# Refactoring Opportunities Audit — Qesto

**Date:** 2026-06-28
**Scope analysed:** `functions/`, `worker/`, `src/`
**Excluded:** generated files, `node_modules`, vendored code, already-run migrations
**Method:** evidence-based — every finding cites ≥2 concrete `file:line` references; hard counts are reproduced via `grep`/`wc`, not estimated.

---

## Verified evidence baseline (hard counts)

| Metric | Count | Command basis |
|---|---|---|
| Raw `AI.run` / `ai.run(` call sites | **38** across ~22 files | `grep -rn "\.AI\.run\|ai\.run(" functions/api` |
| Files using `runThroughAIGateway` wrapper | **2** (gateway + session-context) | grep |
| Inline `env.DB.prepare` in routes | **288** across **57** route files | `grep -rn "env\.DB\.prepare" functions/api/routes` |
| Repository files | **4** (session, embedWidget, studioLibrary, kbVector) | `ls functions/api/repositories/` |
| Inline `ok: false` error responses in routes | **610** | `grep -rn "ok: false" functions/api/routes` |
| Files using `sanitizeError` helper | **17** | grep |
| `any` usage (`: any` / `as any` / `<any>`) | **37** functions, **3** src | grep |
| `insights-vectorize.ts` vs `help-vectorize.ts` | 135 vs 140 LOC, parallel structure | wc + read |
| `functions/api/lib` modules | ~200 files | ls |

**Severity scale:** 🔴 Critical (active bug source / blocks correct behaviour) · 🟠 High (significant maintenance burden or risk on next change) · 🟡 Medium (noticeably improves readability/testability) · 🟢 Low (nice-to-have).

---

## Findings

### 🟠 [High] Workers AI calls bypass the gateway wrapper; retry logic is copy-pasted
**Categorie:** Cloudflare-specifieke patterns / Duplicatie
**Locatie:** `functions/api/lib/ai/ai-gateway.ts:81` (wrapper), 38 raw call sites incl. `functions/api/routes/copilot-context.ts:207`, `functions/api/routes/studio.ts:121`, `functions/api/lib/ai-insights.ts:245`, `functions/api/lib/help-rag.ts:165`.
**Wat:** A caching/rate-limit-aware wrapper `runThroughAIGateway()` exists but only 2 files use it; 38 sites call `c.env.AI.run()` raw. Retry/timeout logic is duplicated (`help-rag.ts` and `ai-insights.ts` both reimplement retry + `withTimeout`; `copilot-context.ts` has none).
**Bewijs:** `runThroughAIGateway` importers = `ai-gateway.ts`, `ai/session-context.ts` only. Raw sites: `ai-insights.ts:245` retry loop w/ `AI_TIMEOUT_MS=25s`; `help-rag.ts:158-202` retry loop w/ `RETRY_DELAYS_MS=[200,400]`; `copilot-context.ts:207` no retry.
**Impact:** Inconsistent latency/cost behaviour, no semantic caching on most calls, divergent failure handling, no single place to tune model/timeout/retry. AI-eval gate (REV-10) risk on prompt/model changes scattered across files.
**Voorstel:** Make `runThroughAIGateway()` (or a thin `runAI(env, model, input, opts)`) the single entry point with built-in timeout + retry + gateway fallback; migrate the 38 sites incrementally, starting with the no-retry ones.
**Effort:** L

### 🟠 [High] D1 access is overwhelmingly inline; the repository layer is unused
**Categorie:** Coupling / Inconsistente patterns
**Locatie:** 288 `env.DB.prepare` calls across 57 route files (e.g. `routes/billing.ts:52,64,81`, `routes/tournaments.ts:29,47,61`, `routes/insights.ts:71-150`) vs only 4 repos (`repositories/sessionRepository.ts:17-80`).
**Wat:** Repository-layer intent (REPO-LAYER-01) is for routes to use repositories, but ~86% of D1 interactions are inline `prepare().bind().first/run()` in handlers — SQL mixed with HTTP and business logic.
**Bewijs:** `sessionRepository.ts:17` `fetchSessionTitleForOwner()` (the intended pattern) vs `insights.ts:71-80,114-125,132-150` (all queries inline in the route).
**Impact:** SQL duplicated, no central place for tenant-scoping/ownership invariants, schema changes ripple across 57 files, near-impossible to unit-test query logic without a DB.
**Voorstel:** Grow the repository layer per domain (teams, billing, tournaments, sessions); move inline `prepare()` into repo functions that take only `D1Database` + params. Don't big-bang — extract per route file as it's touched.
**Effort:** L

### 🟠 [High] God route files mix routing + validation + business logic + persistence + external calls
**Categorie:** God objects / files
**Locatie:** `routes/integrations.ts` (1021), `routes/teams.ts` (992), `routes/sessions/wizard.ts` (933), `routes/billing.ts` (820), `routes/sessions/lifecycle.ts` (724).
**Wat:** Single handlers orchestrate 5–7 concerns inline with no service layer.
**Bewijs:**
- `sessions/lifecycle.ts:111-355` — `start` handler = 245 lines: load+validate, 4× journey events, retro/ideate extras, energizer count, DB update, DO init+retry, rollback, analytics, multi-region.
- `teams.ts:747-831` — invite handler = membership check + quota + token + KV + email + 2× audit.
- `integrations.ts:251-307` — each of 5 OAuth provider callbacks duplicates the same exchange→encrypt-token→KV-write→emit-event flow (`:251` Slack, `:689` Zoom, `:754` Salesforce).
- `billing.ts:106-181` — an entire minimal Stripe REST client embedded as a nested function.
**Impact:** Highest onboarding cost, hardest to test, change-amplification, duplicated provider flows.
**Voorstel:** Extract per-domain services (`sessionLifecycleService`, `teamMembershipService`, `integrationOAuthService` with one generic provider-callback flow, `stripeClient` to its own module). Handlers shrink to parse → call service → respond.
**Effort:** L

### 🟡 [Medium] Error responses reinvented 610× instead of one builder; `sanitizeError` mostly bypassed
**Categorie:** Duplicatie / Inconsistente patterns
**Locatie:** 610 inline `c.json({ ok:false, error:{code,message}, trace_id }, status)` in routes; helper `lib/error-handler.ts:8` (`sanitizeError`) used in only 17 files.
**Wat:** Every route hand-builds the error envelope; the sanitization helper is applied ad-hoc (mostly in catch blocks), not at the response boundary.
**Bewijs:** `routes/sovereign.ts:53`, `routes/billing.ts:251`, `routes/teams.ts:281` each inline the full shape; `error-handler.ts:8` defines the prod-safe builder that 593 of 610 sites don't use.
**Impact:** Error-code drift, inconsistent prod leakage of 5xx detail, no single registry of codes, trace_id occasionally forgotten.
**Voorstel:** Add `errorResponse(c, status, code, message)` helper (or Hono `onError` + `HTTPException`) that always applies `sanitizeError` + trace_id; codemod the 610 call sites.
**Effort:** M

### 🟡 [Medium] Vectorize pipelines duplicated across DECISIONS / HELP / KB
**Categorie:** Duplicatie / Cloudflare-specifieke patterns
**Locatie:** `lib/insights-vectorize.ts` (135) and `lib/help-vectorize.ts` (140) — parallel embed→query→filter→upsert; KB path lives separately in `repositories/kbVectorRepository.ts`.
**Wat:** Two near-identical implementations of the same bge-m3 embed+query pipeline; only the metadata filter differs (team_id vs plan-scope). Three indices, three code shapes.
**Bewijs:** Both files define the same constants block (model `@cf/baai/bge-m3`, dim 1024, topK 3, timeouts), both wrap with `withTimeout` + `firstEmbeddingVector` (10 occurrences each): `insights-vectorize.ts:46-66` vs `help-vectorize.ts:42-95`.
**Impact:** Fixes/tuning must be applied in parallel; risk of the two drifting (already different min_score: 0.75 vs 0.70).
**Voorstel:** Extract `embedAndQuery(index, env, { text, topK, minScore, filter })` shared helper; the three call sites pass their index binding + filter.
**Effort:** M

### 🟡 [Medium] Whole `Env` leaks into deep business-logic functions (testability blocker + coupling)
**Categorie:** Testability blockers / Coupling
**Locatie:** `routes/integrations.ts:145` `buildRedirectUri(env)`, `:151` `getSlackProvider(env)`; `routes/billing.ts:56` `recordCustomerMapping(env,…)`, `:627` `handleCheckoutSessionCompleted(c)`.
**Wat:** Functions accept the entire `Env`/`Context` but use 1–3 bindings, hiding real dependencies and forcing full-env mocks to test.
**Bewijs:** `getSlackProvider(env)` uses only `SLACK_CLIENT_ID`/`SLACK_CLIENT_SECRET`; `recordCustomerMapping(env,…)` uses only `USERS_KV`+`DB`. (Good counter-examples exist: `copilot-live-context.ts:51` and the vectorize `Pick<Env,…>` bindings show the right narrowing.)
**Impact:** Hard unit testing, implicit coupling, refactors of `Env` ripple widely.
**Voorstel:** Adopt the existing `Pick<Env, ...>` / explicit-param style project-wide; pass only the bindings a function uses.
**Effort:** M

### 🟡 [Medium] Frontend god components hold 30+ state vars + WS + fetching + business logic
**Categorie:** Frontend-specifiek / God objects
**Locatie:** `src/pages/Present.tsx` (657), `src/hooks/useLiveSession.ts` (617), `src/pages/JoinPage.tsx` (491), `src/components/SessionWizard.tsx` (476).
**Wat:** Components co-locate WebSocket lifecycle, polling, SSE parsing, business rules and rendering.
**Bewijs:** `useLiveSession.ts:279-453` = 174 lines WS setup/reconnect/parse + 13 `sendX` callbacks `:465-597`; `JoinPage.tsx:219-238` manual energizer `setInterval` polling inside the component; `SessionWizard.tsx:43-123` = 22 `useState` + inline SSE parsing.
**Impact:** Untestable UI logic, re-render risk, duplicated polling patterns.
**Voorstel:** Split `useLiveSession` into `useWsTransport` + `useSessionReducer` + per-feature send hooks; extract energizer polling to `useEnergizerPolling`; move wizard SSE/creation into a hook.
**Effort:** L

### 🟡 [Medium] Dual auth model: global RBAC middleware vs inline team-permission checks
**Categorie:** Inconsistente patterns / Coupling
**Locatie:** `middleware/rbac.ts:236-289` (PERMISSION_MATRIX) vs inline `hasTeamPermission(...)` in `routes/teams.ts:252-271`, `routes/marketplace-connect.ts:60`, `routes/marketplace-listings.ts:66`; plus SQL-level ownership in `routes/sessions/shared.ts:206-238`.
**Wat:** Three coexisting authorization styles (matrix middleware, in-handler permission calls, `WHERE owner_id`) with no documented contract for which to use when.
**Bewijs:** see locations above — global matrix gate + per-handler `hasTeamPermission` + SQL ownership.
**Impact:** Easy to forget a check on new routes; reviewers can't rely on one mental model; audit risk.
**Voorstel:** Define a `requireTeamPermission(permission)` middleware factory and standardise on it; reserve SQL ownership for defence-in-depth only.
**Effort:** M

### 🟡 [Medium] `functions/api/types.ts` is a 468-line cross-domain dumping ground
**Categorie:** Naming & leesbaarheid / Coupling
**Locatie:** `functions/api/types.ts:4-90` (Env), `:87-221` (config vars), `:223-292` (session), `:294-351` (embed), `:352-460` (user/plan/`PLAN_QUOTAS`), `:462-468` (api envelope).
**Wat:** Env bindings, feature flags, session domain, billing quotas and embed protocol all in one file imported almost everywhere → any edit rebuilds the world.
**Bewijs:** `PLAN_QUOTAS` 67-line data constant at `:393` sits beside `SessionStatus` type at `:223`.
**Impact:** Build amplification, poor discoverability, merge contention.
**Voorstel:** Split into `types/{env,config,session,billing,embed,api}.ts`; re-export a barrel for compatibility.
**Effort:** M

### 🟢 [Low] Copilot module sprawl with overlapping context responsibilities
**Categorie:** Coupling / Naming
**Locatie:** ~9 `lib/copilot-*.ts` + `routes/copilot-context.ts` (665). Overlap between `copilot-context.ts` (`copilotContextKvKey`), `copilot-live-context.ts:51` and `copilot-checkpoint.ts` (all manage context snapshots in KV).
**Wat:** Unclear division of labour; `copilot-multturn.ts` (29 LOC) looks vestigial.
**Bewijs:** `copilot-context.ts:29` defines the KV key; `copilot-checkpoint.ts` also stores snapshots; naming `multturn` (typo) vs `copilot-suggest.ts` multi-turn logic.
**Impact:** Onboarding confusion, KV-key collision risk.
**Voorstel:** Consolidate context/checkpoint into one `copilotContextStore`; delete/merge `copilot-multturn.ts` if dead.
**Effort:** M

### 🟢 [Low] Duplicated fetch/loading/error boilerplate in admin hooks
**Categorie:** Duplicatie / Frontend-specifiek
**Locatie:** Base hooks `useApiQuery.ts`, `usePolledApi.ts` exist and are used correctly by `useAdminAnalytics.ts:34`, `useAdminKpis.ts:12`; but `useAdminUsers.ts:20-46`, `useAdminAnalyticsAdvanced.ts:25-46`, `useAdminUserDetail.ts:43-59` reimplement `setLoading/setError/setData` + manual `useEffect`.
**Wat:** ~4 hooks hand-roll the boilerplate the base hooks already provide.
**Bewijs:** `useAdminKpis.ts:12` one-liner vs `useAdminUsers.ts:20-46` manual triple-state.
**Impact:** Minor maintenance drift; inconsistent loading/error semantics.
**Voorstel:** Refactor the outliers onto `useApiQuery`.
**Effort:** S

### 🟢 [Low] Repeated string-literal unions instead of shared types
**Categorie:** Type safety gaps
**Locatie:** `useAdminOps.ts:3` and `useAdminPlatformOverview.ts:3` both define `type ServiceStatus = 'healthy'|'degraded'|'down'`; energizer kinds as literals in `useLiveSession.ts:24` and mapped again in `components/sessionWizard.helpers.ts:105-110`.
**Wat:** Same domain unions redefined; no single source of truth.
**Bewijs:** identical `ServiceStatus` in two files; energizer-kind literals in 2+ places.
**Impact:** Drift when a value is added in one place only.
**Voorstel:** Hoist shared unions to `src/types/`; reuse.
**Effort:** S

### 🟢 [Low] Misleading names hiding side-effects / silent failure
**Categorie:** Naming & leesbaarheid
**Locatie:** `src/lib/branding.ts:12` `applyBrandingToDocument` (mutates document CSS vars), `src/lib/branding.ts:27` `cacheJoinSession` (swallows quota errors), `components/sessionWizard.helpers.ts:91` `normalizeQuestionKind` (defaults to `'poll'`, not pure).
**Wat:** Names under-describe DOM mutation / silent-catch / defaulting behaviour.
**Impact:** Low; surprises on read.
**Voorstel:** Rename or document (`applyBrandingCssVars`, `tryCacheJoinSession`, `coerceQuestionKind`).
**Effort:** S

### ⚪ Notes (no finding)
- **KV access is well-wrapped** (`lib/kv.ts` `readKvJson/writeKvJson` used ~95% of the time) — not a problem.
- **Dead code:** spot-checked `src/utils/*` are all imported; no obvious unused exports found in sampling.

---

## Slotsectie

### Top 3 quick wins (impact/effort)
1. **`errorResponse()` helper + codemod** the 610 inline error envelopes (Medium effort, removes the single most-duplicated pattern and fixes prod leakage of 5xx detail).
2. **Single `runAI()` wrapper** over the 38 raw `AI.run` sites (kills duplicated retry logic, enables caching/cost control in one place).
3. **Shared `embedAndQuery()`** for the 3 Vectorize indices (removes the insights↔help twin files).

### Top 1 structurele investering
Introduce a **service + repository layer** between Hono routes and the Workers bindings. Today 288 inline `DB.prepare` calls and 700–1000-line god routes prove the boundary is missing. A per-domain service (teams, billing, sessions, integrations) + repository prevents the recurring "handler does everything" pattern and unlocks unit testing.

### Onderliggend patroon
**Workers bindings leak straight through into handlers and deep helpers.** Most findings (god routes, inline D1, whole-`Env` params, raw AI/Vectorize calls, inline error envelopes) share one root cause: there is no consistent abstraction layer between `c.env`/`Context` and business logic. Where the team *did* add a boundary (`kv.ts`, `runThroughAIGateway`, repositories, `Pick<Env>` vectorize bindings), the code is clean — those abstractions just haven't been adopted broadly. The fix is consistency: make the existing good patterns the default path rather than the exception.
