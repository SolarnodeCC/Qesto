---
id: ADR-0028
status: accepted
date: 2026-05-25
---

# ADR-0028 — Public API v3 Contract

## Decision

- Base path: `/api/v3`
- Auth: `Authorization: Bearer qesto_*` (same key store as v1/v2)
- Scopes: `read`, `write`, `admin` (admin = team settings webhooks only in v3.1)
- Writes require `Idempotency-Key` header (24h cache in ACTIONS_KV)
- Deprecation: v1 sunset announced S70; v2 maintained through S68
