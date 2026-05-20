---
id: PLAN
type: planning
domain: product
category: planning
status: active
version: 1.0
created: 2026-04-01
updated: 2026-05-11
tags:
  - planning
  - sprints
  - implementation
relates_to:
  - BACKLOG_MASTER
  - ROADMAP_FULL
---

# Sprint 26-32 Plan — v2.2 Live Engagement to Enterprise Release

_Created: 2026-05-04._
_Planning basis: Sprint 24 accepted the versioned Durable Object protocol; Sprint 25 added dark-launched LIVE energizer transport._

## Arc Goal

Sprints 26-32 take Qesto from hidden LIVE energizer transport to a controlled v2.2 engagement release, then harden enterprise/admin reporting and rollout quality. The sequence is intentionally gated: each gameplay sprint depends on protocol compatibility, staging WebSocket validation, and observability evidence from the prior sprint.

## Guardrails

- Existing voting, presenter controls, reconnect, pause/resume, and close flows remain the regression baseline.
- No breaking WebSocket protocol change without a new ADR and compatibility test matrix.
- Energizer rollout stays feature-flagged until staging and a11y/i18n checks are green.
- Analytics and exports must use aggregate labels and IDs, not raw prompts, participant text, emails, tokens, SAML material, or Stripe secrets.
- Advanced tournament mechanics wait until the simple LIVE energizer loop proves stable.

## Sprint Summary

| Sprint | Goal | Committed Scope | Gate |
|---|---|---|---|
| Sprint 26 | Staging validation + presenter controls for LIVE energizers | WebSocket staging smoke, Launchpad/presenter activation controls, disabled/flag-off UX, protocol audit events | No participant gameplay until activation is stable in staging |
| Sprint 27 | First playable LIVE energizer: Quick Finger | Participant quick-answer UI, server-side answer validation, score event broadcast, reconnect-safe state | No second energizer until vote flow and Quick Finger can coexist |
| Sprint 28 | Team Quiz LIVE loop | Multi-question quiz progression, presenter advance, participant answer locking, score summary | No leaderboard/badges until quiz scoring evidence is reliable |
| Sprint 29 | Leaderboard + badges foundation | Aggregated score model, live leaderboard broadcast, badge-award hooks, admin metric labels | No advanced competitions until scoring and badge idempotency are proven |
| Sprint 30 | Admin engagement analytics maturity | Engagement funnels, exportable energizer metrics, entitlement/ops correlation, privacy review | No release-candidate posture until dashboards answer support questions |
| Sprint 31 | Enterprise rollout hardening | Role/permission rollout to session and energizer actions, audit UX polish, staging migration check | No broad rollout until permission-deny and audit paths are clear |
| Sprint 32 | v2.2 release candidate | Full regression pass, docs closeout, feature-flag rollout plan, release notes, rollback plan | Release only after full-stack smoke and staging WebSocket validation |

## Sprint 26 — LIVE Energizer Activation Readiness

**Goal:** Prove the Sprint 25 dark-launched protocol works in a production-like path and expose activation controls without enabling public gameplay.

| Item | Size | Epic | Acceptance Signal |
|---|---:|---|---|
| GAM-STAGE-01: Staging WebSocket smoke for v1 protocol + energizer activation | 5 | GAM/QA | Staging validates legacy v1, explicit v1, unsupported version, reconnect, and activation flag-off/on cases. |
| GAM-CTRL-01: Presenter/Launchpad activation controls | 5 | GAM/UX | Presenter can see eligible energizers and trigger activation only when `LIVE_ENERGIZERS_ENABLED=true`. |
| GAM-CTRL-02: Disabled and permission-denied UX | 3 | GAM/I18N | Flag-off, non-presenter, and invalid-state messages are localized and accessible. |
| OBS-GAM-01: Protocol audit/metrics events | 3 | OPS | Activation attempts, flag denials, and protocol denials emit sanitized event labels. |

**Deferrals:** Participant gameplay, score tracking, badges.

## Sprint 27 — Quick Finger LIVE Gameplay

**Goal:** Ship the first playable LIVE energizer behind the feature flag while preserving the normal voting loop.

| Item | Size | Epic | Acceptance Signal |
|---|---:|---|---|
| GAM-QF-01: Participant quick-answer UI | 8 | GAM/UX | Participants receive active Quick Finger state and can submit one answer with keyboard/touch. |
| GAM-QF-02: Server-side answer validation + result broadcast | 8 | GAM/REALTIME | DO validates answer IDs, records first correct answer timing, and broadcasts sanitized score deltas. |
| GAM-QF-03: Reconnect-safe energizer state | 5 | GAM/REALTIME | Reconnecting clients receive active question, locked answer state, and current score summary. |
| GAM-QF-QA-01: Compatibility regression tests | 5 | QA | Existing vote/presenter tests stay green alongside Quick Finger activation and answer tests. |

**Deferrals:** Team Quiz, leaderboard persistence, badges.

## Sprint 28 — Team Quiz LIVE Loop

**Goal:** Add a multi-question LIVE energizer loop with controlled presenter progression.

| Item | Size | Epic | Acceptance Signal |
|---|---:|---|---|
| GAM-TQ-01: Team Quiz state machine | 8 | GAM/REALTIME | DO tracks quiz index, answer windows, locked submissions, and completion state. |
| GAM-TQ-02: Presenter quiz controls | 5 | GAM/UX | Presenter can advance quiz questions and close the energizer without closing the session. |
| GAM-TQ-03: Participant answer flow | 5 | GAM/UX | Participants see current quiz question, submit once, and receive clear locked/late states. |
| GAM-TQ-QA-01: Multi-question reconnect tests | 5 | QA | Reconnect at start/middle/end of quiz restores the correct snapshot. |

**Deferrals:** Tournament mechanics and advanced competitions.

## Sprint 29 — Leaderboard + Badge Foundation

**Goal:** Convert simple energizer outcomes into reusable scoring and recognition primitives.

| Item | Size | Epic | Acceptance Signal |
|---|---:|---|---|
| GAM-SCORE-01: Aggregated score model | 8 | GAM/DATA | Per-session energizer scores are idempotent and queryable without storing participant text. |
| GAM-LB-01: Live leaderboard broadcast | 5 | GAM/REALTIME | Leaderboard updates are versioned, bounded, and do not leak participant PII. |
| GAM-BADGE-01: Badge-award hooks | 5 | GAM | First-answer, speedster, perfect-trivia, and engagement badges award once per eligible event. |
| GAM-QA-02: Score/badge idempotency tests | 5 | QA | Duplicate messages/reconnects cannot double-award score or badges. |

**Deferrals:** Battle royale, bracket tournaments, referral mechanics.

## Sprint 30 — Resilience P0 + Analytics Observability

**Goal:** Eliminate GDPR-risk PII leaks, add production-grade error containment, and wire the observability events analytics depends on. ADMIN-ENGAGE-01/02 shipped in the v2.2 RC branch (Sprint 29 closeout); removed from scope.

**Window:** 2026-05-27 to 2026-06-10
**Release posture:** No LIVE energizer flag-on until PRIVACY-GAM-01 passes. No v2.2 RC posture until RES-PII-01 CI gate is merged.

| Item | Size | Epic | Pri | Acceptance Signal |
|---|---:|---|---|---|
| ADMIN-OPS-02: Realtime health correlation | 5 | OPS | P1 | Admin can compare energizer activity with WebSocket capacity, reconnect, and error signals via `/api/admin/ops/summary` time-series view. |
| PRIVACY-GAM-01: Engagement analytics privacy review | 3 | SEC | P0 | Tests confirm no PII in analytics/export payloads; energizer events verified with sanitized labels only. |
| RES-PII-01: PII call site replacement + CI gate | 5 | SEC | P0 | ~24 raw `console.error(err)` call sites replaced with `safeLogContext()`; CI grep gate blocks new violations; ADR-0009 compliance test added. `safeLogContext()` exists in `lib/log.ts` — this is call-site work, not greenfield. |
| RES-TIMEOUT-01: Workers AI AbortController (25s) | 5 | OPS | P0 | `ai-insights.ts:140` and `:244` wrapped in `AbortController` with 25s timeout; test confirms timeout fires and returns graceful error. |
| RES-D1-01: admin middleware D1 safe fallback | 3 | OPS | P0 | `middleware/admin.ts` D1 query catches transient failures and denies access (not 500); plan middleware pattern already done — match it. |
| RES-RETRY-01: Shared `invokeAIWithRetry()` for insights | 3 | OPS | P1 | Insights route uses same retry wrapper as wizard (200ms/400ms backoff, 3 attempts, then 503). |
| RES-ERR-01: Verify `sanitizeError()` wiring | 1 | SEC | P0 | Confirm `app.ts:101` wiring is complete; add any missing 5xx paths; no raw `err.message` or stack traces reach client. `sanitizeError` already wired — verify completeness only. |
| OBS-VOTE-01: `vote.submitted` AE event in SessionRoom | 3 | OPS | P0 | `ws.vote_submitted` event with `durationMs` (DO storage round-trip), `teamId`, `plan` emitted from `SessionRoom.webSocketMessage` vote branch. Required for Sprint 32 PERF-PROOF-01 latency benchmark. |
| OBS-ENERGIZER-FIX-01: Add `teamId`+`plan` to `emitEnergizerMetric()` | 2 | OPS | P1 | All energizer AE events gain `teamId` and `plan` fields; plan-segmentation AQL queries become valid. |

**Note:** ADMIN-ENGAGE-01 (energizer funnel) and ADMIN-ENGAGE-02 (exportable metrics CSV) are already shipped in `src/components/admin/AdminAnalyticsTab.tsx`. No Sprint 30 action required.

**Total committed: ~30 pts**

**Deferrals:** Circuit breakers (Sprint 31), integration library (Sprint 31), new feature routes.

**Quality gates:**
- `npm test` (717+ tests green)
- `npm run typecheck` (0 errors)
- `npm run check:i18n`
- `npm run check:tokens-drift`
- CI grep gate for PII sanitization (RES-PII-01 gate enforced)

## Sprint 31 — Enterprise Hardening + Circuit Breakers + Integration Foundation

**Goal:** Apply enterprise controls to the realtime surface, arm the resilience circuit-breaker layer (ADR-0007 lib exists but zero call sites in production), and build the integration provider foundation (ADR-0008 — token encryption is currently plaintext TODO at `lib/integrations/token-store.ts:53`).

**Window:** 2026-06-10 to 2026-06-24
**Release posture:** v2.2 prep. LIVE energizers stay behind flag. No broad rollout until permission-deny + audit paths are clear.

**Pre-condition gate:** ADR-0010 (zero-knowledge mode) must be accepted before ANON-DEPTH-01 implementation starts. ADR-0007 amendment (CircuitBreaker.INTEGRATIONS) must be accepted before CB-01 wiring.

**DevOps provisioning required (before CB-01/CB-02 merge):**
- `wrangler kv namespace create CIRCUIT_BREAKER_KV` (production)
- `wrangler kv namespace create INTEGRATIONS_KV` (production)
- `wrangler pages secret put OAUTH_TOKEN_MEK` (prod + staging) — AES-GCM master encryption key

| Item | Size | Epic | Pri | Acceptance Signal |
|---|---:|---|---|---|
| AUTHZ-GAM-01: Permission gate for energizer activation | 5 | ENT/AUTH | P0 | Custom roles can allow/deny energizer activation separately from session:launch; audit event fires. |
| AUDIT-GAM-01: Audit UX polish for realtime actions | 5 | ENT/OPS | P1 | Audit viewer clearly distinguishes activation, answer-window changes, completion, and denials. |
| DEPLOY-GAM-01: Staging migration/flag checklist | 3 | OPS | P0 | Staging checklist covers D1/KV compatibility, flag state, rollback, and WebSocket smoke. |
| QA-ENT-02: Enterprise permission regression bundle | 5 | QA | P0 | Owner/admin/member/custom-role allow/deny paths cover session + energizer actions. |
| ADR-0010: Zero-knowledge anonymity mode ADR | 3 | ARCH | P0 | ADR defines voter dedup without PII, session config options, UI trust indicators, and DO protocol impact; accepted before ANON-DEPTH-01 starts. |
| CB-01: Wire CircuitBreaker into Stripe + Resend | 8 | OPS | P0 | `initCircuitBreakers()` called in `app.ts createApp()`; `billing.ts:36/59` raw Stripe fetch wrapped; `email.ts:22` Resend fetch wrapped; state machine: 5 failures in 60s → OPEN; Stripe 5s timeout, Resend 5s timeout; CIRCUIT_BREAKER_KV provisioned in production. |
| CB-02: Wire CircuitBreaker for Workers AI + JWKS | 5 | OPS | P0 | Workers AI 10s timeout, 3 failures in 60s → OPEN; JWKS 5s, 3/30s; graceful degrade (free plan on JWKS OPEN). |
| INT-PROVIDER-01: Integration provider library with real encryption | 9 | INT | P0 | `EncryptedTokenStore` uses AES-GCM with `OAUTH_TOKEN_MEK` (not plaintext — fixes TODO at `token-store.ts:53`); `IntegrationHttpClient` timeout bug fixed (inverted logic at `http-client.ts:80`); `OAuth2Client` typed; `webhook-verify` HMAC tested; all downstream providers extend typed interface. |
| ANON-DEPTH-01: Zero-knowledge mode session config + trust indicator | 8 | UX | P1 | Session config shows anonymity level selector (none/standard/zero-knowledge); participant-visible trust badge; i18n in 5 locales validated. Gate: ADR-0010 accepted. |

**Total committed: ~51 pts** | **Stretch (if ADR-0010 slips):** Defer ANON-DEPTH-01 to Sprint 32 stretch.

**Quality gates (adds to Sprint 30 baseline):**
- Staging WebSocket smoke (energizer LIVE path)
- 16+ enterprise permission integration tests green
- Circuit breaker unit tests: state transitions, KV sync, graceful fallback
- Token encryption round-trip test: encrypt → store → retrieve → decrypt in staging

**Deferrals:** Specific integration providers (Slack in Sprint 33), compliance evidence (Sprint 33-34), billing UI changes.

## Sprint 32 — v2.2 Release Candidate + Code Quality + Export Foundation

**Goal:** Freeze the v2.2 release candidate with documentation, rollout, and rollback readiness. Add CODE-SPLIT-01 (reducing sessions.ts 81KB risk) and EXPORT-RICH-01-A (partial commercial promise fulfillment). Slack integration moved to Sprint 33 — combining RC with a new integration was too high risk (PO decision).

**Window:** 2026-06-24 to 2026-07-08
**Release posture:** v2.2 ships this sprint.

| Item | Size | Epic | Pri | Acceptance Signal |
|---|---:|---|---|---|
| RC-REGRESSION-01: Full regression pass | 8 | QA | P0 | Unit, a11y, typecheck, i18n, token drift, build, full-stack smoke all green (target: 840+ tests) or documented with accepted exceptions. |
| RC-DOCS-01: Spec + runbook closeout | 5 | DOCS | P0 | `SPEC_REALTIME`, `SPEC_BACKEND`, `SPEC_FRONTEND`, roadmap, backlog, and release notes reflect shipped behavior. |
| RC-ROLLOUT-01: Feature-flag rollout plan (LIVE energizers) | 3 | OPS | P0 | Rollout steps, cohorts, metrics watched, rollback trigger, and owner defined. |
| RC-OBS-01: Release health dashboard checklist | 3 | OPS | P0 | Admin surfaces: active sessions, reconnects, errors, activation rate, participation, completion. |
| CODE-SPLIT-01: Split sessions.routes.ts (81KB) into subrouters | 5 | DX | P1 | DRAFT-state routes, LIVE-state routes, session lifecycle routes in separate files under `routes/sessions/`; existing 717+ tests stay green; no behavior change. |
| EXPORT-RICH-01-A: Structured JSON + enhanced CSV export | 8 | ENT | P1 | `GET /api/sessions/:id/export.json` returns full session structure; CSV includes question text, response labels, timing metadata; plan-gated; CSRF + auth security controls in place. |
| PERF-PROOF-01: AE latency benchmark data capture | 3 | OPS | P1 | AQL query on `qesto_metrics` produces p50/p95/p99 latency data from `vote.submitted` events (requires OBS-VOTE-01 from Sprint 30 to have 30+ days of data). |

**Total committed: ~35 pts**

**Stretch (do not start until RC gates green):**
- ANON-DEPTH-01 (8 pts) — if deferred from Sprint 31
- NOTION-01: Notion export (5 pts)

**v2.2 Release Gate:**
- All RC items green
- Staging WebSocket validation passes (LIVE energizers on + off)
- CODE-SPLIT-01: zero test regressions
- EXPORT-RICH-01-A: CSRF headers verified, plan gate tested
- 0 new P0 regressions

**Detailed Plan (Sprints 33-34):** See [`SPRINT33_34_PLAN.md`](./SPRINT33_34_PLAN.md).

## Cross-Sprint Verification

- `npm run typecheck`
- `npm run check:i18n`
- `npm run check:tokens-drift`
- `npm run check:baseline`
- `npm test`
- `npm run test:a11y`
- `npm run build`
- Staging WebSocket smoke for every sprint that touches `SessionRoom`

## Out Of Scope For Sprints 26-32

- Battle royale and bracket tournament public rollout.
- Mobile app work.
- External AI provider integration.
- Broad redesign of dashboard or marketing pages.
- Billing/pricing changes unrelated to energizer entitlement evidence.
- Slack/Teams integration providers (Sprint 33).
- PDF export (Sprint 33).
- Compliance evidence packs (Sprint 33-34).
- AI sentiment inference (Sprint 34 — requires ADR-0011 accepted first).
- EU residency documentation (Sprint 34).

## New ADRs Required (Sprints 30-32)

| ADR | Title | Required Before | Sprint |
|---|---|---|---|
| ADR-0007 amendment | Clarify `CircuitBreaker.INTEGRATIONS` scope | CB-01 wiring | 31 |
| ADR-0010 | Zero-knowledge anonymity mode | ANON-DEPTH-01 | 31 |

**Continued in Sprint 33-34:** ADR-0011 (live sentiment inference) required before AI-SENTIMENT-01 in Sprint 34.
