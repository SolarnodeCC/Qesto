---
id: GOVERNANCE
type: guide
domain: governance
category: policy
status: active
version: 2.0
created: 2026-04-01
updated: 2026-09-14
tags:
  - governance
  - policy
  - guidelines
  - testing
relates_to:
  - CONTRIBUTING
  - TESTING_PYRAMID
---

# Qesto — QA & Test Strategy (Current)

_Hub: [Documentation map](../README.md)._

_Last verified: 2026-09-14 (UTC) — every command below was executed against the
repository on that date; the counts are the measured output, not estimates._

## 1. Test layers in repository

All automated tests live under `tests/`. Vitest picks up `tests/**/*.test.{ts,tsx}`
(configured in root [`vite.config.ts`](../../../vite.config.ts) — there is no separate
`vitest.config.ts`), so **eight of the nine lanes below run in one `npm test`**.
Playwright (`*.spec.ts`) and k6 (`*.js`) are the exceptions.

| Lane | Path | Files | Runner | Command |
|---|---|---:|---|---|
| Unit | `tests/unit/` | 248 | Vitest (node) | `npm test -- tests/unit/` |
| Integration | `tests/integration/` | 38 | Vitest + Hono app, KV/D1 mocks, real SQLite for migrations | `npm test -- tests/integration/` |
| Functional (UI contracts) | `tests/functional/ui/` | 9 | Vitest (source-text contracts) | `npm test -- tests/functional/` |
| Component | `tests/component/` | 2 | Vitest + React Testing Library (jsdom) | `npm test -- tests/component/` |
| A11y | `tests/a11y/` | 5 | Vitest + axe-core (jsdom) | `npm run test:a11y` |
| Stress | `tests/stress/` | 3 | Vitest + MockDurableObjectState | `npm run test:stress` |
| AI eval | `tests/eval/` | 11 | Vitest golden set (REV-10 gate) | `npm run test:eval` |
| E2E | `tests/e2e/` | 20 | Playwright (Chromium) | `npm run test:e2e:smoke` / `:fullstack` |
| Load | `tests/load/` | 3 scripts | k6 (not in CI) | see [`tests/load/README.md`](../../../tests/load/README.md) |

**Measured 2026-09-14:** `npm test` → 316 files, 2706 tests, all passing, ~65 s.
`npm run test:e2e:smoke` → 7 tests passing, ~18 s.

### E2E prerequisites

The Playwright lane owns its own server: `tests/playwright.config.ts` starts
[`scripts/e2e-webserver.sh`](../../../scripts/e2e-webserver.sh), which builds `dist/`,
applies the local D1 migrations, installs the Chromium build pinned by the
installed `@playwright/test`, and serves the SPA + Worker API on
`http://localhost:8788`. A bare `npm run test:e2e:smoke` is therefore enough on a
clean checkout; nothing has to be started by hand.

## 2. Quality gates

`npm run check:rc` runs the release-candidate chain end to end. Individually:

| # | Gate | Command |
|---|---|---|
| 1 | Claude config conventions | `npm run check:claude-config` |
| 2 | Lint ratchet | `npm run check:lint` |
| 3 | Migration sequence + safety metadata | `npm run check:migrations` |
| 4 | Architecture ratchets (KV / AI gateway / D1 / error builder / `any`) | `check:kv-access`, `check:ai-gateway`, `check:d1-access`, `check:error-response`, `check:no-any` |
| 5 | Type check | `npm run typecheck` |
| 6 | i18n key + literal check | `npm run check:i18n` |
| 7 | Help seed in sync with KB | `npm run check:help-seed` |
| 8 | Contrast tokens | `npm run check:contrast-tokens` |
| 9 | Requirement traceability ratchet | `npm run check:test-traceability` |
| 10 | Baseline check | `npm run check:baseline` |
| 11 | Unit/integration suite | `npm test` |
| 12 | AI eval golden set (REV-10) | `npm run test:eval` |
| 13 | A11y suite | `npm run test:a11y` |
| 14 | Build | `npm run build` |

The pre-push subset lives in [`ops/ci/quality-gates.sh`](../../../ops/ci/quality-gates.sh)
and adds `npm run test:coverage`, which enforces the coverage floors.
The E2E lane runs separately via [`ops/ci/playwright.sh`](../../../ops/ci/playwright.sh)
(PRs run `smoke`, `main` runs `full`).

> The design-token gates (`check:design-tokens`, `check:tokens-drift`) that earlier
> versions of this document listed no longer exist: the token generator was removed
> as dead code, see [`SPEC_DEPLOYMENT.md`](../../specifications/domain/SPEC_DEPLOYMENT.md) §Design tokens.

## 3. Coverage

Thresholds live in `vite.config.ts` under `test.coverage.thresholds` (the v4
location — v3-style top-level keys are silently ignored, which is how the project
once ran at ~31 % with a green build).

| Metric | Floor | Measured 2026-09-14 | Long-term target |
|---|---:|---:|---:|
| Statements | 41 | 42.51 | 85 |
| Branches | 30 | 31.07 | 85 |
| Functions | 37 | 38.18 | 75 |
| Lines | 42 | 43.87 | 85 |

Floors are a **ratchet**: raise them as coverage grows, never lower one to make a
build pass. The denominator covers `functions/**/*.ts` and `src/**/*.{ts,tsx}`.

## 4. Current status summary

- Broad automated coverage across API, auth, billing, data security, realtime and AI paths.
- Realtime ranking/vote behaviour is covered by the SessionRoom suites in
  `tests/unit/session-room-*.test.ts` and `tests/stress/`.
- Migrations are executed against real SQLite in `tests/integration/migrations.test.ts`.
- Next maturity step: raise the coverage floors, and grow the component lane
  (2 files today) so `src/` is covered by behaviour rather than source-text contracts.

## 5. Requirement traceability (convention)

**Every test file states which requirement it proves**, in a docblock at the top:

```ts
/**
 * Requirement: ADR-0073 §WS-1 — rate limits fail closed when KV is unavailable.
 *
 * ...and, where it is not obvious, why this test exists at all.
 */
```

An accepted reference is any of:

| Kind | Example |
|---|---|
| Numbered or named ADR | `ADR-0073`, `ADR-KV-Tenant-Conventions` |
| Specification section | `SPEC_REALTIME.md §Voter Deduplication (PSM-007)` |
| Knowledge-base document path | `knowledge-base/quality/accessibility/A11Y_FULL.md §2` |
| Backlog / review / audit id | `MARKETPLACE-CONNECT-01`, `REV-10`, `HLT-021` |
| GitHub issue | `issue #688` |

A test whose subject is not a product requirement (marketing B-roll recording,
toolchain smoke) says so in the same place, rather than citing a requirement it
does not actually prove.

**Enforcement:** `npm run check:test-traceability` counts the test files whose
header carries no such reference and fails if the count exceeds the baseline in
[`scripts/check-test-traceability.mjs`](../../../scripts/check-test-traceability.mjs).
The baseline is **0** as of RT-2026-09 (336/336 files traced), so a new test file
without a requirement header fails the gate. `--report` prints the per-lane table,
`--list` names the offending files.
