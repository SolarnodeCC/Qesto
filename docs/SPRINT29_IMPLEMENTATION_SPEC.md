# Sprint 29 Implementation Spec — Leaderboard and badge foundation

## Goal

Convert LIVE energizer outcomes into reusable, bounded scoring and recognition primitives without adding public competitions or persistent profile mechanics yet.

## Shipped Scope

- `SessionRoom` derives leaderboard entries from Quick Finger answers and Team Quiz submissions.
- Leaderboards are bounded to the top 10, rank ordered, and use anonymous participant labels.
- Badge awards are deterministic and idempotent, with stable ids per energizer, participant, and badge kind.
- Initial badge kinds: `first_answer`, `speedster`, `perfect_trivia`, and `engaged`.
- Participant and presenter LIVE screens can render leaderboard state from the existing `energizer_state` broadcast.
- Reconnect snapshots replay leaderboard and badge state as part of the active energizer.

## Acceptance

- Duplicate answer messages cannot duplicate score, leaderboard rows, or badges.
- Quick Finger awards first-answer and top-three speedster badges.
- Team Quiz awards engagement and perfect-trivia badges once eligibility is met.
- Leaderboard entries remain PII-safe and bounded.

## Deferrals

- Persistent participant profile badges.
- Cross-session tournaments, referrals, and advanced competitions.
- Admin engagement analytics dashboards, queued for Sprint 30.

