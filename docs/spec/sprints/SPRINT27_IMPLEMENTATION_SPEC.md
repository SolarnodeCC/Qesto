# Sprint 27 Implementation Spec — Quick Finger playable loop

## Goal

Ship the first playable LIVE energizer loop over the versioned WebSocket protocol.

## Shipped Scope

- Participants can submit Quick Finger answers through the `energizer_answer` WebSocket frame.
- `SessionRoom` validates the active energizer id, option value, feature flag, participant role, and duplicate answers.
- Correct answers are ranked by response speed and broadcast back in the `energizer_state` frame.
- Reconnect snapshots include the stored Quick Finger answer state, so scoreboards survive client refreshes.

## Acceptance

- A participant can answer once per active Quick Finger energizer.
- Duplicate answers return `duplicate_energizer_answer` without overwriting the first answer.
- Correct answers receive rank `1..n` by fastest response; incorrect answers are retained with rank `0`.

