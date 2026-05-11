# Sprint 20 Readiness Implementation Spec

_Hub: [Documentation map](./README.md)._

_Created: 2026-05-01 (UTC)_
_Sprint 20 build update: 2026-05-04 (Europe/Amsterdam)_

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

- `GET /api/admin/sprint19-baseline` returns durable D1-based baseline evidence:
  - AI usage rate.
  - Wizard completion rate from `wizard.opened` / `wizard.completed` when available, with D1 fallback for older windows.
  - Launchpad success rate from `launchpad.launch_attempt` / `launchpad.launch_success` when available, with D1 fallback for older windows.
  - Inline AI suggestion acceptance from `ai_accepted_count` / `ai_dismissed_count`.
  - Invalid LIVE attempts from `launchpad.launch_failed`.
  - Preflight failure rate from durable `preflight.checked` / `preflight.failed` journey events.
  - AI consent / grounding counts.
  - Draft vs started-or-closed session counts.
- Measurement gaps are returned only for selected windows that do not yet contain the relevant denominator events.

### Authorization ADR

- `AUTHZ-ADR-01` is captured as [`ADR-0004: Custom RBAC Authorization`](../../../adr/ADR-0004-custom-rbac-authorization.md).
- The ADR defines authorization order, permission names, built-in role mapping, route ownership, D1 data-model direction, audit semantics, and contract-test strategy.
- Status is **Proposed for Sprint 20 review**. Sprint 21 RBAC implementation remains blocked until Product Owner + Architect accept the ADR.

### Sprint A Verification Bundle

- Sprint A verification is now a Sprint 20 release gate, not feature scope:
  - `npm run check:tokens-drift`
  - `npm run check:i18n`
  - `npm run test:a11y`
  - `npm run typecheck`
  - focused Sprint 20 tests
  - production build

## Acceptance Criteria

- Focused tests pass:
  - `tests/integration/entitlement-contracts.test.ts`
  - `tests/integration/sprint19-baseline.test.ts`
  - `tests/unit/observability.test.ts`
  - `tests/unit/ai-wizard.test.ts`
  - `tests/unit/sessions-new-routes.test.ts`
- `npm run typecheck` passes.
- Token drift, i18n, a11y, and production build gates pass.
- `AUTHZ-ADR-01` is in review and linked from planning docs.
- No new RBAC/custom-role or LIVE energizer implementation begins before the required ADRs.

## Known Measurement Gaps

- The 7-day production baseline cannot be finalized until the post-2026-05-01 data window accrues.
- Older date windows without `sprint19_events` rows use D1 fallback proxies for wizard completion and Launchpad success.
- Abandoned AI wizard suggestions remain outside the AI suggestion acceptance denominator; they are handled through wizard completion/drop-off analysis.
