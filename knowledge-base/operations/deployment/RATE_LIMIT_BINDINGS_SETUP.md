---
id: RUNBOOK-RATE_LIMIT_BINDINGS
type: runbook
category: deployment
status: active
version: 1.0
created: 2026-07-30
updated: 2026-07-30
tags:
  - rate-limiting
  - wrangler
  - cloudflare
  - operations
relates_to:
  - ADR-0073-atomic-rate-limiting-workers-api
  - DEPLOY_BOOTSTRAP
  - SEC-APIKEY-LIMITER-ATOMIC-01
---

# Rate Limit Bindings Setup (Workers Rate Limiting API)

Companion runbook for [[ADR-0073-atomic-rate-limiting-workers-api]]. Bindings are **declarative in `wrangler.toml`** — there is no `wrangler ratelimit create` CLI step. Ops owns ID hygiene, env mirroring, flag rollout, and monitoring.

**Build workstreams:** [[ADR0073_ATOMIC_RL_WORKSTREAMS]] — this runbook is executed primarily in **WS-1** (bindings) and **WS-1b** (monitoring); flag flips happen in **WS-2+**.

## Prerequisites

- Cloudflare account with Workers Paid (Rate Limiting binding is a Workers runtime API; confirm plan entitlement before prod canary).
- Deploy target: Worker `qesto-api` (`wrangler.toml` root) — same surface as today’s Hono API.
- ADR-0073 accepted (or explicitly approved for Phase 1 infra-only land).

## Namespace ID registry (account-unique)

| `namespace_id` | Binding name | Limit / period | Environment |
|---|---|---|---|
| `1001` | `RL_API_KEY` | 120 / 60s | prod (+ preview if same budget) |
| `1002` | `RL_EMBED_READ` | 120 / 60s | prod |
| `1003` | `RL_EMBED_HANDSHAKE` | 30 / 60s | prod |
| `1004` | `RL_JOIN` | 20 / 60s | prod |
| `1005` | `RL_PUBLIC_EVENT` | 60 / 60s | prod |
| `1006` | `RL_WEBHOOK` | 100 / 60s | prod |
| `1007` | `RL_AUTH_BURST` | 5 / 60s | prod |
| `1008` | `RL_REPORT_BURST` | 5 / 60s | prod |
| `1009` | `RL_KB_SEARCH` | 60 / 60s | prod |
| `1010` | `RL_ADMIN_AUDIT_Q` | 120 / 60s | prod |
| `1001–1099` | *(reserved block)* | — | Do not use outside Qesto API |

**Rules:**

1. IDs are strings of positive integers, unique per account for a given logical limiter.
2. Never repurpose an ID for a different limit/period — allocate a new ID and leave the old binding unused until removed in a cleanup train.
3. If staging needs looser limits, allocate `11xx` (e.g. `1101`) — do not silently change `simple.limit` on a shared ID used by prod.
4. Update this table in the same PR that edits `wrangler.toml`.

## Wrangler fragment

Add under production (and mirror under `[env.preview]` / `[env.staging]` as needed):

```toml
[[ratelimits]]
name = "RL_API_KEY"
namespace_id = "1001"

[ratelimits.simple]
limit = 120
period = 60
```

Repeat for each registry row. Validate with:

```bash
npx wrangler deploy --dry-run
npx wrangler types   # or project equivalent — Env must include RateLimit bindings
```

## Feature flag

| Var / secret | Default | Meaning |
|---|---|---|
| `ATOMIC_RATE_LIMIT_ENABLED` | `"false"` | When `"true"`, facade prefers Workers RL for Tier A profiles |

Land bindings with flag **off**. Call sites must no-op safely if binding missing (local bootstrap).

Fail-closed parity: existing `RATE_LIMIT_FAIL_CLOSED` continues to govern KV / missing-backend behaviour (SEC-RATELIMIT-01). Document whether binding errors fail open or closed in the facade PR; default match middleware (fail-open unless flag set).

## Rollout sequence

1. **Merge Phase 1** — bindings + facade + tests; flag false in all envs.
2. **Staging** — set `ATOMIC_RATE_LIMIT_ENABLED=true`; run burst script against API key route.
3. **Prod canary** — enable for API key path only (code profile gate or env allowlist if needed).
4. **Prod Tier A** — embed, join, webhook, public event, admin audit query.
5. **Tier B** — dual-layer auth/AI (separate story; do not co-land with canary).
6. **Cleanup** — remove Tier A KV counters after one quiet train.

## Rollback

`public-api-auth` keeps the **legacy KV RMW path** when the flag is false (WS-2 design). Flip flag off to restore prior behaviour without code rollback.

```bash
# Fastest: secret overrides [vars] — no full config rewrite required
wrangler secret put ATOMIC_RATE_LIMIT_ENABLED
# value: false
```

Or set `[vars] ATOMIC_RATE_LIMIT_ENABLED = "false"` and redeploy. Leave `[[ratelimits]]` in place (harmless when unused).

## Monitoring (WS-1b)

Workers Rate Limiting bindings are **not** visible in the Cloudflare dashboard.

| Signal | How |
|---|---|
| 429 rate | Workers Observability / logs filter `status=429` |
| Deny by backend | AE `rate_limit.hit` — blob6 contains `profile=…;backend=workers_rl\|kv;actor=key:<id>` |
| Fallback | AE `rate_limit.backend_fallback` — blob6 `reason=binding_missing` or `workers_rl_error` |
| KV path errors | existing `rate_limit.kv_failure` / `rate_limit_kv_error` |

**AE detail contract (blob6):** `profile=<AtomicRateLimitProfile>;backend=<workers_rl|kv|bypass|deny>;…` — never raw API keys or IPs.

Example Analytics Engine SQL (dataset `qesto_metrics`, adjust account/table names per env):

```sql
SELECT
  blob1 AS event,
  blob6 AS detail,
  COUNT(*) AS n
FROM qesto_metrics
WHERE blob1 IN ('rate_limit.hit', 'rate_limit.backend_fallback')
  AND timestamp > NOW() - INTERVAL '1' HOUR
GROUP BY blob1, blob6
ORDER BY n DESC
```

Filter canary: `blob6 LIKE '%profile=api_key%'` and `blob6 LIKE '%backend=workers_rl%'`.

Suggested canary alert: 5-minute spike of `rate_limit.hit` > 3× baseline on `profile=api_key` after flag flip → investigate false positives before expanding Tier A.

## Burst harness (WS-1b / WS-2)

```bash
API_KEY=qesto_… npm run burst:api-key-rate-limit -- https://qesto.cc 150 50
# or: node scripts/burst-api-key-rate-limit.mjs [BASE_URL] [TOTAL] [CONCURRENCY]
```

**Colo slack:** Workers RL is per-location. A single-region canary should see `okish ≲ 120` per minute for one key; multi-colo fan-out can exceed that in aggregate. Document observed `okish` / `limited429` in the canary PR.

**Staging sequence:** deploy with flag false → dry-run bindings → set flag true on staging → run burst harness → compare AE `backend=workers_rl` hits → only then consider prod flag.

## Local development

- `wrangler dev --local`: binding support may be limited; facade must treat missing `env.RL_*` as KV fallback (+ AE `backend_fallback`).
- Unit tests **must not** call real colo counters — inject a fake `{ limit: async () => ({ success }) }`.

## Verification checklist (per env)

- [x] All registry rows present in wrangler for that env (default Worker config)
- [x] `namespace_id` values match this runbook
- [x] `Env` TypeScript includes optional `RL_*` bindings
- [x] `ATOMIC_RATE_LIMIT_ENABLED` documented (default false)
- [x] AE `backend` / `profile` encoded in blob6 for rate-limit events
- [ ] Rollback owner named in release train notes (operator)

## Related

- [[ADR-0073-atomic-rate-limiting-workers-api]]
- [[ADR0073_ATOMIC_RL_WORKSTREAMS]]
- [[ADR0073_WS0_WS1_EVIDENCE]]
- [[DEPLOY_BOOTSTRAP]] — general binding bootstrap
- ADR-042 §1.2 — optional L0 zone WAF rate rules (complementary, not a substitute)
