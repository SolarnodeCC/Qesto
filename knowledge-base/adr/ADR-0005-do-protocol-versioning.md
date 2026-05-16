---
id: ADR-0005
title: DO Protocol Versioning
domain: architecture
status: accepted
version: 1.0
created: 2026-04-25
updated: 2026-05-11
tags:
  - durable-objects
  - protocol
  - versioning
  - backward-compatibility
  - realtime
relates_to:
  - ADR-0001-do-per-session
  - SPEC_REALTIME
---

# ADR-0005: Durable Object Protocol Versioning

_Status: Accepted for Sprint 24_
_Date: 2026-05-04_

## Context

Sprint 24 starts v2.2 realtime depth work. Qesto already uses `SessionRoom` as the coordination atom for LIVE session state, vote broadcasts, presenter controls, participant counts, and fun-mode timers. The next gamification slice needs new LIVE message semantics, but changing `ClientMessage` or `ServerMessage` directly can break active voters, presenters, reconnecting browsers, and hibernated Durable Object instances.

Cloudflare Durable Objects are a good fit for this coordination model, but WebSocket clients can remain connected while the object hibernates and later wakes with reset in-memory state. Connection attachment state must therefore stay small, serializable, and compatible across deployments. Deploys may also disconnect WebSockets, so clients must be able to reconnect and receive an `init` snapshot without relying on old in-memory protocol state.

## Decision

Qesto's LIVE WebSocket protocol uses a monotonic numeric protocol version:

- Current version: `1`.
- Client frames may include `v: 1`; missing `v` is treated as legacy v1.
- Server frames include `v: 1`.
- Unsupported future client versions are rejected with an `error` frame using `code: "unsupported_protocol"`.
- New message families must be additive in v1 unless they alter existing field meaning.
- Breaking changes require a new version, a fallback path, and focused protocol tests before rollout.

## Message Envelope

Client and server JSON text frames use:

```json
{
  "v": 1,
  "type": "vote",
  "data": {},
  "timestamp": 1777900000000
}
```

Legacy clients that send `{ "type": "...", "data": {}, "timestamp": ... }` remain valid v1 clients.

## Rollout Rules

- Durable Object handlers must validate the envelope before dispatching by `type`.
- Existing vote, presenter, reconnect, pause/resume, and close messages are the regression baseline.
- LIVE energizer messages must be hidden behind feature flags until the versioned contract tests pass.
- The server must be able to answer `request_state` with the full authoritative snapshot needed after hibernation or reconnect.
- Any per-connection WebSocket attachment must stay below Cloudflare's attachment size limit and contain no PII, tokens, prompts, or participant text.

## Test Matrix

Every protocol extension needs focused tests for:

- Legacy v1 client without `v`.
- Explicit v1 client with `v: 1`.
- Unsupported future client version.
- Unknown message type.
- Reconnect/request-state snapshot.
- Existing vote/presenter flows.
- Feature-flag-off behavior for new message families.

## Consequences

This keeps Sprint 24's LIVE energizer foundation intentionally narrow. The sprint may add feature-flagged frontend entry points and typed protocol scaffolding, but full advanced energizers, tournaments, leaderboard depth, and broad realtime schema changes stay deferred until the v1 contract is proven in staging.
