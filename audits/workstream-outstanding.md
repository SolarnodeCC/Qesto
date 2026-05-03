# Outstanding Work Across All Audit Workstreams

**Date:** 2026-05-03 (WS3 auth/energizers/ai-insights status refreshed)  
**Source of truth:** `audits/remediation-plan.md` + completed frontend polling dedupe changes.

## Executive status

| Workstream | Status | Completed | Outstanding |
|---|---|---|---|
| WS1: Shared foundations | Not started | None | Shared response helpers, KV JSON helpers, key/TTL constant consolidation |
| WS2: Security + correctness hotfixes | Not started | None | EH-01/02/03/04, CR-04, ST-04 |
| WS3: Backend modularization | In progress | `energizers/`, `ai-insights/`, `auth/` route packages | Optional: extract non-HTTP helpers from `ai-insights`; add service layer where routes stay fat |
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

1. ~~Split `functions/api/routes/energizers.ts`~~ → **`routes/energizers/`** (done).
2. ~~Split `functions/api/routes/auth.ts`~~ → **`routes/auth/`** (`magic-link`, `session-routes`, `password`, `oauth`, `saml`, `constants`, `schemas`, `cookie`, `helpers`; `mountAuthRoutes` in `index.ts`) (done).
3. ~~Split `functions/api/routes/ai-insights.ts`~~ → **`routes/ai-insights/`** (done). Optional: move deterministic bundle + Vectorize steps into `lib/` pure helpers.
4. Keep enforcing route/service/repository boundaries on future edits.

## WS4 — Realtime/session state

1. Convert `SessionRoom` vote branching to strategy handlers.
2. ~~Replace websocket `switch` with message-handler registry~~ → registry + presenter handlers (done); vote-policy strategies still outstanding.
3. Introduce `SessionRepository` / `QuestionRepository` abstractions for sessions domain (`lib/session-repository.ts` used by insights only so far).
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
