# Qesto — Security & Privacy Baseline (Current)

_Hub: [Documentation map](./README.md)._

_Last verified: 2026-05-05 (UTC)_

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

## 4. LIVE engagement hardening
- `energizer:activate` is a distinct permission from `session:launch` and `session:close`.
- Built-in team members do not receive `energizer:activate` by default; custom roles can grant or omit it explicitly.
- The session WebSocket route resolves effective team permissions server-side and forwards them internally to `SessionRoom`; clients do not control the permission attachment.
- `SessionRoom` writes sanitized D1 audit rows for LIVE energizer activation, denial, answers, advancement, and completion.
- Admin analytics and CSV exports use aggregate counts and opaque identifiers only. Prompt text, answer values, emails, bearer tokens, SAML material, Stripe identifiers, and magic links are outside the LIVE engagement analytics boundary.
