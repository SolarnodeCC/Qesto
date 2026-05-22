---
id: ADR-0013
status: accepted
created: 2026-05-22
---

# ADR-0013: Energizer Strategy Pattern

## Context

Energizers (quick_finger, team_quiz, emoji_poll, word_cloud) share WebSocket lifecycle hooks in `SessionRoom` but differ in scoring, badges, and completion rules. Sprint 35 needs a stable extension point for new energizer kinds without duplicating DO message handlers.

## Decision

1. **Kind registry** — Each energizer `kind` maps to a strategy object with `onActivate`, `onAnswer`, `onAdvance`, and `onComplete` hooks. Handlers in `SessionRoom` dispatch by `energizer.kind` rather than branching on string literals inline.
2. **State shape** — Wire format remains `LiveEnergizerState` in `realtime.ts`; strategies may attach kind-specific fields under optional keys validated at activation time.
3. **Badges** — Badge awards flow through `determineBadgesAwarded()` on close/advance; strategies supply stats snapshots only (no direct D1 writes from DO).
4. **Draft vs live** — DRAFT/ENERGIZING REST routes create rows; only the DO activates energizers during ENERGIZING/LIVE per session state machine.

## Consequences

- New energizer kinds add one strategy module + tests; DO diff stays small.
- GAM-06 analytics count `energizer.*` and `ws.energizer_*` audit actions uniformly.
- Zoom/Slack notifications remain outside energizer strategies (integration layer on session close).

## References

- `functions/api/SessionRoom.ts`
- `knowledge-base/specifications/domain/SPEC_REALTIME.md`
