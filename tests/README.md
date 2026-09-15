# Testing assets

All automated tests and Playwright configuration live under **`tests/`**.

| Path | Purpose | Command |
|------|---------|---------|
| `unit/` | Vitest unit tests | `npm test -- tests/unit/` |
| `integration/` | Hono app + KV/D1 mocks; migrations against real SQLite | `npm test -- tests/integration/` |
| `functional/ui/` | UI contract tests (assert on component source text) | `npm test -- tests/functional/` |
| `component/` | React Testing Library trees (jsdom) | `npm test -- tests/component/` |
| `a11y/` | axe-core suites (jsdom) | `npm run test:a11y` |
| `stress/` | SessionRoom DO under concurrency | `npm run test:stress` |
| `eval/` | AI golden set — REV-10 release gate | `npm run test:eval` |
| `e2e/` | Playwright specs | `npm run test:e2e:smoke` / `:fullstack` |
| `load/` | k6 scripts (manual, not in CI) — see [`load/README.md`](./load/README.md) | `k6 run tests/load/k6-smoke.js` |
| `helpers/` | Shared mocks and factories (`kv-mock`, `do-mock`, `d1-mock`, `d1-sqlite`) | — |
| `setup/rtl.ts` | Global Vitest setup (RTL cleanup, jsdom shims) | — |
| `playwright.config.ts` | Playwright entrypoint | `--config tests/playwright.config.ts` |
| `docs/playwright-local.md` | Local full-stack / SPA Playwright workflow | — |
| `flaky.quarantine.txt` | Quarantine list for flaky cases | — |
| `artifacts/` | Generated traces, HTML report, screenshots, marketing videos (gitignored) | — |

`npm test` runs **every Vitest lane at once** — unit, integration, functional,
component, a11y, stress and eval — because Vitest's `test.include` is
`tests/**/*.test.{ts,tsx}` (configured in root **`vite.config.ts`**; there is no
separate `vitest.config.ts`). Only Playwright (`*.spec.ts`) and k6 (`*.js`) sit
outside it. Coverage thresholds live in the same config; reports land in
repo-root `coverage/` when you run `npm run test:coverage`.

## Running the E2E lane

```bash
npm run test:e2e:smoke        # auth · session lifecycle · participant voting
npm run test:e2e:fullstack    # the whole fullstack-chrome project
```

No manual setup: Playwright's `webServer` block runs
[`scripts/e2e-webserver.sh`](../scripts/e2e-webserver.sh), which builds `dist/`,
applies the local D1 migrations, installs the Chromium build pinned by the
installed `@playwright/test`, and serves SPA + API on `http://localhost:8788`.
Set `E2E_FORCE_BUILD=1` to rebuild the frontend, or
`E2E_SKIP_BROWSER_INSTALL=1` where the image already provisions the browser
(CI does this in `ops/ci/playwright.sh`).

## Every test file names its requirement

The first docblock in each test file says which requirement it proves:

```ts
/**
 * Requirement: ADR-0073 §WS-1 — rate limits fail closed when KV is unavailable.
 */
```

ADR ids, `SPEC_*.md` sections, knowledge-base paths, backlog/review/audit ids and
GitHub issues all count. `npm run check:test-traceability` enforces it (baseline
0 — a new test file without one fails the gate); `--report` prints the per-lane
table and `--list` names offenders. Convention and rationale:
[`knowledge-base/quality/testing/QA_FULL.md`](../knowledge-base/quality/testing/QA_FULL.md) §5.
