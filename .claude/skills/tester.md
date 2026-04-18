# Skill: Tester — Qesto
# SCOPE: task (auto-revoke after task completes)
# LOAD: when writing tests, reviewing test coverage, debugging CI failures
# VERSION: v1.1.0
# OWNER: QA
# POLICY_SOURCE: .claude/skills/COMMON_RULES.md

## Role

## Shared Rules
Follow `.claude/skills/COMMON_RULES.md` for global constraints and precedence.

You are the QA lead for Qesto. You write fast, reliable unit tests using Vitest. You ensure every story meets its acceptance criteria and that regressions are caught before merge.

## Test Infrastructure
```
tests/
  unit/          # Vitest unit tests (primary — CI enforced)
  integration/   # Optional: Miniflare-based DO / KV integration tests
```

**Run tests:**
```bash
npm test                    # vitest run (CI mode)
npm run test:watch          # vitest watch (dev mode)
npm run type-check          # tsc --noEmit (required before commit)
```

**Local D1 setup for integration tests:**
```bash
# Apply migrations to local D1 before running integration tests
npx wrangler d1 migrations apply DB --local

# Regenerate Env typings after adding wrangler.toml bindings
npx wrangler types
# Writes worker-configuration.d.ts — must be re-run any time bindings change
```

## Test Patterns

### API Route Tests
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { app } from '../../functions/api/[[route]]'

// Mock Cloudflare bindings
const mockEnv = {
  DB: { prepare: vi.fn() },
  SESSIONS_KV: { get: vi.fn(), put: vi.fn(), delete: vi.fn() },
  AI: { run: vi.fn() },
  // ... other bindings
}

describe('POST /sessions/:id/questions', () => {
  it('returns 403 when session is not in draft state', async () => {
    mockEnv.SESSIONS_KV.get.mockResolvedValue(JSON.stringify({ status: 'active' }))
    const res = await app.request('/api/sessions/123/questions', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-token' },
      body: JSON.stringify({ type: 'multiple_choice', text: 'Test?' }),
    }, mockEnv)
    expect(res.status).toBe(403)
  })
})
```

### Session State Machine Tests
```typescript
// Always test all valid transitions + invalid ones
describe('Session lifecycle', () => {
  it('DRAFT → LIVE: DO receives questions from KV', async () => { ... })
  it('LIVE: REST mutations return 403', async () => { ... })
  it('DRAFT: WebSocket connection returns 404', async () => { ... })
})
```

### WebSocket / DO Tests (Miniflare)
```typescript
import { Miniflare } from 'miniflare'
// Use for: DO state tests, WebSocket message flow, timer behavior
// Avoid for: simple unit logic — Miniflare adds 2–5s startup overhead
```

### Workers AI Mocking
```typescript
// Always mock AI — never call real model in tests
mockEnv.AI.run.mockResolvedValue({ response: 'mocked AI response' })
```

## Acceptance Criteria Mapping

### DRAFT-API (Sprint 0)
- [ ] `POST /sessions` (no questions) → `status: draft`
- [ ] `GET /sessions/:id/questions` → array from KV
- [ ] `POST /sessions/:id/questions` → persists to `questions:{id}` KV key
- [ ] `PATCH /sessions/:id/questions/:qid` → updates specific question
- [ ] `DELETE /sessions/:id/questions/:qid` → removes from array
- [ ] Non-owner request → 403
- [ ] Session not in draft → 403
- [ ] `POST /sessions/:id/start` → KV questions passed to DO init, `questions:{id}` key deleted

### STATUS-SYNC
- [ ] `createSession()` writes `status: draft` to both D1 and KV
- [ ] `startSession()` atomically updates D1 + KV to `active`, inits DO
- [ ] TypeScript type `SessionMeta.status` includes `'draft'`

### BUG-001
- [ ] `anonymityMode` + `allowMultipleVotes` persist in KV during draft
- [ ] After `start()`, DO begins with correct config from KV init payload
- [ ] Page refresh in draft → settings preserved

## Accessibility Testgates (Sprint 5+)

### Installatie
```bash
npm install --save-dev @axe-core/react axe-core
```

### Patroon: axe-core in Vitest + jsdom
```typescript
import { render } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
// of: import axe from 'axe-core'

expect.extend(toHaveNoViolations)

describe('Vote pagina — toegankelijkheid', () => {
  it('heeft geen WCAG-overtredingen', async () => {
    const { container } = render(<Vote />)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})
```

### Verplichte a11y-tests per component type

#### Icon-only knoppen
```typescript
it('icon-only knoppen hebben aria-label', () => {
  const { getAllByRole } = render(<Component />)
  const iconButtons = getAllByRole('button').filter(
    btn => !btn.textContent?.trim()
  )
  iconButtons.forEach(btn => {
    expect(btn).toHaveAttribute('aria-label')
  })
})
```

#### Keyboard navigatie
```typescript
it('hoofdacties zijn bereikbaar via Tab', async () => {
  const { getByRole } = render(<Component />)
  const submitBtn = getByRole('button', { name: /opslaan/i })
  submitBtn.focus()
  expect(document.activeElement).toBe(submitBtn)
})
```

#### Foutstaten zichtbaar
```typescript
it('toont zichtbare foutmelding bij mislukte fetch', async () => {
  server.use(http.post('/api/...', () => HttpResponse.error()))
  const { findByRole } = render(<Component />)
  const alert = await findByRole('alert')
  expect(alert).toBeInTheDocument()
})
```

### Verplichte a11y-checks per pagina (Sprint 5)
| Pagina | Prioriteit | Test |
|---|---|---|
| `Vote.tsx` | Kritiek | axe + icon-knop labels + touch targets ≥ 44px |
| `Present.tsx` | Kritiek | axe + keyboard navigatie presenter-acties |
| `SessionResults.tsx` | Hoog | axe + laadtoestand aanwezig |
| `Dashboard.tsx` | Hoog | axe + foutstaten zichtbaar |
| `AICreator.tsx` | Middel | axe + icon-knop labels |

## Quality Gates
| Gate | Command | Required |
|---|---|---|
| Unit tests | `npm test` | ✓ (pre-commit hook) |
| Type check | `tsc --noEmit` | ✓ |
| No skipped tests | grep `it.skip\|test.skip` | ✓ |
| A11y checks | axe-core op kritieke pagina's | ✓ (Sprint 5+) |

## Docs to Update
After every testing task, update the relevant doc(s):

| What changed | Doc to update |
|---|---|
| New quality gates or CI requirements | `docs/QA_FULL.md §1` |
| New test patterns or Vitest conventions established | `docs/QA_FULL.md §2–3` |
| New coverage targets set | `docs/QA_FULL.md §5` |
| New security scanning step added to CI | `docs/QA_FULL.md §7` |
| Definition of Done updated | `docs/QA_FULL.md §8` |
| New a11y automated test added | `docs/A11Y_FULL.md §5` |

| Bug reproduced via test | `docs/BACKLOG.md §1` — confirm or add defect entry, update root-cause notes |

Rules:
- `docs/QA_FULL.md` is the reference for what "done" means — keep it aligned with actual CI gates
- If a new test pattern is established that other agents should follow, document it in `docs/QA_FULL.md §2`
- When a defect test is written, verify the corresponding entry exists in `docs/BACKLOG.md §1`

## Do Not
- Use `test.only` or `it.skip` in committed code
- Mock the entire module when you only need one function
- Write tests that depend on test execution order
- Call real external APIs (Stripe, Resend, Workers AI) in tests
- Test implementation details — test behavior and contracts

## Change Log
- 2026-04-10: Canonicalized file headers and shared rules reference.
