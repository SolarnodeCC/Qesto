---
id: ADR-0021
status: accepted
date: 2026-05-23
---

# ADR-0021 — Public API v1

## Decision

- Base path: `/api/v1`
- Auth: `Authorization: Bearer qesto_<uuid>` (SHA-256 hash indexed in INTEGRATIONS_KV)
- Scopes: `read` | `write` (v1 routes are read-only)
- Key management: `/api/api-keys` (JWT + Team plan)
- No WebSocket in v1 (deferred to v2 / ADR-0024)
