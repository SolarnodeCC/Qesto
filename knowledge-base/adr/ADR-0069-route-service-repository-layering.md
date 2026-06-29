---
id: ADR-0069
status: accepted
created: 2026-06-28
accepted: 2026-06-28
deciders: architect, backend
relates_to: REFACTORING_AUDIT, ADR-0070
---

# ADR-0069: Route → Service → Repository Layering (No Inline D1 in Routes)

## Status

Accepted (2026-06-28). Establishes `functions/api/repositories/` as the home for D1 access and adds a
CI ratchet (`scripts/check-d1-access.mjs`) to stop new inline queries in route handlers. Implements
the High findings "D1 access is overwhelmingly inline" and "God route files" from
[`REFACTORING_AUDIT.md`](../../REFACTORING_AUDIT.md).

## Context

The audit found **288 inline `env.DB.prepare(...)` calls across 57 route files**, versus only **4
repository modules**. SQL is interleaved with HTTP parsing, validation, business logic and external
calls — the largest route files run 700–1000+ lines (`integrations.ts`, `teams.ts`, `wizard.ts`,
`billing.ts`, `lifecycle.ts`). This duplicates queries, scatters tenant-scoping/ownership invariants,
makes schema changes ripple across dozens of files, and makes query logic effectively untestable
without a live DB. The repository pattern exists (`repositories/sessionRepository.ts`) but is barely
adopted — there was no gate to make it the default.

## Decision

1. D1 queries belong in `functions/api/repositories/` (functions taking `D1Database` + params), not
   in route handlers. Routes parse → call a service/repository → respond.
2. Grow the repository layer per domain (teams, billing, tournaments, sessions) opportunistically —
   extract queries from a route file as it is touched; no big-bang rewrite.
3. Enforce with `scripts/check-d1-access.mjs` (multi-line-aware ratchet, baseline 329, DOWN only)
   scanning `functions/api/routes/`, wired into `ops/ci/quality-gates.sh` and `npm run check:rc`.

**First slice (reference implementation):** `sessions/lifecycle.ts` (724→663 lines) — its 8 D1 queries
moved to `repositories/sessionLifecycleRepository.ts`, board warm-up config to
`services/sessionLifecycleService.ts`. Handlers now orchestrate (DO init, journey events, queues) and
delegate persistence. The remaining god routes follow this pattern as `ARCH-REPO-LAYER-01` burn-down.

## Consequences

- **Positive:** queries become unit-testable, tenant-scoping centralises, god routes shrink as their
  persistence moves out; the ratchet blocks new inline queries.
- **Cost:** burn-down is release-train work, naturally paired with the god-route service extraction
  (extracting a service drains its `DB.prepare` calls into repositories, lowering the baseline).
- **Neutral:** introducing the gate at baseline changes no runtime behaviour.
