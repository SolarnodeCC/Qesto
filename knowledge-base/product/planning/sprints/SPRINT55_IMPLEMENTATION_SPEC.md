---
status: shipped
branch: feat/sprint-55-v33-tournaments-coaching
---

# Sprint 55 — LIVE Tournaments + Coaching UI

## Design

- **SessionRoom** (`tournament-live.ts`): battle royale eliminates bottom 25% per round; bracket records picks until 2+ answers.
- **CoachingCard**: Insights tab calls `POST /api/sessions/:id/coaching`; i18n via `insights.coaching.*`.
- **AE**: `tournament.completed` on round end; `tournament.started` on REST seed only.
- **Tests**: `tests/unit/tournament-live.test.ts`, `session-room-cross-region.test.ts` (S52).

| ID | Shipped |
|----|---------|
| GAM-05-LIVE-01 | bracket/battle_royale in SessionRoom + realtime kinds |
| AI-COACHING-02 | CoachingCard on Dashboard insights |
| OBS-GAM-TOURNAMENT-01 | tournament.started AE |
