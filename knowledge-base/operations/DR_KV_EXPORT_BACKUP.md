---
id: DR_KV_EXPORT_BACKUP
type: operations
domain: operations
category: disaster-recovery
status: active
version: 1.0
created: 2026-06-19
updated: 2026-06-19
tags:
  - ops-dr-gap-01
  - rt-01
relates_to:
  - DR_DRILL_V7_2026
  - kv-backup.ts
---

# DR — KV Export Backup (AUDIT_KV / ACTIONS_KV)

_`OPS-DR-GAP-01` (RT-01). Closes v6/v7 Gap 1 for KV-only blobs._

## Scope

| Namespace | Binding | D1 counterpart |
|-----------|---------|----------------|
| Audit blobs | `AUDIT_KV` | None |
| Action queues / OAuth state | `ACTIONS_KV` | Partial |

## SLA & Recovery Targets

| Target | Value | Rationale |
|--------|-------|-----------|
| **RPO (Recovery Point Objective)** | ≤ 7 days | Weekly export; max data loss is 6 days 23h 59m |
| **RTO (Recovery Time Objective)** | ≤ 4 hours | Manual restore via `wrangler kv bulk put`; includes verification |
| **Retention** | 90 days (R2 lifecycle) | Balances cost; audit window typically ≤ 7 years in KV, backed by D1 |
| **Backup frequency** | Weekly (Sundays 03:00 UTC) | Matches retention cost curve; can be increased to daily if needed |

## Job design

| Item | Value |
|------|-------|
| **Implementation** | `functions/api/lib/kv-backup.ts` |
| **Scheduler** | Worker cron `0 3 * * 0` (Sunday 03:00 UTC) in `wrangler.toml` |
| **Destination** | `R2_SESSIONS` prefix `kv-backups/{audit\|actions}/{YYYY-MM-DD}/batch-{cursor}.json` |
| **Batch size** | 500 keys per list page |
| **Failure mode** | Non-fatal; logged + alert on zero exports (stale R2) |

## First-run evidence

After deploy, either:

1. Wait for Sunday 03:00 UTC cron and check Worker logs for `[kv-backup] OK`, or
2. Trigger manually: `wrangler dev` / production `wrangler tail` + invoke scheduled handler, or
3. List R2: `wrangler r2 object list qesto-sessions --prefix kv-backups/`

Unit proof: `tests/unit/kv-backup.test.ts`.

## Restore (tabletop)

1. List `kv-backups/{namespace}/{date}/` batches in R2.
2. For each batch JSON, `PUT` keys back into the target KV namespace via `wrangler kv bulk put` or admin script.
3. Verify audit trail continuity for compliance window.

## Acceptance (`OPS-DR-GAP-01`)

- [x] Job spec + code path in Worker
- [x] Unit test for export shape
- [ ] First production cron log + R2 object (operator, post-deploy)
