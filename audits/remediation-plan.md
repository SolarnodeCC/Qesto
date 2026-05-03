# Audit Remediation Plan — Dependency-Safe Execution

**Date:** 2026-05-02  
**Inputs reviewed:**
- `audits/error-handling-audit.md`
- `audits/code-duplication-audit.md`
- `audits/code-complexity-audit.md`
- `audits/design-pattern-audit.md`

## 1) Consolidated problem map

We can cluster the findings into 5 workstreams:

1. **Shared foundations** (cross-cutting helpers): response envelope, error sanitization usage, KV JSON helpers, constants centralization.
2. **Security + correctness hotfixes**: production error leakage, malformed JSON handling, DO rejection caching, SQL builder fragility.
3. **Backend modularization**: split monolithic route files (`energizers`, `auth`, `ai-insights`) and introduce repository/service boundaries.
4. **Realtime/session state simplification**: `SessionRoom` strategy dispatch and websocket handler decomposition.
5. **Frontend de-duplication**: polling hook abstraction + type source-of-truth alignment.

## 2) Dependency graph (what must happen first)

### Base dependencies
- **Error helper standardization first** before touching route refactors, so new modules inherit safe behavior.
- **Response envelope helper first** before large route splits, so migrated files don’t reintroduce inline response drift.
- **KV read/write helper first** before repo extraction, since repositories should consume shared IO primitives.

### Critical sequencing constraints
1. `lib/error-handler` adoption in global `app.onError` must land **before** route-level cleanup to guarantee minimum safety even if route migration is partial.
2. `audit.ts` query builder rewrite should land **before** repository extraction for audit concerns, to avoid reworking two abstractions at once.
3. `sessions` schema patch migration strategy decision must be finalized **before** splitting `sessions.ts`; otherwise branch churn is high.
4. Frontend hook dedupe (`usePolledApi`) can run in parallel with backend work because dependency surface is minimal.

## 3) Phased implementation plan (low blast radius)

## Phase 0 — Safety net and observability baseline
**Goal:** make changes measurable and reversible.

- Add/confirm targeted tests around:
  - `app.onError` status/code/message mapping
  - `sanitizeError` behavior in dev vs production
  - `queryAuditEvents` filtering/count consistency
  - `SessionRoom.ensureVoters()` retry behavior after rejection
- Add a lightweight migration checklist in PR templates / docs for large file splits.

**Why first:** prevents silent regressions while refactoring high-complexity modules.

## Phase 1 — Immediate security/correctness fixes (highest priority)

Address audit IDs: `EH-01`, `EH-02`, `EH-03`, `EH-04`, `CR-04`, `ST-04`.

1. **Global error safety**
   - Wire `sanitizeError()` into `app.onError`.
   - Normalize canonical error codes per status (401/403/404/409/429/500).
2. **Energizers input + error handling hardening**
   - Replace typed `req.json<T>()` cast with `safeParse` flow.
   - Replace raw `err.message` client responses with sanitized message.
3. **Durable Object rejection handling**
   - Add `.catch()` on voters init promise; clear cached rejected promise.
4. **Audit SQL builder reliability**
   - Replace string replacement count query with explicit where-clause builder.
   - Use typed clause/value arrays and explicit selected columns.
5. **KV cache namespace proxy bug (`ST-04`)**
   - Fix binding usage and add test to prevent regression.

**Exit criteria:** no client-facing raw internal errors in production paths; malformed JSON returns 400; DO storage transient failures recover.

## Phase 2 — Foundation deduplication layer

Address audit IDs: `F-02`, `F-03`, `F-05`, `F-07`, `F-10`, partially `DM-01`.

1. Create `functions/api/lib/kv.ts` with `readKvJson`/`writeKvJson`.
2. Create API response factory helpers (e.g. `ok(c, data, status?)`, `fail(c, code, message, status, details?)`).
3. Consolidate key builders and TTL/rate-limit constants under `lib/keys.ts` and `lib/constants.ts`.
4. Migrate low-risk route files first (`users`, `teams`, `quota`, then `admin`).

**Why now:** reduces duplication before large modular splits, minimizing repeated edits.

## Phase 3 — Complexity reduction in monolith modules

Address audit IDs: `C-01`, `C-02`, `C-03`, `BH-02`, `BH-05`, `DM-05`.

1. **Split `energizers.ts`** into kind-focused subrouters + shared guards.
2. **Split `auth.ts`** by protocol (magic link, oauth, saml, password, session endpoints).
3. **Refactor `ai-insights.ts`** into cache/search/generate helpers.
4. During splits, enforce service boundaries:
   - Route layer: HTTP/validation/response only
   - Service layer: orchestration
   - Repository layer: D1/KV operations

**Risk control:** one module split per PR; no simultaneous schema changes.

## Phase 4 — Session/Realtime domain refactor

Address audit IDs: `C-04`, `C-05`, `BH-01`, `DM-04`, `DM-02`.

1. Implement vote-policy strategy map (`once`, `multi`, `react`, `multi_select`).
2. Extract websocket message handler registry from switch.
3. Introduce `SessionRepository` + `QuestionRepository` for `sessions.ts` dependencies.
4. Replace implicit lifecycle checks with explicit state transition helpers.

**Dependency note:** do this after Phase 2 helpers so repositories can reuse shared abstractions.

## Phase 5 — Frontend dedupe and type alignment

Address audit IDs: `F-01`, `F-06`, `F-08`, plus leftover medium complexity in hooks.

1. Add `usePolledApi<T>()` and migrate admin polling hooks.
2. Remove duplicated frontend session type declarations; import/generated shared contracts.
3. Consolidate loading/error boilerplate in session hooks.
4. Optional: split `useLiveSession` with lower-level `useWebSocket`.

**Runs parallel** with backend Phases 3–4, but merge independently.

## 4) Suggested PR slicing (to avoid impact overlap)

1. **PR-A:** Error hardening (`EH-01/02/03/04`) + tests.
2. **PR-B:** Audit SQL builder (`CR-04`) + cache proxy bug (`ST-04`).
3. **PR-C:** KV/response/key/constants shared foundation (`F-02/03/05/07/10`).
4. **PR-D:** `energizers` split (`C-01` + remaining energizer EH items).
5. **PR-E:** `auth` split (`C-02/BH-02`).
6. **PR-F:** `ai-insights` split (`C-03/BH-05`).
7. **PR-G:** `SessionRoom` strategies + websocket handlers (`C-04/C-05/BH-01`).
8. **PR-H:** repository/state pattern in sessions (`DM-02/DM-04/DM-05`).
9. **PR-I:** frontend dedupe/types (`F-01/F-06/F-08`).

## 5) Regression prevention checklist per PR

- Unit tests for touched domain pass.
- `npm run typecheck` passes.
- For API PRs: assert stable response envelope (`ok/error/trace_id`) and no leaked internals.
- For refactors: add one characterization test before moving logic.
- Avoid mixed concerns: no schema migration + route split in same PR.

## 6) Definition of done (program level)

- No production response returns unsanitized runtime/internal error messages.
- Major route modules each stay below agreed complexity threshold (target CC < 15 per handler).
- Shared helpers adopted broadly (no repeated ad-hoc `KV get/parse`, envelope boilerplate).
- Sessions/Realtime logic uses explicit strategy/state transitions.
- Frontend polling hooks share one generic implementation.
- Audit findings can be closed with test-backed evidence and mapped PR links.
