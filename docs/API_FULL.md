# Qesto — API & Realtime Specification (Current)

_Hub: [Documentation map](./README.md)._

_Last verified: 2026-04-06 (UTC)_

## 1. API conventions
- Base path: `/api`
- Auth: Bearer JWT / signed session tokens depending on endpoint.
- Error shape: `{ error, message, details? }`

## 2. Implemented route domains
- `auth.routes.ts` — magic link, credential and auth helpers.
- `sessions.routes.ts` — create/start/close/join/session state.
- `decisions.routes.ts` — decisions and semantic search.
- `templates.routes.ts` / `template-handlers.ts`
- `teams.routes.ts`
- `billing.routes.ts` + Stripe handlers
- `admin.routes.ts`
- `ai.routes.ts`
- `collaboration.routes.ts`
- `integrations.routes.ts`
- `misc.routes.ts`

## 3. Realtime protocol
- WebSocket session channel handled by `SessionRoom`.
- Presenter and voter message types are role-gated server-side.
- Broadcast updates for vote/reveal/timer/state transitions.
- `ranking` submissions are normalized to multiple-choice style aggregation:
  top-ranked option is counted in `results`, and presenter/client rendering is sorted descending by vote count.

## 4. Quality expectations
- Every API change requires route tests and validation updates.
- Security-sensitive endpoints require explicit rate-limit and ownership checks.

## 5. 2026-04-06 verification delta
- `sessions.routes.ts` depends on shared route helpers for `uniqueCode` and `getStub`; this is now explicitly treated as a required dependency for session creation, DO fetches, analytics/export, and GDPR respondent erasure.
- Speed Round endpoint `/api/sessions/:id/ai/speed-round` depends on `services/speed-round.ts` helpers for language normalization, prompt generation, and payload sanitization.
