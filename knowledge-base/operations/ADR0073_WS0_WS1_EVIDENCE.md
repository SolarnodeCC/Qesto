---
id: ADR0073_WS0_WS1_EVIDENCE
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
  - workstream
relates_to:
  - ADR-0073-atomic-rate-limiting-workers-api
  - ADR0073_ATOMIC_RL_WORKSTREAMS
  - SEC-RL-ATOMIC-ADR-01
  - SEC-RL-ATOMIC-BINDINGS-01
  - SEC-RL-ATOMIC-FACADE-01
---

# ADR-0073 — WS-0 + WS-1 closeout evidence

**Date:** 2026-07-30  
**Branch:** `cursor/atomic-rate-limiting-adr-c8e4`  
**Scope:** Work packages 0 (plan freeze) and 1 (bindings + facade) only. WS-1b / WS-2 **not** included.

## WS-0 — Plan freeze (`SEC-RL-ATOMIC-ADR-01`)

| AC | Evidence |
|----|----------|
| ADR with layered model + binding registry | [`ADR-0073`](../../adr/ADR-0073-atomic-rate-limiting-workers-api.md) — status **Accepted** |
| Ops runbook | [`RATE_LIMIT_BINDINGS_SETUP.md`](../deployment/RATE_LIMIT_BINDINGS_SETUP.md) |
| Build workstreams | [`ADR0073_ATOMIC_RL_WORKSTREAMS.md`](../../product/planning/ADR0073_ATOMIC_RL_WORKSTREAMS.md) |
| Stories promoted into backlog train table | [[BACKLOG_ACTIVE]] RT-02 addendum “ADR-0073 Train A” |

**Deciders recorded on ADR:** architect, backend, devops, security. Acceptance closes the Proposed → Accepted gate so Train A implementation is authorized.

## WS-1 — Foundation

### `SEC-RL-ATOMIC-BINDINGS-01`

| AC | Evidence |
|----|----------|
| `[[ratelimits]]` 1001–1010 in wrangler | `wrangler.toml` — 10 bindings, inline `simple = { limit, period }` |
| Flag default false | `ATOMIC_RATE_LIMIT_ENABLED = "false"` in `[vars]` |
| Dry-run lists bindings | `npx wrangler deploy --dry-run` → all `env.RL_*` Rate Limit rows + flag |

**Note:** No `[env.preview]` block exists in this repo (intentional); bindings live on the default Worker config only.

### `SEC-RL-ATOMIC-FACADE-01`

| AC | Evidence |
|----|----------|
| Facade + profile registry | `functions/api/lib/atomic-rate-limit.ts` |
| Env `RL_*` + flag | `functions/api/types/env.ts`, `functions/api/lib/flags.ts` |
| Vitest fake binding | `tests/unit/atomic-rate-limit.test.ts` |
| Flag off ⇒ no production behaviour change | **No production callers** of `atomicRateLimit` yet (WS-2 owns canary) |

**Critical constraints enforced in code:** empty keys denied; Workers RL errors fall back to KV; `remaining` non-authoritative for `workers_rl`; no dual-layer (WS-4).

## Exit gates

| Gate | Result |
|------|--------|
| `npx wrangler deploy --dry-run` | Pass — 10 `RL_*` bindings visible |
| `npm run typecheck` | Pass (`tsc --noEmit`) |
| `npm test` | Pass — **303** files / **2589** tests (2026-07-30 local) |

## Explicitly not done (next packages)

- WS-1b observability / burst harness
- WS-2 `public-api-auth.ts` canary + flag flip
- Any Tier A/B route migration
