# Ops Runbooks — v3.0 (Sprint 49)

| Incident | Runbook |
|----------|---------|
| Vote latency regression | `SUB100MS_PROOF.md` + `/api/admin/perf/sub100ms-proof` |
| Multi-region read skew | `ADR-0022` + `/api/admin/multi-region/status` |
| API key leak | Rotate via `/api/api-keys`, audit `INTEGRATIONS_KV` |
| Webhook dead-letter | `/api/admin/webhooks/dead-letter` (S40) |
| DO session stuck | `knowledge-base/operations/SESSION_ROOM_RECOVERY.md` |

## On-call checklist

1. Check `/api/health` — `multiRegion`, `commit`
2. Review `/api/admin/perf/latency-dashboard` (24h)
3. Confirm activation funnel not collapsing (`/api/admin/analytics/activation-funnel`)
