# Sprint 28 Implementation Spec — Team Quiz LIVE loop

## Goal

Add a multi-question LIVE energizer loop with controlled presenter progression on the v1 WebSocket protocol.

## Shipped Scope

- Presenter can start a Team Quiz energizer from the live presentation controls.
- Presenter can advance Team Quiz questions without advancing or closing the main LIVE session.
- Participants can answer the current Team Quiz question once and receive locked feedback.
- `SessionRoom` validates Team Quiz payloads, answer options, presenter advance permissions, duplicate submissions, and stale energizer ids.
- Team Quiz submissions, scores, rank order, current question index, and completed status are stored in Durable Object storage and replayed through reconnect `init` snapshots.

## Acceptance

- Each participant can submit once per quiz question.
- Presenter advance increments `currentIndex`; advancing from the final question marks the energizer `completed`.
- Reconnecting clients restore the same question index, submissions, scores, and completion state.
- Quick Finger and normal voting remain on their existing protocol paths.

