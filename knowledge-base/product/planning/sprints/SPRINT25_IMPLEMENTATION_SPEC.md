---
id: PLAN
type: planning
domain: product
category: planning
status: active
version: 1.0
created: 2026-04-01
updated: 2026-05-11
tags:
  - planning
  - sprints
  - implementation
relates_to:
  - BACKLOG_MASTER
  - ROADMAP_FULL
---

# Sprint 25 Implementation Spec — LIVE Energizer Protocol Foundation

_Started: 2026-05-04._

## Goal

Sprint 25 uses the Sprint 24 protocol/versioning gate to add the first safe LIVE energizer WebSocket foundation. This sprint does not ship advanced gameplay; it creates the versioned, feature-flagged transport needed before public LIVE energizer rollout.

## Committed Scope

| Item | Status | Acceptance Signal |
|---|---|---|
| GAM-LIVE-01 | Built; verification pending | Presenter-only `energizer_activate` client frame and `energizer_state` server broadcast exist in v1 protocol. |
| GAM-LIVE-FLAG-01 | Built; verification pending | `LIVE_ENERGIZERS_ENABLED=true` is required before activation mutates DO state or broadcasts. |
| GAM-LIVE-RECONNECT-01 | Built; verification pending | `request_state` / `init` snapshots include active energizer state for reconnecting clients. |
| GAM-LIVE-QA-01 | Built; verification pending | Unit tests cover flag-off, presenter allow, voter deny, broadcast, and reconnect snapshot behavior. |

## Explicit Deferrals

- Full participant gameplay for quick finger, team quiz, emoji poll, or word cloud.
- Battle royale, bracket tournaments, leaderboard depth, and badge expansion.
- Any breaking protocol version beyond v1.
- Public rollout before staging WebSocket validation.

## Verification

Focused gates:

- `npm run typecheck`
- `npx vitest run tests/unit/session-room.test.ts tests/unit/live-session-reducer.test.ts`
- `npm test`
- `npm run build`
