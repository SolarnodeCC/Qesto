# Qesto SOC 2 Evidence Framework
## COMPLIANCE-01 | Sprint 33 | v2.3

> **Status:** Framework established. Evidence collection ongoing (Sprint 33–34).
> **Owner:** Platform lead + security reviewer
> **Review cadence:** Monthly during Sprint 33–34; quarterly after v2.3 ships.

---

## Sub-Processor Registry

| Sub-Processor | Purpose | Data Processed | Location | DPA/Agreement |
|---|---|---|---|---|
| **Cloudflare** | CDN, Workers runtime, Durable Objects, D1, KV, R2, Analytics Engine | All platform data (in transit + at rest) | EU (configurable via regional routing) | Cloudflare DPA accepted |
| **Resend** | Transactional email (magic links, notifications) | Email addresses only | US (EU region available) | Resend DPA accepted |
| **Stripe** | Payment processing, subscription management | Billing data, cardholder info | US/EU | Stripe DPA accepted; PCI DSS compliant |
| **Slack** _(optional)_ | Session result notifications (opt-in per team) | Session title, aggregate vote counts only — no participant data | US | Slack DPA; data minimised per ADR-0008 |
| **Microsoft** _(optional)_ | Teams result notifications (opt-in per team) | Session title, aggregate vote counts only | EU/US (tenant-dependent) | Microsoft DPA; data minimised per ADR-0008 |
| Workers AI (Cloudflare) | AI insights, question generation | Open-ended response text (team plan only) | Cloudflare network (no external AI API calls) | Covered by Cloudflare DPA |

**Data minimisation note:** Integration providers (Slack, Teams) receive only session titles and aggregate vote counts — never participant identifiers, raw responses, or email addresses. This is enforced by `SessionResults.consent_posture` and the `buildSlackMessage()` / Adaptive Card builders which operate on aggregate data only.

---

## SOC 2 Trust Service Criteria — Control Inventory

### CC6: Logical and Physical Access Controls

| Control ID | Description | Implementation Evidence | Status |
|---|---|---|---|
| CC6.1 | Access to data requires authentication | JWT magic-link auth; SAML SSO for enterprise; all API routes behind `authMiddleware` | ✓ Implemented |
| CC6.2 | User access provisioned and deprovisioned | Team invite/remove via `/api/teams/:id/members`; token revocation on leave | ✓ Implemented |
| CC6.3 | Role-based access control | `BUILTIN_ROLE_PERMISSIONS` matrix (owner/admin/member/viewer); custom roles; `rbacMiddleware` on all `/api/*` routes | ✓ Implemented |
| CC6.6 | Encryption of data in transit | All traffic via HTTPS (Cloudflare TLS 1.2+); WebSocket over WSS | ✓ Implemented |
| CC6.7 | Encryption of data at rest | D1 encrypted at rest by Cloudflare; KV encrypted at rest; integration tokens in EncryptedTokenStore (plaintext TODO v2.3 — see gap below) | ⚠ Partial |
| CC6.8 | Monitoring for security events | `audit_events` D1 table (written via `lib/audit.ts` `recordAuthAuditEvent()`) for auth/admin actions, with actor, outcome, trace id; `safeLogContext()` PII sanitization. Note: the older `audit_log` table exists in `schema.sql` but nothing writes to it — it is not the active audit trail. | ✓ Implemented |

### CC7: System Operations

| Control ID | Description | Implementation Evidence | Status |
|---|---|---|---|
| CC7.1 | Malware and vulnerability monitoring | Cloudflare WAF enabled; dependabot alerts via GitHub | ✓ Platform |
| CC7.2 | Anomaly detection | Analytics Engine rate limit events, circuit breaker open events, error.api events | ✓ Implemented |
| CC7.3 | Incident response | Incident runbook in `knowledge-base/operations/incidents/`; rollback procedure in `STAGING_MIGRATION_CHECKLIST.md` | ✓ Documented |
| CC7.4 | Breach notification process | GDPR Article 33 notification within 72h; runbook TBD (Sprint 34) | ⚠ Gap — Sprint 34 |

### CC8: Change Management

| Control ID | Description | Implementation Evidence | Status |
|---|---|---|---|
| CC8.1 | Authorized changes only | GitHub PR review required; wrangler deploy gated on CI | ✓ Process |
| CC8.2 | Regression testing before production | `npm test` (797+ tests), `npm run typecheck`, quality gates documented | ✓ Implemented |
| CC8.3 | Rollback capability | Cloudflare Pages revision rollback; feature flags for LIVE energizers; circuit breaker state reset via KV delete | ✓ Implemented |

### CC9: Risk Mitigation

| Control ID | Description | Implementation Evidence | Status |
|---|---|---|---|
| CC9.1 | Risk assessment | Resilience audit (score 4/10 pre-Sprint 30); addressed by Sprints 30–31 | ✓ Addressed |
| CC9.2 | Vendor risk management | Sub-processor registry above; Cloudflare, Stripe, Resend all have SOC 2 Type II certifications | ✓ Documented |

### A1: Availability

| Control ID | Description | Implementation Evidence | Status |
|---|---|---|---|
| A1.1 | System availability commitments | Cloudflare Workers 99.99% SLA; circuit breakers for Stripe/Resend/AI/JWKS prevent cascade failures | ✓ Implemented |
| A1.2 | Capacity planning | Participant capacity limit enforced in SessionRoom; token bucket rate limiting; KV-backed rate limits | ✓ Implemented |
| A1.3 | Environmental protection | Cloudflare global network; Durable Object geographic distribution | ✓ Platform |

### P: Privacy

| Control ID | Description | Implementation Evidence | Status |
|---|---|---|---|
| P1.1 | Privacy notice | `/privacy` page with GDPR disclosure | ✓ Implemented |
| P2.1 | Consent collection | Anonymity mode selector; `consent_posture` tracked per session; `zero_knowledge` mode | ✓ Implemented |
| P3.1 | Data collection minimisation | Voter IDs are SHA-256 hashes of IP+fingerprint (never plaintext); no email in session data | ✓ Implemented |
| P4.1 | Data retention limits | Session TTL policies in KV; [`GDPR_DATA_SUBJECT_RUNBOOK.md`](./GDPR_DATA_SUBJECT_RUNBOOK.md) | ✓ Documented (Sprint 34) |
| P5.1 | Data subject rights | `DELETE /api/users/me/gdpr-delete` + runbook; unit tests in `tests/unit/sentiment.test.ts` / gdpr route | ✓ Implemented (Sprint 34) |
| P6.1 | Data disclosure disclosure | Sub-processor registry above; integration providers only receive aggregate data | ✓ Documented |
| P7.1 | Data quality | Users can update their account; sessions can be deleted by owner | ✓ Implemented |
| P8.1 | Monitoring for privacy violations | PII sanitization (`safeLogContext()`, CI gate); PRIVACY-GAM-01 tests | ✓ Implemented |

---

## Known Gaps and Sprint Assignments

| Gap | Sprint | Story |
|---|---|---|
| Integration token encryption at rest (EncryptedTokenStore has `TODO v2.3`) | Sprint 34 | COMPLIANCE-02 |
| GDPR right-to-deletion automation test | — | Closed Sprint 34 (`GDPR-BADGE-01`) |
| Breach notification runbook (GDPR Art. 33) | Sprint 35+ | See `GDPR_DATA_SUBJECT_RUNBOOK.md` |
| DPA template for EU enterprise customers | — | Closed Sprint 34 (`DPA_SCC_TEMPLATE.md`) |
| SCC (Standard Contractual Clauses) template | — | Closed Sprint 34 (`DPA_SCC_TEMPLATE.md`) |
| EU data residency routing evidence | — | Closed Sprint 34 (`EU_DATA_RESIDENCY.md`) |
| Formal penetration test | Post v2.3 | Sprint 35+ |

---

## Evidence Collection Checklist

The following evidence artefacts must be collected before SOC 2 Type I readiness:

- [ ] Cloudflare DPA acceptance confirmation (screenshot / contract reference)
- [ ] Stripe DPA acceptance confirmation
- [ ] Resend DPA acceptance confirmation
- [ ] GitHub repository access control screenshot (branch protection, required reviews)
- [ ] CI pipeline screenshot (test gate, typecheck gate)
- [ ] Cloudflare WAF configuration screenshot
- [ ] Analytics Engine dashboard screenshot showing error rate monitoring
- [ ] Audit log sample export showing `auth.*`, `session.*`, `energizer.*` events
- [ ] PII sanitization CI gate screenshot (eslint rule or custom hook output)
- [ ] Circuit breaker KV keys screenshot (CIRCUIT_BREAKER_KV state)
- [ ] `npm test` output showing 797+ tests passing
- [ ] `npm run typecheck` output showing 0 errors
- [ ] Rollback procedure test run (disable `LIVE_ENERGIZERS_ENABLED`, confirm state)
- [ ] Token bucket rate limit test (vote flood rejected with 429)

---

## Audit Trail

| Date | Reviewer | Finding | Resolution |
|---|---|---|---|
| 2026-05-20 | Sprint 33 | Framework established | This document |
| TBD | Sprint 34 | Token encryption gap | COMPLIANCE-02 |
| TBD | Sprint 34 | DPA template | ENT-RESIDENCY-01 |
