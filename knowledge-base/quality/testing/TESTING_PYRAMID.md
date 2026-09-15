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
  - QA_FULL
---

# Testing Pyramid & CI Quality Gates

_Hub: [Documentation map](../README.md)._

_Last verified: 2026-09-14 (UTC). Counts below are measured output of `npm test`
on that date, not targets._

## Overview

Qesto tests at the lowest level that fully captures the behaviour, and reserves
browser tests for what only a browser can prove. Gate definitions, coverage
floors and the requirement-traceability convention live in
[`QA_FULL.md`](./QA_FULL.md); this document is the level-choice guide.

## Shape today

```
         E2E (Playwright)           20 spec files
      Component + a11y + stress     10 files
   Integration (routes, migrations) 38 files
          Unit                      248 files + 11 AI eval
```

| Level | Location | Files | Tests | Runner |
|---|---|---:|---:|---|
| Unit | `tests/unit/` | 248 | 1959 | Vitest (node) |
| AI eval | `tests/eval/` | 11 | 58 | Vitest golden set |
| Integration | `tests/integration/` | 38 | 385 | Vitest + Hono app / SQLite |
| Functional UI contract | `tests/functional/ui/` | 9 | 39 | Vitest (source-text assertions) |
| Component | `tests/component/` | 2 | 16 | Vitest + RTL (jsdom) |
| A11y | `tests/a11y/` | 5 | 76 | Vitest + axe-core (jsdom) |
| Stress | `tests/stress/` | 3 | 27 | Vitest + MockDurableObjectState |
| E2E | `tests/e2e/` | 20 | 58 | Playwright (Chromium) |

**`npm test` total: 316 files, 2706 tests, ~65 s.** (`npm test` picks up every
`*.test.ts(x)` under `tests/`, so unit, integration, functional, component, a11y,
stress and eval all run in that single command. Playwright `*.spec.ts` and the k6
`tests/load/*.js` scripts do not.)

## Choosing a level

```
What are you testing?                            → Level                      Helper
──────────────────────────────────────────────────────────────────────────────────────
Pure function, schema, key builder, JWT          → tests/unit/                mockEnv, vi.fn()
Route handler, middleware, state transition      → tests/integration/         testHonoApp()
Migration / real SQL behaviour                   → tests/integration/         tests/helpers/d1-sqlite.ts
DO concurrency, WebSocket protocol under load    → tests/stress/              MockDurableObjectState
React tree: hooks, effects, events               → tests/component/           RTL + jsdom
Prompt, retrieval or AI output schema (REV-10)   → tests/eval/                golden fixtures
WCAG on rendered markup                          → tests/a11y/                axe-core
Whole journey in a real browser                  → tests/e2e/                 Playwright fixtures
Throughput at scale                              → tests/load/                k6 (manual, not CI)
```

**Rule:** never write an integration test for what a unit test fully covers, and
never write a unit test for what only end-to-end execution can prove.
`tests/functional/ui/` asserts on *source text* (a route is registered, an endpoint
is called); it is a cheap contract net, not a substitute for the component lane.

## Running

```bash
npm test                          # every Vitest lane (CI mode)
npm test -- tests/unit/           # one lane
npm run test:a11y                 # a11y lane only
npm run test:stress               # stress lane only
npm run test:eval                 # AI golden set (REV-10 gate)
npm run test:coverage             # + coverage thresholds
npm run test:e2e:smoke            # Playwright: auth, lifecycle, participant voting
npm run test:e2e:fullstack        # Playwright: full fullstack-chrome project
npx vitest -t "supersede"         # filter by test name
```

The Playwright lane builds `dist/`, applies local D1 migrations and starts the
Worker itself ([`scripts/e2e-webserver.sh`](../../../scripts/e2e-webserver.sh)) — no
manual setup.

## Performance expectations

| Lane | Measured 2026-09-14 |
|---|---|
| Full Vitest run | ~65 s (2706 tests) |
| E2E smoke (7 tests) | ~18 s + ~10 s server cold start |

A unit test that needs more than ~100 ms is usually doing integration work in the
wrong lane. DO tests get a 10 s timeout by default.

## CI

| Workflow | Runs |
|---|---|
| [`ci.yml`](../../../.github/workflows/ci.yml) | quality gates (`ops/ci/quality-gates.sh`) |
| [`playwright.yml`](../../../.github/workflows/playwright.yml) | E2E via `ops/ci/playwright.sh` — `smoke` on PRs, `full` on `main` |

The gate list, coverage floors and the traceability ratchet are specified in
[`QA_FULL.md`](./QA_FULL.md) §2–§5. Keep this file's counts and that file's gate
table in step with reality — both were wrong for months (this document described
`tests/technical/`, `tests/data-security/` and `tests/perf/`, none of which exist,
and a `qa-gates.yml` workflow that was never added).

## Writing good tests

### Every test file

- [ ] Header docblock naming the requirement it proves (QA_FULL §5) — enforced by
      `npm run check:test-traceability`
- [ ] No `test.only` / `it.skip` in committed code (quarantine with an issue link instead)
- [ ] Mock setup in `beforeEach`, never in `describe` scope
- [ ] No dependence on execution order or shared state
- [ ] No real external calls — Stripe, Resend, Workers AI and Vectorize are mocked

### Unit

- [ ] One function or module under test, dependencies mocked
- [ ] Happy path, error path, and the edge that motivated the code
- [ ] Runs in <100 ms

### Integration

- [ ] Crosses a route or storage boundary on purpose
- [ ] Asserts the response contract (status, envelope, error code)
- [ ] Real auth/RBAC path rather than a bypass

### E2E

- [ ] A journey a user actually performs, asserted from the user's perspective
- [ ] Deterministic selectors and generated unique fixtures (e.g. `createUniqueEmail`)
- [ ] Budgeted timeout when the flow includes DO init plus a WebSocket

## Common patterns

### Mocking an external service

```typescript
vi.mock('../lib/stripe', () => ({
  createCharge: vi.fn().mockResolvedValue({ id: 'ch_123' }),
}))
```

### Real SQL instead of a mock

```typescript
import { SqliteD1, migrationFiles } from '../helpers/d1-sqlite'
// applies migrations/ against better-sqlite3 — see tests/integration/migrations.test.ts
```

### WebSocket / DO behaviour

```typescript
import { SessionRoom } from '../../functions/api/SessionRoom'
// drive the DO directly with MockDurableObjectState; see tests/stress/session-room-concurrent.test.ts
```

## Troubleshooting

```bash
npx vitest run --reporter=verbose tests/unit/foo.test.ts   # see every assertion
npm test -- --testTimeout=20000                            # slow suite
```

- Flaky by time → `vi.useFakeTimers()`, never a bare `setTimeout`
- Flaky by state → reset in `beforeEach`
- Playwright "Executable doesn't exist" → the pinned Chromium build is missing;
  `scripts/e2e-webserver.sh` installs it, or run `npx playwright install chromium`

## Resources

- [Vitest](https://vitest.dev/)
- [Playwright](https://playwright.dev/)
- [Test Pyramid (Fowler)](https://martinfowler.com/bliki/TestPyramid.html)
