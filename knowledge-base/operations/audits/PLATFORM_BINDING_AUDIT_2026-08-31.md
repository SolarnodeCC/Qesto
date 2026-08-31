---
id: PLATFORM_BINDING_AUDIT_2026-08-31
type: audit
category: operations
status: active
version: 1.0
created: 2026-08-31
updated: 2026-08-31
tags:
  - operations
  - bindings
  - queues
  - durable-objects
relates_to:
  - RUNBOOK-SESSION_ROOM_RECOVERY
  - BACKLOG_ACTIVE
  - ADR-042-cloudflare-capability-expansion
---

# Platform Binding Audit — 2026-08-31

**Scope:** Phase 0 baseline for ISS-001 (Queues), ISS-002 (integration flag), ISS-003 (SESSION_ROOM), ISS-029 (branch protection).

## Automated probes (post Phase 1 code)

```bash
# Remote (production or staging)
npm run audit:bindings -- https://qesto.cc

# Local fullstack (after wrangler dev --local)
npm run audit:bindings -- http://localhost:8787

# Wrangler flag contract (CI)
npm run check:wrangler-flags

# GitHub branch protection (requires gh auth)
npm run check:branch-protection
```

## Expected `/api/admin/health` bindings shape

```json
{
  "ok": true,
  "data": {
    "bindings": {
      "ok": true,
      "degraded": false,
      "missingRequired": [],
      "probes": [
        { "name": "SESSION_ROOM", "bound": true, "required": true },
        { "name": "INSIGHTS_QUEUE", "bound": true, "required": true },
        { "name": "INTEGRATION_ENABLED", "bound": true, "required": false, "detail": "raw=true; effective=true" }
      ]
    }
  }
}
```

## Operator checklist (production)

| Check | Command / location | Pass criteria |
|-------|-------------------|---------------|
| Queue producer bound | `npm run audit:bindings` | `INSIGHTS_QUEUE bound=true` |
| Queue consumer deployed | Worker deploy + Cloudflare dashboard Queues | Consumer attached to `qesto-insights` |
| DLQ exists | `wrangler queues list` | `qesto-insights-dlq` present (or remove DLQ from wrangler if not created) |
| SESSION_ROOM on Pages | Dashboard → Pages → qesto → Functions → DO bindings | Cross-script to `qesto-api` / `SessionRoom` |
| Integration flag | wrangler `[vars]` + health probe | `INTEGRATION_ENABLED="true"` |
| Branch protection | `npm run check:branch-protection` | Required checks + reviews on `main` |
| No silent queue drops | AE / logs | Zero `queue.enqueue.noop` after close traffic |

## Queue provisioning (one-time per account)

```bash
wrangler queues create qesto-insights
wrangler queues create qesto-insights-dlq
wrangler deploy   # qesto-api Worker — picks up producer + consumer from wrangler.toml
```

## Known gaps before deploy

- **Pages DO binding** remains dashboard-configured until codified — see [`SESSION_ROOM_RECOVERY.md`](../SESSION_ROOM_RECOVERY.md).
- **CI** still deploys Pages only — `OPS-DEPLOY-UNIFIED-01` tracks Worker deploy in pipeline.

## Issue traceability

| Issue ID | Story ID | Remediation in this train |
|----------|----------|---------------------------|
| ISS-001 | OPS-QUEUE-BIND-01 | Queue bind + fail-visible enqueue |
| ISS-002 | BE-FLAG-CONTRACT-01 | `true` + getFlag |
| ISS-003 | OPS-DO-BIND-VERIFY-01 | Health + smoke |
| ISS-023 | OPS-QUEUE-BIND-01 | wrangler comment fix |
| ISS-029 | OPS-BRANCH-PROTECT-01 | gh audit script |
