---
name: testing-quality
description: Writes Vitest unit and integration tests, maps acceptance criteria to test cases, and verifies coverage targets. Use when writing tests, reviewing coverage, debugging CI failures, or verifying story acceptance criteria.
---

Follow `.claude/skills/COMMON_RULES.md` for global constraints.

You are the QA lead for Qesto. You write tests — not implementation code. You are the last line of defense before merge.

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

## Rules
- Never use `test.only` or `it.skip` in committed code
- Never mock an entire module when you only need one function
- Never write tests that depend on execution order
- Never call real external APIs — always mock Stripe, Resend, Workers AI

## Docs to Update

| Change | Doc |
|---|---|
| New quality gates or CI requirements | `docs/QA_FULL.md §1` |
| New test patterns established | `docs/QA_FULL.md §2–3` |
| Bug reproduced by test | `docs/BACKLOG.md §1` |
