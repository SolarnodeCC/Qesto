# Qesto — Security & Privacy Baseline (Current)

_Hub: [Documentation map](./README.md)._

_Last verified: 2026-04-05 (UTC)_

## 1. Security baseline
- JWT-based authentication and role/ownership enforcement.
- SAML SSO support.
- Stripe webhook handling and idempotency infrastructure.
- URL validation and server-side checks on integrations/webhooks.
- Data-security tests for auth, permissions, tenant isolation, and ownership.

## 2. Privacy baseline
- Team/session scoped access patterns.
- Audit/event logging structure.
- GDPR-oriented tests and deletion/integrity coverage in `tests/data-security`.

## 3. Active hardening priorities
- Continue reducing large-surface route complexity.
- Harden admin and webhook observability with alerting thresholds.
- Keep CSP, rate limits, and secret-management checks part of release checklist.
