---
id: ADR-0027
status: accepted
date: 2026-05-25
---

# ADR-0027 — Multi-Region Write Routing (Design)

## Decision

1. **S62–S64:** `teams.home_region` in KV (`team:region:{teamId}`) + `resolveWriteBinding()` returns primary D1 until `MULTI_REGION_WRITES_ENABLED=true`.
2. **EU-only tenants:** `region_lock=eu` blocks Workers AI and logs `db.residency_violation` AE event (no cross-region write).
3. Full `DB_EU` binding is a DevOps provisioning step (see `SPRINT60_70_INFRA_PLAN.md`).
