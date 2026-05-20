# Staging Migration & Deployment Checklist
## DEPLOY-GAM-01 — ENERGIZING State + Circuit Breakers + Zero-Knowledge Mode

> **Owner:** DevOps / Release Lead
> **Sprint:** 31
> **Gate:** Must be completed before `sprint/sprint-31` is merged to `main` and `wrangler pages deploy` runs against production.

---

## Pre-Deploy: Local Quality Gates

- [ ] `npm test` — 797+ tests green
- [ ] `npm run typecheck` — 0 TypeScript errors
- [ ] `npm run check:i18n` — no missing translation keys
- [ ] `npm run check:tokens-drift` — design system unchanged
- [ ] `npm run build` — clean production build

---

## D1 Schema Compatibility

| Check | Status |
|---|---|
| No breaking schema migrations in this sprint | No new migrations in Sprint 31 |
| `anonymity` column already exists in `sessions` table | Pre-existing (Sprint 24) |
| `energizers` table schema unchanged | No migration required |

> **Action:** Verify with `wrangler d1 execute DB --command "SELECT name FROM pragma_table_info('sessions') WHERE name='anonymity'"` against staging DB.

---

## KV Namespace Compatibility

| Namespace | Change | Notes |
|---|---|---|
| `ACTIONS_KV` | Now used by circuit breakers | Keys prefixed `cb:v1:{name}:{env}`. Old KV data unaffected. |
| `SESSIONS_KV` | No change | |
| `USERS_KV` | No change | |
| `TEAMS_KV` | No change | |
| `AUDIT_KV` | No change | Audit entries for `energizer.*` actions pre-existing |

> **Action:** After first staging deploy, run: `wrangler kv:key list --namespace-id $ACTIONS_KV_ID --prefix "cb:v1:"` to confirm circuit breaker keys are being written.

---

## Feature Flag State

| Flag | Required State | Notes |
|---|---|---|
| `ENABLE_ENERGIZERS` | **OFF** in prod until RC-ROLLOUT-01 | Sprint 32 delivers rollout plan |
| `ENABLE_ENERGIZERS` | **ON** in staging for smoke tests | Explicit for this checklist |
| `ENABLE_ZERO_KNOWLEDGE` | Optional — UI visible to all, no flag required | `zero_knowledge` anonymity is an API field, not feature-flagged |

> **Action:** Confirm `ENABLE_ENERGIZERS=true` is set in `wrangler.toml` staging vars before running WebSocket smoke.

---

## Circuit Breaker Smoke Tests

Run these after staging deploy to verify circuit breakers are wired:

```bash
# 1. Verify /api/version returns 200 (proves app boots with circuit breakers)
curl -s https://staging.qesto.cc/api/version | jq .

# 2. Verify /api/admin/health returns 200
curl -s https://staging.qesto.cc/api/admin/health | jq .

# 3. Verify circuit breaker KV keys written after first request
wrangler kv:key list --namespace-id $ACTIONS_KV_STAGING_ID --prefix "cb:v1:"
# Expected: keys for stripe, resend, ai, jwks (once any of those paths are hit)
```

---

## WebSocket Smoke Tests (ENERGIZING / LIVE Energizers)

> These require `ENABLE_ENERGIZERS=true` in staging.

### Energizer LIVE path

- [ ] **Create draft session with energizers:** `POST /api/sessions` → add energizer via `POST /api/sessions/:id/energizers`
- [ ] **Start session:** `POST /api/sessions/:id/start` → verify response `status: "energizing"`
- [ ] **Presenter joins via WebSocket** — confirm `init` message received with `role: "presenter"`
- [ ] **Voter joins via WebSocket** — confirm `init` message received with `role: "voter"`, `energizer: null` initially
- [ ] **Presenter activates energizer** — `ws.send({type:"energizer_activate",...})` — confirm `energizer_state` broadcast to voter
- [ ] **Voter answers energizer** — confirm answer accepted (no error frame)
- [ ] **Presenter advances** (`energizer_advance`) — confirm leaderboard/completion broadcast
- [ ] **Transition to LIVE:** `POST /api/sessions/:id/transition-to-live` — confirm `session_energizing_complete` broadcast
- [ ] **Presenter advances questions** — confirm `question` frame delivered to voter
- [ ] **Session close** — confirm `session_closed` frame, connection clean-close code 1000

### Energizer permission gate (AUTHZ-GAM-01)

- [ ] **Member-role presenter** (no `energizer:activate` custom permission) → activation attempt returns `permission_denied` WS error frame
- [ ] **Custom role with `energizer:activate`** → activation succeeds

### Zero-knowledge mode (ANON-DEPTH-01)

- [ ] **Create session with `anonymity: "zero_knowledge"`** — confirm field persists in `GET /api/sessions/:id`
- [ ] **Voter joins** — confirm `init` frame contains `session.anonymity: "zero_knowledge"`
- [ ] **JoinPage trust badge** — verify UI shows zero-knowledge trust badge when anonymity is `zero_knowledge`
- [ ] **Session with `anonymity: "partial"`** — confirm trust badge is NOT shown

---

## Rollback Plan

| Scenario | Action |
|---|---|
| Circuit breaker OPEN blocks Stripe in prod | `wrangler kv:key delete --namespace-id $ACTIONS_KV_ID "cb:v1:stripe:production"` to reset state; circuit closes on next success |
| Circuit breaker OPEN blocks JWKS (auth failure) | As above for `cb:v1:jwks:production`; alternatively deploy previous release revision |
| ENERGIZING state DO crash | `ENABLE_ENERGIZERS=false` via wrangler var + redeploy; existing LIVE sessions unaffected |
| Zero-knowledge trust badge display issue | CSS-only component — no data risk; hotfix deploy |

---

## Rollback Trigger Criteria

Rollback (revert to previous Pages revision) if ANY of the following occur within 30 min of production deploy:

- [ ] Error rate on `/api/auth/*` > 1% (JWKS circuit breaker regression)
- [ ] Error rate on `/api/billing/*` > 2% (Stripe circuit breaker regression)
- [ ] Any 5xx on `/api/version` or `/api/admin/health` (boot failure)
- [ ] WebSocket `init` frame not received within 5s for 3+ consecutive test joins

---

## Sign-off

| Role | Sign-off | Date |
|---|---|---|
| Backend lead | | |
| QA lead | | |
| DevOps / Release | | |

> Proceed to `wrangler pages deploy` (production) only when all smoke tests above are checked and signed off.
