---
id: RUNBOOK-OBSERVABILITY
type: runbook
category: incident
status: active
version: 1.0
created: 2026-04-01
updated: 2026-05-11
tags:
  - incident-response
  - operations
  - procedures
relates_to:
  - OBSERVABILITY
---

# Qesto — Observability Status (Current)

_Hub: [Documentation map](./README.md)._

_Last verified: 2026-04-06 (UTC)_

## Current implementation
- API logging and error-tracking modules exist in `functions/api/logging.ts`, `error-tracker.ts`, `observability.ts`.
- Background worker tail infrastructure exists (`worker/tail`).
- Admin and billing flows include dedicated operational routes.
- API middleware emits request-level `[access]` structured logs and correlation headers (`X-Trace-Id`).
- **Operator paging:** `functions/api/lib/alerts.ts` (`checkAlert` / `alertCritical` / `dispatchAlert`) — webhook, optional Sentry, optional GitHub `auto-alert` issues. Setup: [ALERTING_SETUP.md](./ALERTING_SETUP.md).
- **Debug guide:** symptom → Log Explorer / AE / alerts: [DEBUG_GUIDE.md](./DEBUG_GUIDE.md).

## Maturity assessment
- **Implemented foundation**: structured logging primitives + instrumentation hooks + optional multi-channel paging.
- **Partially complete**: unified dashboards, consistent SLO alerts, and runbooks.

## Next actions
1. Promote key operational metrics to one dashboard (API latency, websocket errors, billing webhook health, AI failures).
2. Set `ALERT_WEBHOOK_URL` / `GITHUB_ALERT_TOKEN` in production (see [ALERTING_SETUP.md](./ALERTING_SETUP.md)).
3. Tie sprint closure to explicit observability evidence.
