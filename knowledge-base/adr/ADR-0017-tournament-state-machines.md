---
id: ADR-0017
status: accepted
created: 2026-05-22
---

# ADR-0017: Tournament State Machines

## Decision

1. **Storage** — `bracket_matches` D1 table (existing schema) keyed by `energizer_id`.
2. **Seeding** — idempotent: reject second `POST .../bracket/seed` for same energizer.
3. **States** — `pending` → `active` → `completed` per match; winner advances in future DO work.
4. **Battle royale** — uses separate `battle_royale_rounds` table (not in REST MVP).

## Consequences

- Live bracket progression still partially manual via `PATCH /api/tournaments/matches/:id`.
- GAM-05-QA tests cover seed idempotency contract.
