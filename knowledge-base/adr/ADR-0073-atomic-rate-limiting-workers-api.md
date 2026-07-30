---
id: ADR-0073
title: Atomic Rate Limiting via Workers Rate Limiting API
status: proposed
date: 2026-07-30
deciders: architect, backend, devops, security
relates_to:
  - SEC-APIKEY-LIMITER-ATOMIC-01
  - SEC-RATELIMIT-01
  - ADR-0001-do-per-session
  - ADR-042-cloudflare-capability-expansion
  - ADR-0050-embeddable-sdk-auth-widget-origin-sandboxing
  - ADR0073_ATOMIC_RL_WORKSTREAMS
  - RATE_LIMIT_BINDINGS_SETUP
  - BACKLOG_ACTIVE
tags:
  - security
  - infrastructure
  - rate-limiting
  - cloudflare
---

# ADR-0073: Atomic Rate Limiting via Workers Rate Limiting API

## Status

**Proposed** (2026-07-30). Architecture + ops plan only — no production code change in this ADR.

**Build organisation:** [[ADR0073_ATOMIC_RL_WORKSTREAMS]] — six workstreams (WS-0…WS-5), two-train capacity split, file ownership, and do-not-co-land rules. Promote stories from that doc into [[BACKLOG_ACTIVE]] train tables when PO commits capacity.

## Problem

Qesto’s HTTP rate limits are **KV read-then-write counters** (`ACTIONS_KV` / `INTEGRATIONS_KV`):

| Surface | Location | Window | Failure mode under burst |
|---|---|---|---|
| Public API key (120/min) | `middleware/public-api-auth.ts` | 60s | TOCTOU — concurrent isolates read same count, all pass (`SEC-APIKEY-LIMITER-ATOMIC-01`) |
| Route middleware (auth/join/admin/…) | `middleware/rate-limit.ts` | 60–3600s | Same race + eventual consistency across edges |
| Lib helper (AI, magic-link, embed, deliberate) | `lib/rate-limit.ts` | 60–3600s | Same; documented as “acceptable for magic-link” |
| Webhook egress | `lib/webhook-rate-limit.ts` | 60s | Same |
| SessionRoom WS | `lib/session-room-rate-limiter.ts` | in-DO | **Already single-threaded / atomic** — out of scope |

KV cannot provide atomic increment. Under concurrent burst at one colo, N isolates can each observe `count < limit` and each write `count+1`, so the true request volume exceeds the configured budget by roughly the concurrency factor. That is soft-quota behaviour, not a hard abuse boundary.

A 20-line swap of `kv.put` → something else does **not** fix this: limits are binding-configured, windows that are not `{10,60}` seconds do not map 1:1, headers/remaining semantics change, local/test mocks differ, and ops must own `namespace_id` registries across prod/preview/staging.

## Decision drivers

1. **Burst correctness** for ≤60s abuse shields (API keys, embed read plane, join, webhooks).
2. **Preserve long-window quotas** (AI 10/h, auth 5/10min, admin destructive 10/600s) — product intent, not an accident.
3. **No new third-party services**; stay on Cloudflare platform.
4. **Rollback** via feature flag without redeploying bindings out of existence.
5. **Observability** — AE events already exist (`rate_limit.hit`); extend, do not invent a parallel system.
6. Honest accuracy: Workers Rate Limiting is **colo-local and permissive**, not a global ledger.

## Options considered

### A — Keep KV (status quo)

- **Pro:** Zero infra change; soft quota already accepted for `SEC-APIKEY-LIMITER-ATOMIC-01`.
- **Con:** Burst bypass remains; KV 1 write/s/key amplifies under load; fail-open on KV errors bypasses entirely unless `RATE_LIMIT_FAIL_CLOSED`.

### B — Durable Object counter (global-ish atomic)

- **Pro:** Strong single-key serialization; arbitrary windows; accurate remaining counts.
- **Con:** Extra DO class + routing latency + cost; overkill for IP/key burst shields; new failure domain; conflicts with “keep Workers thin” unless scoped tightly (e.g. auth only).

### C — Zone WAF / Rate Limiting Rules (ADR-042 §1.2)

- **Pro:** Blocks before Worker CPU; good for volumetric auth/WS floods.
- **Con:** Coarse (path/IP); cannot key on API key id or embed `wid`; does not replace app-layer budgets; separate ops surface (dashboard rulesets).

### D — Workers Rate Limiting API (`ratelimits` binding) — **chosen as L1**

- **Pro:** GA (2025-09); colo-local cached counters; `limit({ key })` is fast (no network RTT); designed for exactly this abuse pattern; declarative budgets in `wrangler.toml`.
- **Con:** `simple.period` ∈ `{10, 60}` only; limit is **binding-static** (one budget per binding); returns only `{ success }` (no remaining/reset); **per-colo**, not global; intentionally permissive under extreme same-colo fan-in; no dashboard visibility (AE/logs only).

### E — Hybrid layers (recommended)

Combine D (L1 burst) + A (L2 long-window soft quota) + existing DO SessionRoom limiter (L3) + optional C (L0 edge).

## Recommendation

**Adopt Option E — layered rate limiting**, with Workers Rate Limiting as the primary L1 implementation for every budget that already fits a 10s or 60s window.

```
L0  Zone WAF / CF Rate Limiting rules   (optional; ADR-042 §1.2 — volumetric)
L1  Workers Rate Limiting binding       (burst / ≤60s — this ADR)
L2  KV soft quota                       (long windows; dual-check with L1 where needed)
L3  SessionRoom DO RateLimiter          (WS votes/connect — unchanged, ADR-0001)
```

**Do not** attempt a wholesale “delete KV limiter” rewrite. Map surfaces by fitness:

| Fitness | Criterion | Backend |
|---|---|---|
| **Tier A — migrate to L1** | Window is 10 or 60s; limit is a fixed integer; key is stable (apiKeyId, wid+origin, teamId, hashed IP) | `env.RL_*.limit({ key })` |
| **Tier B — dual-layer** | Product window > 60s (auth 5/600, AI 10/3600, admin 10/600) | L1 burst shield (derived 10/60 budget) **and** L2 KV sustained quota |
| **Tier C — leave alone** | Session-scoped WS token buckets | DO `RateLimiter` |

Trade-off accepted: L1 is **colo-local**. A sophisticated attacker fanning traffic across many Cloudflare locations can still exceed a single-colo budget in aggregate. That is still a strict improvement over KV TOCTOU at the hot colo, and L0 WAF + L2 KV remain available for residual risk. True global atomicity stays reserved for DO (Tier C / future auth DO only if abuse evidence warrants).

## Platform constraints (must design around)

From [Workers Rate Limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/):

1. **`simple.period` must be `10` or `60`** — no 600s / 3600s bindings.
2. **Budget is compile-time** — different limits ⇒ different `[[ratelimits]]` bindings (or plan-tier pairs like FREE vs PAID).
3. **`namespace_id`** is an account-unique positive integer string (`"1001"`); must be registered and non-colliding across Workers in the account.
4. **API shape:** `const { success } = await env.RL.limit({ key: string })` — approximate `X-RateLimit-*` / `Retry-After` (use configured period; do not claim exact remaining).
5. **Locality:** counters are per Cloudflare location.
6. **Accuracy:** eventually consistent / permissive within a colo — not billing-grade accounting.
7. **Monitoring:** no CF dashboard for binding hits — emit AE + structured logs.

## Binding registry (proposed)

Account-unique `namespace_id` values — **reserve the block `1001–1099` for Qesto API Worker** (`qesto-api`). Document in ops runbook; never reuse IDs across environments with different limits (use distinct IDs for prod vs preview if limits diverge).

| Wrangler binding | `namespace_id` | `simple.limit` | `period` | Key material | Replaces |
|---|---:|---:|---:|---|---|
| `RL_API_KEY` | 1001 | 120 | 60 | `apiKey:{id}` | `public-api-auth.ts` KV counter |
| `RL_EMBED_READ` | 1002 | 120 | 60 | `embed:{wid}:{origin}` | widget-token EMBED_READ_RATE |
| `RL_EMBED_HANDSHAKE` | 1003 | 30 | 60 | `embed-hs:{wid}:{origin}` | EMBED_HANDSHAKE_RATE |
| `RL_JOIN` | 1004 | 20 | 60 | `join:{ipHash}` | middleware `join` 20/60 |
| `RL_PUBLIC_EVENT` | 1005 | 60 | 60 | `event:{ipHash}` | agenda/feed 60/60 |
| `RL_WEBHOOK` | 1006 | 100 | 60 | `webhook:{teamId}` | webhook-rate-limit.ts |
| `RL_AUTH_BURST` | 1007 | 5 | 60 | `auth:{ipHash}` / `auth:{email}` | L1 for auth (Tier B) |
| `RL_REPORT_BURST` | 1008 | 5 | 60 | `report:{ipHash}` | L1 for DSA report (Tier B) |
| `RL_KB_SEARCH` | 1009 | *(confirm current)* | 60 | `kb:{ipHash}` | middleware `kb-search` if ≤60s |
| `RL_ADMIN_AUDIT_Q` | 1010 | 120 | 60 | `audit:{ipHash}` | admin-audit query 120/60 |

**Not in binding table (Tier B L2-only or dual):** AI insights/coaching/wizard (`10/3600`), session-create (`30/3600`), admin-destructive (`10/600`), audit CSV export (`10/3600`), magic-link email sustained (`5/600` after L1 burst).

Plan-tier differentiation (future): add `RL_API_KEY_PAID` with higher limit + select binding in middleware from team plan — same pattern as CF docs FREE/PAID example. Out of v1 scope.

### Wrangler sketch

```toml
[[ratelimits]]
name = "RL_API_KEY"
namespace_id = "1001"
[ratelimits.simple]
limit = 120
period = 60

# …repeat per row above (prod + mirrored under [env.preview] / [env.staging])
```

`Env` gains optional bindings:

```typescript
RL_API_KEY?: RateLimit
RL_EMBED_READ?: RateLimit
// …
```

Where `RateLimit` is `{ limit(opts: { key: string }): Promise<{ success: boolean }> }`.

## Application design

### Facade (single choke point)

Introduce `functions/api/lib/atomic-rate-limit.ts` (name illustrative):

```typescript
type AtomicLimitResult = {
  allowed: boolean
  backend: 'workers_rl' | 'kv' | 'bypass'
  retryAfterSec: number
  /** Best-effort; omit or approximate when backend === 'workers_rl' */
  remaining?: number
}

async function atomicLimit(env, profile: RateLimitProfile, key: string): Promise<AtomicLimitResult>
```

- **Profiles** are a typed registry (not scattered literals) mapping to binding name + optional KV fallback profile.
- **Feature flag** `ATOMIC_RATE_LIMIT_ENABLED` (default off until canary): when off → existing KV path only.
- **Missing binding** (local/bootstrap): behave like today’s unbound KV — allow, or fail-closed if `RATE_LIMIT_FAIL_CLOSED`.
- **Middleware** (`middleware/rate-limit.ts`) and **lib** (`lib/rate-limit.ts`) call the facade; do not fork two semantics.

### Response contract

Keep HTTP 429 envelope (`rate_limited` / existing codes). Headers:

| Header | Behaviour with Workers RL |
|---|---|
| `Retry-After` | Set to binding `period` (or remaining seconds in window if we track wall-clock locally) |
| `X-RateLimit-Limit` | Configured `simple.limit` |
| `X-RateLimit-Remaining` | Optional: omit, or emit `0` on deny / `limit` on allow (document as non-authoritative) |
| `X-RateLimit-Reset` | `now + period` approximation |

Do not invent fake remaining counts from KV when L1 is authoritative.

### Keying guidance (security)

- Prefer **stable actor ids**: API key id, team id, user sub, embed `wid`+origin.
- Hashed `cf-connecting-ip` remains acceptable for anonymous surfaces (join, report) — CF docs discourage raw IP for *user fairness*; for **abuse shields** IP hash is still correct (matches today’s SEC M-6 posture). Document the deliberate exception in the facade.
- Never use client-supplied `X-Forwarded-For` (already enforced).

## Implementation phases → workstreams

Phases map 1:1 onto build workstreams in [[ADR0073_ATOMIC_RL_WORKSTREAMS]]. Prefer that doc for story IDs, pts, file ownership, and train slicing.

| Phase | Workstream | Story IDs | Pts |
|------:|------------|-----------|----:|
| 0 | WS-0 Plan freeze | `SEC-RL-ATOMIC-ADR-01` | 3 |
| 1 | WS-1 Foundation | `SEC-RL-ATOMIC-BINDINGS-01` + `SEC-RL-ATOMIC-FACADE-01` | 8 |
| 1b | WS-1b Observability | `SEC-RL-ATOMIC-OBS-01` | 3 |
| 2 | WS-2 API-key canary | `SEC-APIKEY-LIMITER-ATOMIC-01` | 5 |
| 3 | WS-3 Tier A migrate | `SEC-RL-ATOMIC-TIER-A-01` | 8 |
| 4 | WS-4 Tier B dual-layer | `SEC-RL-ATOMIC-TIER-B-01` | 5 |
| 5 | WS-5 Cleanup (+ optional L0) | `SEC-RL-ATOMIC-CLEANUP-01` (+ `SEC-RL-ATOMIC-L0-WAF-01`) | 3 (+5) |

**Train A (~19 pts):** WS-0 → WS-1 → (WS-1b ∥ WS-2). **Train B (~13–21 pts):** WS-3 → WS-4 → WS-5. **Do not co-land WS-3 with WS-4.**

## Ops plan

See [[RATE_LIMIT_BINDINGS_SETUP]] (`knowledge-base/operations/deployment/RATE_LIMIT_BINDINGS_SETUP.md`).

Checklist summary:

1. Reserve `namespace_id` 1001–1099 in account runbook (wiki table + this ADR).
2. Deploy wrangler with bindings **before** flipping the flag (bindings are inert until code calls them).
3. Mirror bindings on preview/staging with **same IDs** if limits match; **different IDs** if staging uses looser limits (avoid prod/staging counter bleed — counters are account+namespace scoped per CF design; keep IDs unique per logical limiter).
4. Feature flag rollout: staging → 5% canary (API key routes) → full Tier A → Tier B.
5. Rollback: set `ATOMIC_RATE_LIMIT_ENABLED=false` (secret/var); no binding deletion required.
6. Alerting: AE query on `rate_limit.hit` spike + `rate_limit.kv_failure` / binding errors; Workers Observability filter `status=429`.

## Observability contract

Extend existing events (do not rename):

| Event | When | Blobs / fields |
|---|---|---|
| `rate_limit.hit` | deny | `backend=workers_rl\|kv`, `profile=<name>`, actor hash (no raw PII) |
| `rate_limit.backend_fallback` | L1 missing → L2 | profile |
| `rate_limit.kv_failure` | existing | keep; fail-closed via `RATE_LIMIT_FAIL_CLOSED` |

## Testing strategy

| Layer | Approach |
|---|---|
| Unit | Fake `RateLimit` binding returning scripted `{ success }` sequences; prove middleware 429 + headers |
| Contract | Existing suites retargeted through facade (`tests/unit/rate-limit*.ts`, `embed-rate-limit`, `webhook-rate-limit`) |
| Burst / stress | Scripted parallel fetch against preview; assert observed allows ≤ `limit × colo_factor` (document colo_factor ≈ 1 for single-region canary) |
| Local | Binding may be unsupported in `--local`; facade must bypass or mock — never crash bootstrap |

## What this ADR does **not** decide

- Replacing SessionRoom DO rate limiting (already correct).
- Billing-accurate metering (use Analytics Engine / Stripe metered elsewhere).
- Global single-counter semantics (would require DO — reopen only with abuse evidence).
- Changing product quotas (5/600 auth stays product intent via Tier B).

## Success criteria

1. Tier A surfaces no longer use KV read-modify-write for the allow/deny decision.
2. Under synthetic burst (≥50 concurrent) against one API key on one colo, observed accepts ≤ 120/min ± documented permissive slack.
3. Flag-off rollback restores prior behaviour in < 5 minutes (config only).
4. `SEC-APIKEY-LIMITER-ATOMIC-01` closed or reclassified “remediated via ADR-0073 Phase 2”.
5. No increase in false-positive 429 rate on join/embed happy-path canaries.

## Conflict resolution

| Conflict | Resolution |
|---|---|
| Backend wants one binding + runtime limit param | **Rejected** — CF API does not support; multiple bindings |
| Product wants 10/hour on Workers RL alone | **Rejected** — use Tier B dual-layer |
| DevOps worries namespace_id collisions | Registry in runbook; architect owns ID allocation |
| Security wants global atomic auth | Escalate to optional auth DO **only** if L0+L1+L2 insufficient under measured abuse |
| Accuracy of `X-RateLimit-Remaining` | Prefer omit/approximate; do not lie with KV leftovers |

## References

- Cloudflare Workers Rate Limiting (GA): https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
- Changelog GA 2025-09-19: https://developers.cloudflare.com/changelog/post/2025-09-19-ratelimit-workers-ga/
- [[SEC-APIKEY-LIMITER-ATOMIC-01]] in [[SECURITY_AUDIT_BACKLOG]]
- [[ADR-042-cloudflare-capability-expansion]] §1.2 (L0 WAF)
- [[ADR-0001-do-per-session]] (L3 DO limiter)
- Current code: `functions/api/lib/rate-limit.ts`, `middleware/rate-limit.ts`, `middleware/public-api-auth.ts`
