---
id: ADR0073_WS1B_WS2_EVIDENCE
type: evidence
domain: security
category: execution
status: complete
version: 1.0
created: 2026-07-30
updated: 2026-07-30
tags:
  - rate-limiting
  - adr-0073
relates_to:
  - ADR-0073-atomic-rate-limiting-workers-api
  - SEC-RL-ATOMIC-OBS-01
  - SEC-APIKEY-LIMITER-ATOMIC-01
---

# ADR-0073 — WS-1b + WS-2 closeout evidence

**Date:** 2026-07-30  
**Branch:** `cursor/atomic-rate-limiting-adr-c8e4`

## WS-1b — Observability + burst harness (`SEC-RL-ATOMIC-OBS-01`)

| AC | Evidence |
|----|----------|
| `rate_limit.hit` carries backend + profile | `composeRateLimitDetail` → blob6 `profile=…;backend=…;…` in `observability.ts` |
| `rate_limit.backend_fallback` emitted | Facade emits AE on missing binding / Workers RL throw |
| Burst harness | `scripts/burst-api-key-rate-limit.mjs` + `npm run burst:api-key-rate-limit` |
| Runbook SQL / colo notes | [[RATE_LIMIT_BINDINGS_SETUP]] Monitoring + Burst harness sections |

## WS-2 — API-key canary (`SEC-APIKEY-LIMITER-ATOMIC-01`)

| AC | Evidence |
|----|----------|
| Allow/deny via facade when flag on | `public-api-auth.ts` → `atomicRateLimit(..., 'api_key', id)` |
| Flag off restores legacy KV RMW | Separate `legacyKvRateLimit()` path (rollback &lt;5 min via flag) |
| 429 + Retry-After unchanged envelope | Unit tests assert status/headers/code |
| No raw API key in AE | `actor=key:<id>` only; tests assert raw key absent |
| Dual-write on Workers RL allow | `dualWriteLegacyKv` for canary comparison |

**Production flag:** remains `ATOMIC_RATE_LIMIT_ENABLED=false` in `wrangler.toml`. Operator enables on staging → burst harness → prod. Code path is complete; live colo burst proof is an ops step post-deploy.

## Tests

- `tests/unit/public-api-auth-rate-limit.test.ts`
- Extended `atomic-rate-limit.test.ts`, `observability.test.ts`
