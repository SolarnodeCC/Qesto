---
name: e2e-testing
description: E2E (Playwright), load (k6), stress (SessionRoom DO), and a11y (axe-core) test patterns for Qesto. Use when writing browser-level specs, load scenarios, DO concurrent stress tests, or WCAG audits.
---
# Skill: E2E, Load, Stress & A11y Testing
# SCOPE: tests/e2e/, tests/load/, tests/stress/, tests/a11y/
# LOAD: when writing E2E/load/stress/a11y tests or debugging Playwright CI failures
# VERSION: v1.0.0
# OWNER: QA

## Role

E2E & Performance QA engineer for Qesto. You write browser, load, stress, and accessibility
tests — not implementation code. When you read source files, it is only to understand what
flows to exercise. Unit and integration tests (`tests/unit/`, `tests/integration/`) are owned
by `qesto-tester` — do not overlap.

## Preconditions / Inputs

- Acceptance criteria for the feature (from story)
- Running local dev stack (`npm run dev` / `wrangler pages dev`) for Playwright
- k6 binary for load scenarios
- Knowledge of Playwright projects defined in `tests/playwright.config.ts`

## Test Infrastructure

```
tests/e2e/           # Playwright specs — fullstack-chrome, spa-chrome, a11y-chrome
tests/load/          # k6 scripts (not Vitest — run with k6 CLI)
tests/stress/        # Vitest + MockDurableObjectState — DO concurrent scenarios
tests/a11y/          # Vitest + axe-core — WCAG component-level audits
tests/helpers/       # Shared: kv-mock.ts, do-mock.ts, session-room-stub.ts
tests/playwright.config.ts
tests/flaky.quarantine.txt
```

```bash
# E2E
PLAYWRIGHT_BASE_URL=http://localhost:8788 npx playwright test --project=fullstack-chrome
PLAYWRIGHT_BASE_URL=http://localhost:5173  npx playwright test --project=spa-chrome
npx playwright test --project=a11y-chrome

# Load
k6 run tests/load/k6-smoke.js -e BASE_URL=http://localhost:8787

# Stress (Vitest)
npm test -- tests/stress/

# A11y unit (Vitest)
npm test -- tests/a11y/
```

## Playwright Projects

| Project | testDir / testMatch | baseURL |
|---|---|---|
| `fullstack-chrome` | `tests/e2e/` (excludes `a11y.spec.ts`) | `localhost:8788` (full stack) |
| `spa-chrome` | `public-routes`, `protected-routes`, `visual_smoke` | `localhost:5173` (SPA only) |
| `a11y-chrome` | `a11y.spec.ts` | `localhost:8788` |

## Playwright Patterns

### Helper Imports (always use existing helpers — do not duplicate)

```typescript
import { createUniqueEmail, expectAuthenticatedDashboard, signupWithPassword } from './helpers/auth'
import { addPollQuestion, closeSession, createDraftSession, startSession } from './helpers/session'
```

### E2E Spec Structure

```typescript
import { test, expect } from '@playwright/test'

test.describe('[Feature / Flow]', () => {
  test('[expected behavior in plain English]', async ({ page }) => {
    // Arrange: set up user / data
    const email = createUniqueEmail('pw-feature')
    await signupWithPassword(page, email, 'PlaywrightPass123!')

    // Act: navigate and interact
    await page.goto('/sessions/new')
    await page.getByRole('button', { name: /create/i }).click()

    // Assert: verify observable outcome
    await expect(page.getByRole('heading', { name: /launchpad/i })).toBeVisible()
  })
})
```

### Session State Machine — Critical E2E Flows

Always cover the full DRAFT → LIVE → CLOSED arc for session features:

```typescript
test('session lifecycle: draft → live → closed', async ({ page }) => {
  const email = createUniqueEmail('pw-lifecycle')
  await signupWithPassword(page, email, 'PlaywrightPass123!')
  await expectAuthenticatedDashboard(page)

  const session = await createDraftSession(page, `E2E ${Date.now()}`)
  await addPollQuestion(page, session.id, 'Test question?')

  // DRAFT → LIVE
  await startSession(page, session.id)
  await page.goto(`/sessions/${session.id}/launchpad`)
  await expect(page).toHaveURL(new RegExp(`/sessions/${session.id}/present`))

  // LIVE → CLOSED
  await closeSession(page, session.id)
  await page.goto(`/sessions/${session.id}/launchpad`)
  await expect(page).toHaveURL(new RegExp(`/sessions/${session.id}/results`))
})
```

### Visual Regression (spa-chrome only)

```typescript
test('login page matches snapshot', async ({ page }) => {
  await page.goto('/login')
  await expect(page).toHaveScreenshot('login-spa-chrome-linux.png')
})
```

Snapshots live in `tests/e2e/visual_smoke.spec.ts-snapshots/`. Update with:
```bash
npx playwright test visual_smoke --update-snapshots --project=spa-chrome
```

## k6 Load Patterns

### Smoke scenario structure

```javascript
import http from 'k6/http'
import { check, sleep } from 'k6'

const baseUrl = __ENV.BASE_URL || 'http://localhost:8787'

export const options = {
  vus: 10,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.05'],   // <5% errors
    http_req_duration: ['p(95)<500'], // p95 <500ms
  },
}

export default function () {
  const res = http.get(`${baseUrl}/api/your-endpoint`)
  check(res, { 'status 200': (r) => r.status === 200 })
  sleep(1)
}
```

### Adding a new scenario

1. Add a new file in `tests/load/` (e.g. `k6-voting.js`)
2. Define `options.thresholds` matching the SLA from the story AC
3. Document the scenario and thresholds in the file header comment
4. Run against staging before merging, record p95 result in the PR

## Stress Test Patterns (SessionRoom DO)

Use `MockDurableObjectState` and `MockWebSocket` from `tests/helpers/do-mock.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { SessionRoom } from '../../functions/api/SessionRoom'
import { MockDurableObjectState, MockWebSocket } from '../helpers/do-mock'

function makeEnv() {
  return {
    ENV: 'dev',
    PAGES_URL: 'http://local',
    API_URL: 'http://local',
    JWT_SECRET: 'test-secret',
  } as unknown as Env
}

describe('SessionRoom concurrent stress', () => {
  it('100 concurrent voters: all votes counted, no drops', async () => {
    const state = new MockDurableObjectState()
    const room = new SessionRoom(state as unknown as DurableObjectState, makeEnv())
    // init room, connect 100 mock WS clients, send votes, assert totals
  }, 30_000) // always set explicit timeout for DO stress tests
})
```

### DO Stress Test Rules

- Always set an explicit timeout ≥ 10000ms: `it('…', async () => {…}, 30_000)`
- Assert **both** that all votes are counted **and** that no connection is silently dropped
- Cover the per-IP connection cap (6th connection → reject code 1008)
- Cover vote rate limiting (token bucket: 10 req/s)

## A11y Patterns

### Component-level (tests/a11y/ — Vitest + axe-core)

```typescript
import { render } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
expect.extend(toHaveNoViolations)

it('has no WCAG 2.1 AA violations', async () => {
  const { container } = render(<YourComponent />)
  const results = await axe(container, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } })
  expect(results).toHaveNoViolations()
})

it('icon-only buttons have aria-label', () => {
  const { getAllByRole } = render(<YourComponent />)
  getAllByRole('button')
    .filter(btn => !btn.textContent?.trim())
    .forEach(btn => expect(btn).toHaveAttribute('aria-label'))
})
```

### Flow-level (tests/e2e/a11y.spec.ts — Playwright a11y-chrome)

```typescript
import { test, expect } from '@playwright/test'
import { checkA11y } from './helpers/a11y'

test('voting page has no axe violations', async ({ page }) => {
  await page.goto('/sessions/test-sess/vote')
  await checkA11y(page) // uses helpers/a11y.ts wrapper
})
```

### A11y Audit Checklist (run on every new page/flow)

- [ ] All images have `alt` text (empty string for decorative)
- [ ] All icon-only buttons have `aria-label`
- [ ] All form inputs have a visible label or `aria-label`
- [ ] Color contrast ratio ≥ 4.5:1 for normal text, ≥ 3:1 for large text
- [ ] Keyboard navigation: Tab order is logical, no keyboard traps
- [ ] Focus is visible on all interactive elements
- [ ] Error messages are announced via `role="alert"` or `aria-live`
- [ ] axe-core returns zero violations at WCAG 2.1 AA level

## Prove-It Pattern for Bugs

When asked to demonstrate a reported bug:
1. Write the E2E/load/stress test that exposes it — it **must fail** with current code
2. Capture the failure output (screenshot for Playwright, k6 threshold breach, assertion error)
3. Report: "Test written and failing. Ready for fix implementation."
4. Do **not** touch the implementation

## Flaky Test Policy

### Detection
- Playwright: Run CI twice on same commit. If test passes 1/2 → flaky
- k6: Collect 3 consecutive runs; if p95 crosses threshold on 1/3 → investigate infra first

### Triage (within 24h)
1. **Timing/animation**: Add `await page.waitForSelector()` or explicit `waitFor` — never `page.waitForTimeout()`
2. **Auth state leaking**: Ensure each test creates a unique email with `createUniqueEmail()`
3. **DO startup**: Add explicit test timeout (≥ 30000ms for full-stack DO tests)
4. **Network in CI**: Check if test depends on real external service — mock it instead

### Quarantine
- Rename to `test.skip` with comment: `// FLAKY: reason — issue #XXX`
- Add to `tests/flaky.quarantine.txt`
- Link GitHub issue with `flaky-test` label and remediation plan

## Quality Gates

| Gate | Command | Required |
|---|---|---|
| E2E fullstack | `npx playwright test --project=fullstack-chrome` | ✓ pre-release |
| E2E SPA | `npx playwright test --project=spa-chrome` | ✓ pre-release |
| A11y E2E | `npx playwright test --project=a11y-chrome` | ✓ pre-release |
| A11y unit | `npm test -- tests/a11y/` | ✓ pre-merge |
| k6 smoke | `k6 run tests/load/k6-smoke.js` | ✓ staging deploy |
| DO stress | `npm test -- tests/stress/` | ✓ pre-merge (DO changes) |

## Rules

- Never use `page.waitForTimeout()` — use `waitForSelector`, `waitForURL`, or `expect().toBeVisible()`
- Each test creates its own user via `createUniqueEmail()` — no shared auth state
- Never call real external APIs — Stripe, Resend, Workers AI must be mocked in stress/a11y unit tests
- Never skip tests in committed code except quarantined flaky tests with a linked issue
- DO stress tests always have an explicit timeout ≥ 10000ms

## Do Not

- Do not write Playwright tests for things Vitest unit tests can cover
- Do not duplicate helpers already in `tests/helpers/`, `tests/e2e/helpers/`
- Do not increase k6 thresholds without architect + devops approval
- Do not commit `test.only` or `test.skip` without a quarantine comment and issue link

## Metrics

- E2E pass rate in CI: target 99%+
- Flaky test count: target 0 in `tests/flaky.quarantine.txt`
- k6 p95 latency on staging: < 500ms
- WCAG violations: 0 on all critical pages (axe-core AA)

## Change Log

- 2026-06-09: Initial version. Complements `qesto-tester` (unit/integration). Owns
  `tests/e2e/`, `tests/load/`, `tests/stress/`, `tests/a11y/`. Edges E31–E32 added
  to HANDOFFS.md.
