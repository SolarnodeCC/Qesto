# Testing Pyramid & CI Quality Gates

_Hub: [Documentation map](./README.md)._

## Overview

Qesto uses a structured testing pyramid to ensure comprehensive coverage while maintaining fast feedback loops. Tests are classified into three levels: Unit, Integration, and E2E, with target distributions and performance gates.

## Testing Pyramid Structure

```
        🔺 E2E Tests (10%)
        Slow, brittle, valuable
        
     📦 Integration Tests (20%)
     Medium speed, higher confidence
     
🏗️  Unit Tests (70%)
   Fast, isolated, foundation
```

### Target Distribution

| Level | Target | Count | Per PR | Speed |
|-------|--------|-------|--------|-------|
| **Unit** | 70% | ~42 files | 0 failures | <100ms each |
| **Integration** | 20% | ~12 files | 0 failures | <1s each |
| **E2E** | 10% | ~6 files | 0 failures (or skip) | <5s each |

**Current Stats:** 42 test files, 405 tests passing (`npm test`, verified 2026-05-01)

## Test Classification

### 1. Unit Tests

**Location:** `tests/unit/`

**Purpose:** Test individual functions, utilities, and services in isolation

**Characteristics:**
- No external dependencies (database, network, file system)
- Use mocks/stubs for external calls
- Run in <100ms
- Test happy path, error cases, edge cases
- >90% code coverage target for the tested module

**Examples:**
```typescript
// tests/unit/services/sessionLifecycle.test.ts
describe('SessionLifecycle', () => {
  it('should transition from DRAFT to LIVE', () => {
    const session = new SessionLifecycle({ status: 'draft' })
    session.start()
    expect(session.status).toBe('live')
  })
})

// tests/unit/middleware/idempotency.test.ts
describe('Idempotency middleware', () => {
  it('should reject duplicate requests with same idempotency key', () => {
    const req1 = idempotencyCheck({ idempotencyKey: 'abc-123' })
    const req2 = idempotencyCheck({ idempotencyKey: 'abc-123' })
    expect(req2.status).toBe(409)
  })
})
```

### 2. Integration Tests

**Location:** `tests/technical/`, `tests/functional/`, `tests/data-security/`

**Purpose:** Test interactions between components, APIs, and services

**Characteristics:**
- May use real or mocked databases
- Test API routes with request/response
- Test business logic workflows
- Run in <1s
- Focus on contract/interface correctness
- Real authentication/authorization flows

**Examples:**
```typescript
// tests/technical/api/route-integrity.test.ts
describe('API Route Integrity', () => {
  it('should have all routes properly mounted', () => {
    // Tests that route structure matches expected paths
    expect(getRoutePaths()).toContain('/api/sessions/:id')
  })
})

// tests/functional/workflows/decision-workflow.test.ts
describe('Decision Workflow', () => {
  it('should complete full voting cycle', async () => {
    const session = await createSession()
    await submitVote(session.id, 'option-a')
    const result = await getResults(session.id)
    expect(result.votes).toContain('option-a')
  })
})
```

### 3. E2E Tests

**Location:** `tests/functional/e2e/`, `tests/load/`, `tests/perf/`

**Purpose:** Test complete user journeys from entry to exit

**Characteristics:**
- Full browser/client simulation
- Real or staging environment
- Test entire workflows
- Run in <5s
- Focus on critical paths (join, vote, results)
- May be skipped in CI if infrastructure not available

**Examples:**
```typescript
// tests/functional/e2e/e2e-scenario.test.ts
describe('E2E: Complete Session Workflow', () => {
  it('user should join, vote, and see results', async () => {
    // Simulate complete user flow
    await joinSession('code-1234')
    await submitVote('option-a')
    const results = await viewResults()
    expect(results.winner).toBe('option-a')
  })
})
```

## Test Organization

### By Feature Domain

```
tests/
├── unit/                          # Atomic unit tests
│   ├── services/                  # Business logic
│   ├── middleware/                # Request/response handlers
│   └── db/                        # Database queries
├── functional/                    # Feature workflows
│   ├── ui/                        # Component behavior
│   ├── workflows/                 # Multi-step flows
│   └── e2e/                       # Full user journeys
├── technical/                     # Infrastructure
│   ├── api/                       # Route/endpoint testing
│   ├── integration/               # External service integration
│   ├── websockets/                # WebSocket communication
│   └── messaging/                 # Async messaging
├── data-security/                 # Data & security
│   ├── authentication/            # Auth flows
│   ├── permissions/               # Access control
│   ├── ownership/                 # Data isolation
│   └── data-integrity/            # GDPR, audit logs
├── a11y/                          # Accessibility
│   └── critical-flows.test.ts     # WCAG AA compliance
├── load/                          # Performance at scale
│   └── k6/                        # Load testing
└── perf/                          # Build performance
    └── measure-performance.cjs    # Bundle size tracking
```

## Running Tests

### All Tests
```bash
npm test
```

### By Level
```bash
# Unit tests only
npm test -- tests/unit/

# Integration tests only
npm test -- tests/technical/ tests/functional/ tests/data-security/

# E2E tests only
npm test -- tests/functional/e2e/ tests/load/

# Accessibility tests
npm test -- tests/a11y/
```

### By Feature
```bash
# Session lifecycle
npm test -- tests/unit/services/sessionLifecycle.test.ts

# Authentication
npm test -- tests/data-security/authentication/

# API routes
npm test -- tests/technical/api/
```

### With Filtering
```bash
# Run tests matching pattern
npm test -- --grep "should submit vote"

# Run single file
npm test -- tests/unit/services/sessionLifecycle.test.ts

# Run with coverage (requires @vitest/coverage-v8)
npm test -- --coverage
```

## Performance Targets

### Test Execution Time

| Level | Target | Actual | Status |
|-------|--------|--------|--------|
| Unit (42 files) | 4.2s (100ms each) | <3s | ✅ PASS |
| Integration (18 files) | 18s (1s each) | <12s | ✅ PASS |
| E2E (3 files) | 15s (5s each) | <3s | ✅ PASS |
| **Total** | **~37s** | **~18s** | ✅ PASS |

### Coverage Targets

| Metric | Target | Status | Notes |
|--------|--------|--------|-------|
| Line Coverage | 80% | 🔄 Pending | Coverage gate not yet implemented |
| Branch Coverage | 75% | 🔄 Pending | Hit all code paths |
| Function Coverage | 85% | 🔄 Pending | All functions tested |
| Statement Coverage | 80% | 🔄 Pending | Every statement executed |

## CI Quality Gates

### PR Gates (Required)

✅ **All tests pass**
```bash
npm test 2>&1 | grep "Test Files"
# Must show: "Test Files" "passed"
```

✅ **No TypeScript errors**
```bash
npm run typecheck
# Must show no errors
```

✅ **Code quality checks**
- ESLint (style + security)
- No critical violations

✅ **Performance targets met**
- Build size <200KB JS, <50KB CSS
- Test execution <30s total

### CI Implementation

See `.github/workflows/qa-gates.yml` for implementation.

## Writing Good Tests

### Unit Test Checklist

- [ ] Tests a single function/method
- [ ] No external dependencies (mock them)
- [ ] Tests success case
- [ ] Tests error/edge cases
- [ ] Clear test name: `should [behavior] when [condition]`
- [ ] Runs in <100ms
- [ ] No shared state between tests

### Integration Test Checklist

- [ ] Tests interaction between components
- [ ] Tests API contract (request/response)
- [ ] Mock external services (Stripe, email, etc.)
- [ ] Tests success and error flows
- [ ] Clear business context in test name
- [ ] Runs in <1s
- [ ] Setup/teardown properly isolated

### E2E Test Checklist

- [ ] Tests complete user journey
- [ ] Tests critical business flow
- [ ] Can skip gracefully in CI (skip when infrastructure unavailable)
- [ ] Tests from user perspective (not internal details)
- [ ] Clear scenario description
- [ ] Runs in <5s

## Common Test Patterns

### Mocking External Services

```typescript
// Mock Stripe API
vi.mock('../lib/stripe', () => ({
  createCharge: vi.fn().mockResolvedValue({ id: 'ch_123' })
}))

// Use in test
import { createCharge } from '../lib/stripe'
expect(createCharge).toHaveBeenCalledWith({ amount: 999 })
```

### Testing Database Queries

```typescript
// Use D1 test utilities
import { createTestDB } from '../test-helpers'

const db = createTestDB()
await db.query('INSERT INTO sessions (id) VALUES (?)', ['sess-123'])
const session = await db.query('SELECT * FROM sessions WHERE id = ?', ['sess-123'])
expect(session).toBeDefined()
```

### Testing WebSocket Messages

```typescript
import { createTestWebSocket } from '../test-helpers'

const ws = createTestWebSocket()
ws.send({ type: 'submit-vote', answer: 'option-a' })
expect(ws.lastMessage.type).toBe('vote-confirmed')
```

### Testing Error Handling

```typescript
it('should return 401 when not authenticated', async () => {
  const res = await request('/api/sessions/123')
    .get()
    .expect(401)
  expect(res.body.error).toMatch(/unauthorized|authentication required/i)
})
```

## Continuous Integration

### Test Runs on Every Push

1. **Lint & Type Check** (1m)
   - ESLint for code quality
   - TypeScript --noEmit for type safety

2. **Unit Tests** (3s)
   - Fast feedback
   - Run immediately

3. **Integration Tests** (12s)
   - More thorough checks
   - Run in parallel

4. **E2E Tests** (optional, 3s)
   - Skip if infrastructure unavailable
   - Run with continue-on-error

5. **Performance Checks** (optional)
   - Bundle size tracking
   - Non-blocking

6. **Coverage Report** (if enabled)
   - Line coverage ≥80%
   - Blocks merge if below threshold

## Tools & Configuration

### Vitest

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 10000,
    hookTimeout: 10000,
    reporters: ['verbose'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['functions/**/*.ts', 'src/**/*.ts'],
      exclude: [
        'node_modules/',
        'tests/',
        'dist/',
        '**/*.test.ts',
        '**/*.d.ts'
      ],
      lines: 80,
      branches: 75,
      functions: 85,
      statements: 80
    }
  }
})
```

## Troubleshooting

### Test Timeout

```bash
# Increase timeout for slow tests
npm test -- --testTimeout=20000

# Or use vi.setConfig in test file
vi.setConfig({ testTimeout: 20000 })
```

### Flaky Tests

- Use `beforeEach()` to reset state
- Mock time with `vi.useFakeTimers()`
- Avoid `setTimeout()` without mocking
- Test isolated, no shared state

### Missing Mocks

```bash
npm test -- --reporter=verbose
# Shows which imports aren't mocked
```

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [Test Pyramid Article](https://martinfowler.com/bliki/TestPyramid.html)

## Next Steps

1. **Enable Coverage Reporting**
   - Install `@vitest/coverage-v8`
   - Add coverage gate to CI

2. **Performance Profiling**
   - Profile slowest tests
   - Optimize database mocks

3. **E2E Expansion**
   - Add critical path tests
   - Set up staging environment

4. **Documentation**
   - Add test examples per feature
   - Create testing guidelines document
