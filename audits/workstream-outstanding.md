# Outstanding Work Across All Audit Workstreams

**Date:** 2026-05-03  
**Source of truth:** all files in `audits/`, with current code layout checked after the WS3/WS4 split work.

## Executive status

| Workstream | Status | Completed | Outstanding |
|---|---|---|---|
| WS1: Shared foundations | Partially started | `lib/kv.ts`, `lib/kv-keys.ts`, `lib/constants.ts`, `lib/http.ts` exist | Broaden adoption; add response/error-code helpers; consolidate plan quotas, user lookup, TTL/rate-limit constants |
| WS2: Security + correctness | Not started | None confirmed in plan | EH/EF raw error leaks, malformed JSON handling, audit SQL builder, KV cache proxy decision/fix, schema patch retry behavior |
| WS3: Backend modularization | Mostly done | Route packages for `energizers/`, `ai-insights/`, `auth/`; insights libs extracted | Residual `sessions.ts`, `admin.ts`, `teams.ts`, `gamification.ts`, and service/repository boundaries |
| WS4: Realtime/session state | Partially done | `session-lifecycle.ts`, `session-room-vote.ts`, insights-only `session-repository.ts`, `liveSessionWsTransport.ts` | DO outer error boundary, voter init retry validation, broader repositories, optional WS/domain hook split |
| WS5: Frontend dedupe/type alignment | In progress | `usePolledApi` + 3 admin hook migrations; transport helper started | `useAdminMetrics`/`useAdminUsers` review, shared session types, session hook boilerplate, optional `useWebSocket` extraction |
| WS6: Resilience/external service safety | New | Some timeout/retry examples exist in AI wizard/OAuth fetch | Timeouts, retries, fail-open KV rate limits, circuit-breaker policy, Vectorize/AI degradation paths |
| WS7: Naming/readability contracts | New | Naming audit guide exists | Error-code registry, traceId local casing, idempotency naming, key-builder naming, camelCase DTO boundary strategy |
| WS8: Observability/error-flow consistency | New | Observability helpers exist | OAuth/RBAC/admin/plan/billing/logging failure visibility; consistent 401/500 code mapping and logs |

## Dependency map

1. **Error/response/code helpers unblock security and readability.** Standardize the production-safe error envelope and `ErrorCode` registry before touching broad route catches, otherwise fixes will drift.
2. **Resilience wrappers must land before service-wide retries.** Add small timeout/retry/fail-open helpers first, then migrate AI, Stripe, Resend, OAuth, D1/KV call sites one surface at a time.
3. **Schema patch handling must be stabilized before any `sessions.ts` split.** `patchSchemaIfNeeded` has hidden global state and swallowed errors; splitting first would spread the migration concern.
4. **Session repositories come before deeper session route decomposition.** The existing insights-only repository is a useful seed; expand data-access seams before extracting more handlers.
5. **Wire-format naming changes are compatibility-sensitive.** Do not rename WebSocket error codes or payload fields without an alias/deprecation strategy and frontend checks.
6. **Frontend type alignment depends on backend DTO boundaries.** Decide whether backend route DTOs remain snake_case at persistence edges with camelCase API types before migrating frontend declarations.

## Detailed outstanding backlog

## WS1 -- Shared foundations

1. Broaden `readKvJson` / `writeKvJson` adoption across routes/libs and add representative unit tests.
2. Add centralized response helpers with stable envelope, trace id propagation, and production-safe failure shape.
3. Add an `ErrorCode` registry/constants module and migrate magic code strings gradually.
4. Consolidate plan quota facts (`F-04`), common user-plan lookup (`F-09`), KV key builders (`F-05`, `NC-06`), and TTL/rate-limit constants (`F-10`).
5. Decide the fate of `middleware/kv-cache.ts`: wire it correctly with tests, or remove it as dead abstraction after replacing the intended cache use.

## WS2 -- Security + correctness

1. Fix global `app.onError` production leakage and status/code mapping (`EH-01`, `EH-07`, `EH-13`, `EF` template).
2. Replace raw 500 responses in route catches, especially energizers/gamification/billing/admin (`EH-02`, `EF-09`, `EF-10`).
3. Add safe JSON parsing/schema validation for energizer creation and admin JSON endpoints (`EH-04`, `EH-08`).
4. Rewrite `queryAuditEvents` with typed clause assembly and stable count query (`CR-04`).
5. Fix or retire cache proxy namespace bug (`ST-04`, `SA-06`) with regression coverage.
6. Fix schema patch retry semantics so failed D1 migration attempts do not mark the worker instance complete (`CR-03`, `A-01`, `EF-05`, `SA-09`).

## WS3 -- Backend modularization

1. Keep completed `energizers/`, `auth/`, and `ai-insights/` packages stable; avoid mixing further refactors into security PRs.
2. Split remaining high-risk `sessions.ts` concerns only after WS2 schema-patch work and WS4 repository expansion.
3. Split `admin.ts` into metrics/users/ops route modules after response/error helpers land.
4. Extract `gamification.ts` into battle-royale, bracket, and badge modules when touching energizer internals again (`COH-02`).
5. Move `app.ts` health/status route out of the pure integration point if/when app wiring is next edited (`CP-03`).

## WS4 -- Realtime/session state

1. Verify `ensureVoters` clears rejected initialization promises and add a storage-failure retry test (`EH-03`, `RES-12`).
2. Add an outer `webSocketMessage` error boundary with safe client errors and server logging (`EF-04`, `RES-13`, `EH-12`).
3. Expand `session-repository.ts` beyond insights reads to session/question CRUD before deeper `sessions.ts` splits (`DM-02`).
4. Continue replacing implicit lifecycle checks with `session-lifecycle.ts` helpers (`DM-04`), especially start/close/results/precompute paths.
5. Keep WebSocket wire-code renames out of mechanical readability PRs unless aliases are added (`NC-05`).

## WS5 -- Frontend dedupe/type alignment

1. Audit `useAdminMetrics` and `useAdminUsers` for possible `usePolledApi` adoption or intentional differences.
2. Remove duplicated session/question frontend type declarations after backend DTO casing strategy is set (`F-06`, `NC-01`).
3. Reduce repeated loading/error state in `useSessions` and related hooks (`F-08`).
4. Complete optional `useLiveSession` extraction into transport + domain/message hooks (`C-06`), building on `liveSessionWsTransport.ts`.
5. Clean low-risk naming items when files are already touched: `idempotencyKey`, event parameter names, repeated `next` locals (`NC-07`, `NC-12`, `NC-16`).

## WS6 -- Resilience/external service safety

1. Add shared timeout/retry helpers for external calls; start with AI insights and Workers AI (`RES-01`, `RES-05`, `RES-15`).
2. Add fail-open/observable handling for plan middleware, admin middleware, RBAC, and `lib/rate-limit.ts` KV failures (`RES-02`, `RES-03`, `RES-10`, `RES-14`, `EH-05`).
3. Wrap Stripe, Resend, and OAuth external calls with bounded retry or explicit no-retry policy based on idempotency (`RES-06`, `EF-03`, `EF-12`, `EH-09`).
4. Decide on a lightweight circuit-breaker policy after call wrappers exist (`RES-08`); do not build this before the timeout/retry primitive.
5. Change Vectorize upsert/embedding after insights to timeout-bounded background/degraded behavior where feasible (`RES-15`).

## WS7 -- Naming/readability contracts

1. Introduce error-code constants/registry together with WS1/WS2 response helper work (`NC-10`).
2. Convert local `trace_id` variables to `traceId` while preserving response payload field `trace_id` (`NC-02`).
3. Define DTO/persistence casing boundaries before `Session`/`Question` camelCase migration (`NC-01`).
4. Rename local abbreviations when touching affected code: energizer config vars, `idemKey`, `_rbac_cache`, unnamed boolean args (`NC-03`, `NC-07`, `NC-11`, `NC-14`).
5. Treat WebSocket British/American spelling as an API compatibility item, not a simple rename (`NC-05`, `NC-15`).

## WS8 -- Observability/error-flow consistency

1. Log OAuth callback failures with enough context to distinguish user cancel vs provider/config/runtime failure (`EF-01`, `EH-06`).
2. Ensure RBAC/plan/admin fallback behavior logs or emits metrics when it degrades (`EF-02`, `EF-07`, `RES-02`, `RES-03`, `RES-14`).
3. Use `console.error` or structured logging for KV/rate-limit failures; keep request logs available in dev/preview where useful (`EH-10`, `EH-11`).
4. Standardize auth failure codes across middleware (`EF-08`).
5. Make email delivery outcomes truthful: either return actionable failure or record a pending/retry state instead of unconditional 202 (`EH-09`, `EF-12`).

## Recommended next execution order

1. **PR-A (WS1/WS2/WS7):** Error envelope, `ErrorCode` registry, `app.onError` hardening, and tests.
2. **PR-B (WS2/WS8):** Route JSON parsing/raw-error cleanup for energizers, admin, billing, gamification; OAuth/RBAC logging touch-ups.
3. **PR-C (WS2):** Audit SQL builder and schema-patch retry semantics.
4. **PR-D (WS1/WS2):** KV cache proxy decision plus KV helper/key/TTL adoption in a small set of routes.
5. **PR-E (WS6):** Timeout/retry/fail-open primitives; migrate AI insights, rate-limit KV, and plan/admin middleware first.
6. **PR-F (WS6/WS8):** Stripe, Resend, OAuth resilience wrappers and truthful email-delivery behavior.
7. **PR-G (WS4):** Durable Object voter retry test + outer WebSocket error boundary.
8. **PR-H (WS4/WS3):** Expand session/question repositories, then split one `sessions.ts` concern at a time.
9. **PR-I (WS3):** Split `admin.ts`; opportunistically remove unsafe KV casts and repeated response code.
10. **PR-J (WS5/WS7):** Frontend shared types and hook cleanup, after backend DTO strategy is settled.

## Regression prevention checklist per PR

1. Add characterization tests before moving logic out of large route/DO files.
2. Keep security/resilience PRs separate from large file moves.
3. For API changes, assert stable envelope, trace id, status code, and no production raw error leakage.
4. For retry/timeout changes, test both success and degraded/fail-open behavior.
5. For WebSocket changes, test existing wire codes and aliases before any rename.
6. Run `npm test` for normal PRs; add `npm run type-check` for type/DTO/refactor PRs; note known pre-existing suite failures if encountered.
