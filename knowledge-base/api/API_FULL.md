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

## 6. Phase 7 additions (AI wizard, launchpad, insights)

### POST /api/sessions/:id/questions/generate  (WIZ-AI-01/02)
- Auth: session cookie required. Owner-only. DRAFT state only.
- Rate limit: 20 / user / hour via `ACTIONS_KV:rl:ai-wizard:<userId>`.
- Request body:
  ```json
  { "sessionTitle": "Q2 Kickoff",
    "sessionGoal":  "Align priorities",
    "focusArea":    "engineering" }
  ```
- Calls `c.env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', ...)`.
  Output JSON is extracted, parsed, validated with Zod (3–5 questions, each
  with 3–5 options), then normalised (synthetic ULID ids are filled in when
  the model omits them).
- Response:
  ```json
  { "ok": true,
    "data": { "questions": [...],   // Question[] (kind/prompt/options)
              "confidence": 0.9 },  // heuristic 0..1
    "trace_id": "…" }
  ```
- Errors: `400 validation`, `400 ai_output_invalid`, `404 not_found`,
  `409 conflict`, `429 rate_limited`, `500 ai_failed` (sanitised).

### PUT /api/sessions/:id/questions/reorder  (LAUNCHPAD-01)
- Auth: session cookie required. Owner-only. DRAFT state only.
- Idempotent: repeat calls with the same ordering are a no-op.
- Request body: `{ "questionIds": ["id1", "id2", "id3"] }`
- Validates the set matches the session's current question ids exactly
  (no add/remove, no duplicates). Uses a two-phase `UPDATE` with a 10_000
  offset to respect the `UNIQUE(session_id, position)` constraint.
- Response: `{ ok: true, data: { session, questions }, trace_id }`
- Errors: `400 validation`, `404 not_found`, `409 conflict`.

### GET /api/sessions/:id/insights  (DX-INSIGHTS-01/02)
- File: `functions/api/routes/insights.ts` (new). Mounted under
  `/api/sessions/:id/insights`.
- Auth: session cookie required. Owner-only.
- Plan-gated to `insightsAI` feature (Team plan today, Pro+ once Pro plan
  ships) via `requireFeature('insightsAI')` → `403 feature_not_available`.
- Closed or archived sessions only (`409 conflict` otherwise).
- Cache: 5-minute TTL in `SESSIONS_KV` at `insights:<model>:<sessionId>`.
- AI: `@cf/mistral/mistral-7b-instruct-v0.2` over open responses plus top
  poll labels; schema-validated; sanitised errors.
- Response:
  ```json
  { "ok": true,
    "data": {
      "themes": [{ "theme": "...", "count": N, "examples": ["..."] }],
      "trend": { "7d": N, "30d": N },
      "cached": false,
      "cached_at": 1713705600000
    },
    "trace_id": "…" }
  ```
- Errors: `400 ai_output_invalid`, `403 feature_not_available`,
  `404 not_found`, `409 conflict`, `500 ai_failed` (sanitised).
