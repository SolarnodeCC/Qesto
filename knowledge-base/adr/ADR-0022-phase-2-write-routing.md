---
id: ADR-0022-PHASE-2
status: accepted
date: 2026-05-24
relates_to:
  - ADR-0022
---

# ADR-0022 Phase 2 — Write Routing Metadata (Sprint 51)

## Context

Phase 1 (S46) added `resolveReadRegion()` from `cf.colo`. Phase 2 (S48) exposed opt-in and health metadata. Sprint 51 adds **write-path routing decisions** before a second D1 binding exists.

## Decision

1. **Writes always target `MULTI_REGION_PRIMARY`** unless `multi-region:failover:active` is set in `MULTI_REGION_STATE_KV` (operator drill / incident).
2. **`resolveWriteRegion(colo, cfg, failoverActive)`** returns the logical write region for logging, Analytics Engine, and future D1 binding selection.
3. **No dual-write** in S51 — single D1 binding remains; routing is observable and testable.
4. **Session mutations** call `emitMultiRegionWrite()` (best-effort AE `multi_region.write_routed`).
5. **Failover** is manual: `POST /api/admin/multi-region/failover` sets KV flag; runbook in `MULTI_REGION_RUNBOOK.md`.

## Env

| Var | Purpose |
|-----|---------|
| `MULTI_REGION_STATE_KV` | Failover flag + drill state |
| `MULTI_REGION_FAILOVER_ENABLED` | `true` allows admin failover routes |

## Consequences

- S52 runbooks and staging drill validate operator flow before production `MULTI_REGION_ENABLED` rollout.
- True D1 replica bindings remain a follow-up ADR when Cloudflare multi-region D1 is provisioned.
