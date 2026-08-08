---
id: ADR0073_ATOMIC_RL_WORKSTREAMS
type: planning
domain: product
category: planning
status: active
version: 1.0
created: 2026-07-30
updated: 2026-07-30
tags:
  - rate-limiting
  - workstreams
  - security
  - release-train
relates_to:
  - ADR-0073-atomic-rate-limiting-workers-api
  - RATE_LIMIT_BINDINGS_SETUP
  - BACKLOG_ACTIVE
  - SEC-APIKEY-LIMITER-ATOMIC-01
  - HANDOFFS
---

# ADR-0073 — Build Workstreams (Atomic Rate Limiting)

_Build organisation for [[ADR-0073-atomic-rate-limiting-workers-api]]. Planning truth for promotion: [[BACKLOG_ACTIVE]]. Ops registry: [[RATE_LIMIT_BINDINGS_SETUP]]._

**Mode:** conditional P2 until PO promotes into a release train. **Do not start code** until ADR status → Accepted (or PO explicit override for WS-1 infra-only).

**Capacity fit:** ~32 pts total across **two trains** (recommended). Stories ≤ 13 pts. One story ID per PR where possible.

```
WS-0 Plan ──► WS-1 Foundation ──┬──► WS-2 Canary (API key) ──► WS-3 Tier A ──► WS-4 Tier B ──► WS-5 Cleanup
                                └──► WS-1b Observability (parallel after WS-1)
```

**Hard do-not-co-land:** WS-3 ✗ WS-4 in the same merge train window (different failure modes; separate rollback evidence).

---

## Workstream map

| WS | Name | Lead agent | Support | Pts | Depends | Train slice |
|----|------|------------|---------|----:|---------|-------------|
| **WS-0** | Plan freeze | architect | PO, security | 3 | — | Train A (done / in PR) |
| **WS-1** | Bindings + facade | devops + backend | architect (E12) | 8 | WS-0 accept | Train A |
| **WS-1b** | Observability + burst harness | devops + analytics | tester | 3 | WS-1 | Train A (parallel) |
| **WS-2** | API-key canary | backend | security (E10) | 5 | WS-1 | Train A |
| **WS-3** | Tier A migrate | backend | security, tester | 8 | WS-2 green | Train B |
| **WS-4** | Tier B dual-layer | backend | security | 5 | WS-3 | Train B |
| **WS-5** | Cleanup + optional L0 | backend + devops | knowledge | 3+5 | WS-4 | Train B or C |

**Train A (~19 pts):** WS-0 + WS-1 + WS-1b + WS-2  
**Train B (~13–21 pts):** WS-3 + WS-4 + WS-5 (split L0 WAF to Train C if capacity tight)

---

## File ownership (collision avoidance)

| Path / area | WS owner | Notes |
|-------------|----------|-------|
| `wrangler.toml` `[[ratelimits]]` + env mirrors | **WS-1** devops | No other WS edits limits without registry PR |
| `functions/api/types/env.ts` (`RL_*`, flag) | **WS-1** backend | |
| `functions/api/lib/atomic-rate-limit.ts` (new) | **WS-1** backend | Single facade; all later WS call this |
| `functions/api/lib/flags.ts` / feature-flag tests | **WS-1** | `ATOMIC_RATE_LIMIT_ENABLED` |
| `functions/api/middleware/public-api-auth.ts` | **WS-2** only | Canary surface |
| `functions/api/middleware/rate-limit.ts` | **WS-3** | join / public-event / admin-audit profiles |
| `functions/api/middleware/widget-token.ts` | **WS-3** | embed read + handshake |
| `functions/api/lib/webhook-rate-limit.ts` | **WS-3** | |
| `functions/api/lib/rate-limit.ts` + auth/AI callers | **WS-4** | Dual-layer; leave Tier A callers alone after WS-3 |
| `functions/api/SessionRoom*` / `session-room-rate-limiter.ts` | **None** | Explicitly out of scope |
| AE queries / dashboards / k6 or burst script | **WS-1b** | |
| Zone WAF rules (dashboard) | **WS-5** devops | ADR-042 §1.2; optional |
| KB ADR / SPEC / security closeout | **WS-5** knowledge | |

---

## WS-0 — Plan freeze

| Field | Value |
|-------|-------|
| **Story** | `SEC-RL-ATOMIC-ADR-01` |
| **Pts** | 3 |
| **Status** | **Done** (2026-07-30) — [[ADR0073_WS0_WS1_EVIDENCE]] |
| **Agents** | architect → PO (accept) → security (ack) |
| **Handoffs** | E4 architect→backend/devops; E12 binding spec→devops |

**Done when**

- [x] ADR-0073 proposed with layered model + binding registry
- [x] [[RATE_LIMIT_BINDINGS_SETUP]] published
- [x] ADR status → **Accepted** (PO + architect + security)
- [x] Stories promoted into `BACKLOG_ACTIVE` RT-02 addendum (Train A)

---

## WS-1 — Foundation (bindings + facade)

| Field | Value |
|-------|-------|
| **Stories** | `SEC-RL-ATOMIC-BINDINGS-01` (3) + `SEC-RL-ATOMIC-FACADE-01` (5) = **8** |
| **Status** | **Done** (2026-07-30) — [[ADR0073_WS0_WS1_EVIDENCE]] |
| **Agents** | devops (bindings), backend (facade), architect (review Env) |
| **Handoffs** | E12 → devops; E5 backend→devops; E9 tester gate |

### `SEC-RL-ATOMIC-BINDINGS-01` (devops, 3 pts)

**Build**

1. Add `[[ratelimits]]` for registry IDs **1001–1010** in prod (+ preview/staging mirrors per runbook).
2. Keep `ATOMIC_RATE_LIMIT_ENABLED` default **false**.
3. Confirm `wrangler deploy --dry-run` / types generation includes bindings.

**AC**

- GIVEN wrangler config WHEN dry-run THEN all Tier A+B bindings listed in [[RATE_LIMIT_BINDINGS_SETUP]] are present  
- GIVEN local bootstrap without remote THEN Worker starts (bindings optional / inert)

**Status (2026-07-30):** ✅ Landed — `wrangler deploy --dry-run` lists all 10 `RL_*` bindings; flag `"false"`. `RL_KB_SEARCH` budget set to **60/60** (matches `kb-search` middleware; was TBD in registry). No `[env.preview]` mirror (repo intentionally has no preview env block).

### `SEC-RL-ATOMIC-FACADE-01` (backend, 5 pts)

**Build**

1. New `functions/api/lib/atomic-rate-limit.ts` with typed profiles → binding or KV.
2. Wire `Env` optional `RL_*` + `RateLimit` type.
3. Vitest fake binding (`limit()` scripted `{ success }`).
4. Flag off ⇒ existing KV behaviour unchanged for all callers (no route migration yet).

**AC**

- GIVEN flag false WHEN any existing rate-limit test runs THEN green without behaviour change  
- GIVEN missing `RL_*` WHEN facade called THEN bypass or fail-closed per `RATE_LIMIT_FAIL_CLOSED`  
- GIVEN fake binding deny WHEN facade used THEN `{ allowed: false, backend: 'workers_rl' }`

**Exit gate:** `npm test` + `npm run typecheck` green. **No production flag flip.**

**Status (2026-07-30):** ✅ Landed — facade + `tests/unit/atomic-rate-limit.test.ts`. **Critical choices:** (1) **no production callers** in this package (WS-2 owns canary); (2) **no dual-layer L1+L2** yet (WS-4); (3) empty keys **denied**; (4) Workers RL errors fall back to KV (availability); (5) `remaining` non-authoritative for `workers_rl`.

---

## WS-1b — Observability + burst harness

| Field | Value |
|-------|-------|
| **Story** | `SEC-RL-ATOMIC-OBS-01` |
| **Pts** | 3 |
| **Status** | **Done** (2026-07-30) — [[ADR0073_WS1B_WS2_EVIDENCE]] |
| **Agents** | devops + analytics (E13), tester |
| **Depends** | WS-1 merged |

**Build**

1. Extend AE `rate_limit.hit` with `backend` + `profile` (contract in ADR-0073).
2. Add `rate_limit.backend_fallback` emission path in facade.
3. Burst harness script (preview): N concurrent requests against one API key; document colo slack.
4. Staging query / dashboard note in runbook.

**AC**

- GIVEN deny on Workers RL WHEN AE queried THEN `backend=workers_rl` present  
- GIVEN flag-off rollback WHEN 429s inspected THEN `backend=kv` path still observable  

**Parallel OK** with WS-2 after WS-1 lands.

---

## WS-2 — Canary (close `SEC-APIKEY-LIMITER-ATOMIC-01`)

| Field | Value |
|-------|-------|
| **Story** | `SEC-APIKEY-LIMITER-ATOMIC-01` |
| **Pts** | 5 |
| **Status** | **Done (code)** (2026-07-30) — [[ADR0073_WS1B_WS2_EVIDENCE]]; prod flag flip = ops |
| **Agents** | backend (lead), security (E10), devops (flag) |
| **Files** | `middleware/public-api-auth.ts` **only** |
| **Depends** | WS-1 |

**Build**

1. Route API-key allow/deny through facade profile `api_key` → `RL_API_KEY`.
2. Optional dual-write KV for one train (metrics only; L1 decides).
3. Staging flag on → burst harness → prod flag on for API routes only.

**AC**

- GIVEN 50+ concurrent requests one key one colo WHEN flag on THEN accepts ≤ 120/min ± documented slack  
- GIVEN flag set false WHEN redeploy/secret THEN KV path restored &lt; 5 min  
- GIVEN 429 THEN `Retry-After` + existing error envelope unchanged  
- Security: no raw API key or IP in AE blobs  

**Exit gate:** security ack + staging burst evidence attached to PR. Closes LOW finding as remediated-for-canary.

---

## WS-3 — Tier A migrate

| Field | Value |
|-------|-------|
| **Story** | `SEC-RL-ATOMIC-TIER-A-01` |
| **Pts** | 8 |
| **Status** | **Done** (2026-07-30) — [[ADR0073_WS3_WS5_AUDIT]] |
| **Agents** | backend, tester, security (embed RG-1) |
| **Depends** | WS-2 green ≥ canary window (staging + short prod soak) |
| **Do not co-land** | WS-4 |

**Surfaces (single story; split PRs by file ownership if needed)**

| Profile | Binding | File |
|---------|---------|------|
| embed read / handshake | `RL_EMBED_*` | `middleware/widget-token.ts` |
| join / public event | `RL_JOIN`, `RL_PUBLIC_EVENT` | `middleware/rate-limit.ts` + `app.ts` mounts |
| webhook egress | `RL_WEBHOOK` | `lib/webhook-rate-limit.ts` |
| admin audit query | `RL_ADMIN_AUDIT_Q` | `routes/admin/audit.ts` mounts |

**AC**

- Existing unit suites green: `embed-rate-limit`, `rate-limit-middleware`, `webhook-rate-limit`  
- Pentest regression **RG-1** (embed read-plane) still holds  
- No Tier B caller behaviour change  
- Dual-write from WS-2 removable after soak (follow-up commit OK)

---

## WS-4 — Tier B dual-layer

| Field | Value |
|-------|-------|
| **Story** | `SEC-RL-ATOMIC-TIER-B-01` |
| **Pts** | 5 |
| **Status** | **Done** (2026-07-30) — [[ADR0073_WS3_WS5_AUDIT]] |
| **Agents** | backend + security |
| **Depends** | WS-3 |
| **Do not co-land** | WS-3 |

**Surfaces**

| Product window | L1 burst | L2 KV sustained | Call sites |
|----------------|----------|-----------------|------------|
| Auth magic-link / password | `RL_AUTH_BURST` 5/60 | 5/600 | `auth/magic-link.ts`, `auth/password.ts`, middleware auth |
| DSA report | `RL_REPORT_BURST` 5/60 | 5/600 | `app.ts` report-content |
| AI insights / coaching / wizard | derived ≤60s shield | 10/3600 (existing) | `insights.ts`, `ai-insights/*`, `wizard-ai.ts` |
| Session create | optional burst | 30/3600 | `app.ts` POST `/api/sessions` |

**AC**

- Documented L1+L2 matrix in runbook or SPEC snippet  
- Product windows preserved (e.g. still max 5 magic-links / 10 min after L1)  
- Security sign-off: Resend / AI cost storm risk reduced vs KV-only  
- Fail-closed flag behaviour unchanged for KV leg  

---

## WS-5 — Cleanup (+ optional L0)

| Field | Value |
|-------|-------|
| **Stories** | `SEC-RL-ATOMIC-CLEANUP-01` (3) + optional `SEC-RL-ATOMIC-L0-WAF-01` (5) |
| **Status** | **Cleanup Done**; L0 WAF deferred (ops) — [[ADR0073_WS3_WS5_AUDIT]] |
| **Agents** | backend, devops, knowledge |
| **Depends** | WS-4 |

### Cleanup (required)

- Remove dead Tier A KV RMW paths; keep KV helper for Tier B L2 only.
- Close `SEC-APIKEY-LIMITER-ATOMIC-01` in [[SECURITY_AUDIT_BACKLOG]] as remediated.
- Update SPEC rate-limit section / ARCHITECTURE note; ADR-0073 → Implemented.

### L0 WAF (optional, ADR-042 §1.2)

- Zone rules on `/api/auth/*` + WS upgrade path.
- **Separate PR**; not required to close atomic-limiter epic.

---

## Agent routing & handoffs

| Step | From → To | Artifact | Edge |
|------|-----------|----------|------|
| 1 | PO → train | Promote WS stories into `BACKLOG_ACTIVE` train table | E3 |
| 2 | Architect → devops/backend | Accepted ADR + binding registry | E4, E12 |
| 3 | DevOps → backend | Bindings live, flag false | E5 / E22 |
| 4 | Backend → tester | Facade + canary PR | E9 |
| 5 | Backend → security | Auth/API-key/embed PRs | E10 |
| 6 | Backend → analytics | New AE field dims | E13 |
| 7 | Tester / e2e → devops | Burst harness results | E9 / E32 |
| 8 | Knowledge → all | SPEC/ADR closeout | E7-style docs |

---

## Promotion checklist (PO)

Before committing Train A:

- [ ] ADR-0073 Accepted
- [ ] WS-1 + WS-1b + WS-2 rows copied into active train table with pts summing ≤ train residual capacity
- [ ] Explicit note: SessionRoom DO limiter out of scope
- [ ] Rollback owner named (devops) for flag flip

Before committing Train B:

- [ ] WS-2 prod soak evidence linked
- [ ] WS-3 and WS-4 scheduled on **different** merge weeks if possible
- [ ] Security available for embed RG-1 + auth dual-layer review

---

## Out of scope (all workstreams)

- SessionRoom / WebSocket token buckets (`session-room-rate-limiter.ts`)
- Billing-grade metering
- Global single-counter DO (reopen only with measured abuse evidence)
- Changing published product quotas

---

## Changelog

| Date | Change |
|------|--------|
| 2026-07-30 | Initial workstream breakdown for ADR-0073 build |
