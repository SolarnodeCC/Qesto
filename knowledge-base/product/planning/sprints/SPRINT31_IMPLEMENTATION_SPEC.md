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

# Sprint 31 Implementation Spec — Enterprise Realtime Controls

Status: shipped in the v2.2 release-candidate branch.

## Scope

Sprint 31 adds enterprise controls for the LIVE energizer surface. `energizer:activate` is a first-class permission, separate from `session:launch` and `session:close`, so custom roles can grant session lifecycle access without automatically granting energizer activation.

## Permission Behavior

- Built-in `owner` and `admin` roles can activate energizers.
- Built-in `member` keeps session participation/lifecycle access but does not receive `energizer:activate` by default.
- `viewer` remains read-only.
- Custom roles can include or omit `energizer:activate`.
- Team-session presenter sockets carry an explicit `permissions` attachment resolved by the session WebSocket route from team membership and custom roles.
- Realtime presenter sockets with a `permissions` attachment are denied activation unless the list includes `energizer:activate`.
- Legacy presenter sockets without a permission list continue to work so existing activation flows are not broken while auth plumbing rolls forward.

## Audit And Observability Labels

The audit filter and realtime metrics distinguish:

- `energizer.activate`
- `energizer.advance`
- `energizer.complete`
- `energizer.activation_denied`
- `ws.energizer_activated`
- `ws.energizer_activation_denied`
- `ws.energizer_answered`
- `ws.energizer_advanced`
- `ws.energizer_completed`

These labels are intentionally sanitized and contain no prompt text or participant answers.

## Regression Coverage

`tests/unit/session-room.test.ts` covers custom permission deny/allow behavior and sanitized realtime audit writes. `tests/integration/session-lifecycle.test.ts` verifies the real session WebSocket route forwards effective team permissions into the Durable Object path. `tests/functional/ui/sprint30-32-contract.test.ts` protects the permission vocabulary, Team Settings permission picker, audit filter labels, and Durable Object enforcement hook.
