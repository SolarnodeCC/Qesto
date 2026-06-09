---
name: testing-quality
description: Writes Vitest unit and integration tests, maps acceptance criteria to test cases, and verifies coverage targets. Use when writing tests, reviewing coverage, debugging CI failures, or verifying story acceptance criteria.
---
# Skill: Testing & Quality
# SCOPE: unit/integration tests, coverage verification, CI debugging
# LOAD: when writing tests, reviewing coverage, debugging CI failures, verifying AC
# VERSION: v2.0.0
# OWNER: QA

## Role

QA lead for Qesto. You write tests — not implementation code — and verify coverage targets.
You are the last line of defense before merge.

## Preconditions / Inputs

- Acceptance criteria for the feature (from story)
- Access to test infrastructure (Vitest, mockEnv, testHonoApp)
- Knowledge of coverage targets per area
- CI failure logs (if debugging)

---

## Step 0 — Decide the test level before writing anything

```
What are you testing?                          → Which test level
─────────────────────────────────────────────────────────────────
Pure function / util / JWT / KV key builder    → Unit   (tests/unit/)        mockEnv vi.fn()
Route handler / middleware / state transition  → Integration (tests/integration/)  testHonoApp()
DO concurrent behavior / WebSocket protocol   → Stress  (tests/stress/)      MockDurableObjectState
Full browser flow / WCAG on real pages         → E2E / a11y  → hand to qesto-e2e-tester
```

**Rule:** test at the lowest level that fully captures the behavior. Never write an
integration test for something a unit test can cover; never write a unit test for something
that only matters end-to-end.

---

## Test Infrastructure

```
tests/unit/        # Vitest unit tests (primary — CI enforced)
tests/integration/ # Real Hono app + KVMock + D1Mock (use when crossing a route boundary)
tests/helpers/     # kv-mock.ts, do-mock.ts, d1-mock.ts — reuse, never reduplicate
```

### Layer run commands

```bash
npm test                              # all layers (CI mode)
npm test -- tests/unit/               # unit layer only
npm test -- tests/integration/        # integration layer only
npm run test:watch                    # vitest watch (local dev)
npm run type-check                    # tsc --noEmit — required before every commit
npx wrangler d1 migrations apply DB --local  # run once before integration tests
```

**Recommended local order before pushing:**
1. `npm run type-check` — fail fast on types
2. `npm test -- tests/unit/` — fast, no I/O
3. `npm test -- tests/integration/` — slower, real app
4. `npm test` — full suite confirms nothing broken

---

## Mock Infrastructure

### Unit tests: `mockEnv` (vi.fn() — use for pure function and middleware tests)

```typescript
import { vi } from 'vitest'

export const mockEnv = {
  DB: { prepare: vi.fn().mockReturnValue({ bind: vi.fn().mockReturnThis(), first: vi.fn(), all: vi.fn(), run: vi.fn() }) },
  SESSIONS_KV: { get: vi.fn(), put: vi.fn(), delete: vi.fn(), list: vi.fn() },
  TEAMS_KV:    { get: vi.fn(), put: vi.fn(), delete: vi.fn() },
  USERS_KV:    { get: vi.fn(), put: vi.fn() },
  TEMPLATES_KV:{ get: vi.fn(), put: vi.fn(), delete: vi.fn() },
  AI:          { run: vi.fn().mockResolvedValue({ response: 'mocked' }) },
  DECISIONS_VECTORIZE: { insert: vi.fn(), query: vi.fn() },
}
```

KV mocks **must return JSON strings**, not objects:
```typescript
mockEnv.SESSIONS_KV.get.mockResolvedValue(JSON.stringify({ status: 'draft', ownerId: 'user-1' }))
// ✗  mockEnv.SESSIONS_KV.get.mockResolvedValue({ status: 'draft' })  — will break JSON.parse
```

### Integration tests: `testHonoApp()` (real app — use when crossing a route boundary)

`tests/integration/setup.ts` exports a factory that wires the real Hono app with `KVMock`
and `D1Mock`. Prefer this over `mockEnv` whenever your test exercises a full request/response
cycle including middleware, auth, and KV reads/writes.

```typescript
import { testHonoApp, cookieFor } from '../integration/setup'

describe('POST /api/sessions/:id/questions', () => {
  it('201: adds question for draft session', async () => {
    const { app, env } = await testHonoApp()
    const cookie = await cookieFor('user-1', 'host@example.com')

    // Seed KV directly via the real KVMock
    await env.SESSIONS_KV.put('sess-1', JSON.stringify({ status: 'draft', ownerId: 'user-1' }))

    const res = await app.request('/api/sessions/sess-1/questions', {
      method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'multiple_choice', text: 'Pick one?', options: ['A', 'B'] }),
    }, env)

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body).toMatchObject({ type: 'multiple_choice', text: 'Pick one?' })
  })
})
```

### Mock strategy rules

| Tool | When to use |
|---|---|
| `vi.fn()` | Replace a single function; assert call count/args |
| `vi.mock('module')` | Replace an entire module (Resend, Stripe SDK) — use sparingly |
| `vi.spyOn(obj, 'method')` | Observe a real function without replacing it; restore after |

**Spy vs mock rule:** if the real implementation is fast and deterministic, use `vi.spyOn`
and keep the real behavior. Only reach for `vi.mock` when the module has I/O, network calls,
or non-determinism (Stripe, Resend, Workers AI, Vectorize).

---

## Test File Structure

Every test file follows the same describe hierarchy:

```typescript
// tests/unit/sessions-questions.test.ts

import { vi, describe, it, expect, beforeEach } from 'vitest'

// 1. Setup — one describe per system concern
describe('POST /api/sessions/:id/questions', () => {
  beforeEach(() => vi.clearAllMocks())  // always — prevents test pollution

  // 2. Happy path
  it('201: adds question to KV for draft session', async () => { ... })

  // 3. Auth / ownership
  it('401: rejects unauthenticated request', async () => { ... })
  it('403: rejects non-owner', async () => { ... })

  // 4. State guard
  it('403: rejects when session is live (not draft)', async () => { ... })

  // 5. Input validation
  it('400: rejects missing question text', async () => { ... })
  it('400: rejects malformed JSON body', async () => { ... })

  // 6. Error paths
  it('500 is sanitized — no stack trace in response', async () => { ... })
})
```

Names read like specifications: `'201: adds question to KV for draft session'` — not
`'should work'` or `'test 1'`.

---

## Matcher Specificity Guide

Pick the most specific matcher for the assertion — it produces better failure messages.

| Situation | Use | Not |
|---|---|---|
| Primitive equality (string, number, boolean) | `toBe('draft')` | `toEqual('draft')` |
| Deep object comparison | `toEqual({ id: '1', status: 'draft' })` | `toBe(...)` |
| Subset of object fields | `toMatchObject({ status: 'draft' })` | `toEqual(whole object)` |
| Array contains item | `toContain('item')` | `toEqual([...])` |
| String matches pattern | `toMatch(/^sess-/)` | `toBe(exact string)` |
| Number range | `toBeGreaterThan(0)` / `toBeLessThan(500)` | `toBe(exact number)` |
| Function throws sync | `expect(() => fn()).toThrow('message')` | manual try/catch |
| Promise rejects | `await expect(promise).rejects.toThrow('message')` | manual try/catch |
| Promise resolves | `await expect(promise).resolves.toEqual(value)` | `const r = await p; expect(r)...` |

---

## Async Patterns

### Happy path

```typescript
it('resolves with session data', async () => {
  await expect(getSession('sess-1', mockEnv)).resolves.toMatchObject({ status: 'draft' })
})
```

### Rejection / error path (required for AI timeout, Stripe failure, DO rejection)

```typescript
it('rejects when Workers AI times out', async () => {
  mockEnv.AI.run.mockRejectedValueOnce(new Error('timeout'))
  await expect(generateInsights('sess-1', mockEnv)).rejects.toThrow('timeout')
})
```

### Retry / fallback assertion

```typescript
it('Workers AI retries once then falls back to safe message', async () => {
  mockEnv.AI.run
    .mockRejectedValueOnce(new Error('transient'))
    .mockResolvedValueOnce({ response: '{"summary":"ok"}' })
  const result = await generateInsights('sess-1', mockEnv)
  expect(mockEnv.AI.run).toHaveBeenCalledTimes(2)
  expect(result).toMatchObject({ summary: 'ok' })
})
```

---

## API Response Contract Shape Tests

For every new route, add a contract describe block that asserts **shape**, not just status.
This catches DTO drift between backend and frontend before it reaches the browser.

```typescript
describe('GET /api/sessions/:id — response contract', () => {
  it('returns required fields in the expected shape', async () => {
    const { app, env } = await testHonoApp()
    await env.SESSIONS_KV.put('sess-1', JSON.stringify({ id: 'sess-1', status: 'draft', ownerId: 'user-1', title: 'Test' }))
    const cookie = await cookieFor('user-1', 'host@example.com')

    const res = await app.request('/api/sessions/sess-1', {
      headers: { Cookie: cookie },
    }, env)
    expect(res.status).toBe(200)

    const body = await res.json()
    // Assert required contract fields
    expect(body).toMatchObject({
      id: expect.any(String),
      status: expect.stringMatching(/^(draft|energizing|live|closed|archived)$/),
      title: expect.any(String),
      ownerId: expect.any(String),
    })
    // Assert no internal fields leak
    expect(body).not.toHaveProperty('_raw')
    expect(JSON.stringify(body)).not.toMatch(/stack|password|jwt/i)
  })
})
```

---

## State Machine Tests (always cover invalid transitions)

```typescript
describe('Session state machine', () => {
  it('start() transitions DRAFT → LIVE atomically — D1 + KV + DO init all updated', async () => { ... })
  it('start() on LIVE session returns 409', async () => { ... })
  it('start() on CLOSED session returns 409', async () => { ... })
  it('REST mutation (PATCH question) on LIVE session returns 403', async () => { ... })
  it('transition-to-live() rejects when session not in energizing state', async () => { ... })
})
```

---

## Audit Regression Patterns

```typescript
it('production 500s are sanitized — no stack trace', async () => {
  const { app, env } = await testHonoApp()
  // Force an internal error by breaking a dependency
  vi.spyOn(env.SESSIONS_KV, 'get').mockRejectedValueOnce(new Error('storage failure'))
  const cookie = await cookieFor('user-1', 'host@example.com')
  const res = await app.request('/api/sessions/sess-1', { headers: { Cookie: cookie } }, env)
  const body = await res.json()
  expect(res.status).toBe(500)
  expect(JSON.stringify(body)).not.toMatch(/stack|Error:|at Object/)
})

it('malformed JSON body returns 400', async () => {
  const { app, env } = await testHonoApp()
  const cookie = await cookieFor('user-1', 'host@example.com')
  const res = await app.request('/api/sessions/sess-1/questions', {
    method: 'POST',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: '{not-json',
  }, env)
  expect(res.status).toBe(400)
})

it('transient DO storage failure clears cached promise — retry succeeds', async () => {
  // First storage.get rejects; cleared promise allows second call to succeed.
})

it('Workers AI timeout/retry is explicit', async () => {
  mockEnv.AI.run
    .mockRejectedValueOnce(new Error('transient'))
    .mockResolvedValueOnce({ response: '{"ok":true}' })
  // Assert retry behavior or safe fallback per the feature contract.
})
```

---

## Coverage Targets

| Area | Min |
|---|---|
| DRAFT-API routes | 90% |
| Session state transitions | 100% critical paths |
| Auth middleware | 100% |
| Plan middleware gating | 80% |
| AI routes | 70% (mock AI, test prompt construction + retry) |

---

## CI Failure Playbook

```bash
# Tests pass locally, fail in CI
→ Missing vi.clearAllMocks() in beforeEach — test pollution

# "Cannot read property of undefined" in KV mock
→ mockEnv.SESSIONS_KV.get must return JSON.stringify(...), not a plain object

# Type error in test file
→ Import from functions/api/types.ts — never redeclare DTOs in tests

# Miniflare DO test hangs
→ Add explicit timeout: it('…', async () => {…}, 10_000)

# Integration test: D1 table missing
→ Run: npx wrangler d1 migrations apply DB --local  before the test suite

# Promise rejection not caught
→ Use await expect(promise).rejects.toThrow() — do not suppress with try/catch
```

---

## Quality Gates

| Gate | Command | Required |
|---|---|---|
| Type check | `tsc --noEmit` | ✓ pre-commit |
| Unit tests | `npm test -- tests/unit/` | ✓ pre-commit |
| Integration tests | `npm test -- tests/integration/` | ✓ pre-merge |
| No skipped tests | `grep -r 'it\.skip\|test\.skip' tests/unit tests/integration` | ✓ |
| Audit regression | targeted test for every changed audit-affected area | ✓ |

---

## Flaky Test Triage & Quarantine Policy

### Detection
- Run CI twice on the same commit; passes 1/2 → flaky
- Log in GitHub issue with `flaky-test` label

### Triage (within 24h)
1. **Timing**: depends on `setTimeout`/`setInterval`? → `vi.useFakeTimers()`
2. **State pollution**: modifies shared mock? → verify `vi.clearAllMocks()` in `beforeEach`
3. **Mock ordering**: KV mock order matters? → ensure deterministic setup per test
4. **DO/Miniflare**: timeout too short? → add explicit timeout ≥ 10000ms

### Quarantine (if unresolved)
- `it.skip('…', …) // FLAKY: reason — issue #XXX`
- Add to `tests/flaky.quarantine.txt`
- GitHub issue with `flaky-test` label + remediation plan

### Prevention
- All timing-based tests use `vi.useFakeTimers()`
- All mock setup in `beforeEach` — never in `describe` scope
- DO tests: 10000ms timeout by default
- Use `waitFor()` not `setTimeout` in React tests

---

## Rules

- Never use `test.only` or `it.skip` in committed code (except quarantined flaky with issue link)
- Never mock an entire module when you only need one function — use `vi.spyOn`
- Never write tests that depend on execution order
- Never call real external APIs — always mock Stripe, Resend, Workers AI, Vectorize
- Never increase a coverage floor target without architect approval
- Never commit with skipped tests unless quarantined flaky with a linked issue

---

## Output Contract

1. Test file(s) created/modified + layer (unit / integration)
2. Which acceptance criteria each test covers
3. Edge cases not yet covered
4. `npm test` result (pass/fail + count)
5. Handoffs fired + docs updated

## Docs to Update

- `docs/QA_FULL.md §1` — new quality gates or CI requirements
- `docs/QA_FULL.md §2–3` — new test patterns
- `knowledge-base/product/backlog/BACKLOG_MASTER.md §1` — bugs reproduced by tests
- `tests/flaky.quarantine.txt` — quarantined flaky tests

## Metrics

- Overall coverage: aim 85%+
- Critical path coverage (state machine, auth, billing): 100%
- Flaky test count: target 0 unquarantined
- CI pass rate: target 99%

## Change Log

- 2026-06-09: v2.0.0 — Added execution scope decision tree, promoted `testHonoApp()` as
  primary integration pattern, added matcher specificity guide, async rejection patterns,
  spy vs mock decision rules, API contract shape test pattern, test file structure template,
  layer-by-layer run commands. Sourced from deepwiki/coleam00 + LambdaTest agent-skills
  Playwright/Jest skill analysis.
- 2026-06-04: v1.0.0 — Initial. Audit regression priorities + flaky-test policy.
