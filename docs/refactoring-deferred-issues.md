# Deferred Refactoring Issues — Ready to File

Companion to [`REFACTORING_AUDIT.md`](./REFACTORING_AUDIT.md) and [`REMEDIATION_PLAN.md`](./REMEDIATION_PLAN.md).
File these as GitHub issues for future release trains. Labels suggested: `tech-debt`, `backend`, severity label.

---

## Issue 1: Migrate remaining raw `AI.run` sites through `runAI()` facade

**Labels:** `tech-debt`, `backend`, `high`

**Context:** 🟠 High audit finding — 32 raw `env.AI.run` / `ai.run(` call sites bypass `runAI()` in `lib/ai/ai-gateway.ts` (ADR-0068). CI ratchet: `scripts/check-ai-gateway.mjs` (baseline 32).

**Acceptance criteria:**
- [ ] Migrate raw call sites to `runAI(env, model, input, opts?)`
- [ ] Fold duplicated retry/timeout from `help-rag.ts` / `ai-insights.ts` into the facade
- [ ] `npm run test:eval` stays green per batch (REV-10)
- [ ] Lower `BASELINE` in `scripts/check-ai-gateway.mjs`

---

## Issue 2: Extract D1 repositories for billing, integrations, teams, wizard

**Labels:** `tech-debt`, `backend`, `high`, `database`

**Context:** 🟠 High — 329 inline `env.DB.prepare` in routes. Reference: `sessionLifecycleRepository.ts` (ADR-0069). Ratchet: `scripts/check-d1-access.mjs` (baseline 329).

**Acceptance criteria:**
- [ ] Per-domain repositories for billing, integrations, teams, sessions/wizard
- [ ] No new inline `prepare()` in route handlers
- [ ] Lower D1 access baseline per batch
- [ ] Unit tests for repository query logic where feasible

---

## Issue 3: Extract service layer from remaining god route files

**Labels:** `tech-debt`, `backend`, `high`

**Context:** 🟠 High — `integrations.ts`, `teams.ts`, `sessions/wizard.ts`, `billing.ts` mix 5–7 concerns inline. Lifecycle slice done.

**Acceptance criteria:**
- [ ] Per-domain services (`integrationOAuthService`, `teamMembershipService`, …)
- [ ] Handlers: parse → authorize → service → respond
- [ ] Shared OAuth callback flow for 5 providers
- [ ] Optional: route-file size ratchet (>600 LOC)

---

## Issue 4: Continue `errorResponse()` migration (449 remaining)

**Labels:** `tech-debt`, `backend`, `medium`

**Context:** 🟡 Medium — 449 inline `ok: false` envelopes remain. Baseline lowered 610 → 449. Ratchet: `scripts/check-error-response.mjs`.

**Acceptance criteria:**
- [ ] Codemod remaining route files to `errorResponse(c, status, code, message)`
- [ ] Lower baseline toward 0
- [ ] Special cases (SAML `retry-after`, dynamic error objects) documented or extended helper

---

## Issue 5: Split `functions/api/types.ts` into domain modules

**Labels:** `tech-debt`, `backend`, `medium`

**Context:** 🟡 Medium — 468-line cross-domain dumping ground (Env, session, billing, embed, api envelope).

**Acceptance criteria:**
- [ ] Split into `types/{env,config,session,billing,embed,api}.ts`
- [ ] Barrel re-export for backward compatibility
- [ ] `tsc --noEmit` green; no import churn in consumer PRs

---

## Issue 6: Split frontend god components and hooks

**Labels:** `tech-debt`, `medium`

**Context:** 🟡 Medium — `Present.tsx`, `useLiveSession.ts`, `JoinPage.tsx`, `SessionWizard.tsx` co-locate WS, polling, SSE, and business rules.

**Acceptance criteria:**
- [ ] `useLiveSession` → `useWsTransport` + `useSessionReducer` + per-feature send hooks
- [ ] Extract `useEnergizerPolling` from `JoinPage`
- [ ] Move wizard SSE/creation into dedicated hook
- [ ] Vitest coverage for extracted hooks

---

## Issue 7: Consolidate copilot context modules

**Labels:** `tech-debt`, `backend`, `low`

**Context:** 🟢 Low — ~9 `copilot-*.ts` files with overlapping KV context responsibilities; `copilot-multturn.ts` naming overlap.

**Acceptance criteria:**
- [ ] Single `copilotContextStore` for context + checkpoint snapshots
- [ ] Remove or merge vestigial `copilot-multturn.ts` if redundant
- [ ] Document KV key ownership

---

## Issue 8: Refactor `useAdminAnalyticsAdvanced` parallel fetch pattern

**Labels:** `tech-debt`, `low`

**Context:** 🟢 Low — still hand-rolls loading/error state; parallel `Promise.all` does not fit `useApiQuery` one-shot pattern.

**Acceptance criteria:**
- [ ] Shared `useParallelApiQuery` or equivalent for multi-endpoint admin dashboards
- [ ] Consistent loading/error semantics with `useAdminKpis` / `useApiQuery`
