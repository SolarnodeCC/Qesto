# Outstanding Work Across All Audit Workstreams

**Date:** 2026-05-02  
**Source of truth:** `audits/remediation-plan.md` + completed frontend polling dedupe changes.

## Executive status

| Workstream | Status | Completed | Outstanding |
|---|---|---|---|
| WS1: Shared foundations | Not started | None | Shared response helpers, KV JSON helpers, key/TTL constant consolidation |
| WS2: Security + correctness hotfixes | Not started | None | EH-01/02/03/04, CR-04, ST-04 |
| WS3: Backend modularization | Reviewed only | Scope reviewed | Split `energizers`, `auth`, `ai-insights`; enforce route/service/repository boundaries |
| WS4: Realtime/session refactor | Reviewed only | Scope reviewed | Vote strategy map, websocket handler registry, repositories, explicit lifecycle transitions |
| WS5: Frontend dedupe | In progress | `usePolledApi` + 3 admin hook migrations | Shared session types, session hook boilerplate dedupe, optional `useWebSocket` extraction |

## Detailed outstanding backlog

## WS1 — Shared foundations (blocking prerequisite)

1. Add `functions/api/lib/kv.ts` with `readKvJson` / `writeKvJson` and migrate duplicated call sites.
2. Add centralized API response helpers and replace inline envelopes.
3. Consolidate KV key builders and TTL/rate-limit constants in shared libs.
4. Add unit tests covering helpers and representative route migration.

## WS2 — Security + correctness

1. Update global `app.onError` to use sanitized production-safe messages.
2. Replace raw error messages in `energizers` route catch blocks.
3. Add schema-validated parsing for energizer creation payloads.
4. Fix Durable Object voters init rejection caching (`ensureVoters` retry path).
5. Rewrite audit query builder (`queryAuditEvents`) for typed clause assembly and stable count query.
6. Resolve KV cache proxy namespace wiring bug and regression-test it.

## WS3 — Backend modularization

1. Split `functions/api/routes/energizers.ts` into kind-specific route modules + shared guards.
2. Split `functions/api/routes/auth.ts` by protocol flows.
3. Split `functions/api/routes/ai-insights.ts` into cache/search/generate helpers.
4. Keep one monolith split per PR to control merge conflict and regression risk.

## WS4 — Realtime/session state

1. Convert `SessionRoom` vote branching to strategy handlers.
2. Replace websocket `switch` with message-handler registry.
3. Introduce `SessionRepository` / `QuestionRepository` abstractions for sessions domain.
4. Model explicit lifecycle transitions for session state updates.

## WS5 — Frontend dedupe/type alignment

### Already done
- `usePolledApi<T>()` introduced.
- `useAdminAnalytics`, `useAdminKpis`, `useAdminOps` migrated.

### Still outstanding
1. Remove duplicated frontend session-type declarations and align on shared contracts.
2. Reduce repeated loading/error state management in session-related hooks.
3. Optional: split `useLiveSession` transport lifecycle into `useWebSocket` + message/domain hooks.

## Recommended next execution order

1. **PR-A (WS2):** Error hardening + validation (EH-01/02/03/04).
2. **PR-B (WS2):** Audit SQL + KV cache proxy fix (CR-04, ST-04).
3. **PR-C (WS1):** Shared KV/response/key/constants helpers.
4. **PR-D/E/F (WS3):** One module split per PR (`energizers`, then `auth`, then `ai-insights`).
5. **PR-G/H (WS4):** SessionRoom strategy/handler extraction, then repository + lifecycle model.
6. **PR-I follow-ups (WS5):** Type alignment and `useLiveSession` extraction.
