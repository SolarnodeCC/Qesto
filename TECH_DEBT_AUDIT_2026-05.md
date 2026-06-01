# Technical Debt Audit — May 2026

> **Scope:** Full codebase scan — `functions/`, `src/`, `tests/`, `migrations/`, `wrangler.toml`
> **Methodology:** Priority = (Impact + Risk) × (6 − Effort) — higher = fix sooner

---

## Summary

| Severity | Count | Categories |
|----------|-------|------------|
| 🔴 Critical | 3 | Architecture, Code, Infrastructure |
| 🟠 High | 4 | Code, Test, Architecture |
| 🟡 Medium | 5 | Code, Documentation, Infrastructure |
| 🟢 Low | 3 | Code, Documentation |

---

## 🔴 Critical

### TD-01 — `SessionRoom.ts` God Object (2 242 lines)

**Category:** Architecture debt
**Score:** (5+5) × (6−2) = **40**

`SessionRoom.ts` is a single Durable Object class handling WebSocket lifecycle, vote processing, energizers, townhall moderation, tournament bracket logic, sentiment analysis triggers, rate limiting, and alarm scheduling. At 2 242 lines with 89 methods, it violates single-responsibility and makes correctness review of the critical realtime path extremely difficult.

There is prior art for extraction — `session-room-townhall.ts`, `session-room-vote.ts`, `tournament-live.ts`, and `session-room-cross-region.ts` already exist as helpers — but the core class has never been split.

**Fix:** Extract `EnergizerManager`, `VoteProcessor`, `TownhallHandler`, and `RateLimiter` as collaborator classes injected into the DO. The DO retains only WebSocket lifecycle and alarm dispatch.
**Effort:** Large (3 sprints)

---

### TD-02 — 35 Type-Unsafe D1 Queries (`DB.prepare as any`)

**Category:** Code debt
**Score:** (5+4) × (6−2) = **36**

Across the route layer, D1 queries are cast as `(c.env.DB.prepare as any)(...)` to bypass TypeScript strict D1 typing. This suppresses type errors on column names, return shapes, and bound parameters — making schema renames invisible to the compiler and regression-prone.

Affected files include: `routes/energizers/active.ts`, `middleware/rbac.ts`, `middleware/kv-cache.ts`, `routes/billing.ts`, and ~10 others.

**Fix:** Generate a typed D1 query layer from `schema.sql` (e.g. via `d1-orm` or `drizzle-orm`) and replace raw `prepare as any` calls with typed query functions. Can be done incrementally route-by-route.
**Effort:** Medium (1–2 sprints)

---

### TD-03 — Migration Sequence Gaps (0017–0019, 0021–0041 missing)

**Category:** Infrastructure debt
**Score:** (4+5) × (6−1) = **45** *(highest)*

The `migrations/` directory jumps from `0016` to `0020`, then from `0020` to `0042`. 24 migration numbers are missing. This suggests migrations were applied directly to production outside of the versioned system, breaking the ability to reproduce the database schema from scratch. `wrangler.toml` itself contains a comment warning against manual migration application.

**Fix:**
1. Run `wrangler d1 execute --command "SELECT name FROM sqlite_master" --remote` to diff actual schema against `schema.sql`.
2. Write reconciliation migrations for the gaps (even if no-ops) to restore a contiguous sequence.
3. Add a CI check that refuses to merge if `migrations/` has gaps.

**Effort:** Small-Medium (1 sprint)

---

## 🟠 High

### TD-04 — Three Overlapping Validation Files

**Category:** Code debt
**Score:** (4+3) × (6−2) = **28**

`lib/validate.ts` (28 lines), `lib/validation.ts` (281 lines), and `lib/validators.ts` (769 lines) coexist with overlapping purposes. The naming collision creates import confusion and duplicated schema logic across ~60 import sites.

**Fix:** Merge `validate.ts` into `validation.ts`. Rename `validators.ts` to `route-validators.ts`. Add a barrel `index.ts`.
**Effort:** Small (< 1 sprint)

---

### TD-05 — 30 Untested Source Files Including High-Risk Modules

**Category:** Test debt
**Score:** (4+4) × (6−2) = **32**

Of 123 source files in `functions/api/lib/`, 30 have no test. The gap includes high-risk modules:

- `gdpr-delete-user.ts` — irreversible data deletion
- `cmk.ts` — customer-managed encryption keys
- `webhook-dlq.ts` / `webhook-sla.ts` — reliability infrastructure
- `api-abuse.ts` — security enforcement
- `multi-region-mutation.ts` — distributed write semantics

**Fix:** Start with the five highest-risk files above. Add a vitest coverage threshold check in CI.
**Effort:** Medium (1–2 sprints)

---

### TD-06 — Feature Flags via Raw String Env Vars (25 sites)

**Category:** Architecture debt
**Score:** (3+4) × (6−2) = **28**

Feature flags are evaluated as `c.env.FEATURE_NAME === "true"` scattered across 25 call sites. There is no central flag registry, no typed flag names, no audit log, and no per-team targeting without a full deploy.

**Fix:** Introduce a `getFlag(env, flagName)` helper in `lib/flags.ts` with a `FlagName` string-literal union. Long-term, back flags with a KV store to allow toggling without redeploy.
**Effort:** Small (< 1 sprint for typed helper; medium for KV-backed store)

---

### TD-07 — Sprint-Named Files Surviving in Production Code

**Category:** Documentation + Code debt
**Score:** (2+3) × (6−2) = **20**

Two route files: `routes/admin/sprint19.ts` (155 lines) and `routes/admin/platform/sprint19.ts` (105 lines). Six functional tests: `sprint23-polish.test.ts`, `sprint24-contract.test.ts`, etc. Sprint-named files make purpose opaque and resist cleanup.

**Fix:** Rename route files to reflect domain (e.g. `sprint19.ts` → `engagement-admin.ts`). Rename functional tests to reflect the feature under test.
**Effort:** Small (1–2 days)

---

## 🟡 Medium

### TD-08 — 26 Direct KV Operations Bypassing Abstraction Layer

**Category:** Code debt
**Score:** (3+3) × (6−3) = **18**

`kv.ts` and `kv-keys.ts` exist as an abstraction but 26 call sites in routes and middleware access KV namespaces directly (`c.env.USERS_KV.put(...)`, etc.). TTL policies, serialization, and error handling are duplicated ad-hoc. Notably, `gdpr-delete-user.ts` hard-codes `user-teams:${userId}` inline instead of using the `userTeamsIndexKey()` builder already in `kv-keys.ts`.

**Fix:** Route all KV access through the abstraction layer. Add a CI grep check banning direct `env.*_KV` access outside `lib/kv.ts`.
**Effort:** Medium

---

### TD-09 — `console.log` for Structured Logging (71 call sites)

**Category:** Code debt
**Score:** (2+3) × (6−3) = **15**

71 `console.log` calls bypass the `lib/log.ts` abstraction that handles log-level filtering, PII scrubbing, and Cloudflare Logpush integration. Raw logs in production mean no filtering, no sampling, and potential PII leakage.

**Fix:** Replace all `console.log` in `functions/` with `log()` from `lib/log.ts`. A codemod can handle the mechanical transformation.
**Effort:** Small

---

### TD-10 — Three Parallel Public API Versions With No Deprecation Plan

**Category:** Architecture debt
**Score:** (3+2) × (6−3) = **15**

`public-api-v1.ts`, `public-api-v2.ts`, and `public-api-v3.ts` are all live with no documentation of breaking changes, no deprecation timeline, and no `Deprecation` headers in responses.

**Fix:** Document breaking changes between versions in `knowledge-base/specifications/`. Add `Deprecation` response headers to v1 and v2. Write a migration guide.
**Effort:** Small-Medium

---

### TD-11 — 48 `: any` Type Annotations in Backend

**Category:** Code debt
**Score:** (2+3) × (6−3) = **15**

48 explicit `: any` annotations in `functions/`, concentrated in AI inference wrappers, workflow files, and middleware. Incorrect types here can silently corrupt AI payloads or request data at runtime.

**Fix:** Enable `strict` in `tsconfig.json` and replace `: any` with `unknown` + type guards.
**Effort:** Medium

---

### TD-12 — Scattered KV TTL Magic Numbers (10+ sites)

**Category:** Code debt
**Score:** (2+2) × (6−2) = **16**

Inline TTL literals (`86400`, `90 * 24 * 60 * 60`, `90000`, etc.) appear in 10+ KV `.put()` calls despite `constants.ts` already defining named TTL constants for other durations.

**Fix:** Add named constants for all remaining TTL values to `lib/constants.ts` and replace inline literals.
**Effort:** Small (hours)

---

## 🟢 Low

### TD-13 — `account_id` and `CF_ACCESS_AUDIENCE` Hardcoded in `wrangler.toml`

**Category:** Infrastructure debt
**Score:** (2+3) × (6−4) = **10**

A hardcoded Cloudflare `account_id` and `CF_ACCESS_AUDIENCE` in source control limits environment portability.

**Fix:** Move `account_id` to CI env var `CLOUDFLARE_ACCOUNT_ID`. Move `CF_ACCESS_AUDIENCE` to `wrangler secret`.
**Effort:** Small

---

### TD-14 — `SUPERUSER_EMAIL` in Production `[vars]`

**Category:** Security debt
**Score:** (3+3) × (6−5) = **6**

`SUPERUSER_EMAIL = "oostelaar@hotmail.com"` and `SEED_ADMIN_EMAIL = "qesto@example.com"` are in the production `[vars]` block. The comment says "remove in production" for the seed admin. These define privilege-escalation entry points committed to source control.

**Fix:** Move `SUPERUSER_EMAIL` to `wrangler secret put SUPERUSER_EMAIL`. Remove `SEED_ADMIN_EMAIL` or guard it behind `ENV !== "production"`.
**Effort:** Small (minutes)

---

### TD-15 — No E2E Tests for Happy-Path Session Lifecycle

**Category:** Test debt
**Score:** (3+3) × (6−5) = **6**

Playwright is configured but no test covers: create session → add question → start → participant joins → vote → close → view results. The full edge-runtime WebSocket path is untested at the integration level.

**Fix:** Write 3–5 Playwright fullstack tests using the `test:e2e:fullstack` script.
**Effort:** Medium

---

## Prioritized Remediation Plan

### Phase 1 — Quick wins (< 1 sprint, do alongside feature work)

| ID | Action | Days |
|----|--------|------|
| TD-14 | Move superuser email to secrets | 0.5 |
| TD-12 | Named TTL constants | 1 |
| TD-07 | Rename sprint-named files | 2 |
| TD-06 | Typed `getFlag()` helper | 2 |
| TD-09 | Replace `console.log` with `log()` | 2 |

### Phase 2 — Structural fixes (1–2 sprints, can be parallelized)

| ID | Action | Days |
|----|--------|------|
| TD-03 | Reconcile migration gaps + CI gap check | 3 |
| TD-04 | Merge validation files | 2 |
| TD-08 | Route KV access through abstraction | 4 |
| TD-05 | Tests for top 5 untested high-risk files | 5 |
| TD-10 | Document API versions + deprecation headers | 3 |

### Phase 3 — Investment items (2–3 sprints, plan as dedicated work)

| ID | Action | Sprints |
|----|--------|---------|
| TD-02 | Typed D1 query layer (replace `as any` casts) | 1.5 |
| TD-11 | Eliminate `: any` annotations, enable strict TS | 1 |
| TD-01 | Extract collaborators from `SessionRoom.ts` | 2–3 |

---

*Generated by tech-debt skill — 2026-05-31. Re-run quarterly or after major feature sprints.*
