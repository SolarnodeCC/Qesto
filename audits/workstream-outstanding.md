# Outstanding Work Across All Audit Workstreams

**Date:** 2026-05-03 (WS3/WS4 marked complete; WS1/WS2 unchanged vs remediation plan)  
**Source of truth:** `audits/remediation-plan.md` + completed frontend polling dedupe changes.

## Executive status

| Workstream | Status | Completed | Outstanding |
|---|---|---|---|
| WS1: Shared foundations | Not started | None | Shared response helpers, KV JSON helpers, key/TTL constant consolidation |
| WS2: Security + correctness hotfixes | Not started | None | EH-01/02/03/04, CR-04, ST-04 |
| WS3: Backend modularization | Done | Route packages (`energizers/`, `ai-insights/`, `auth/`); analyze/get thin handlers; `lib/insights-analyze-data.ts`, `lib/insights-vectorize.ts`, `ai-insights/constants.ts` | Optional: thicker service layer only where routes remain orchestration-heavy |
| WS4: Realtime/session refactor | Done | `lib/session-lifecycle.ts` (+ sessions REST wired); vote mutations in `lib/session-room-vote.ts`; DO header docs in `SessionRoom.ts`; insights-only `session-repository.ts` | Further repository coverage beyond insights; optional SessionRoom-internal registry polish |
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
3. ~~Split `functions/api/routes/ai-insights.ts`~~ → **`routes/ai-insights/`** (done).
4. ~~Deterministic insights bundle + Vectorize upsert/query~~ → **`lib/insights-analyze-data.ts`**, **`lib/insights-vectorize.ts`**; analyze/register-get use shared KV + **`lib/http`** helpers (done).
5. Keep enforcing route/service/repository boundaries on future edits.

## WS4 — Realtime/session state

1. ~~Vote branching policy~~ → **`lib/session-room-vote.ts`** (`applyVoteMutation`); documented from **`SessionRoom.ts`** (done).
2. ~~WebSocket handler registry~~ → presenter-side registry where applicable (done earlier); DO-side vote path uses shared policy module (done).
3. ~~Session repository abstraction~~ → **`lib/session-repository.ts`** (insights reads today); broader CRUD abstraction optional later.
4. ~~Explicit lifecycle transitions~~ → **`lib/session-lifecycle.ts`** (`requireDraft`, `requireLiveForClose`, `requireLiveForWebSocket`, `rejectDraftForResults`, `requireClosedOrArchivedForInsights`, etc.) wired through **`routes/sessions.ts`** (done).

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
4. ~~**PR-D/E/F (WS3):** Module splits + insights libs~~ (done).
5. ~~**PR-G/H (WS4):** Vote policy module + lifecycle helpers~~ (done).
6. **PR-I follow-ups (WS5):** Type alignment and `useLiveSession` extraction.
