# Multi-Region Runbook (Sprint 51)

## Preconditions

- `MULTI_REGION_ENABLED=true` in staging/production
- `MULTI_REGION_STATE_KV` provisioned
- `MULTI_REGION_FAILOVER_ENABLED=true` for failover drill endpoints

## Health check

```bash
curl -s "$APP_URL/api/admin/health" | jq '.data | {readRegion, writeRegion, multiRegion, failoverActive}'
```

## Failover drill (staging)

1. Confirm baseline: `failoverActive` is `false`, `writeRegion` matches `multiRegion.primary`.
2. `POST /api/admin/multi-region/failover` with superuser JWT — sets KV `multi-region:failover:active`.
3. Verify AE event `multi_region.failover_triggered` in Analytics Engine (if bound).
4. Re-run health — `writeRegion` should reflect promoted replica (default: first `readReplicas` entry).
5. `DELETE /api/admin/multi-region/failover` — clears flag.
6. Document results in sprint closeout.

## Rollback

- Clear failover KV key immediately if write errors spike.
- Set `MULTI_REGION_ENABLED=false` to disable read hints (writes still primary).

## References

- [ADR-0022](../adr/ADR-0022-multi-region-foundation.md)
- [ADR-0022 Phase 2](../adr/ADR-0022-phase-2-write-routing.md)
