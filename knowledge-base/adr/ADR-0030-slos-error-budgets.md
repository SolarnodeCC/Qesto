# ADR-0030: SLOs and error budgets

**Status:** Accepted (S66)  
**Date:** 2026-05-25

## Context

Post-v3.2 requires measurable reliability targets for enterprise SLAs and SOC 2 Type II evidence.

## Decision

- Define platform SLOs: API availability 99.9%, vote p95 &lt; 100ms (colo-tagged), WebSocket connect success 99.5%.
- Error budgets computed in `functions/api/lib/slo.ts` from KV/AE snapshots; exposed at `GET /api/admin/slo`.
- Burn rate alerts are ops-runbook items (DEVOPS-SLO-*); not auto-paging in app code for S66.

## Consequences

- Marketing/compliance copy must pass `check:compliance-claims` against SLO definitions.
- SLO dashboard is read-only in admin UI for S66.
