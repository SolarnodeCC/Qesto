# Future-Ready Refactoring Review — June 2026

> **Scope:** Full codebase — `functions/`, `src/`, `worker/`, `migrations/`, `tests/`, build config, dependencies.
> **Purpose:** Identify refactoring actions that keep Qesto maintainable, upgradeable, and safe to evolve.
> **Supersedes:** `TECH_DEBT_AUDIT_2026-05.md` — re-verified against current `HEAD`; ~70% of that audit is already remediated (see §1).

---

## 0. Headline

The codebase is in **good** structural and dependency health. The most impactful refactors from the May 2026 audit have already landed. What remains is a short tail of consolidation work plus a few forward-looking guardrails. **No critical, change-blocking debt remains.** The biggest *future-readiness* risk is not stale code — it's a few large modules and a handful of governance gaps (API deprecation, KV access discipline) that will compound if left unmanaged.

---

## 1. What the May audit flagged that is now FIXED ✅

Re-verifying each item against current `HEAD` — most have been resolved since the audit was generated (2026-05-31):

| ID | May claim | Current state | Status |
|----|-----------|---------------|--------|
| TD-01 | `SessionRoom.ts` = 2,242 lines, God object | **1,256 lines**; `session-room-energizer-handler.ts` + `session-room-townhall-handler.ts` extracted | ⚠️ Mostly done |
| TD-02 | 35 `DB.prepare as any` casts | **1 remaining** | ✅ Fixed |
| TD-03 | Migration gaps 0017–0041 | Filled with `00NN_reconcile_gap.sql`; `scripts/check-migration-gaps.mjs` + `check:migrations` CI gate added | ✅ Fixed |
| TD-06 | 25 raw-env feature flags | `lib/flags.ts` exists; **1 raw-env site left** | ✅ Fixed |
| TD-07 | Sprint-named route files | Production route files renamed/removed; only 2 *test* files keep sprint names | ✅ Fixed |
| TD-09 | 71 `console.log` calls | **8 remaining** | ✅ Mostly fixed |
| TD-11 (part) | "Enable `strict` in tsconfig" | `strict: true` already set — plus `noUnusedLocals`, `exactOptionalPropertyTypes`, `noImplicitOverride` | ✅ Already on |

**Action:** Delete or archive `TECH_DEBT_AUDIT_2026-05.md` so it stops being cited as current. This document replaces it.

---

## 2. Genuinely remaining refactors (verified June 2026)

### R-01 — Three overlapping validation modules 🟠
- `lib/validate.ts` (628 B) — a single `validateBody()` helper.
- `lib/validation.ts` (9.8 KB) — Zod schemas for sessions/questions/AI.
- `lib/validators.ts` (25 KB) — WebSocket `ClientMessage`, auth claims, OAuth state schemas.

The names are near-synonyms; import sites guess wrong constantly. These have **distinct responsibilities** but terrible names.
**Fix:** Rename for intent, not size — `validate.ts` → `request-validation.ts`, `validation.ts` → `domain-schemas.ts`, `validators.ts` → `protocol-schemas.ts`. Add a barrel `validation/index.ts`. Low risk, mechanical.
**Effort:** Small (1 day).

### R-02 — 50 direct `*_KV` accesses across 18 files 🟠
A `lib/kv.ts` abstraction exists but is bypassed in 18 files (TTL policy, serialization, and error handling duplicated ad hoc). This is the *largest* remaining consistency gap and it grew since May (26 → 50 sites).
**Fix:** Route all KV reads/writes through `lib/kv.ts` + `kv-keys.ts` builders. Add a CI grep gate banning `env.*_KV.` outside `lib/kv.ts`. Migrate incrementally, namespace by namespace.
**Effort:** Medium (3–4 days).

### R-03 — Three live public API versions, no deprecation signal 🟡 (future-ready)
`public-api-v1.ts`, `-v2.ts`, `-v3.ts` all serve traffic. **No `Deprecation`/`Sunset` headers** on v1/v2, no documented migration path. This is the single biggest *external* future-readiness liability: every external integrator pins to whatever version they found first, and you can never retire one.
**Fix:** (a) Add `Deprecation: true` + `Sunset: <date>` headers to v1/v2 responses; (b) write a v1→v3 migration note in `knowledge-base/specifications/`; (c) add usage telemetry per version so retirement is data-driven.
**Effort:** Small-Medium (2–3 days).

### R-04 — ~20 `: any` annotations concentrated in workflows + middleware 🟡
`strict` is on, so these are deliberate escape hatches. Hotspots: `lib/workflows/session-pipeline.ts` (6), `middleware/kv-cache.ts` (5), `middleware/rbac.ts` (2). These sit on the request-auth and AI-pipeline paths where a wrong shape corrupts silently.
**Fix:** Replace `any` with `unknown` + Zod/type guards, prioritising `rbac.ts` and `kv-cache.ts` (security-adjacent). Add `"@typescript-eslint/no-explicit-any": "warn"` to stop regrowth.
**Effort:** Medium (2–3 days).

### R-05 — Large frontend modules approaching unmaintainable size 🟡
Not in the May audit (backend-only scope). These are the future-maintainability hotspots on the client:
- `src/components/SessionWizard.tsx` — **1,362 lines**
- `src/pages/TeamSettings.tsx` — **1,331 lines**
- `src/pages/Dashboard.tsx` — **1,103 lines**
- `src/pages/JoinPage.tsx` / `Launchpad.tsx` — ~1,000 lines each

**Fix:** Extract step components + hooks (`SessionWizard` → one component per wizard step + `useWizardState`; `TeamSettings` → tabbed sub-panels). No behaviour change; pure decomposition for testability.
**Effort:** Medium per file — do opportunistically when next touching each.

### R-06 — `SessionRoom.ts` finish-the-job 🟢
Down to 1,256 lines with handlers extracted, but vote processing + rate limiting + alarm dispatch still live in the core DO.
**Fix:** Extract `VoteProcessor` and fold `session-room-rate-limiter.ts` into an injected collaborator, leaving the DO as WS-lifecycle + alarm dispatch only. Lower urgency now that it's under control.
**Effort:** Medium (1 sprint).

---

## 3. Future-readiness scorecard (new dimension, not in May audit)

### Dependencies — 🟢 Excellent
Stack is at or near the latest majors. Nothing approaching EOL:

| Package | Pinned | Note |
|---------|--------|------|
| React / react-dom | 19.2 | current major |
| Hono | 4.12 | current |
| Zod | 4.x | current major |
| TypeScript | 6.0 | current major (`ignoreDeprecations: "6.0"` set — clean) |
| Vite | 7.0 | current major |
| Tailwind | 4.3 | current major (v4 engine) |
| Wrangler | 4.94 | current |
| @cloudflare/workers-types | 4.2026… | current |

**Action:** Add a scheduled `npm audit` + Dependabot/renovate config so this stays true. Currently there's a `just security` target but no automated dependency-bump pipeline.

### Code hygiene signals — 🟢 Strong
- **1** `TODO/FIXME/HACK/XXX` marker in `functions/` + `src/` combined.
- **0** `@ts-ignore` / `@ts-expect-error` / `@ts-nocheck`.
- **126** test files vs **107** lib modules — healthy ratio (though coverage *thresholds* aren't enforced — see below).
- Strict TS with `exactOptionalPropertyTypes` + `noUnusedLocals`/`Parameters`.

### Guardrails to add (cheap, high-leverage) — 🟡
These are the "stay future-ready" investments, ordered by leverage:
1. **Vitest coverage threshold in CI** — lock in the good test ratio; flag high-risk untested modules (`gdpr-delete-user.ts`, `cmk.ts`, `webhook-dlq.ts`, `api-abuse.ts`).
2. **KV-access lint gate** (R-02) — prevents the abstraction from eroding further.
3. **`no-explicit-any` warn** (R-04) — stops `any` regrowth.
4. **Dependency-update automation** — keep the 🟢 dependency score green.
5. **Deprecation-header convention** for the public API (R-03).

---

## 4. Prioritized plan

### Phase 1 — Quick wins ✅ DONE (June 2026)
| Item | Action | Status |
|------|--------|--------|
| §1 | Supersede-banner stale `TECH_DEBT_AUDIT_2026-05.md` (kept filename — 10 source comments cite its `TD-NN` ids) | ✅ |
| R-01 | Renamed validation modules for intent: `validate.ts`→`request-validation.ts`, `validation.ts`→`domain-schemas.ts`, `validators.ts`→`protocol-schemas.ts` (50 import sites). *Merging barrel intentionally skipped — `PollOptionSchema` is exported by two of the files; flat re-export would clash. Tracked as a follow-up dedup.* | ✅ |
| R-03 | `Deprecation`/`Sunset`/`Link` (RFC 8594) headers on API v1 (sunset 2026-12-31) and v2 (sunset 2027-06-30) via reusable `lib/deprecation.ts` middleware + unit test | ✅ |
| Guardrails | No ESLint in repo → added repo-style ratchet scripts `check:kv-access` (baseline 50) and `check:no-any` (baseline 47), wired into `check:rc`. Counts can only shrink. | ✅ |

> **New follow-up surfaced during Phase 1:** `PollOptionSchema` is defined in
> both `domain-schemas.ts` and `protocol-schemas.ts` — dedupe into one source
> before introducing a merging barrel.

### Phase 2 — Consistency ✅ DONE (June 2026)
| Item | Action | Status |
|------|--------|--------|
| R-02 | Routed **all 50** direct `env.*_KV.*` calls (18 files) through `lib/kv.ts`. Extended the abstraction with exact-passthrough helpers (`readKvText`/`writeKvText`/`deleteKv`) so auth/billing/gdpr error semantics are unchanged. `check:kv-access` baseline locked at **0**. | ✅ |
| R-04 | Replaced `: any` with real types in the hot paths (`rbac.ts` RBAC context, `kv-cache.ts` helpers, `workflows/session-pipeline.ts` env/AI/kv). `: any` in `functions/` down **47 → 34**; ratchet lowered. | ✅ |
| Guardrails | Dependency automation already present (`dependabot.yml`). **Coverage threshold was dead config** — the 85% thresholds sat in the vitest-v3 location and were silently ignored (real coverage ~31%). Installed `@vitest/coverage-v8`, moved thresholds to the v4 `thresholds` block as a **regression floor** (29/19/24/30), and wired coverage into the CI quality gate (also feeds the previously-dead coverage artifact upload). | ✅ |

> **Findings surfaced during Phase 2:**
> 1. The `lib/kv.ts` abstraction only covered JSON get/put; it had no
>    `delete`/raw-text helper, which is why 18 files bypassed it. Now fixed.
> 2. Coverage thresholds in `vite.config.ts` were silently ignored under
>    vitest v4 — the build was green at ~31% against an "85%" config. Now a
>    live, enforced regression floor.

### Phase 3 — Decomposition ✅ DONE (June 2026)
| Item | Action | Status |
|------|--------|--------|
| Dedup | `PollOptionSchema` (defined twice) disambiguated by intent → `PollOptionInputSchema` (strict request validation) / `StoredPollOptionSchema` (loose KV/wire parsing). | ✅ |
| R-05 | Decomposed the 4 largest frontend modules by extracting self-contained sub-components/helpers verbatim (no logic moved): **SessionWizard** 1362→1020 (`QuestionEditor`, `AIChip`, helpers); **TeamSettings** 1331→895 (`TeamIntegrations` — self-contained Slack/Teams section); **Dashboard** 1103→859 (`SessionCard` trio); **JoinPage** 1005→764 (live energizer panels). | ✅ |
| R-06 | Extracted the pure vote-admission guard (`evaluateVoteAdmission`) from `SessionRoom.handleVote` into `session-room-vote.ts` (+10 unit tests). The DO retains all side effects; a full "VoteProcessor owns everything" extraction was deliberately *not* done (wide callback seam on the production realtime path, low marginal benefit). | ✅ |

> **Findings surfaced during Phase 3:**
> 1. Several UI **source-contract tests** assert on file *content* (`.toContain('Assign role')`), so they break on harmless component relocation — updated to scan the extracted modules (mirroring the existing TD-01 pattern). Consider migrating these toward behaviour assertions.
> 2. `TeamSettings`/`Dashboard`/`JoinPage` were dominated by single large stateful components with already-standalone sub-components defined inline; relocating those is behaviour-neutral. Deeper *stateful* splits (e.g. the TeamSettings roles/members sections) remain genuine on-touch work needing interactive UI verification.

---

## 5. Bottom line

Qesto is **future-ready today** on the things that are expensive to fix later: dependencies are current, TypeScript is strict, migrations are contiguous and gated, and the realtime God-object has already been broken up. All three phases of this review have now landed: consolidation (Phase 1), consistency + governance (Phase 2), and decomposition (Phase 3). The codebase actively self-defends against regression — KV-access, `: any`, migration-gap, and coverage-floor gates are all enforced in CI — and the four 1,000+-line frontend modules plus the `SessionRoom` vote guard have been broken into focused, testable units. Remaining work is genuinely opportunistic: deeper *stateful* page splits (on-touch, needing UI verification) and raising the coverage floor as tests are added.

---

*Generated June 2026. Re-verify quarterly. Each remaining item is independently verifiable with the grep/wc commands in this repo's history.*
