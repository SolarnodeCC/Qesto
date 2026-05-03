# Sprint 20 Readiness Implementation Spec

_Hub: [Documentation map](./README.md)._

_Created: 2026-05-01 (UTC)_

## Goal

Sprint 20 converts the Sprint 19 AI wizard and Launchpad delivery into release evidence for v2.1 readiness. The implementation scope is intentionally narrow: prove entitlement gates, emit operational signals, and expose a baseline KPI surface without starting broad feature expansion.

## Implemented Scope

### Entitlement Contracts

- `ENTITLEMENTS-02` is verified through `tests/integration/entitlement-contracts.test.ts`.
- Contract coverage includes results export, ranking/consent question gating, SAML configuration, team-member caps, duplicate session quota, precomputed insights themes, and legacy AI insights analysis.

### Operational Evidence

- AI wizard generation and refinement emit `ai.inference` events with `traceId`, `sessionId`, `userId`, plan, latency, and generated-question count.
- AI wizard/refine rate limits emit `rate_limit.hit`.
- Launchpad preflight failures emit `preflight.failed` and a structured log with failed check IDs and `trace_id`.
- Durable Object voter token-bucket contention emits `ws.token_bucket_contention`.
- Existing signals remain authoritative for `session.started`, `session.closed`, `ws.capacity_exceeded`, and `error.api`.

### Sprint 19 KPI Baseline

- `GET /api/admin/sprint19-baseline` returns durable D1-based baseline proxies:
  - AI usage rate.
  - Wizard completion proxy.
  - Launchpad success proxy.
  - AI consent / grounding counts.
  - Draft vs started-or-closed session counts.
- Fields requiring client event ingestion or Analytics Engine query support are returned as `null` with explicit `measurement_gaps`.

## Acceptance Criteria

- Focused tests pass:
  - `tests/integration/entitlement-contracts.test.ts`
  - `tests/integration/sprint19-baseline.test.ts`
  - `tests/unit/observability.test.ts`
  - `tests/unit/ai-wizard.test.ts`
  - `tests/unit/sessions-new-routes.test.ts`
- `npm run typecheck` passes.
- No new RBAC/custom-role or LIVE energizer implementation begins before the required ADRs.

## Known Measurement Gaps

- Inline AI suggestion acceptance needs client event ingestion.
- Invalid LIVE attempts and exact preflight failure rate need Analytics Engine/log querying outside the Worker endpoint.
- Launchpad success currently uses D1 session state as a proxy until dedicated `launch_attempt` / `launch_success` events are queryable.
