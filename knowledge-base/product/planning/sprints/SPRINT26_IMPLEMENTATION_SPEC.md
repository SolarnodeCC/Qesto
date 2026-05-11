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

# Sprint 26 Implementation Spec — LIVE energizer activation readiness

## Goal

Make the Sprint 25 LIVE energizer protocol operational from the presenter room, while keeping the feature dark behind `LIVE_ENERGIZERS_ENABLED`.

## Shipped Scope

- Presenter controls can activate a Quick Finger energizer from the live presentation screen.
- Activation still requires the WebSocket presenter role and the `LIVE_ENERGIZERS_ENABLED=true` binding.
- Active energizer state is persisted in `SessionRoom` Durable Object storage and replayed through `init` snapshots.
- The participant page prefers WebSocket energizer state when available and keeps the previous REST energizer renderer as fallback.

## Acceptance

- Voter-triggered activation remains forbidden.
- Disabled environments receive `feature_disabled` and do not persist active energizer state.
- Reconnecting clients receive the current active energizer in the v1 `init` envelope.

