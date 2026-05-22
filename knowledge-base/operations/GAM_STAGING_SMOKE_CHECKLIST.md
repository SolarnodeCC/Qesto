---
id: GAM-STAGING-SMOKE
type: operations
domain: operations
status: active
version: 1.0
created: 2026-05-22
tags:
  - staging
  - websocket
  - energizers
  - v2.2
relates_to:
  - V2_2_AUDIT_OUTCOMES
  - SPRINT30_39_PLAN
---

# GAM-STAGING-SMOKE-01 — Cloudflare Staging WebSocket Checklist

**Backlog ID:** GAM-STAGING-SMOKE-01  
**Blocks:** v2.2 cohort rollout (`RC-ROLLOUT-01`)  
**Owner:** DevOps + Backend

## Preconditions

- Staging/preview environment with `SESSION_ROOM` Durable Object binding (not local Pages-only dev).
- `LIVE_ENERGIZERS_ENABLED=true` for the energizer-on pass; repeat with `false` for flag-off pass.
- Test team with custom role that **denies** `energizer:activate` and one that **allows** it.

## Smoke matrix

| # | Case | Steps | Expected |
|---|------|-------|----------|
| 1 | Legacy WS v1 | Connect without `v` field; submit vote | Vote accepted; no protocol error |
| 2 | Explicit v1 | Connect with `v: 1`; activate Quick Finger | Activation + participant UI |
| 3 | Unsupported version | Send `v: 99` | `unsupported_protocol` error |
| 4 | Reconnect mid-energizer | Disconnect participant; reconnect | Snapshot includes active energizer state |
| 5 | Flag off | `LIVE_ENERGIZERS_ENABLED=false` | Activation denied; localized error |
| 6 | Permission deny | Member without `energizer:activate` | `ws.energizer_activation_denied` in audit |
| 7 | Admin analytics | Run Quick Finger + Team Quiz to completion | `/api/admin/analytics` energizer counts increase |
| 8 | Admin audit export | Export audit CSV | No PII; `ws.energizer_*` rows present |

## Evidence to attach to release PR

- Screenshot or AQL snippet of `ws.vote_submitted` / `ws.energizer_*` events
- `/api/version` JSON showing deployed commit SHA
- Link to staging session ID used in smoke

## Rollback trigger

Abort cohort rollout if any P0 case fails or if `do.storage_fault` AE events spike after flag-on.
