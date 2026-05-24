# Multi-Region Failover Drill Checklist (Sprint 52)

- [ ] `MULTI_REGION_ENABLED=true` on staging
- [ ] `MULTI_REGION_STATE_KV` bound
- [ ] `MULTI_REGION_FAILOVER_ENABLED=true`
- [ ] Baseline `GET /api/admin/health` shows `failoverActive: false`
- [ ] `POST /api/admin/multi-region/failover` sets `failoverActive: true`
- [ ] Session create still succeeds; AE `multi_region.write_routed` present
- [ ] `DELETE /api/admin/multi-region/failover` clears flag
- [ ] Sign-off recorded in sprint closeout
