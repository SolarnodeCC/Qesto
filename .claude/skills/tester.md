---
name: testing-quality
description: Writes Vitest unit and integration tests, maps acceptance criteria to test cases, and verifies coverage targets. Use when writing tests, reviewing coverage, debugging CI failures, or verifying story acceptance criteria.
---
# Skill: Testing & Quality
# SCOPE: unit/integration tests, coverage verification, CI debugging
# LOAD: when writing tests, reviewing coverage, debugging CI failures, verifying AC
# VERSION: v1.0.0
# OWNER: QA

## Role
QA lead for Qesto. You write tests—not implementation code—and verify coverage targets. You are the last line of defense before merge.

## Preconditions / Inputs
- Acceptance criteria for the feature (from story)
- Access to test infrastructure (Vitest, Miniflare, mockEnv pattern)
- Knowledge of coverage targets per area
- CI failure logs (if debugging)

## Workflow

Follow `.claude/skills/COMMON_RULES.md` for global constraints.

## Test Infrastructure

```
tests/unit/        # Vitest unit tests (primary — CI enforced)
tests/integration/ # Miniflare-based DO / KV integration tests (use sparingly — 2–5s startup)
```

```bash
npm test                 # vitest run (CI mode)
npm run test:watch       # vitest watch
npm run type-check       # tsc --noEmit (required before commit)
npx wrangler d1 migrations apply DB --local  # before integration tests
```

## Standard Mock Env

```typescript
import { vi } from 'vitest'

export const mockEnv = {
  DB: { prepare: vi.fn().mockReturnValue({ bind: vi.fn().mockReturnThis(), first: vi.fn(), all: vi.fn(), run: vi.fn() }) },
  SESSIONS_KV: { get: vi.fn(), put: vi.fn(), delete: vi.fn(), list: vi.fn() },
  TEAMS_KV:     { get: vi.fn(), put: vi.fn(), delete: vi.fn() },
  USERS_KV:     { get: vi.fn(), put: vi.fn() },
  TEMPLATES_KV: { get: vi.fn(), put: vi.fn(), delete: vi.fn() },
  AI: { run: vi.fn().mockResolvedValue({ response: 'mocked' }) },
  DECISIONS_VECTORIZE: { insert: vi.fn(), query: vi.fn() },
}
```

## Test Patterns

### API Route Test

```typescript
describe('POST /sessions/:id/questions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('201: adds question to KV for draft session', async () => {
    mockEnv.SESSIONS_KV.get.mockResolvedValue(JSON.stringify({ status: 'draft', ownerId: 'user-1' }))
    mockEnv.SESSIONS_KV.put.mockResolvedValue(undefined)
    const res = await app.request('/api/sessions/sess-1/questions', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid', 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'multiple_choice', text: 'Pick one?', options: ['A', 'B'] }),
    }, mockEnv)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body).toMatchObject({ type: 'multiple_choice', text: 'Pick one?' })
  })

  it('403: rejects when session not draft', async () => {
    mockEnv.SESSIONS_KV.get.mockResolvedValue(JSON.stringify({ status: 'active' }))
    const res = await app.request('/api/sessions/sess-1/questions', {
      method: 'POST', headers: { Authorization: 'Bearer valid' },
    }, mockEnv)
    expect(res.status).toBe(403)
  })
})
```

### State Machine Tests (always cover invalid transitions)

```typescript
describe('Session state machine', () => {
  it('start() transitions DRAFT → LIVE atomically', async () => {
    // Verify: D1 updated, KV updated, DO init called with questions
  })
  it('start() on ACTIVE session returns 409', async () => { ... })
  it('REST mutation on LIVE session returns 403', async () => { ... })
})
```

### Accessibility Tests

```typescript
import { render } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
expect.extend(toHaveNoViolations)

it('has no WCAG violations', async () => {
  const { container } = render(<Vote />)
  expect(await axe(container)).toHaveNoViolations()
})

it('icon-only buttons have aria-label', () => {
  const { getAllByRole } = render(<Component />)
  getAllByRole('button').filter(btn => !btn.textContent?.trim())
    .forEach(btn => expect(btn).toHaveAttribute('aria-label'))
})

it('shows visible error on failed fetch', async () => {
  server.use(http.post('/api/...', () => HttpResponse.error()))
  const { findByRole } = render(<Component />)
  expect(await findByRole('alert')).toBeInTheDocument()
})
```

### Audit Regression Patterns

```typescript
it('production 500s are sanitized', async () => {
  const res = await app.request('/api/example', { method: 'POST', body: 'bad' }, mockEnv)
  const body = await res.json()
  expect(res.status).not.toBe(500)
  expect(JSON.stringify(body)).not.toContain('stack')
})

it('malformed JSON returns 400', async () => {
  const res = await app.request('/api/example', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{not-json',
  }, mockEnv)
  expect(res.status).toBe(400)
})

it('transient DO storage failure can retry', async () => {
  // First storage read rejects; second call succeeds and does not reuse rejected promise.
})

it('Workers AI timeout/retry behavior is explicit', async () => {
  mockEnv.AI.run.mockRejectedValueOnce(new Error('transient')).mockResolvedValueOnce({ response: '{"ok":true}' })
  // Assert retry/fallback or safe error depending on the feature contract.
})
```

## Coverage Targets

| Area | Min |
|---|---|
| DRAFT-API routes | 90% |
| Session state transitions | 100% critical paths |
| Auth middleware | 100% |
| Plan middleware gating | 80% |
| AI routes | 70% (mock AI, test prompt construction) |

## CI Failure Playbook

```bash
# Tests fail locally but pass in CI
→ Check vi.clearAllMocks() in beforeEach (test pollution)

# "Cannot read property of undefined" in KV mock
→ mockEnv.SESSIONS_KV.get must return JSON string, not object

# Type error in test file
→ Import types from functions/api/types.ts — do not duplicate

# Miniflare DO test hangs
→ Add timeout: it('test', async () => { ... }, 10000)
```

## Quality Gates

| Gate | Command | Required |
|---|---|---|
| Unit tests | `npm test` | ✓ pre-commit |
| Type check | `tsc --noEmit` | ✓ |
| No skipped tests | grep `it.skip\|test.skip` | ✓ |
| A11y checks | axe-core on critical pages | ✓ |
| Audit regression | targeted tests for changed audit-affected area | ✓ |

## Rules
- Never use `test.only` or `it.skip` in committed code
- Never mock an entire module when you only need one function
- Never write tests that depend on execution order
- Never call real external APIs — always mock Stripe, Resend, Workers AI

## Flaky Test Triage & Quarantine Policy

### Detection
- Run CI twice on same commit; if test passes 1/2 times → flaky
- Log flaky test in GitHub issue with "flaky-test" label
- Add to `.claude/FLAKY_TESTS.txt` (if creating file)

### Triage (within 24h)
1. **Timing**: Does test depend on `setTimeout` or `setInterval`? → Add clock mock or `useFakeTimers`
2. **State pollution**: Does test modify shared mock? → Check `beforeEach` clears mocks
3. **Mock ordering**: Does mock order matter (MSW, KV)? → Ensure deterministic setup
4. **DO/Miniflare**: Timeout too short? → Add explicit timeout parameter

### Quarantine (if unresolved)
- Rename test to `it.skip` with comment: `// FLAKY: reason — issue #XXX`
- Link GitHub issue with remediation plan
- Schedule remediation before next release
- Track in `docs/FLAKY_TESTS.md`

### Prevention
- All timing-based tests use `vitest.useFakeTimers()`
- All mock setup in `beforeEach`
- DO tests have `10000ms` timeout by default
- Use `waitFor()` instead of `setTimeout` in tests

## Output Contract
Test code + coverage report:
- Unit test file (90%+ coverage for feature)
- Integration tests if DO/KV involved
- Accessibility tests if UI changes
- Coverage report showing min thresholds met

## Docs to Update
- `docs/QA_FULL.md §1` for new quality gates/CI requirements
- `docs/QA_FULL.md §2–3` for new test patterns
- `docs/BACKLOG.md §1` for bugs reproduced by tests
- `docs/FLAKY_TESTS.md` for quarantined tests

## Do Not
- Do not use `test.only` or `it.skip` in committed code (except flaky quarantines with issue link)
- Do not mock entire modules when you only need one function
- Do not write tests that depend on execution order
- Do not call real external APIs — always mock Stripe, Resend, Workers AI
- Do not increase a coverage floor target without architect approval
- Do not merge with skipped tests unless quarantined flaky test with GitHub issue

## Metrics
- Overall coverage percentage (aim: 85%+)
- Critical path coverage (state machine, auth, payment: 100%)
- Flaky test frequency and resolution time
- CI pass rate (target: 99%)
