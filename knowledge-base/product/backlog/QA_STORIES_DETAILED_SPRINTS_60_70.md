---
id: QA-STORIES-DETAILED
type: planning
domain: quality
category: qa-stories
status: active
version: 1.0
created: 2026-05-25
updated: 2026-05-25
tags:
  - qa
  - stories
  - detailed-specs
  - sprints-60-70
relates_to:
  - QA_COMMITMENT_SPRINTS_60_70
  - SPRINT_PLAN_MASTER
---

# QA Story Specifications — Sprints 60–70 (Detailed)

**All stories**: P0 unless marked P1. Story size: 5 pts (quick), 8 pts (standard), 13 pts (epic).

---

## S60: LOAD-PROOF-01 — 10k Voter Scaling Test

**Story ID:** QA-LOAD-PROOF-01  
**Sprint:** 60  
**Epic:** QA  
**Priority:** P0  
**Size:** 8 pts  
**Owner:** QA Engineer (backend focus)

### Story

As a QA lead, I can run a realistic 10,000-voter load simulation against SessionRoom so that Qesto can validate enterprise scaling claims (10k concurrent voters) and unblock GTM for large-event organizers.

### Acceptance Criteria

**Test Infrastructure**
- [ ] Load test harness in `tests/load/10k-voter-scale.test.ts` uses Miniflare for local DO mock (not production Cloudflare)
- [ ] Harness accepts parameterized `connectionRate` (connections/sec): 100, 500, 1000
- [ ] Test runs 5-question poll → vote submission → reconnect → results view cycle
- [ ] Execution completes in <2 minutes locally

**Success Metrics**
- [ ] Connection success rate ≥99.5% (≤50 failures out of 10,000)
- [ ] Vote submission latency p50 < 500ms, p95 < 1000ms, p99 < 2000ms
- [ ] DO memory usage <512 MB (inspect via DO statistics)
- [ ] DO storage writes <1,000 unique keys (vote idempotency working; validate via write count assertion)
- [ ] No socket closes due to timeout or backpressure

**Output Artifacts**
- [ ] CSV file: 1000-row latency distribution (connection time, vote time, reconnect time)
- [ ] JSON telemetry: `{success_count, failure_count, p50, p95, p99, memory_mb, storage_ops}`
- [ ] Markdown report: `LOAD_TEST_REPORT.md` (metrics + pass/fail summary)
- [ ] CI artifact link in GitHub Actions

**Code Quality**
- [ ] Tests use no external services (fully mocked)
- [ ] Code passes `npm run typecheck`
- [ ] Comments explain parameterization and ramp rates

**CI Integration**
- [ ] New CI job: `test:load-10k` (optional tier, runs on PR with label `load-test` or on push to `main`)
- [ ] Job output: links to CSV + JSON + markdown report
- [ ] Job fails if p95 > 1000ms or success rate < 99%

### Definition of Done

- [ ] Code reviewed + merged to main
- [ ] `npm test` passes (including load test)
- [ ] `npm run typecheck` passes
- [ ] CI job `test:load-10k` green
- [ ] Runbook: `docs/qa/load-testing.md` documents how to run locally and interpret results
- [ ] QA lead sign-off: report shows ≥99% success + p95 < 1000ms

### Technical Notes

- Use Miniflare's `do.env` to mock SessionRoom state storage
- Implement connection ramp using `setInterval` or `Promise.allSettled` for parallel connections
- Measure latency using `performance.now()` (millisecond precision)
- Store telemetry in memory, export at test end
- Consider: if latency too high, parallelize load harness across multiple Vitest workers (later optimization)

### Dependencies

- Miniflare already in dev deps
- No external services required

---

## S61: CHAOS-RESILIENCE-01 — KV/DO Failure Injection

**Story ID:** QA-CHAOS-RESILIENCE-01  
**Sprint:** 61  
**Epic:** QA  
**Priority:** P0  
**Size:** 8 pts  
**Owner:** QA Engineer (backend focus)

### Story

As a QA lead, I can inject transient and permanent failures into KV and Durable Object storage so that Qesto can validate graceful degradation under infrastructure failures and ensure production resilience.

### Acceptance Criteria

**Fault Injection Helpers**
- [ ] New module: `lib/chaos.ts` exports reusable fault injection helpers
  - `createFaultyKVStore(failureMode, failureRate)` — returns mock KV with injected failures
  - `createFaultyDOStorage(failureMode, failureRate)` — returns mock DO storage with injected failures
  - Supports: `timeout` (5s hang), `miss` (key not found), `fault` (transient error), `permanent` (persistent failure)
- [ ] Helpers track injection: count of failures injected + client handling

**Test Suite: KV Resilience**
- [ ] File: `tests/chaos/kv-resilience.test.ts`
- [ ] Test 1: **KV timeout (5s)** — SESSIONS_KV.get(key) hangs 5s then throws
  - Verify: Route returns 503 with `Retry-After: 60`
  - Verify: Error logged (sanitized, no PII)
  - Verify: Client receives safe message (not raw exception)
- [ ] Test 2: **KV miss (404)** — TEAMS_KV.get(key) returns null unexpectedly
  - Verify: Plan enforcement middleware denies access (fail-closed)
  - Verify: Client receives 403 (not 500)
- [ ] Test 3: **KV partial failure** — 10% of requests fail, 90% succeed
  - Verify: Session join eventually succeeds (retries working)
  - Verify: Audit logs show retry attempts
- [ ] Test 4: **KV permanent failure** — all requests fail
  - Verify: After 3 retries, route returns 503
  - Verify: Circuit breaker opens (if wired)

**Test Suite: DO Resilience**
- [ ] File: `tests/chaos/do-resilience.test.ts`
- [ ] Test 1: **DO storage_fault** — DO.storage.get(key) throws `Error("Transient error")`
  - Verify: Vote submission returns `internal_error` to client (not crash)
  - Verify: DO connection remains open (reconnect works)
  - Verify: Other participants unaffected
- [ ] Test 2: **DO concurrent storage faults** — 3+ storage calls fail simultaneously
  - Verify: DO handles without deadlock
  - Verify: Client reconnect snapshot safe (state consistent)

**Code Quality**
- [ ] Zero real KV/DO calls (fully mocked)
- [ ] All tests pass `npm run typecheck`
- [ ] Chaos module has inline comments explaining failure injection

**CI Integration**
- [ ] New CI job: `test:chaos` (required for main branch)
- [ ] Job runs: `npm run test:chaos` (runs chaos-resilience-*.test.ts)
- [ ] Fails if any graceful degradation assertion fails

### Definition of Done

- [ ] Code reviewed + merged to main
- [ ] `npm test` passes (including chaos tests)
- [ ] `npm run typecheck` passes
- [ ] CI job `test:chaos` required + green
- [ ] Runbook: `docs/qa/chaos-testing.md` documents failure modes and expected behavior
- [ ] QA lead sign-off: all 4 KV + 2 DO fault scenarios verified

### Technical Notes

- Mock KV stores using `vi.fn().mockImplementation()`
- Use Promise delays for timeout simulation: `new Promise(() => { /* never resolves */ }).race(delay(5000))`
- Test both sync and async error handling paths
- Consider: Extract reusable failure patterns into `lib/testing/mocks/`

### Dependencies

- Vitest `vi.fn()` and `vi.spyOn()` already available
- RES-* resilience items (ADR decisions) should be decided before implementation; this test exercises the contract

---

## S62: CHAOS-RESILIENCE-02 — AI/Stripe/Resend Failure Injection

**Story ID:** QA-CHAOS-RESILIENCE-02  
**Sprint:** 62  
**Epic:** QA  
**Priority:** P0  
**Size:** 8 pts  
**Owner:** QA Engineer (backend focus)

### Story

As a QA lead, I can inject failures into Workers AI, Stripe, and Resend integrations so that Qesto validates graceful degradation under external API failures and ensures no silent cascading failures.

### Acceptance Criteria

**Fault Injection: Workers AI**
- [ ] Extend `lib/chaos.ts` with `createFaultyAI(failureMode)` helper
  - `timeout`: AI inference hangs 25s, AbortController fires
  - `error`: AI returns `{"ok": false, "errors": ["model unavailable"]}`
  - `rate_limit`: Repeated calls fail with `{"errors": ["rate_limit_error"]}`
- [ ] Test file: `tests/chaos/external-resilience.test.ts`
- [ ] Test: **AI timeout (25s)** — wizard generation hangs
  - Verify: AbortController timeout fires at 25s
  - Verify: Client receives graceful timeout message (not crash)
  - Verify: Session creation not blocked (user can write questions manually)
- [ ] Test: **AI error** — model unavailable
  - Verify: Route returns 500 with safe message (not raw API error)
  - Verify: Error logged + trace ID provided to user
- [ ] Test: **AI rate limit** — 10 consecutive failures, circuit breaker opens
  - Verify: CircuitBreaker.OPEN state reached
  - Verify: 11th call rejected immediately (fail-fast)
  - Verify: Retry happens after circuit cooldown (5 min default)

**Fault Injection: Stripe**
- [ ] Extend `lib/chaos.ts` with `createFaultyStripe(failureMode)` helper
  - `error`: Stripe returns `error.code = "rate_limit_error"` / `"service_unavailable"`
  - `connection_timeout`: Stripe API call hangs 30s
- [ ] Test: **Stripe rate limit** — checkout session creation fails
  - Verify: Route retries 3 times with exponential backoff
  - Verify: After 3 failures, return 503 (not 500)
  - Verify: Error logged (no payment data in logs)
- [ ] Test: **Stripe timeout** — API call hangs
  - Verify: Request times out after 10s (configured timeout)
  - Verify: No half-completed Stripe objects (idempotency key prevents duplicates)
  - Verify: User sees "Payment service temporarily unavailable" (retry button shown)

**Fault Injection: Resend (Email)**
- [ ] Extend `lib/chaos.ts` with `createFaultyResend(failureMode)` helper
  - `transient_error`: Resend returns `{success: false, error: "service_unavailable"}`
  - `permanent_error`: Resend returns `{success: false, error: "invalid_email"}`
- [ ] Test: **Resend transient** — email send fails, should retry
  - Verify: Error logged
  - Verify: Email resent on next cycle (worker cron or manual retry)
  - Verify: No duplicate emails if retry called twice
- [ ] Test: **Resend permanent** — invalid email, don't retry
  - Verify: Error logged (non-retryable)
  - Verify: User notified (retry button hidden)

**Code Quality**
- [ ] All tests pass `npm run typecheck`
- [ ] Comments explain circuit breaker + retry logic
- [ ] No sensitive data (tokens, emails) logged

**CI Integration**
- [ ] Update CI job `test:chaos` to include external resilience tests
- [ ] Job runs: `npm run test:chaos` (runs chaos-external-resilience.test.ts)

### Definition of Done

- [ ] Code reviewed + merged to main
- [ ] `npm test` passes (including external chaos tests)
- [ ] `npm run typecheck` passes
- [ ] CI job `test:chaos` required + green
- [ ] Runbook: `docs/qa/chaos-external-failures.md` documents AI/Stripe/Resend failure modes
- [ ] QA lead sign-off: all 3 external integrations tested, circuit breaker wired correctly

### Technical Notes

- Mock Stripe SDK using `vi.fn().mockRejectedValue()` and `vi.fn().mockResolvedValue()`
- Mock Workers AI using similar patterns
- Use `jest.useFakeTimers()` for simulating backoff delays (or `vi.useFakeTimers()` in Vitest)
- Verify: Circuit breaker state changes via exposed getter (or audit logs)

### Dependencies

- CHAOS-RESILIENCE-01 (foundation)
- ADR-0007 (circuit breaker ADR) should be decided before implementation

---

## S63: CONTRACT-API-01 — API v2/v3 Versioning Contract Tests

**Story ID:** QA-CONTRACT-API-01  
**Sprint:** 63  
**Epic:** QA  
**Priority:** P0  
**Size:** 8 pts  
**Owner:** QA Engineer (backend focus)

### Story

As a QA lead, I can lock immutable API v2 contracts and validate v3 backward compatibility so that Qesto prevents breaking API changes and enables safe client version upgrades.

### Acceptance Criteria

**v2 Contract (Immutable)**
- [ ] File: `tests/contract/api-v2-v3.test.ts`
- [ ] Define v2 request/response schemas for 15–20 critical endpoints:
  - `POST /api/sessions/:id/start` (request: `{energizer_ids}`, response: `{session_id, status}`)
  - `POST /api/sessions/:id/questions` (request: `{kind, text, config}`, response: `{question_id, ...}`)
  - `POST /api/sessions/:id/votes` (request: `{question_id, answer}`, response: `{vote_id}`)
  - (... 12–17 more critical routes)
- [ ] Each schema test:
  - Sends example v2 request
  - Captures response
  - Asserts response matches v2 schema (exact field names, types, no extra fields)
  - Fails if response evolves (breaking change detection)
- [ ] Contract snapshot: `tests/contract/snapshots/api-v2-contract.json`
  - Committed to repo
  - CI compares current response against snapshot
  - Any diff requires reviewer approval (prevents accidental breaking changes)

**v3 Proto (New, Feature-Flagged)**
- [ ] New v3 routes are additive (don't modify v2 routes)
  - Example: `POST /api/v3/sessions/:id/questions/batch` (array endpoint, not modifying singular `/questions`)
- [ ] v3 schema test:
  - Send v2 request to v3 route (if applicable)
  - Verify v2 client still works (backward compatible)
  - Send v3 request to v3 route
  - Verify new fields accepted + response includes new fields
  - Verify v2 client can ignore v3 extra fields (graceful ignorance)

**Cross-Version Compatibility**
- [ ] Integration test: v2 client behavior against mixed v2+v3 server
  - v2 client calls `/api/sessions/:id/questions` (still v2)
  - v3 code internally calls `/api/v3/sessions/:id/questions/batch` (new)
  - v2 client sees same behavior (no regression)

**CI Integration**
- [ ] New CI job: `test:contract` (required for main branch)
- [ ] Job runs: `npm run test:contract` (runs contract tests)
- [ ] Snapshot comparison: fails if v2 schema drifts
- [ ] PR comment: shows exact field diffs if schema changes

### Definition of Done

- [ ] Code reviewed + merged to main
- [ ] `npm test` passes (including contract tests)
- [ ] `npm run typecheck` passes
- [ ] Snapshot files committed (`tests/contract/snapshots/*.json`)
- [ ] CI job `test:contract` required + green
- [ ] Runbook: `docs/qa/contract-testing.md` documents how to update snapshots when v2 intentionally evolves
- [ ] QA lead sign-off: v2 immutability enforced, v3 backward compat verified

### Technical Notes

- Use Pact.js (consumer-driven contracts) or manual Vitest schema assertions
- Snapshot format: JSON (human-readable)
- To update snapshot intentionally: run `npm test -- --update` (Vitest flag)
- Consider: API versioning ADR should define v2 → v3 migration window (e.g., v2 supported 12 months after v3 release)

### Dependencies

- ADR for API versioning (proposed, not yet written)
- Can simplify S63 scope to v2-only (remove v3 proto) if versioning ADR delayed

---

## S64: A11Y-REGRESSION-01 — WCAG 2.2 Expansion + Regression Suite

**Story ID:** QA-A11Y-REGRESSION-01  
**Sprint:** 64  
**Epic:** QA  
**Priority:** P0  
**Size:** 8 pts  
**Owner:** QA Engineer (frontend focus)

### Story

As a QA lead, I can maintain WCAG 2.2 compliance across new surfaces added in Sprints 60–63 so that Qesto remains accessible and prevents a11y regression as the platform scales.

### Acceptance Criteria

**A11y Coverage Expansion**
- [ ] Expand from 48 tests to 80+ tests (add 32+ tests)
- [ ] New coverage areas (added in S60–S63):
  - Slack OAuth consent flow (form labels, keyboard nav, focus outline)
  - Teams OAuth consent flow (same as Slack)
  - Admin compliance dashboard (table keyboard nav, sortable columns, ARIA attributes)
  - Energizer Quick Finger UI (timer announcements, live region for score updates)
  - Energizer Team Quiz UI (question display, answer options, result live region)
  - Load test results dashboard (chart alt text, tabpanel structure)

**Regression Test Suite**
- [ ] File: `tests/a11y/wcag-expansion.test.ts`
- [ ] Baseline audit on 8 key flows:
  1. Home page (landing, nav, CTA)
  2. Wizard (all 5 steps)
  3. Launchpad (pre-live UI)
  4. Results (vote results display)
  5. Dashboard (sessions list, Insights tab)
  6. Admin audit (table + filters)
  7. OAuth consent (Slack/Teams integration)
  8. Energizer presentation (Quick Finger + Team Quiz)
- [ ] For each flow:
  - Run axe-core scan (automated)
  - Assert: 0 violations (level A + AA)
  - Assert: Minimum landmarks present (main, nav, contentinfo)
  - Assert: Skip link present (if applicable)
  - Assert: Focus visible on all interactive elements
- [ ] Store baseline snapshots in `tests/a11y/regressions/`
  - Format: JSON (axe results + custom assertions)
  - Committed to repo for CI comparison

**E2E A11y Tests**
- [ ] File: `tests/e2e/a11y-flows.spec.ts` (Playwright)
- [ ] Keyboard navigation tests for 4 key flows:
  - Wizard step 1 → 5 using Tab key only
  - Results page: Tab through vote display + export button
  - Dashboard: Tab through sessions list (if paginated, verify focus trap)
  - Energizer: Tab through participant interface
- [ ] Screen reader tests (mock/simulated):
  - Verify: ARIA labels present on all form fields
  - Verify: Heading hierarchy correct (h1 > h2 > h3)
  - Verify: Live regions announce timer updates (ARIA `live="polite"`)

**CI Integration**
- [ ] New CI job: `test:a11y` (required for main branch)
- [ ] Job runs: `npm run test:a11y` (unit tests) + `npm run test:e2e:a11y` (E2E)
- [ ] Snapshot comparison: fails if new violations introduced
- [ ] PR comment: shows exact a11y violations if regressions found

### Definition of Done

- [ ] Code reviewed + merged to main
- [ ] `npm test` passes (including a11y tests)
- [ ] `npm run typecheck` passes
- [ ] Snapshot files committed (`tests/a11y/regressions/*.json`)
- [ ] CI job `test:a11y` required + green
- [ ] Runbook: `docs/qa/a11y-regression-testing.md` documents how to add new surfaces
- [ ] QA lead + accessibility specialist sign-off: 0 violations on 8 flows

### Technical Notes

- Use axe-core (npm package) for automated scanning
- Use axe-playwright for E2E flows
- Custom assertions: `expect(axeResults.violations.length).toBe(0)`
- Keyboard nav tests: use Playwright `page.keyboard.press('Tab')` loops
- Consider: Hire external accessibility specialist for manual WCAG 2.2 deep-dive quarterly

### Dependencies

- New UI surfaces must be in feature branches or main by S64 start (Slack, Teams, OAuth, admin, energizers)
- axe-core, axe-playwright already in dev deps

---

## S65: COMPLIANCE-AUTO-01 — Audit Trail + GDPR Deletion Automation

**Story ID:** QA-COMPLIANCE-AUTO-01  
**Sprint:** 65  
**Epic:** QA  
**Priority:** P0  
**Size:** 8 pts  
**Owner:** QA Engineer (backend focus)

### Story

As a QA lead, I can automatically test audit trail functionality and GDPR user deletion so that Qesto validates compliance controls under load and ensures audit events are immutable + complete.

### Acceptance Criteria

**Audit Trail Tests**
- [ ] File: `tests/integration/audit-compliance.test.ts`
- [ ] Test 1: **Create session audit event**
  - Create session via API
  - Query audit table: `SELECT * FROM audit_logs WHERE action = 'CREATE_SESSION' AND resource_id = ?`
  - Verify: row exists with correct (timestamp, user_id, action, session_id)
  - Verify: timestamp within 1 second of creation
  - Verify: No PII in event data
- [ ] Test 2: **Delete session audit event**
  - Delete session via API
  - Query audit: `SELECT * FROM audit_logs WHERE action = 'DELETE_SESSION' AND resource_id = ?`
  - Verify: row exists, immutable (no UPDATE on audit row)
  - Verify: role/user_id recorded (who deleted)
- [ ] Test 3: **Query audit trail with filters**
  - Create 100 audit events (various actions)
  - Query with date range filter: `SELECT * FROM audit_logs WHERE timestamp BETWEEN ? AND ?`
  - Verify: <100ms query response (indexed correctly)
  - Verify: Results correctly filtered
  - Verify: Sorting (ASC/DESC timestamp) works
- [ ] Test 4: **Export audit CSV**
  - Generate CSV export via API: `GET /api/admin/audit/export`
  - Parse CSV
  - Verify: No email addresses, passwords, or tokens (PII-safe)
  - Verify: Columns: timestamp, action, user, resource_type, resource_id, changes
  - Verify: No raw exceptions in "changes" field

**GDPR Deletion Tests**
- [ ] Test 1: **Delete user account**
  - Create user + session + votes
  - Call DELETE `/api/users/{user_id}` (GDPR endpoint)
  - Verify: User record removed from D1 `users` table
  - Verify: All votes by user removed (or anonymized with `participant_id = null`)
  - Verify: Sessions owned by user deleted (or transferred to admin)
  - Verify: Profile data (preferences, prefs.density) removed
  - Verify: JWT tokens revoked (stored in D1 `revoked_tokens`)
  - Verify: Audit log: `gdpr.deletion_requested` event created
- [ ] Test 2: **Verify deletion**
  - Query D1: `SELECT * FROM users WHERE user_id = ?`
  - Verify: No result (user fully deleted)
  - Query: `SELECT * FROM votes WHERE submitted_by = ?`
  - Verify: No results (anonymized or deleted)
  - Query audit: `SELECT * FROM audit_logs WHERE action LIKE 'gdpr.%'`
  - Verify: `gdpr.deletion_requested` and `gdpr.deletion_completed` events exist
- [ ] Test 3: **Deletion runbook**
  - Manual steps (documented in `tests/compliance/gdpr-deletion-runbook.md`):
    1. Admin initiates deletion via API or admin panel
    2. Verify: Deletion queued in `ACTIONS_KV` or `deletion_jobs` table
    3. Wait for background job to complete (5–10 min)
    4. Verify: User fully deleted + audit events logged
    5. Data subject can verify deletion by re-requesting account (404 or "Account deleted")

**Code Quality**
- [ ] No hardcoded email addresses in tests (use fixtures)
- [ ] All tests pass `npm run typecheck`
- [ ] Tests use separate test database (not production)

**CI Integration**
- [ ] New CI job: `test:compliance` (required for main branch)
- [ ] Job runs: `npm run test:compliance` (runs audit + GDPR tests)
- [ ] Fails if any deletion test fails or PII detected in exports

### Definition of Done

- [ ] Code reviewed + merged to main
- [ ] `npm test` passes (including compliance tests)
- [ ] `npm run typecheck` passes
- [ ] CI job `test:compliance` required + green
- [ ] Runbook: `tests/compliance/gdpr-deletion-runbook.md` (manual verification steps)
- [ ] Runbook: `tests/compliance/audit-trail-operations.md` (admin audit query examples)
- [ ] QA lead sign-off: audit trail verified, GDPR deletion end-to-end tested

### Technical Notes

- Audit trail already shipped (v2.x); these tests lock the contract
- D1 schema: `audit_logs` table with (id, timestamp, user_id, action, resource_type, resource_id, changes_json, created_at)
- Deletion: may be synchronous (small user) or async (large user with many sessions/votes)
- Consider: Weekly scheduled job to verify no stale audit rows (orphaned events)

### Dependencies

- Audit logging infrastructure already shipped (v2.x)
- D1 schema migrations for GDPR support (may already exist)

---

## S66–S70: Quick Specs (Lightweight Stories)

### S66: A11Y-REGRESSION-02 (5 pts)

Refresh a11y tests for new surfaces added in S64–S66 (Zoom, Salesforce integrations, custom roles UI). Add 4–6 flows to regression baseline. Same testing pattern as A11Y-REGRESSION-01.

---

### S67: INTEGRATION-SMOKE-01 (5 pts)

E2E smoke tests for Slack, Teams, webhook integrations (assumed shipped by S67). Test OAuth flow → result delivery → audit logging. Mocked external APIs.

---

### S68: CONTRACT-API-PROTO-01 (5 pts)

Lock v3 proto API routes via contract tests before v3 becomes stable. Validate v2 → v3 migration path.

---

### S69: PERF-PROFILE-01 (8 pts)

Capture production latency baseline from ≥30 days of `vote.submitted` AE events. Establish SLOs: vote p50 < 300ms, p95 < 800ms. Load profile expected peak (50 sessions/hour, 5k votes/hour). Compare current perf vs. baseline; fail if p95 degrades >20%.

---

### S70: RC-VERIFY-BUNDLE-01 (13 pts)

Full end-to-end RC verification: run all 950+ tests, staging smoke, load test, chaos injection, a11y audit, compliance checks, performance validation. Generate markdown RC report. Require QA lead + PO sign-off before RC rollout.

---

## Test Layer Integration Matrix

| Test Type | File Location | S60 | S61 | S62 | S63 | S64 | S65 | S66 | S67 | S68 | S69 | S70 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Load | `tests/load/10k-voter-scale.test.ts` | ✅ | — | — | — | — | — | — | — | — | ✅ | ✅ |
| Chaos KV/DO | `tests/chaos/kv-resilience.test.ts` | — | ✅ | — | — | — | — | ✅ | — | — | — | ✅ |
| Chaos External | `tests/chaos/external-resilience.test.ts` | — | — | ✅ | — | — | — | ✅ | — | — | — | ✅ |
| Contract API v2/v3 | `tests/contract/api-v2-v3.test.ts` | — | — | — | ✅ | — | — | — | — | — | — | ✅ |
| A11y Expansion | `tests/a11y/wcag-expansion.test.ts` | — | — | — | — | ✅ | — | — | — | — | — | ✅ |
| A11y E2E | `tests/e2e/a11y-flows.spec.ts` | — | — | — | — | ✅ | — | ✅ | — | — | — | ✅ |
| Audit/GDPR | `tests/integration/audit-compliance.test.ts` | — | — | — | — | — | ✅ | — | — | — | — | ✅ |
| Integration Smoke | `tests/e2e/integrations-smoke.spec.ts` | — | — | — | — | — | — | — | ✅ | — | — | ✅ |
| Contract v3 | `tests/contract/api-v3-proto.test.ts` | — | — | — | — | — | — | — | — | ✅ | — | ✅ |
| Performance | `tests/perf/baseline-profile.test.ts` | — | — | — | — | — | — | — | — | — | ✅ | ✅ |
| RC Bundle | `tests/rc/rc-verify-bundle.test.ts` | — | — | — | — | — | — | — | — | — | — | ✅ |

---

## Revision History

| Date | Author | Change |
|---|---|---|
| 2026-05-25 | QA Lead | Initial detailed story specifications for S60–S70 |
