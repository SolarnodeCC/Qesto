---
name: e2e-testing
description: E2E (Playwright), load (k6), stress (SessionRoom DO), and a11y (axe-core) test patterns for Qesto. Use when writing browser-level specs, load scenarios, DO concurrent stress tests, or WCAG audits.
---
# Skill: E2E, Load, Stress & A11y Testing
# SCOPE: tests/e2e/, tests/load/, tests/stress/, tests/a11y/
# LOAD: when writing E2E/load/stress/a11y tests or debugging Playwright CI failures
# VERSION: v2.0.0
# OWNER: QA

## Role

E2E & Performance QA engineer for Qesto. You write browser, load, stress, and accessibility
tests — not implementation code. When you read source files, it is only to understand what
flows to exercise. Unit and integration tests (`tests/unit/`, `tests/integration/`) are owned
by `qesto-tester` — do not overlap.

## Preconditions / Inputs

- Acceptance criteria for the feature (from story)
- Running local dev stack (`wrangler pages dev`) for fullstack Playwright; `npm run dev` for spa-chrome
- k6 binary for load scenarios
- Playwright projects defined in `tests/playwright.config.ts`

---

## Step 0 — Decide the test level before writing anything

```
What are you testing?                                  → Which level
──────────────────────────────────────────────────────────────────────────
Single component WCAG violations                       → a11y unit  (tests/a11y/)
Full user flow in the browser (auth, voting, results)  → E2E  (tests/e2e/  fullstack-chrome)
Public/protected route rendering, visual smoke         → E2E  (tests/e2e/  spa-chrome)
WCAG on authenticated pages in real browser            → E2E  (tests/e2e/  a11y-chrome)
API throughput / p95 latency SLA                       → Load  (tests/load/  k6)
SessionRoom DO under concurrent connections/votes      → Stress  (tests/stress/)
Pure function / route handler                          → hand to qesto-tester (unit/integration)
```

**Rule:** if a unit test can fully capture the behavior, don't write an E2E test for it.
E2E tests are expensive — reserve them for flows that cross the browser ↔ API ↔ DO boundary.

---

## Test Infrastructure

```
tests/e2e/           # Playwright specs — fullstack-chrome, spa-chrome, a11y-chrome
tests/load/          # k6 scripts (not Vitest — run with k6 CLI)
tests/stress/        # Vitest + MockDurableObjectState — DO concurrent scenarios
tests/a11y/          # Vitest + axe-core — WCAG component-level audits
tests/helpers/       # kv-mock.ts, do-mock.ts, session-room-stub.ts — reuse, never duplicate
tests/e2e/helpers/   # auth.ts, session.ts — Playwright-specific helpers
tests/playwright.config.ts
tests/flaky.quarantine.txt
```

### Run commands

```bash
# E2E — fullstack (requires wrangler pages dev on :8788)
PLAYWRIGHT_BASE_URL=http://localhost:8788 npx playwright test --project=fullstack-chrome

# E2E — SPA only (requires npm run dev on :5173)
PLAYWRIGHT_BASE_URL=http://localhost:5173 npx playwright test --project=spa-chrome

# E2E — a11y flows (requires wrangler pages dev on :8788)
npx playwright test --project=a11y-chrome

# Debug mode (opens browser, pauses on failure)
npx playwright test --debug --project=fullstack-chrome

# Interactive UI mode
npx playwright test --ui

# Load
k6 run tests/load/k6-smoke.js -e BASE_URL=http://localhost:8787

# Stress (Vitest)
npm test -- tests/stress/

# A11y unit (Vitest)
npm test -- tests/a11y/
```

---

## Playwright Projects

| Project | testDir / testMatch | baseURL | When to use |
|---|---|---|---|
| `fullstack-chrome` | `tests/e2e/` (excludes `a11y.spec.ts`) | `localhost:8788` | Any flow crossing API + DO |
| `spa-chrome` | `public-routes`, `protected-routes`, `visual_smoke` | `localhost:5173` | Route rendering, visual snapshots |
| `a11y-chrome` | `a11y.spec.ts` | `localhost:8788` | WCAG audit on authenticated pages |

---

## Selector Hierarchy (resilience order — stop at first that works)

Always pick the most resilient selector. Raw CSS/XPath are the last resort.

```typescript
// 1. Accessible role (most durable — survives CSS/markup changes)
page.getByRole('button', { name: /start session/i })
page.getByRole('heading', { name: /launchpad/i })
page.getByRole('alert')

// 2. Form label
page.getByLabel('Session title')

// 3. Placeholder
page.getByPlaceholder('Enter your email')

// 4. Visible text
page.getByText('Open lobby')

// 5. Test ID (requires data-testid in markup — use only when above options fail)
page.getByTestId('vote-submit-btn')

// ✗ Never: page.$('.btn-primary')  or  page.$('div > span:nth-child(2)')
```

---

## Page Object Model

For any flow with **more than 3 tests**, extract a Page Object in `tests/e2e/helpers/`.
Qesto's existing helpers (`auth.ts`, `session.ts`) are the canonical POM layer — extend them
rather than writing inline selectors.

### When to use helpers vs inline

| Situation | Approach |
|---|---|
| Flow already covered by `auth.ts` / `session.ts` | Import and call the helper |
| New flow with ≥ 3 tests reusing the same selectors | Add a helper function to the relevant file |
| One-off assertion unique to a single test | Inline in the spec |

### Adding to an existing helper

```typescript
// tests/e2e/helpers/session.ts — extend, don't duplicate
export async function activateEnergizer(page: Page, sessionId: string, energizerId: string) {
  await page.goto(`/sessions/${sessionId}/launchpad`)
  await page.getByRole('button', { name: /activate energizer/i }).click()
  await expect(page.getByTestId(`energizer-${energizerId}`)).toHaveAttribute('data-state', 'active')
}
```

---

## Auth State Reuse (skip per-test signup for read-only flows)

For tests that only need an authenticated session (not a fresh user), use `storageState`
to reuse credentials instead of calling `signupWithPassword` every time.

```typescript
// tests/e2e/helpers/auth.ts — add a shared fixture
import { Browser } from '@playwright/test'
import path from 'path'

const AUTH_FILE = path.join(__dirname, '../.auth/user.json')

export async function saveAuthState(browser: Browser, email: string, password: string) {
  const page = await browser.newPage()
  await signupWithPassword(page, email, password)
  await page.context().storageState({ path: AUTH_FILE })
  await page.close()
}

// In playwright.config.ts — add a setup project:
// { name: 'setup', testMatch: /auth.setup.ts/ }
// Then in the test project: use: { storageState: AUTH_FILE }
```

**Rule:** always use `createUniqueEmail()` for tests that mutate user state (signup, billing,
team changes). Use `storageState` only for read-only flows where a shared session is safe.

---

## E2E Spec Structure

```typescript
import { test, expect } from '@playwright/test'
import { createUniqueEmail, signupWithPassword, expectAuthenticatedDashboard } from './helpers/auth'
import { createDraftSession, addPollQuestion, startSession, closeSession } from './helpers/session'

test.describe('Session voting flow', () => {
  // Arrange once — unique user per describe block
  let sessionId: string

  test.beforeEach(async ({ page }) => {
    const email = createUniqueEmail('pw-voting')
    await signupWithPassword(page, email, 'PlaywrightPass123!')
    await expectAuthenticatedDashboard(page)
    const session = await createDraftSession(page, `Voting E2E ${Date.now()}`)
    await addPollQuestion(page, session.id, 'Which do you prefer?')
    sessionId = session.id
  })

  test('participant can cast a vote and see live results', async ({ page }) => {
    await test.step('host starts session', async () => {
      await startSession(page, sessionId)
    })

    await test.step('participant joins and votes', async () => {
      await page.goto(`/join`)
      await page.getByLabel('Session code').fill('CODE1')
      await page.getByRole('button', { name: /join/i }).click()
      await expect(page.getByRole('heading', { name: /which do you prefer/i })).toBeVisible()
      await page.getByRole('radio', { name: /option a/i }).click()
      await page.getByRole('button', { name: /submit/i }).click()
    })

    await test.step('results are visible', async () => {
      await expect(page.getByRole('region', { name: /results/i })).toBeVisible()
    })
  })
})
```

**`test.step()`** wraps logical phases — Playwright's HTML report shows exactly which step
failed, making CI failures self-describing.

---

## Session State Machine — Critical E2E Flows

Always cover the full DRAFT → LIVE → CLOSED arc for session features:

```typescript
test('session lifecycle: draft → live → closed', async ({ page }) => {
  const email = createUniqueEmail('pw-lifecycle')
  await signupWithPassword(page, email, 'PlaywrightPass123!')
  await expectAuthenticatedDashboard(page)

  const session = await createDraftSession(page, `E2E ${Date.now()}`)
  await addPollQuestion(page, session.id, 'Test question?')

  await test.step('DRAFT → LIVE: launchpad redirects to present', async () => {
    await startSession(page, session.id)
    await page.goto(`/sessions/${session.id}/launchpad`)
    await expect(page).toHaveURL(new RegExp(`/sessions/${session.id}/present`))
  })

  await test.step('LIVE → CLOSED: launchpad redirects to results', async () => {
    await closeSession(page, session.id)
    await page.goto(`/sessions/${session.id}/launchpad`)
    await expect(page).toHaveURL(new RegExp(`/sessions/${session.id}/results`))
  })
})
```

---

## Network Mocking with `page.route()`

Use `page.route()` to test UI error states (API down, Stripe failure) without needing the
real server to fail. This is the correct way to test error boundaries and retry UI.

```typescript
test('shows error banner when AI insights endpoint fails', async ({ page }) => {
  // Intercept the AI insights call and force a 500
  await page.route('**/api/sessions/*/insights', (route) =>
    route.fulfill({ status: 500, body: JSON.stringify({ error: 'AI unavailable' }) })
  )

  await page.goto(`/sessions/sess-1/results`)
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByText(/unavailable/i)).toBeVisible()
})

test('shows retry option when vote submission fails', async ({ page }) => {
  await page.route('**/api/sessions/*/votes', (route) =>
    route.fulfill({ status: 503, body: '' })
  )

  await page.goto(`/sessions/sess-1/vote`)
  await page.getByRole('radio').first().click()
  await page.getByRole('button', { name: /submit/i }).click()
  await expect(page.getByRole('button', { name: /retry/i })).toBeVisible()
})
```

---

## Visual Regression (spa-chrome only)

```typescript
test('login page matches snapshot', async ({ page }) => {
  await page.goto('/login')
  // Mask dynamic elements (timestamps, user IDs) before snapshotting
  await expect(page).toHaveScreenshot('login-spa-chrome-linux.png', {
    mask: [page.getByTestId('session-timestamp')],
    animations: 'disabled',
  })
})
```

Snapshots live in `tests/e2e/visual_smoke.spec.ts-snapshots/`. Update with:
```bash
npx playwright test visual_smoke --update-snapshots --project=spa-chrome
```

---

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

1. New file in `tests/load/` (e.g. `k6-voting.js`)
2. Define `options.thresholds` matching the SLA from the story AC
3. Document the scenario and thresholds in a file header comment
4. Run against staging before merging; record p95 in the PR description

---

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
  }, 30_000)

  it('6th connection from same IP is rejected with code 1008', async () => { ... }, 10_000)

  it('vote rate limiter: 11th vote in 1s window is rejected', async () => { ... }, 10_000)
})
```

### DO Stress Test Rules

- Always set an explicit timeout ≥ 10000ms
- Assert **both** that all votes are counted **and** no connection is silently dropped
- Cover per-IP connection cap (6th → code 1008)
- Cover vote rate limiting (token bucket: 10 req/s)

---

## A11y Patterns

### Component-level (tests/a11y/ — Vitest + axe-core)

```typescript
import { render } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
expect.extend(toHaveNoViolations)

it('has no WCAG 2.1 AA violations', async () => {
  const { container } = render(<VotingCard question={mockQuestion} />)
  const results = await axe(container, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } })
  expect(results).toHaveNoViolations()
})

it('icon-only buttons have aria-label', () => {
  const { getAllByRole } = render(<SessionControls />)
  getAllByRole('button')
    .filter(btn => !btn.textContent?.trim())
    .forEach(btn => expect(btn).toHaveAttribute('aria-label'))
})
```

### Flow-level (tests/e2e/a11y.spec.ts — a11y-chrome)

```typescript
import { test, expect } from '@playwright/test'
import { checkA11y } from './helpers/a11y'

test('voting page has no axe violations', async ({ page }) => {
  await page.goto('/sessions/test-sess/vote')
  await checkA11y(page) // uses helpers/a11y.ts wrapper
})
```

### A11y Audit Checklist (run on every new page or flow)

- [ ] All images have `alt` (empty string for decorative)
- [ ] All icon-only buttons have `aria-label`
- [ ] All form inputs have visible label or `aria-label`
- [ ] Color contrast ≥ 4.5:1 normal text, ≥ 3:1 large text
- [ ] Tab order is logical, no keyboard traps
- [ ] Focus visible on all interactive elements
- [ ] Error messages use `role="alert"` or `aria-live`
- [ ] axe-core returns zero violations at WCAG 2.1 AA

---

## Anti-Patterns Table

| Anti-pattern | Problem | Correct approach |
|---|---|---|
| `page.waitForTimeout(3000)` | Hard wait causes flakiness in slow CI | `await expect(locator).toBeVisible()` — auto-retries |
| `expect(await el.isVisible()).toBe(true)` | Loses Playwright's retry mechanism | `await expect(el).toBeVisible()` |
| `page.$('.btn-primary')` raw CSS | Breaks on style changes | `page.getByRole('button', { name: /…/i })` |
| Shared `page` state across tests | Test A leaves cookies/state for test B | Each test creates its own user via `createUniqueEmail()` |
| `try { await expect(…) } catch {}` | Masks real failures | Let Playwright surface failures; never swallow assertion errors |
| Visual snapshot without masking dynamic content | Snapshot fails every run due to timestamps | Use `mask: [...]` and `animations: 'disabled'` |
| Inline selectors repeated across 3+ tests | Brittle — must change in N places | Extract to `tests/e2e/helpers/` helper function |
| Full `signupWithPassword` for read-only tests | Slow — creates a new user for every test | Use `storageState` fixture for read-only flows |

---

## Prove-It Pattern for Bugs

When asked to demonstrate a reported bug:
1. Write the E2E/load/stress test that exposes it — it **must fail** with current code
2. Capture the failure output (Playwright screenshot, k6 threshold breach, assertion error)
3. Report: "Test written and failing at [file:line]. Ready for fix implementation."
4. Do **not** touch the implementation

---

## Flaky Test Policy

### Detection
- Playwright: CI twice on same commit, passes 1/2 → flaky
- k6: 3 consecutive runs; p95 breaches threshold on 1/3 → investigate infra first

### Triage (within 24h)
1. **Animation/timing**: Use `animations: 'disabled'` in screenshot opts; `waitForSelector` not `waitForTimeout`
2. **Auth state leaking**: Verify each test uses `createUniqueEmail()` or isolated `storageState`
3. **DO startup**: Add explicit timeout ≥ 30000ms for full-stack DO tests
4. **Real external service in CI**: Intercept with `page.route()` instead

### Quarantine
- `test.skip('…', …) // FLAKY: reason — issue #XXX`
- Add to `tests/flaky.quarantine.txt`
- GitHub issue with `flaky-test` label + remediation plan

---

## Quality Gates

| Gate | Command | Required |
|---|---|---|
| E2E fullstack | `npx playwright test --project=fullstack-chrome` | ✓ pre-release |
| E2E SPA | `npx playwright test --project=spa-chrome` | ✓ pre-release |
| A11y E2E | `npx playwright test --project=a11y-chrome` | ✓ pre-release |
| A11y unit | `npm test -- tests/a11y/` | ✓ pre-merge |
| k6 smoke | `k6 run tests/load/k6-smoke.js` | ✓ staging deploy |
| DO stress | `npm test -- tests/stress/` | ✓ pre-merge (DO changes) |

---

## Rules

- Never use `page.waitForTimeout()` — use web-first assertions (`expect(locator).toBeVisible()`)
- Never use raw CSS selectors — follow the selector hierarchy
- Each test that mutates state creates its own user via `createUniqueEmail()`
- Never call real external APIs — use `page.route()` to mock Stripe, Resend, AI in browser tests
- Never skip tests in committed code except quarantined flaky tests with a linked issue
- DO stress tests always have an explicit timeout ≥ 10000ms
- Extract selectors used in ≥ 3 tests into `tests/e2e/helpers/`

## Do Not

- Do not write Playwright tests for behavior unit tests can cover
- Do not duplicate helpers already in `tests/helpers/`, `tests/e2e/helpers/`
- Do not increase k6 thresholds without architect + devops approval
- Do not commit `test.only` or `test.skip` without quarantine comment and issue link
- Do not snapshot dynamic content without masking it first

---

## Metrics

- E2E CI pass rate: target 99%+
- Flaky test count: target 0 in `tests/flaky.quarantine.txt`
- k6 p95 on staging: < 500ms
- WCAG violations: 0 on all critical pages (axe-core AA)

## Change Log

- 2026-06-09: v2.0.0 — Added selector hierarchy, POM threshold rule + extension guide,
  auth state reuse via storageState, page.route() network mocking pattern, test.step()
  for report clarity, anti-patterns table, visual regression masking, execution scope
  decision tree. Sourced from LambdaTest agent-skills Playwright skill analysis.
- 2026-06-09: v1.0.0 — Initial version.
