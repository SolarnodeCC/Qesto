# Sprint 19 Implementation Plan — Robustness + Scale (Sprint B)

_Prepared: 2026-04-12 | Target Dates: 2026-04-26 to 2026-05-10 (2-week sprint)_

## Executive Summary

Sprint 19 hardens integrations, implements enterprise safeguards, and achieves template maturity. **14 items** organized into **3 phases**:

- **Phase 1 (Integration Hardening)**: IDs 3, 4, 7, 8, 12, 13 — typed errors, config validation, KV standards, DO resilience, contract tests, retry policies
- **Phase 2 (Enterprise Safeguards)**: IDs 15, 16, 22, 23, 25 — health dashboard, multi-tenant isolation, auth threat modeling, SAML hardening, audit completeness  
- **Phase 3 (Template Maturity)**: IDs 28, 32, 33 — synthetic monitoring, metadata standardization, versioning + deprecation

**KPI Targets**:
- -40% transient integration failures impact
- -30% SSO onboarding issues
- MTTR -25% on integration incidents
- 100% template metadata completeness
- >80% incident pre-detection (synthetic monitoring)

**v2.1.0 Release Readiness**: All 14 items shipped, security review sign-off, enterprise-grade integration layer.

---

## Phase 1: Integration Hardening (Days 1-5)

### ID 3: Typed Error Taxonomy (2-3 points)

**Problem Statement:**
Integration errors scattered across Stripe, DO, KV, D1. No consistent error format. Callers don't know if error is transient (retry) or permanent (fail-fast).

**Acceptance Criteria:**
- Error base type: `IntegrationError` with provider-specific enums (StripeErrorCode, D1ErrorCode, etc.)
- Type guard functions: `isTransientError()`, `isPermanentError()`, `getRetryableStatusCodes()`
- All integration paths throw typed errors
- Error taxonomy documented in `docs/INTEGRATION_ERRORS.md`
- 100% of integration error paths type-safe

**Files to Create/Modify:**
```
functions/api/types/integrationErrors.ts    (NEW)
functions/api/middleware/errorHandler.ts    (MODIFY)
functions/api/stripe.ts                     (MODIFY)
functions/api/sso.ts                        (MODIFY)
functions/api/services/deadLetterQueue.ts   (MODIFY)
docs/INTEGRATION_ERRORS.md                  (NEW)
```

**Dependencies:** None (Phase 1 foundation)

**KPI Target:** 100% integration error paths typed

---

### ID 4: Startup Config Validation (2-3 points)

**Problem Statement:**
Missing env vars detected at runtime (e.g., STRIPE_API_KEY → 500 error on first webhook). Required: validate all secrets + bindings at startup, fail fast.

**Acceptance Criteria:**
- Config validation runs on app startup (before routes)
- Validates: required env vars (STRIPE_*, GOOGLE_*, MICROSOFT_*, DATABASE_URL, etc.)
- Validates: KV/DO/D1 bindings exist and accessible
- Missing config produces helpful error message
- Health check: `GET /health/config` returns status of all bindings
- 0 startup failures due to misconfiguration

**Files to Create/Modify:**
```
functions/api/middleware/configValidation.ts (NEW)
functions/api/[[route]].ts                   (MODIFY)
functions/api/types/env.ts                   (MODIFY)
tests/unit/middleware/configValidation.test.ts (NEW)
```

**Dependencies:** None (Phase 1 foundation)

**KPI Target:** 0 startup failures due to misconfiguration

---

### ID 7: KV Key/TTL Standard (2 points)

**Problem Statement:**
KV keys scattered with no standard (e.g., `plan:${userId}`, `ppt:embed:${token}`, `admin_role:${userId}`). No standard TTL policy. Risk: stale cache, unpredictable data lifetime.

**Acceptance Criteria:**
- KV key taxonomy: `{namespace}:{identifier}[:{subkey}]` (e.g., `plan:userId`, `oauth:state:stateValue`)
- Namespaces defined: plan, user, admin, oauth, integration, embed, session, webhook
- TTL standard per namespace:
  - `plan:` → 24h
  - `oauth:` → 10m
  - `session:` → 12h
  - `webhook:` → 30d
  - `admin:` → indefinite
- All KV.put() calls use standard keys + TTL
- KV wrapper utilities: `kvPut()`, `kvGet()`, `kvDelete()`
- Documentation: `docs/KV_STANDARDS.md`
- <2% stale cache incidents

**Files to Create/Modify:**
```
functions/api/services/kvManager.ts         (NEW)
functions/api/admin.ts                      (MODIFY)
functions/api/sso.ts                        (MODIFY)
functions/api/integrations.ts               (MODIFY)
docs/KV_STANDARDS.md                        (NEW)
tests/unit/services/kvManager.test.ts       (NEW)
```

**Dependencies:** None (Phase 1 foundation)

**KPI Target:** <2% stale cache incidents

---

### ID 8: DO Resilience Checks (3 points)

**Problem Statement:**
SessionRoom doesn't handle reconnect + retry on timeout. Risk: lost votes, incomplete messages, state mismatch.

**Acceptance Criteria:**
- SessionRoom reconnect: exponential backoff (100ms, 1s, 10s) on connection loss
- Heartbeat: client pings DO every 30s; 60s silence triggers reconnect
- Graceful fallback: if DO unavailable, fallback to polling (GET /sessions/{id}/state every 5s)
- State reconciliation: on reconnect, get latest state from DO (delta merge)
- Test: force DO kill + verify client reconnects + no data loss
- Test: concurrent 100 DO connections + verify all messages delivered
- 100% reconnect tests pass

**Files to Create/Modify:**
```
functions/api/SessionRoom.ts                (MODIFY)
src/hooks/useSessionWebSocket.ts            (MODIFY)
tests/unit/api/SessionRoom.test.ts          (MODIFY)
tests/integration/do-resilience.test.ts     (NEW)
docs/DO_RESILIENCE.md                       (NEW)
```

**Dependencies:** None (Phase 1 foundation)

**KPI Target:** 100% reconnect tests pass

---

### ID 12: Integration Contract Tests (3 points)

**Problem Statement:**
Stripe, Google, Microsoft APIs change. No contract tests → integration breaks without warning.

**Acceptance Criteria:**
- Contract test framework using `@pact/consumer` for all providers
- Stripe contracts: POST /charges, POST /subscription updates, webhook retry, refunds
- Google/Microsoft contracts: OAuth token exchange, user info fetch, token refresh
- DO contracts: create session, send message, get state, close session
- Provider mock server included (local testing)
- CI gate: contract tests run on PR
- 100% critical provider endpoints covered
- Documentation: `docs/INTEGRATION_CONTRACTS.md`

**Files to Create/Modify:**
```
tests/contracts/stripe.pact.ts              (NEW)
tests/contracts/google.pact.ts              (NEW)
tests/contracts/microsoft.pact.ts           (NEW)
tests/contracts/do.pact.ts                  (NEW)
.github/workflows/contract-tests.yml        (NEW)
docs/INTEGRATION_CONTRACTS.md               (NEW)
```

**Dependencies:** ID 3 (typed errors), ID 4 (config validation)

**KPI Target:** 100% critical contracts covered

---

### ID 13: Retry/Backoff Policy Matrix (3 points)

**Problem Statement:**
Retry logic ad-hoc—some code retries 3×, some doesn't. No backoff strategy. Thundering herd risk.

**Acceptance Criteria:**
- Retry policy matrix: per-provider (Stripe, D1, DO, KV, Google, Microsoft)
- Stripe: 3 retries, exponential backoff, only on 5xx/timeout
- D1: 2 retries, exponential backoff (100ms, 1s), on timeout/deadlock
- DO: 3 retries, exponential backoff (100ms, 1s, 10s), on timeout/unavailable
- KV: 2 retries, no backoff
- Google/Microsoft: 2 retries, exponential backoff (1s, 5s)
- Jitter: add random ±10% to avoid thundering herd
- Retry decision: `shouldRetry(error, provider, attempt)` → boolean
- All integration calls use matrix
- Observability: log retry attempts
- Documentation: `docs/RETRY_POLICY_MATRIX.md`
- -40% transient failures impact

**Files to Create/Modify:**
```
functions/api/services/retryPolicy.ts       (NEW)
functions/api/stripe.ts                     (MODIFY)
functions/api/sso.ts                        (MODIFY)
functions/api/services/deadLetterQueue.ts   (MODIFY)
docs/RETRY_POLICY_MATRIX.md                 (NEW)
tests/unit/services/retryPolicy.test.ts     (NEW)
```

**Dependencies:** ID 3 (typed errors), ID 7 (KV standards)

**KPI Target:** -40% transient failures impact

---

## Phase 2: Enterprise Safeguards (Days 4-9)

### ID 15: Integration Health Dashboard (3 points)

**Problem Statement:**
When Stripe, D1, DO down, operators have no visibility. MTTR high (1h+ to diagnose).

**Acceptance Criteria:**
- Dashboard: real-time status of 5 providers (Stripe, D1, DO, Google, Microsoft)
- Per-provider: last successful call, failure rate, error types, response time (p50/p95)
- Health check: every 5 min, each provider gets synthetic request
- Dashboard shows: 🟢 healthy (>99%), 🟡 degraded (95-99%), 🔴 down (<95%)
- Alerts: Slack/email when provider goes red (with runbook link)
- MTTR target: <5 min diagnosis via dashboard
- Documentation: `docs/INTEGRATION_HEALTH_RUNBOOK.md`

**Files to Create/Modify:**
```
functions/api/services/healthCheck.ts       (NEW)
functions/api/routes/admin.routes.ts        (MODIFY)
src/pages/AdminHealthDashboard.tsx          (NEW)
tests/integration/health-check.test.ts      (NEW)
docs/INTEGRATION_HEALTH_RUNBOOK.md          (NEW)
```

**Dependencies:** Phase 1 error typing foundation

**KPI Target:** MTTR -25%

---

### ID 16: Multi-Tenant Integration Safeguards (3 points)

**Problem Statement:**
Stripe webhooks, OAuth tokens shared across teams. Risk: team A's webhook triggers team B's action.

**Acceptance Criteria:**
- Stripe webhook handler: validate webhook_account_id matches team binding
- OAuth state validation: include teamId in state token; validate on callback
- Session isolation: DO validates teamId + ownerId before state mutation
- Cross-tenant test: 2 teams, verify team A webhook doesn't affect team B
- Audit log: all cross-tenant boundary checks logged
- 0 cross-tenant incidents
- Documentation: `docs/MULTI_TENANT_SAFEGUARDS.md`

**Files to Create/Modify:**
```
functions/api/middleware/tenantGuard.ts     (NEW)
functions/api/routes/billing.routes.ts      (MODIFY)
functions/api/routes/auth.routes.ts         (MODIFY)
functions/api/SessionRoom.ts                (MODIFY)
tests/data-security/cross-tenant.test.ts    (MODIFY)
docs/MULTI_TENANT_SAFEGUARDS.md             (NEW)
```

**Dependencies:** ID 3 (typed errors), ID 25 (audit logs)

**KPI Target:** 0 cross-tenant incidents

---

### ID 22: JWT/Magic-Link Threat Model Refresh (2 points)

**Problem Statement:**
Auth tokens unclear—when do they expire? Can they be reused? No documented threat model.

**Acceptance Criteria:**
- Threat model document: JWT vs magic-link trade-offs
- JWT: lifetime 1h, refresh token 7d, httpOnly cookie (CSRF protected)
- Magic-link: one-time use, 15-min lifetime, burned after use
- Attack scenarios covered: token theft (CSRF, XSS), replay, expiration
- Mitigations: HTTPS, SameSite=Strict, CSRF tokens, rate limiting
- Security team sign-off
- Documentation: `docs/AUTH_THREAT_MODEL.md`
- 100% high-risk auth scenarios classified + mitigated

**Files to Create/Modify:**
```
docs/AUTH_THREAT_MODEL.md                   (NEW)
functions/api/auth.ts                       (MODIFY - add threat model comments)
functions/api/types/auth.ts                 (MODIFY - document JWT/magic-link lifetime)
```

**Dependencies:** ID 25 (audit logs)

**KPI Target:** 100% high-risk auth scenarios classified

---

### ID 23: SAML Hardening Checklist (3 points)

**Problem Statement:**
SAML SSO vulnerable to common attacks (XML External Entity, signature bypass, metadata poisoning).

**Acceptance Criteria:**
- SAML hardening 10-point checklist:
  1. Signature validation: require signed assertions + metadata
  2. Encryption: assertions encrypted in-transit + at-rest
  3. Replay protection: check audience, issue instant, not-on-or-after
  4. XML parsing: use safe parser (no XXE), validate schema
  5. Metadata validation: HTTPS, signed, refresh periodically
  6. Attribute mapping: whitelist allowed attributes
  7. Rate limiting: 5 login attempts / 5 min per email
  8. Logging: log auth failures + suspicious activity
  9. Certificate pinning: optional, highest security
  10. Key rotation: SAML signing key rotated annually
- Acceptance tests: verify each point
- Documentation: `docs/SAML_HARDENING.md`
- -30% SSO onboarding issues

**Files to Create/Modify:**
```
functions/api/sso.ts                        (MODIFY)
functions/api/middleware/samlValidator.ts   (NEW)
docs/SAML_HARDENING.md                      (NEW)
tests/data-security/sso.test.ts             (MODIFY)
```

**Dependencies:** ID 3 (typed errors), ID 25 (audit logs)

**KPI Target:** -30% SSO onboarding issues

---

### ID 25: Audit Log Completeness Matrix (3 points)

**Problem Statement:**
Some endpoints logged, some not. Audit trail incomplete. Risk: GDPR/SOC 2 compliance failure.

**Acceptance Criteria:**
- Audit completeness matrix: all mutating endpoints (POST, PUT, DELETE)
- Each endpoint: audit event type defined, payload schema
- Audit table extended: add sourceIp, userAgent, impersonatorId
- Acceptance tests: every mutating endpoint logs correctly
- Admin endpoint: `GET /admin/audit-log?filter=session_created&limit=100`
- Retention: audit logs kept for 2 years
- 100% mutating endpoints auditable
- Documentation: `docs/AUDIT_LOG_MATRIX.md`

**Files to Create/Modify:**
```
functions/api/db.ts                         (MODIFY)
functions/api/middleware/auditLog.ts        (MODIFY)
functions/api/routes/*.ts                   (MODIFY - add audit calls)
docs/AUDIT_LOG_MATRIX.md                    (NEW)
tests/integration/audit-coverage.test.ts    (NEW)
```

**Dependencies:** ID 14 (audit schema exists), ID 3 (error typing)

**KPI Target:** 100% mutating endpoints auditable

---

## Phase 3: Template Maturity (Days 8-14)

### ID 28: Synthetic Journey Monitoring (3 points)

**Problem Statement:**
Session flow breaks in production—users can't join. But no alert fires until users complain.

**Acceptance Criteria:**
- Synthetic journey: automated user flow
  1. Create session (host)
  2. Join session (participant)
  3. Submit vote (participant)
  4. View results (host)
  5. Close session
- Runs every 5 min in production
- Alert on failure (Slack, email, dashboard)
- Pre-detection: >80% of incidents caught before user complaint
- Dashboard: synthetic results + latency per step
- Documentation: `docs/SYNTHETIC_MONITORING.md`

**Files to Create/Modify:**
```
tests/synthetic/journey.test.ts              (NEW)
functions/api/routes/admin.routes.ts         (MODIFY)
src/pages/AdminSyntheticDashboard.tsx        (NEW)
.github/workflows/synthetic-monitor.yml      (NEW)
docs/SYNTHETIC_MONITORING.md                 (NEW)
```

**Dependencies:** ID 15 (health dashboard), Phase 1 (error typing)

**KPI Target:** >80% incident pre-detection

---

### ID 32: Template Metadata Standard (2 points)

**Problem Statement:**
Templates incomplete—missing category, description, preview. No schema enforced.

**Acceptance Criteria:**
- Template metadata schema v1.0 with: id, version, name, category, description, thumbnail, estimatedMinutes, questions, sampleAnswers, tags, audience, complexity
- Migration: all existing templates updated to v1.0
- Validation: on template save, schema validated
- UI: template gallery shows all fields
- 100% templates have complete metadata

**Files to Create/Modify:**
```
functions/api/types/template.ts              (MODIFY)
functions/api/services/templateValidator.ts  (NEW)
functions/api/routes/templates.routes.ts     (MODIFY)
functions/api/db.ts                          (MODIFY)
scripts/migrate-templates-v1.0.ts            (NEW)
docs/TEMPLATE_METADATA_SCHEMA.md             (NEW)
tests/unit/services/templateValidator.test.ts (NEW)
```

**Dependencies:** ID 31 (Sprint 18 templates exist)

**KPI Target:** 100% template metadata completeness

---

### ID 33: Template Versioning + Changelog + Deprecation (3 points)

**Problem Statement:**
Update template → existing sessions break. No change history. No deprecation path.

**Acceptance Criteria:**
- Versioning: templates have version (1.0, 1.1, 2.0); sessions lock version
- Schema change: old sessions retain questions (no data loss)
- Changelog: every version has change summary
- Deprecation: old templates marked deprecated
- Migration: admin can trigger migration with mapping rules
- 0 regressions from template changes
- Documentation: `docs/TEMPLATE_VERSIONING.md`

**Files to Create/Modify:**
```
functions/api/db.ts                          (MODIFY)
functions/api/services/templateVersioning.ts (NEW)
functions/api/routes/templates.routes.ts     (MODIFY)
scripts/create-template-version.ts           (NEW)
docs/TEMPLATE_VERSIONING.md                  (NEW)
tests/integration/template-versioning.test.ts (NEW)
```

**Dependencies:** ID 32 (metadata), ID 31 (Sprint 18 templates)

**KPI Target:** 0 regressions from template changes

---

## Execution Timeline

**Week 1 (Apr 26 - May 3)**:
- Days 1-5: Phase 1 items (3-4 per day, parallel work)
  - ID 3, 4, 7, 8: Core foundation (typed errors, config, KV, DO)
  - ID 12, 13: Testing & retry (contract tests, backoff)
- Gate: Phase 1 items 60%+ done by day 5

**Week 2 (May 3 - May 10)**:
- Days 6-9: Phase 2 items (2-3 per day)
  - ID 15, 16, 22, 23, 25: Health, safeguards, audit
- Days 8-14: Phase 3 items (parallel finish)
  - ID 28, 32, 33: Monitoring, metadata, versioning
- Gate: All 14 items complete + tested by day 14

---

## Sprint Metrics

**Effort Distribution:**
- Phase 1: 15-17 points (foundation)
- Phase 2: 14 points (safeguards)
- Phase 3: 8 points (polish)
- **Total: 37-39 points** (realistic for 2-week sprint)

**KPI Targets:**
- -40% transient integration failures impact
- -30% SSO onboarding issues
- MTTR -25% on integration incidents
- 100% template metadata completeness
- >80% incident pre-detection

**Definition of Done:**
- Code + tests complete
- Security review (if auth/integration)
- Performance tested
- Docs updated
- Evidence links added
- No regressions

**Release Guardrails (v2.1.0):**
- All tests green
- TypeScript strict mode
- No linting errors
- No secret leaks
- Performance budgets met
- Security sign-off
- Canary rollout (5% → 100% over 3 days)

---

## Related Documentation

- `SPRINT_PLAN.md` — Active sprint planning hub
- `BACKLOG.md` — Full 36-item product roadmap
- `SPRINT_18_IMPLEMENTATION.md` — Sprint A (foundation + trust)
- `SPRINT_20_IMPLEMENTATION.md` — Sprint C (maturity + optimization)
- `CLAUDE.md` — Hard rules, stack overview
