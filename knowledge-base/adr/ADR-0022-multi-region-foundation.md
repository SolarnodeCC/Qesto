---
id: ADR-0022
status: accepted
date: 2026-05-23
---

# ADR-0022 — Multi-Region Read Replica Foundation

## Decision

1. **Phase 1 (S46):** Design + `resolveReadRegion()` from `cf.colo`; no second D1 binding yet.
2. **Phase 2 (S48):** `MULTI_REGION_ENABLED=true` exposes routing metadata on `/api/admin/health` and session reads log `readRegion`.
3. **Write path** stays US-primary until ADR for write sharding (S51+).
4. **Opt-in migration** toolkit ships in S48 (`MULTI-REGION-MIGRATION-01`).

## Env vars

- `MULTI_REGION_ENABLED` — `true` to activate routing hints
- `MULTI_REGION_PRIMARY` — default `us`
- `MULTI_REGION_REPLICAS` — comma list, default `eu`
