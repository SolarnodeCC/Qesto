---
id: ADR-0074
title: Temporary All-Users Free Access (qesto.cc)
status: implemented
date: 2026-09-13
accepted: 2026-09-13
deciders: product-owner, architect, backend, frontend, devops
relates_to:
  - BILL-04
  - ADR-0067-release-train-cadence
  - ADR-0068-workers-ai-gateway-facade
  - ADR-0073-atomic-rate-limiting-workers-api
  - ADR-0045-cross-session-insights
  - BACKLOG_ACTIVE
  - SPEC_PRODUCT
tags:
  - billing
  - entitlements
  - growth
  - cost-control
---

# ADR-0074: Temporary All-Users Free Access (qesto.cc)

## Status

**Implemented** (2026-09-13). Ships with `FREE_ACCESS_ALL = "false"` — the code is
inert until the flag is flipped. Window configured for **2026-12-12**, granting
**`team`**, with a **25 runs/user/month** AI ceiling and disposable-domain
blocking at signup.

## Problem

We want qesto.cc free for everyone for a bounded period, to get people using the
full product and creating accounts. Three constraints shape the solution:

1. **Accounts are the point.** Nothing may be opened to anonymous use.
2. **No Stripe.** No coupons, no card collection, no subscription objects to
   unwind at the end.
3. **It has to end cleanly.** Whatever we turn on must turn off without a data
   migration or a reconciliation exercise.

Entitlement today resolves through one path and four bypasses:

| Layer | Location | Notes |
|---|---|---|
| Stored tier | `schema.sql:19` | `CHECK (plan IN ('free','starter','team'))`, default `free`; written at seven signup sites |
| Request resolution | `middleware/plan.ts` | Memoised per request; already carries a `SUPERUSER_EMAIL → 'team'` override |
| Quota table | `types/plan-quotas.ts` | Two numeric caps + seventeen feature booleans; **also the public pricing catalogue** via `/api/plans/catalog` |
| Enforcement | `lib/entitlements.ts` | `featureAllowed()` / `denyFeature()` across ~15 route files |
| Frontend | `auth/session-routes.ts` | `/api/auth/me` carries the resolved plan into `useAuth` |

**Bypass register** — readers that never see a request context, and which a
change confined to `planMiddleware` would silently miss:

| # | Location | Failure mode if missed |
|---|---|---|
| 1 | `middleware/kv-cache.ts` — `getPlanUsageWithCache` | Own `SELECT plan`, cached 5 min: usage panel lags the flag in both directions |
| 2 | `routes/sessions/shared.ts` — `precomputeInsights` | Background job, hard `plan !== 'team'` return: insights silently never precompute |
| 3 | `lib/session-room-ws-upgrade.ts` | DO reads `meta.plan`, snapshotted at session start |
| 4 | `lib/workspace-trends.ts` | Teams carry their **own** plan in `TEAMS_KV`, created as `free`: cross-session insights stay locked for every team |

## Decision

A **runtime effective-plan override**, gated on an env flag *and* an expiry.
`users.plan` is never written.

`functions/api/lib/free-access.ts` owns two properties:

- **It only ever upgrades.** `effectivePlan()` returns the higher of the stored
  and granted tiers, so a paying `starter` customer is never downgraded during
  the window and reverts to `starter` — not `free` — after it.
- **It expires on its own.** `FREE_ACCESS_ALL === 'true'` is not sufficient;
  `FREE_ACCESS_UNTIL` must also be in the future. A flag left on cannot extend a
  promo that was announced with an end date.

```
FREE_ACCESS_ALL   = "false"                 # kill switch — ships OFF
FREE_ACCESS_UNTIL = "2026-12-12T23:59:59Z"
FREE_ACCESS_TIER  = "team"                  # "team" | "starter"
PROMO_AI_MONTHLY_CAP = "25"                 # "0" disables the ceiling
SIGNUP_BLOCK_DISPOSABLE_DOMAINS = "true"
```

Applied at `planMiddleware` **after** the D1 read (so the stored tier stays
authoritative the moment the flag lapses) and at each of the four bypasses.
Bypass 3 needs no code change — the DO snapshot is taken from `c.get('plan')`,
which is already the effective tier; sessions already live when the flag moves
keep the participant cap they started with.

### Supporting changes

- **`plan_stored`** on the request context and on `/api/plans/:userId/usage`,
  so billing and analytics can still report what an account actually holds while
  everything that *gates* a feature reads the effective `plan`.
- **`free_access`** on `/api/auth/me` and **`promo`** on `/api/plans/catalog` —
  reported *alongside* the tiers, never folded into them, because that payload
  is what the public pricing page renders.
- **`lib/promo-ai-quota.ts`** — an enforced monthly AI ceiling (below).
- **`lib/email-domain.ts`** — disposable-inbox rejection at signup.
- **Password signup gained a rate limiter.** It had none; magic link was
  limited but `/api/auth/password/signup` was open, which does not survive a
  public free window.

### Alternatives rejected

| Option | Why not |
|---|---|
| `UPDATE users SET plan = 'team'` | Destroys the record of what each account holds, so there is no accurate reverse migration; all seven insert sites would need changing, and new signups during the window need a second mechanism anyway |
| Unlock everything in `PLAN_QUOTAS.free` | That table is the public pricing catalogue — the site would advertise a free tier that does not exist after the promo — and it breaks the ~54 tests asserting tier differences, removing the regression net at exactly the wrong moment |
| Stripe 100%-off coupon | Ruled out by the brief; forces card collection plus a live subscription per user to cancel and reconcile at the end |
| A fourth `promo` tier | Needs a D1 `CHECK` migration, a catalogue column, and a `PlanTier` widening that ripples through the DO snapshot and every exhaustive switch — disproportionate for a temporary window |

## Cost control

Granting `team` to everyone lifts `maxSessionsPerMonth` 5 → 500,
`maxParticipantsPerSession` 50 → 5000, team seats 1 → 10, and turns on
`insightsAI`, `liveCopilot`, `liveCaptions`, `embedWidgets`, `verifiableVoting`,
`townhallQA` and `samlSso`.

**There was no server-side monthly AI cap.** `countInsightsThisMonth`
(`billingRepository.ts`) is *reported* by `/api/plans/:userId/usage` and never
enforced; the per-request limiters in the insights routes only shape burst.
Today that is contained because `insightsAI` is `false` on free and starter —
flipping this flag removes the containment for every account at once.

`lib/promo-ai-quota.ts` is the ceiling: 25 insight runs per user per month,
enforced at both generation entry points (`routes/insights.ts` and
`routes/ai-insights/register-analyze.ts`), **only while the window is open** —
outside it, `team` remains unlimited as sold. Read-then-write on KV, the same
pattern as `lib/quota.ts`; two concurrent runs can slip one over the line, which
is acceptable for a cost ceiling measured in tens per month, and it **fails
open** on a KV fault because a cost control must not take AI insights down.

## Consequences

**Positive**

- Rollback is a variable change and a deploy — under a minute, no migration, no
  reconciliation, no Stripe state.
- Billing is untouched. Webhooks keep writing `users.plan` throughout, so
  subscribers are correct the instant the window closes.
- The pricing page keeps telling the truth about what each tier contains.
- The password-signup limiter and the disposable-domain block are permanent
  improvements that outlive the promo.

**Negative**

- Wider cost exposure for the length of the window; the AI ceiling bounds the
  largest component but not DO/WebSocket load from 5000-participant rooms.
- Sessions live at the moment the flag moves keep their original participant cap
  (bypass 3). Acceptable — say it in the announcement.
- **Standing trap: two sources of truth for plan.** Anything added later that
  reads `users.plan` (or a team's stored plan) directly must go through
  `effectivePlan`, or it will silently miss the window. The bypass register
  above is the list as of this ADR.

**Neutral**

- Analytics record the stored tier where they read D1 directly and the effective
  tier where they read request context. `plan_stored` exists so funnel reports
  can choose deliberately.

## Runbook

### Enabling

1. **Ship inert.** Deploy with `FREE_ACCESS_ALL = "false"`. `npm test`,
   `tsc --noEmit`, `npm run check:rc` green. The AI eval gate (REV-10) is not
   triggered: no prompt, model or output schema changed.
2. **Confirm the guardrails.** AI ceiling enforced (`tests/unit/free-access-promo.test.ts`),
   AI Gateway actually engaged rather than falling back to direct `env.AI.run()`
   (`lib/ai/ai-gateway.ts` degrades silently), signup limiters live on both auth
   paths, AE alerts armed on signups/day, sessions/day and AI calls/day.
3. **Rehearse on preview.** Against a real `free` account: `/api/auth/me`
   returns the granted tier plus `free_access.active`; a previously gated route
   returns 200 instead of `feature_not_available`; upgrade CTAs are gone;
   cross-session insights unlock for a team (bypass 4, the one most likely to
   have been missed).
4. **Set the date, then the flag** — `FREE_ACCESS_UNTIL` first, so there is no
   interval where the promo is live without an end date. Deploy.
5. **Watch 24h.** Signups/hour, sessions started, AI calls and Workers AI spend,
   DO connection counts, 5xx rate. Cap numbers are variables, not code.

### Rollback

Set `FREE_ACCESS_ALL = "false"` and deploy. Every account falls back to its
stored `users.plan` on the next request. No migration, no data to repair, no
Stripe state. Live sessions keep the cap they started with, so nobody is
disconnected mid-session.

### Exit

| When | Action | Owner |
|---|---|---|
| T−14 days | Email active hosts; banner becomes a countdown | marketing |
| T−3 days | Second reminder to hosts who ran a session during the window | marketing |
| T−1 day | Restore upgrade CTAs; pricing page back to the real catalogue | frontend |
| T−0 | Window expires on its own; set `FREE_ACCESS_ALL = "false"` and deploy to remove dead config | devops |
| T+7 days | Report: signups, activation, sessions per host, AI spend, paid conversions | analytics |

**Say this in the exit email:** nothing is deleted. Sessions created during the
window stay readable, but the features that produced them — exports, AI
insights, embeds — re-lock to whatever tier the account actually holds. Hosts
who ran sessions above the free cap should export what they want to keep.

## Verification

`tests/unit/free-access-promo.test.ts` (30 cases) covers, in order of how much
damage getting them wrong would do:

1. a paying customer is never downgraded, during or after the window;
2. the window cannot be extended by leaving the flag on (and `'TRUE'`, `'1'`,
   `'yes'` are all off — only the exact string `'true'` enables it);
3. bypasses resolve the effective tier, and a cache write does not outlive a
   rollback;
4. the AI ceiling counts per user, refuses the run past the cap, is inert
   outside the window, and fails open on a KV fault;
5. disposable-domain matching covers subdomains and does not catch free webmail.
