# Sprint 18 Implementation Guide — Critical Foundation + Trust (Sprint A)

_Generated: 2026-04-11_

## Overview

14 backlog items organized in 3 phases. **Phase 1** (6 items) must complete before Phase 2/3; they unblock all downstream work.

---

## PHASE 1: Core Technical Foundation (6 P0 Items)

These items establish the architectural foundation. **MUST LAND FIRST.**

---

### ID 1: Split Hotspot API Orchestration

**Problem Statement:**
Current API routes have concentration risk in 2-3 "hotspot" endpoints (likely `/sessions`, `/decisions`) that handle 60%+ of request volume. These endpoints orchestrate multiple services (KV, D1, DO, Stripe) with tangled dependencies, making them fragile and hard to optimize.

**Current Status:**
- Route modularization partially done (14 route modules exist)
- Hotspot routes not yet isolated
- No explicit orchestration layer (business logic mixed in route handlers)

**Acceptance Criteria:**
- Hotspot routes identified + analyzed (top 3-5 by request volume)
- Orchestration logic extracted to service layer (`functions/api/services/orchestration.ts`)
- Route handlers now thin: input validation → service call → response
- Load test shows -30% latency on hotspots (measured by `p99_latency_hotspots` metric)
- Zero regression in functionality

**Files to Create/Modify:**
```
functions/api/services/orchestration.ts          (NEW — orchestration layer)
functions/api/services/sessionOrchestration.ts   (NEW — session-specific)
functions/api/services/decisionOrchestration.ts  (NEW — decision-specific)
functions/api/routes/sessions.routes.ts          (MODIFY — thin route handlers)
functions/api/routes/decisions.routes.ts         (MODIFY — thin route handlers)
tests/unit/services/orchestration.test.ts        (NEW — unit tests)
tests/performance/hotspot-routes.test.ts         (NEW — load tests)
```

**Acceptance Tests:**
1. Route handler only does: validate input → call service → return response
2. All business logic in service layer
3. No circular dependencies between orchestration + other services
4. p99 latency on hotspot routes improved -30%
5. All existing tests pass

**KPI:**
- `-30% latency on hotspot routes` (p99)
- 0 regressions

**Effort Estimate:** 8-13 points

**Dependencies:** None (Phase 1 foundation)

---

### ID 2: Shared Session Lifecycle Service

**Problem Statement:**
Session state management is scattered: route handlers, WebSocket DO, KV, D1. State transitions (DRAFT→LIVE→CLOSED→ARCHIVED) are implicit, not validated. Risk: race conditions, silent failures, incorrect state machines.

**Current Status:**
- Session state machine defined in CLAUDE.md (DRAFT/LIVE/CLOSED/ARCHIVED)
- DO maintains some state; routes maintain KV state; D1 maintains persistence
- No single source of truth for state transitions
- No contract validation

**Acceptance Criteria:**
- Single `SessionLifecycleService` class manages all state transitions
- Explicit state machine: DRAFT → LIVE → CLOSED → ARCHIVED (no bypass)
- All mutations go through service (routes, DO, external callers)
- State transition errors caught + logged
- <1% state transition errors (no silent failures)
- All session routes use service

**Files to Create/Modify:**
```
functions/api/services/sessionLifecycle.ts       (NEW — state machine)
functions/api/types/session.ts                   (MODIFY — SessionState enum, contracts)
functions/api/routes/sessions.routes.ts          (MODIFY — use SessionLifecycleService)
functions/durable-objects/SessionRoom.ts         (MODIFY — state transitions via service)
functions/api/db.ts                              (MODIFY — schema update for state audit)
tests/unit/services/sessionLifecycle.test.ts     (NEW — unit tests for state machine)
tests/integration/session-state-machine.test.ts  (NEW — integration tests)
```

**Acceptance Tests:**
1. DRAFT→LIVE: validated, DO created, KV updated, D1 logged
2. LIVE→CLOSED: validated, DO notified, no new events accepted
3. CLOSED→ARCHIVED: only after grace period
4. Invalid transitions (e.g., LIVE→DRAFT) rejected with error
5. Race condition test: concurrent state mutations handled correctly
6. All session routes call service (no direct state updates)

**KPI:**
- `<1% state transition errors` (monitor: `session_state_error_rate`)
- 0 silent failures

**Effort Estimate:** 8-13 points

**Dependencies:** None (Phase 1 foundation)

---

### ID 5: Idempotent Write Handlers

**Problem Statement:**
Stripe webhooks, session updates, decision mutations can arrive out-of-order or be retried. Without idempotency, duplicate mutations occur (double-charge, duplicate votes, etc.). Current approach: hope request IDs match, but no guarantee.

**Current Status:**
- Some routes have request ID checks
- No system-wide idempotency ledger
- Stripe webhook handling vulnerable to duplicates
- Vote/decision mutations not idempotent

**Acceptance Criteria:**
- Idempotency key strategy defined: `{user_id}-{operation}-{request_id}`
- All write operations (mutating endpoints) check ledger before executing
- Ledger: KV store with 24-hour TTL (`IDEMPOTENCY_LEDGER_KV`)
- GET idempotent operations return cached result if key seen before
- POST/PUT/DELETE idempotent operations execute once, return same response on retry
- 0 duplicate mutations (measured by audit log deduplication)
- All webhook handlers use idempotency

**Files to Create/Modify:**
```
functions/api/middleware/idempotency.ts          (NEW — idempotency middleware)
functions/api/routes/billing.routes.ts           (MODIFY — Stripe webhook idempotency)
functions/api/routes/decisions.routes.ts         (MODIFY — vote/decision idempotency)
functions/api/routes/sessions.routes.ts          (MODIFY — session mutation idempotency)
functions/api/types/idempotency.ts               (NEW — IdempotencyKey type)
tests/unit/middleware/idempotency.test.ts        (NEW — unit tests)
tests/integration/stripe-webhook-idempotency.test.ts (NEW)
```

**Acceptance Tests:**
1. Duplicate request with same idempotency key returns cached response
2. Stripe webhook retry (same event ID) doesn't double-charge
3. Concurrent requests with same key: only one mutation executes
4. KV ledger cleanup: old keys expire after 24h
5. Audit log shows zero duplicate mutations
6. Error case: failed first attempt, retry succeeds (and is idempotent)

**KPI:**
- `0 duplicate mutations` (measure via `duplicate_mutation_count` in audit logs)

**Effort Estimate:** 5-8 points

**Dependencies:** None (Phase 1 foundation)

---

### ID 6: D1 Query Governance + Index Audit

**Problem Statement:**
D1 queries lack governance: no query time budgets, missing indexes, N+1 patterns, unoptimized SELECT * queries. p95 latency budget (e.g., 100ms) often exceeded.

**Current Status:**
- D1 schema exists (see `schema.sql`)
- Some queries unoptimized (SELECT * on large tables)
- No query plan analysis
- No index strategy documented

**Acceptance Criteria:**
- Query performance budget defined: p95 ≤ 100ms for user-facing queries
- All queries profiled via D1 query log
- Indexes added for high-frequency WHERE/JOIN columns
- SELECT * replaced with explicit column lists
- N+1 patterns identified + fixed (use batch queries or JOINs)
- Query audit report generated (worst performers, missing indexes)
- p95 latency consistently meets budget
- Zero regression in data consistency

**Files to Create/Modify:**
```
schema.sql                                       (MODIFY — add indexes)
functions/api/db.ts                              (MODIFY — add query plan comments)
docs/DATABASE_GOVERNANCE.md                      (NEW — query strategy + budgets)
tests/performance/d1-query-performance.test.ts   (NEW — latency benchmarks)
scripts/audit-d1-queries.ts                      (NEW — query analyzer)
.github/workflows/d1-query-audit.yml             (NEW — CI gate)
```

**Acceptance Tests:**
1. All high-frequency queries (>100 RPS) analyzed + optimized
2. Missing indexes identified (sequential scans on large tables)
3. N+1 patterns eliminated (batch queries or JOINs)
4. p95 latency ≤ 100ms for user-facing queries
5. Query audit report: lists slowest 10 queries, missing indexes, recommendations
6. CI gate: rejects queries that don't meet performance budget

**KPI:**
- `p95 DB latency budget met` (target: ≤100ms for user-facing queries)

**Effort Estimate:** 8-13 points

**Dependencies:** None (Phase 1 foundation)

---

### ID 9: Webhook Idempotency Ledger

**Problem Statement:**
Stripe webhooks (subscription updates, charge successes, refunds) can be retried by Stripe. Without deduplication, billing state can become corrupt (double-charge, inconsistent subscription status).

**Current Status:**
- Stripe webhook endpoint exists (`POST /billing/webhook`)
- Event IDs checked against D1 to prevent duplicates
- But no explicit idempotency ledger; race conditions possible

**Acceptance Criteria:**
- Dedicated `WEBHOOK_LEDGER_KV` with webhook event IDs
- All webhook handlers check ledger before processing
- Webhook processed exactly once, even if retried 10x
- Ledger TTL: 30 days (Stripe retries up to 3 days)
- Audit log entry: `webhook_duplicate_detected` events
- 0 duplicate billing updates (measure via Stripe API consistency check)
- Runbook: how to replay missed webhooks (via dead-letter queue)

**Files to Create/Modify:**
```
functions/api/middleware/webhookIdempotency.ts   (NEW — webhook deduplication)
functions/api/routes/billing.routes.ts           (MODIFY — webhook handler)
functions/api/services/webhookLedger.ts          (NEW — ledger management)
functions/api/db.ts                              (MODIFY — add webhook_ledger table)
tests/integration/stripe-webhook-dedupe.test.ts  (NEW)
docs/WEBHOOK_RUNBOOK.md                          (NEW)
```

**Acceptance Tests:**
1. Stripe webhook received twice (same event ID)
   - First: processed (charge recorded)
   - Second: deduplicated (no charge)
2. Webhook event not in ledger → processed + added to ledger
3. Ledger TTL verified: old entries expire after 30 days
4. Audit log: `webhook_duplicate_detected` for retries
5. Stripe API consistency check: no duplicate charges in last 30 days
6. Manual replay: dead-letter queue events can be reprocessed via admin endpoint

**KPI:**
- `0 duplicate billing updates` (verify via Stripe API audit)

**Effort Estimate:** 5-8 points

**Dependencies:** None (Phase 1 foundation)

---

### ID 14: Dead-Letter + Replay Flow

**Problem Statement:**
Failed webhook deliveries, failed KV writes, failed D1 queries silently disappear. No recovery path. If a critical event fails (subscription update, session state change), it's lost forever.

**Current Status:**
- No dead-letter queue
- Failed operations logged but not recoverable
- Manual re-run required (ad-hoc, error-prone)

**Acceptance Criteria:**
- Dead-letter queue KV store: `DEAD_LETTER_QUEUE` (events that failed 3x)
- Failover strategy: retry with exponential backoff (1s, 10s, 100s) on transient errors
- On permanent error: log to dead-letter queue + alert
- Admin API endpoint: `GET /admin/dead-letter-queue` + `POST /admin/dead-letter-queue/{id}/replay`
- All failed operations traceable (timestamp, error, retry count)
- 100% of failed events recoverable via replay endpoint
- Runbook: how to diagnose + replay failed events

**Files to Create/Modify:**
```
functions/api/services/deadLetterQueue.ts        (NEW — DLQ management)
functions/api/middleware/failureHandler.ts       (NEW — failure capture)
functions/api/routes/admin.routes.ts             (MODIFY — add DLQ endpoints)
functions/api/db.ts                              (MODIFY — dead_letter_log table)
docs/DEAD_LETTER_RUNBOOK.md                      (NEW)
tests/integration/dead-letter-queue.test.ts      (NEW)
```

**Acceptance Tests:**
1. Webhook fails 3x (transient errors): moved to dead-letter queue
2. Admin can view: `GET /admin/dead-letter-queue?limit=20&status=pending`
3. Admin replays: `POST /admin/dead-letter-queue/{id}/replay` → event reprocessed
4. Successful replay: event moved to `status=replayed`, removed from pending
5. Failed replay: retry count incremented, stays in queue
6. Audit log: all DLQ operations (view, replay, manual purge) logged
7. Alert on dead-letter queue growth (>10 events in 1h)

**KPI:**
- `100% of failed events recoverable` (measure: DLQ replay success rate)

**Effort Estimate:** 8-13 points

**Dependencies:** None (Phase 1 foundation)

---

## PHASE 2: Stability & Security (4 P0 Items)

These items validate Phase 1 + add security/UX polish. **Can proceed once Phase 1 core items (1, 2, 5, 6, 9, 14) are 80% done.**

---

### ID 18: A11y Hardening Critical Flows

**Problem Statement:**
Platform not WCAG AA compliant on critical flows (Join, Vote, Solutions). Missing alt text, poor keyboard navigation, insufficient color contrast. Risk: excludes users with disabilities.

**Current Status:**
- Some a11y tooling in place
- No comprehensive audit on critical flows
- No CI gate for a11y

**Acceptance Criteria:**
- WCAG AA compliance on 3 critical flows: **Join**, **Vote**, **Solutions**
- Accessibility audit (axe-core, manual review) shows 0 critical issues
- Keyboard navigation: Tab/Shift+Tab to all interactive elements, Enter to activate
- Color contrast: ≥4.5:1 on all text
- ARIA labels: all form inputs, buttons, custom components labeled
- Screen reader tested: NVDA/JAWS can navigate flows end-to-end
- CI gate: axe-core + manual a11y tests

**Files to Create/Modify:**
```
src/components/Join.tsx                          (MODIFY — a11y hardening)
src/components/Vote.tsx                          (MODIFY — a11y hardening)
src/components/Solutions.tsx                     (MODIFY — a11y hardening)
src/components/Accessibility.tsx                 (NEW — a11y utilities)
tests/a11y/critical-flows.test.ts                (NEW — a11y tests)
.github/workflows/a11y-checks.yml                (NEW — CI gate)
docs/ACCESSIBILITY_GUIDE.md                      (NEW)
```

**Acceptance Tests:**
1. axe-core scan on Join flow: 0 critical/serious issues
2. axe-core scan on Vote flow: 0 critical/serious issues
3. axe-core scan on Solutions flow: 0 critical/serious issues
4. Keyboard navigation: can complete Join → Vote → Solutions using only Tab + Enter
5. Screen reader (NVDA): reads all labels, instructions, status messages correctly
6. Color contrast: all text ≥4.5:1 (verify via axa-core + manual)
7. ARIA: all custom components have proper ARIA roles/labels

**KPI:**
- `WCAG AA on critical flows` (measure: a11y audit score, axe-core pass rate)

**Effort Estimate:** 8-13 points

**Dependencies:** ID 1, 2, 5, 6, 9, 14 (Phase 1 should be 80% done)

---

### ID 20: Error UX Standardization

**Problem Statement:**
Error messages inconsistent: some are API errors (JSON), some are UI alerts, some are silent failures. Users confused ("Did it fail? Is it loading?"). Support tickets from unclear error states.

**Current Status:**
- Error handling scattered across routes + components
- No unified error format
- No error pattern library

**Acceptance Criteria:**
- Unified error response format: `{type: "error", code: "USER_ERR_001", message: "...", actions: [{...}]}`
- Error code taxonomy: `SYSTEM_*` (500), `USER_*` (4xx), `AUTH_*` (401/403), `VALIDATION_*` (422)
- All API errors follow format (validate in middleware)
- All UI errors (alerts, toasts) use standardized component + styling
- Error pattern library: 20+ common patterns with copy + UI treatment (e.g., "network error", "permission denied", "validation failed")
- -20% support tickets (measure via support volume before/after)
- Users can understand error + take action (e.g., "Retry", "Contact support")

**Files to Create/Modify:**
```
functions/api/types/errors.ts                    (MODIFY — error taxonomy)
functions/api/middleware/errorHandler.ts         (MODIFY — unified format)
src/components/ErrorAlert.tsx                    (NEW — error UI component)
src/lib/errorPatterns.ts                         (NEW — pattern library)
docs/ERROR_PATTERNS.md                           (NEW — error guide)
tests/unit/components/ErrorAlert.test.tsx        (NEW)
tests/unit/api/errorHandler.test.ts              (NEW)
```

**Acceptance Tests:**
1. All API errors return format: `{type: "error", code: "...", message: "...", actions: [...]}`
2. Error codes mapped to HTTP status + user message (via pattern library)
3. UI: ErrorAlert component renders error + action buttons correctly
4. Pattern library covers: network, validation, auth, permission, server errors
5. Support tickets: track pre/post metrics (e.g., "unclear error" category)
6. User testing: 5 users can understand common errors + recover

**KPI:**
- `-20% support tickets` (measure: support volume for "unclear error" category)

**Effort Estimate:** 5-8 points

**Dependencies:** ID 1, 2, 5, 6, 9, 14 (Phase 1 should be 80% done)

---

### ID 24: Secret Governance Automation

**Problem Statement:**
Secrets (API keys, database passwords, signing keys) scattered across `wrangler.toml`, environment, code comments. Risk of leaks via git, logs, error messages.

**Current Status:**
- Hard rules exist (no secrets in `wrangler.toml`)
- No automated enforcement
- No secret rotation policy
- No audit of secret usage

**Acceptance Criteria:**
- CI gate: secret scanning (detect hardcoded API keys, passwords) → reject if found
- All secrets managed via `wrangler secret` (encrypted in CF)
- Secret rotation policy: 90-day rotation for high-risk secrets (API keys, database creds)
- Audit log: all secret access + rotations logged
- No secrets in error messages or logs (redact sensitive fields)
- 0 secret leak incidents (via git, logs, error messages)
- Runbook: how to rotate secrets, emergency key revocation

**Files to Create/Modify:**
```
.github/workflows/secret-scan.yml                (NEW — CI gate)
wrangler.toml                                    (MODIFY — remove secrets, use `wrangler secret`)
functions/api/middleware/secretGuard.ts          (NEW — secret redaction)
docs/SECRET_ROTATION_POLICY.md                   (NEW)
docs/SECRET_RUNBOOK.md                           (NEW)
scripts/rotate-secrets.ts                        (NEW — automation helper)
```

**Acceptance Tests:**
1. CI gate: detects hardcoded secrets in PR (e.g., `STRIPE_API_KEY="sk_live_..."`)
2. All secrets in `wrangler secret` (verify: no plaintext in `wrangler.toml`)
3. Error messages: sensitive fields redacted (e.g., `api_key="***"`)
4. Logs: sensitive fields redacted (check CloudFlare Logs)
5. Secret rotation: script can rotate secrets without downtime
6. Audit log: track who accessed which secrets, when
7. Git history: no secrets accidentally committed (verify via `git log --grep="secret"`)

**KPI:**
- `0 secret leak incidents` (measure: monitor git commits + logs for secrets)

**Effort Estimate:** 5-8 points

**Dependencies:** ID 1, 2, 5, 6, 9, 14 (Phase 1 should be 80% done)

---

### ID 27: Test Pyramid + CI Quality Gates

**Problem Statement:**
Test coverage unbalanced: mostly integration tests, few unit tests. CI gates inconsistent. Tests take 15+ minutes. Silent failures (untested code paths). Risk: regressions slip through.

**Current Status:**
- Vitest unit tests exist
- Integration tests exist
- No clear test pyramid (ideal: 70% unit, 20% integration, 10% E2E)
- No test coverage enforcement
- CI pipeline slow

**Acceptance Criteria:**
- Test pyramid: 70% unit tests, 20% integration, 10% E2E
- Test coverage minimum: 80% (enforce via CI gate)
- Unit tests: <100ms each, 100+ tests
- Integration tests: <1s each, 50+ tests
- E2E tests: critical paths only (Join, Vote, Solutions), 10+ tests
- CI gates:
  - `npm test` must pass (all tests)
  - `npm run test:coverage` must show ≥80% coverage
  - `npm run test:performance` must show <15 min total time
  - TypeScript: `tsc --noEmit` must pass (0 errors)
- <5% escaped defects (measure: bugs found in production)

**Files to Create/Modify:**
```
tests/                                           (MODIFY — reorganize by type)
tests/unit/                                      (NEW — unit tests)
tests/integration/                               (NEW — integration tests)
tests/e2e/                                       (NEW — E2E tests)
vitest.config.ts                                 (MODIFY — coverage config)
.github/workflows/tests.yml                      (MODIFY — add gates)
docs/TESTING_GUIDE.md                            (NEW)
```

**Acceptance Tests:**
1. Test pyramid: measure test counts by type
2. Coverage: `npm run test:coverage` shows ≥80%
3. Performance: `npm test` completes in <15 min (measure runtime)
4. Unit test speed: 100+ unit tests, each <100ms
5. Integration test speed: 50+ integration tests, each <1s
6. E2E test coverage: critical paths covered (Join, Vote, Solutions)
7. CI gates: PR cannot merge if any gate fails

**KPI:**
- `<5% escaped defects` (measure: bugs reported in production)

**Effort Estimate:** 13-21 points

**Dependencies:** ID 1, 2, 5, 6, 9, 14 (Phase 1 should be 80% done)

---

## PHASE 3: Warm UX (4 P0 Items)

These items drive adoption. **Can proceed once Phase 1 core items + Phase 2 are 80% done.**

---

### ID 31: Template Foundation Pack

**Problem Statement:**
Users start from blank session ("create from scratch"). Overwhelming. Need templates to accelerate "time to first session". Target templates: survey, retrospective, brainstorm, voting round, decision-making.

**Current Status:**
- Template system foundation exists (DB schema, routes)
- 0-2 templates exist (mostly empty)
- No template curation/design

**Acceptance Criteria:**
- 15+ templates across 5 topics: **Surveys** (5), **Retrospectives** (3), **Brainstorms** (3), **Voting Rounds** (2), **Decisions** (2)
- Each template pre-configured with questions, question types, layout
- +25% reduction in "time to first session" (measure: time from signup to first session created)
- Template categories + descriptions in UI
- Templates discoverable on "New Session" screen

**Files to Create/Modify:**
```
functions/api/routes/templates.routes.ts         (MODIFY — template endpoints)
functions/api/db.ts                              (MODIFY — template seed data)
src/components/TemplateGallery.tsx               (NEW — template browser)
src/pages/NewSession.tsx                         (MODIFY — use TemplateGallery)
docs/TEMPLATES.md                                (NEW — template design guide)
scripts/seed-templates.ts                        (NEW — seed data loader)
tests/functional/ui/template-gallery.test.tsx    (NEW)
```

**Acceptance Tests:**
1. 15+ templates exist in DB (verify via `GET /templates?limit=100`)
2. Each template has: name, description, category, sample questions
3. UI: TemplateGallery displays templates with preview
4. "Time to first session" metric: before/after comparison
   - Before: avg 8 min (blank start)
   - After: avg 6 min (template start)
5. User testing: 5 new users can pick a template + create session in <5 min
6. No broken template data (all templates loadable)

**KPI:**
- `+25% faster time-to-first-session` (measure: time from account creation to session_created event)

**Effort Estimate:** 8-13 points

**Dependencies:** Phase 1 + Phase 2 (80% done)

---

### ID 34: Template Preview→Confirm→Wizard Flow

**Problem Statement:**
Users click template → immediately creates session. No preview, no chance to customize. High "nope, not what I wanted" rate.

**Current Status:**
- Templates exist but no preview flow
- Direct creation on click
- No customization UI

**Acceptance Criteria:**
- Template preview modal: shows template name, description, sample questions, layout
- Customization options: can edit title, select question subset, reorder questions
- Wizard flow: Preview → Confirm → Create
- +15% template-to-session conversion (measure: template clicks → session creation)
- Customization saved in session metadata (track which questions were added/removed)
- Undo: can revert session to original template (via admin)

**Files to Create/Modify:**
```
src/components/TemplatePreview.tsx               (NEW — preview modal)
src/components/TemplateWizard.tsx                (NEW — wizard flow)
src/components/QuestionCustomizer.tsx            (NEW — customize questions)
src/pages/NewSession.tsx                         (MODIFY — integrate wizard)
functions/api/types/template.ts                  (MODIFY — add customization schema)
tests/functional/ui/template-wizard.test.tsx     (NEW)
```

**Acceptance Tests:**
1. Click template → opens preview modal
2. Preview shows: name, description, questions, layout
3. User can customize: add/remove questions, reorder
4. "Confirm" button creates session with customizations
5. Session metadata tracks customizations (store in D1)
6. Conversion metric: template clicks → session creation (+15%)
7. Undo: admin can revert session to original template

**KPI:**
- `+15% template-to-session conversion` (measure: template_preview_to_session_created ratio)

**Effort Estimate:** 8-13 points

**Dependencies:** ID 31 (Template foundation), Phase 1 + Phase 2 (80% done)

---

### ID 35: Warm Welcome Journey

**Problem Statement:**
New users join but are unsure what to do. No onboarding guidance. Participant drop-off high (first 60s). Need warm welcome: clear instructions, encouragement, next steps.

**Current Status:**
- Join flow exists (minimal UX)
- No onboarding copy
- No progress indicators
- No encouragement messages

**Acceptance Criteria:**
- Join screen: warm welcome copy (e.g., "Welcome to [Session Name]! Here's how to participate...")
- Progress indicator: step 1 of 3, etc.
- Host perspective + participant perspective (different copy)
- Post-join: suggested next actions (e.g., "Read the question above")
- +10% participant completion rate (measure: participants who vote / participants who join)
- -15% early drop-off (first 60s)
- Copy tested with real users (user testing feedback incorporated)

**Files to Create/Modify:**
```
src/components/JoinWelcome.tsx                   (NEW — warm welcome screen)
src/components/ParticipantOnboarding.tsx         (NEW — onboarding guide)
src/lib/copy/welcome.en.json                     (NEW — welcome copy, i18n)
src/lib/copy/welcome.nl.json                     (NEW)
src/lib/copy/welcome.es.json                     (NEW)
src/lib/copy/welcome.de.json                     (NEW)
src/lib/copy/welcome.fr.json                     (NEW)
src/pages/Join.tsx                               (MODIFY — integrate welcome)
tests/functional/ui/welcome-journey.test.tsx     (NEW)
```

**Acceptance Tests:**
1. New participant joins → sees warm welcome screen
2. Welcome includes: session name, host name, clear instructions
3. Progress indicator: shows step (e.g., "Step 1: Enter your name")
4. Host joins → sees different welcome (e.g., "You're the host, invite others")
5. Post-join: progress indicator + "Read the question" CTA
6. Completion rate metric: before/after comparison
   - Before: 70% of participants vote
   - After: 77% of participants vote (+10%)
7. Drop-off rate: measure participants who leave in first 60s
   - Before: 15%
   - After: 12.75% (-15%)
8. Copy tested: user feedback shows welcome is clear + encouraging

**KPI:**
- `+10% participant completion rate` (measure: votes / session participants)
- `-15% early drop-off (first 60s)` (measure: session_left_early / session_joined)

**Effort Estimate:** 8-13 points

**Dependencies:** Phase 1 + Phase 2 (80% done), ID 20 (Error UX)

---

### ID 36: Participant Trust Kit

**Problem Statement:**
New participants worried about privacy: "Is my data secure? Am I anonymous? Who sees my vote?" No clear privacy messaging. Risk: lower trust, fewer participants.

**Current Status:**
- Privacy policy exists (legal doc)
- No in-app privacy messaging
- No anonymity indicators
- No transparency about data usage

**Acceptance Criteria:**
- Privacy messaging in join flow: clear + accessible (not buried)
- Anonymity indicator: "Your vote is anonymous" (if applicable)
- Privacy options: can user choose anonymity level? (if feature exists)
- Privacy help text: tooltips on privacy settings
- +15% trust score (measure: survey question "I trust Qesto with my data")
- Lower join drop-off (measure: users who start join → complete join)
- GDPR/privacy compliance verified (legal review)
- Copy in 5 languages (EN, NL, ES, DE, FR)

**Files to Create/Modify:**
```
src/components/PrivacyKit.tsx                    (NEW — privacy messaging)
src/components/AnonymityIndicator.tsx            (NEW — anonymity badge)
src/pages/Join.tsx                               (MODIFY — add privacy messaging)
src/lib/copy/privacy.en.json                     (NEW — privacy copy, i18n)
src/lib/copy/privacy.nl.json                     (NEW)
src/lib/copy/privacy.es.json                     (NEW)
src/lib/copy/privacy.de.json                     (NEW)
src/lib/copy/privacy.fr.json                     (NEW)
docs/PRIVACY_COMPLIANCE.md                       (NEW)
tests/functional/ui/privacy-kit.test.tsx         (NEW)
```

**Acceptance Tests:**
1. Join screen: privacy message visible (not hidden behind link)
2. Message clear: "Your responses are [anonymous/attributed], only [host/Qesto team] can see"
3. Anonymity indicator: "Anonymous" badge shown if applicable
4. Privacy help: hovering tooltip explains anonymity + data retention
5. Copy in 5 languages: all copy translated + correct
6. Trust survey: conduct before/after UX change
   - Before: 65% agree "I trust Qesto with my data"
   - After: 75% agree (+15%)
7. Legal review: privacy messaging accurate + compliant (GDPR, etc.)

**KPI:**
- `+15% trust score` (measure: survey response to "I trust Qesto with my data")

**Effort Estimate:** 5-8 points

**Dependencies:** Phase 1 + Phase 2 (80% done), I18N infrastructure

---

## Execution Plan

### Timeline
- **Week 1-2:** Phase 1 core items (1, 2, 5, 6, 9, 14) — parallel work
- **Week 2-3:** Phase 2 items (18, 20, 24, 27) — once Phase 1 is 80% done
- **Week 3-4:** Phase 3 items (31, 34, 35, 36) — once Phase 1+2 are 80% done

### CI Gates (Must Pass Before Merge)
- `npm test` (all tests pass)
- `npm run test:coverage` (≥80% coverage)
- `tsc --noEmit` (no TypeScript errors)
- `npm run lint` (no linting errors)
- Secret scan (no hardcoded secrets)
- a11y scan (axe-core)

### Definition of Done (Per Item)
- Code complete + tests passing
- Acceptance tests verified
- KPI measurement live (events/logs)
- Docs updated
- Security/privacy review (if applicable)
- Evidence link added to backlog
- No regressions on existing functionality

---

## Dependencies Summary

```
Phase 1: IDs 1, 2, 5, 6, 9, 14
├─ ID 1: Split hotspot API (no deps)
├─ ID 2: Session lifecycle (no deps)
├─ ID 5: Idempotent writes (no deps)
├─ ID 6: D1 query governance (no deps)
├─ ID 9: Webhook idempotency (no deps)
└─ ID 14: Dead-letter queue (no deps)

Phase 2: IDs 18, 20, 24, 27 (depends on Phase 1 80%)
├─ ID 18: A11y hardening
├─ ID 20: Error UX (enables ID 35)
├─ ID 24: Secret governance
└─ ID 27: Test pyramid (enables Phase 3)

Phase 3: IDs 31, 34, 35, 36 (depends on Phase 1+2 80%)
├─ ID 31: Template pack (enables ID 34)
├─ ID 34: Template wizard (depends on ID 31)
├─ ID 35: Welcome journey (depends on ID 20)
└─ ID 36: Trust kit (standalone)
```

---

## Risk & Mitigation

| Risk | Impact | Mitigation |
|---|---|---|
| Phase 1 items take longer than expected (>2 weeks) | Delays Phase 2/3 | Prioritize IDs 1, 2, 5; parallelize 6, 9, 14 |
| Regressions in Phase 1 refactoring | Blocks Phase 2 | Require 80% test coverage + integration tests |
| i18n content for ID 35/36 delays work | Blocks warm UX | Use English placeholder; localize after sprint |
| A11y audit reveals major issues (ID 18) | Delays Phase 2 | Start audit early; fix critical issues incrementally |
| Template curation (ID 31) takes longer | Delays Phase 3 | Use 3-5 minimal templates; expand post-sprint |

---

## Success Metrics

**Phase 1 Success:**
- All 6 items shipped + tested
- 0 regressions on core flows
- p99 latency -30% on hotspots
- <1% state transition errors
- 0 duplicate mutations

**Phase 2 Success:**
- All 4 items shipped + tested
- WCAG AA on critical flows
- -20% support tickets
- 0 secret leak incidents
- <5% escaped defects

**Phase 3 Success:**
- All 4 items shipped + tested
- +25% time-to-first-session
- +15% template-to-session conversion
- +10% participant completion
- +15% trust score
- -15% early drop-off

**Overall Sprint 18 Success:**
- 14/14 items complete
- KPI targets hit (all 4 adoption metrics)
- 0 regressions
- Ready for Sprint 19 (Sprint B)
