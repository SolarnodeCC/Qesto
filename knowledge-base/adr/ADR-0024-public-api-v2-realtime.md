---
id: ADR-0024
status: accepted
date: 2026-05-23
---

# ADR-0024 — Public API v2 Realtime Contract

## Decision

- **v2 adds** `GET /api/v2/sessions/:id/realtime` — returns WebSocket URL + event list (no separate DO).
- Integrators reuse existing SessionRoom protocol v1 (`init`, `question`, `results`, …).
- **Auth:** same Bearer API key as v1; session must belong to key's team and be `live` or `energizing`.
- **v1 remains** read-only REST; no breaking changes.
