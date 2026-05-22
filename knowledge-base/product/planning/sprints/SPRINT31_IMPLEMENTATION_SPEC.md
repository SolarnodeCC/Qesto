---
id: PLAN
type: planning
domain: product
category: planning
status: active
version: 1.1
created: 2026-04-01
updated: 2026-05-22
tags:
  - planning
  - sprints
  - sprint-31
relates_to:
  - SPRINT30_39_PLAN
  - BACKLOG_MASTER
---

# Sprint 31 Implementation Spec — Enterprise Hardening + Integration Foundation

**Status:** In progress (2026-05-22)

## Shipped in this branch

| ID | Deliverable |
|----|-------------|
| INT-PROVIDER-01 | AES-GCM `EncryptedTokenStore` + `OAUTH_TOKEN_MEK`; legacy plaintext read in dev |
| CB-01/CB-02 | Already wired; `initCircuitBreakers` now prefers `CIRCUIT_BREAKER_KV` |
| ADR-0010 | Zero-knowledge mode ADR accepted |
| ADR-0007-amend | Integration circuit breaker scope |
| COMPLIANCE-02 | MVP `check:compliance-claims` (Sprint 30 carry-in) |
| GDPR-TRUST-PAGE-01 | `/trust/gdpr` marketing page |
| AUDIT-GAM-01 | Energizer action labels + `ws.energizer_answered` filter |
| AUTHZ-GAM-01 | Pre-shipped (v2.2 RC); `tests/unit/enterprise-permissions.test.ts` |

## DevOps gates (manual before prod merge)

```bash
wrangler kv namespace create CIRCUIT_BREAKER_KV
wrangler kv namespace create INTEGRATIONS_KV
wrangler pages secret put OAUTH_TOKEN_MEK
```

See [`GAM_STAGING_SMOKE_CHECKLIST.md`](../../../operations/GAM_STAGING_SMOKE_CHECKLIST.md) and [`STAGING_MIGRATION_CHECKLIST.md`](../../../operations/STAGING_MIGRATION_CHECKLIST.md).

## Tests

- `tests/unit/token-store-encryption.test.ts`
- `tests/unit/webhook-verify.test.ts`
- `tests/unit/integration-http-client.test.ts`
- `tests/unit/circuit-breaker.test.ts`
- `tests/unit/enterprise-permissions.test.ts`

## Deferred to Sprint 32 stretch

- ANON-DEPTH-01 additional i18n polish (core UI already in SessionWizard + JoinPage)
