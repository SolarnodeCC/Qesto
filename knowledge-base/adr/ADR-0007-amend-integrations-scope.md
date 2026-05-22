---
id: ADR-0007-AMEND
title: ADR-0007 Amendment — CircuitBreaker.INTEGRATIONS Scope
domain: architecture
status: accepted
version: 1.0
created: 2026-05-22
updated: 2026-05-22
tags:
  - resilience
  - circuit-breaker
  - integrations
relates_to:
  - ADR-0007-circuit-breaker
  - CB-01
  - CB-02
---

# ADR-0007 Amendment: Circuit Breaker Integration Scope

**Status:** Accepted — Sprint 31  
**Amends:** [`ADR-0007-circuit-breaker.md`](./ADR-0007-circuit-breaker.md)

## Amendment

Clarify which external dependencies use shared vs local breaker strategy and KV backing:

| Breaker | Call sites | Timeout | Threshold | Strategy | KV key prefix |
|---------|------------|---------|-----------|----------|---------------|
| `stripe` | `billing.ts` checkout/portal | 5s | 5 / 60s | shared | `cb:stripe:{env}` |
| `resend` | `email.ts` magic link | 5s | 5 / 60s | shared | `cb:resend:{env}` |
| `ai` | `ai-insights.ts`, wizard AI | 25s | 3 / 45s | shared | `cb:ai:{env}` |
| `jwks` | `oauth.ts` Google/Microsoft JWT | 5s | 3 / 15s | **local** | n/a |
| `integration:*` | `IntegrationHttpClient` per provider | 8s | 3 / 30s | shared | `cb:integration:{name}:{env}` |

## KV binding

- Production/staging: prefer `CIRCUIT_BREAKER_KV` when `CIRCUIT_BREAKER_ENABLED=true`.
- Fallback: `ACTIONS_KV` (dev/local) so breakers still function without extra namespace.

## Graceful degradation

| Breaker open | Behavior |
|--------------|----------|
| stripe | Return `payment_unavailable` JSON; no raw Stripe errors |
| resend | Log `safeLogContext`; magic link fails gracefully |
| ai | Return `ai_unavailable` / 503 with i18n key |
| jwks | OAuth redirect `sso_failed` — no JWT bypass |
| integration | Provider routes return 503; no outbound fetch |

## Acceptance

- [x] CB-01/CB-02 wired in `app.ts`, billing, email, ai-insights, oauth
- [x] `initCircuitBreakers` uses `CIRCUIT_BREAKER_KV` when configured
