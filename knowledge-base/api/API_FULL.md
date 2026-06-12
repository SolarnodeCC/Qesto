---
id: API-FULL
type: api
category: reference
status: active
version: 1.0
created: 2026-04-01
updated: 2026-05-11
tags:
  - rest-api
  - endpoints
  - authentication
  - error-handling
relates_to:
  - SPEC_BACKEND
  - SPEC_DATAMODEL
---

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
- `embed.ts` — EMBED authenticated widget MINT plane (ADR-0050).
- `embed-widget-v1.ts` — EMBED public, read-only, token-gated widget data plane (ADR-0050).

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

## 7. Knowledge-base semantic search (ADR-040 Phase 2)

Mounted under `/api/knowledge-base` in `functions/api/routes/knowledge-base.ts`.
Backed by the `KB_VECTORIZE` index (768-d, cosine, `@cf/baai/bge-m3`) +
`kb_documents` / `kb_chunks` in D1.

### POST /api/knowledge-base/search
- Auth: session cookie required (any authenticated user).
- Rate limit: 60 requests per 60 seconds per client IP (`kb-search` namespace).
- Request body:
  ```json
  { "query":  "how do I configure SAML?",   // 1..500 chars (required)
    "domain": "security",                     // optional, exact match
    "type":   "spec",                         // optional: adr|spec|guide|runbook|experiment|unknown
    "tags":   ["sso", "saml"],                // optional, OR-match, Jaccard re-rank
    "status": "accepted",                     // optional, default: 'accepted'
    "limit":  5 }                             // optional, 1..20, default 5
  ```
- Pipeline (see `services/kbSearchService.ts`):
  1. Embed query via `@cf/baai/bge-m3` with a 3s timeout.
  2. Vectorize query with `topK = limit * 3` and `filter = {domain?, type?, status}`.
  3. Dedup by `doc_id`, keeping the highest-scoring chunk.
  4. Batch-hydrate from D1 (`WHERE chunk_id IN (...)`).
  5. Re-rank: `0.7 * cosine + 0.15 * tag_overlap (Jaccard) + 0.15 * domain_match`.
  6. Sort by `rerank_score` desc, slice top `limit`.
- Response envelope:
  ```json
  { "ok": true,
    "data": {
      "items": [{
        "doc_id":        "ADR-040",
        "chunk_id":      "ADR-040#3",
        "file_path":     "/knowledge-base/adr/ADR-040-...md",
        "title":         "Knowledge-Base Vector Embedding Pipeline",
        "heading_path":  "Query Pipeline > Re-ranking",
        "type":          "adr",
        "domain":        "ai-context",
        "tags":          ["vectorize", "rag"],
        "similarity":    0.94,                  // cosine, rescaled to 0..1
        "rerank_score":  0.86,                  // composite, 0..1
        "chunk_preview": "First 240 chars …"
      }],
      "query_id":   "uuid",
      "latency_ms": 412
    },
    "trace_id": "…" }
  ```
- Errors:
  - `400 invalid_body` — body is not JSON.
  - `400 invalid_query` — query missing, empty, or > 500 chars.
  - `429 rate_limited` — KB rate limit exceeded.
  - `503 embedding_unavailable` — Workers AI embedding timeout or failure.
  - `500 internal_error` — unexpected failure (sanitised).
- Vectorize query failure degrades to `{ items: [] }` (logged); not surfaced as 5xx.

### GET /api/knowledge-base/documents/:doc_id
- Auth: session cookie required.
- Returns `kb_documents` metadata only (no chunk text). Used by callers that
  follow up on a search hit to display source provenance.
- Errors: `404 not_found`.

### GET /api/knowledge-base/documents/:doc_id/chunks
- Auth: session cookie required. Admin role required (owner | admin).
- Returns full chunk text for diagnostics. Not for end-user surfaces — chunk
  bodies may include unreleased product content.
- Response: `{ doc_id, chunks: [{ chunk_id, chunk_index, heading_path, text, ... }] }`.

## 8. RAG context injection (ADR-040 Phase 3)

The `getRagContext()` helper in `functions/api/lib/rag/getRagContext.ts` is an
**internal** API (not an HTTP route). It wraps `KbSearchService.search()` with
a token-budgeted markdown packer so AI endpoints and sub-agents can ground
prompts in knowledge-base passages.

Signature:
```ts
export async function getRagContext(
  env: Env,
  query: string,
  opts?: { maxTokens?: number; domain?: string; type?: KbType; limit?: number },
): Promise<{ contextBlock: string; sources: KbSource[] }>
```

See `knowledge-base/ai-context/RAG_USAGE.md` for full usage, token budgeting
guidance, citation rendering, and troubleshooting.

### POST /api/sessions/:sessionId/insights/analyze — RAG-grounded
Phase 3 adds a best-effort RAG grounding pass to the existing insights
analyze endpoint:

- Before calling `extractThemes()`, the route fetches a KB context block via
  `getRagContext(c.env, sessionTitle, { maxTokens: 800, domain: 'product' })`.
- The block is injected as a "Background knowledge" section ahead of the
  free-text responses in the user prompt.
- Failures (`embedding_unavailable`, `embedding_failed`, etc.) are caught and
  logged as `rag.context.skip`; the analyzer falls back to ungrounded mode
  and the user-facing response is unchanged structurally.
- Response payload gains a new optional field:
  ```json
  "kb_sources": [
    { "doc_id": "ADR-040",
      "file_path": "/knowledge-base/adr/ADR-040-...md",
      "title":     "KB Vector Pipeline",
      "heading_path": "Decision > Index Design",
      "similarity": 0.91 }
  ]
  ```
  Empty array when RAG returned no hits or was unavailable.

## 9. EMBED embeddable widget (ADR-0050, S87)

Two route modules implement the embeddable engagement widget. The **mint plane**
is host-authenticated; the **read plane** is token-gated and aggregate-only.

### Authenticated mint plane — `functions/api/routes/embed.ts` (`/api/embed`)
Host `authMiddleware` + `planMiddleware`, gated on the `embedWidgets` entitlement
(Team tier+). All actions are audit-logged (`embed.widget.create`,
`embed.widget.token_mint`, `embed.widget.revoke`).

| Method + path | Purpose | Returns |
|---|---|---|
| `POST /api/embed/widgets` | create a widget config `{ session_id\|code, allowed_origins[] }` | `{ widget }` (201) |
| `GET /api/embed/widgets` | list the team's configs | `{ widgets }` |
| `POST /api/embed/widgets/:wid/token` | mint a token `{ origins[], ttl? }`; origins must ⊆ the row allowlist | `{ token, exp }` |
| `DELETE /api/embed/widgets/:wid` | revoke (set `revoked_at`) | `{ revoked: true }` |

### Public read plane — `functions/api/routes/embed-widget-v1.ts` (`/api/embed/v1`)
Guarded by `widgetTokenMiddleware` (verify token signature/TTL/scope, enforce the
per-token origin allowlist, revocation check). DELIBERATELY distinct from
`/api/v1` (the API-key integrator surface). Reflected-allowlist CORS (echo the
request `Origin` only if it is in the token `ao`, never `*`), `Vary: Origin`.
`{ ok, data, trace_id }` envelope.

| Method + path | Returns (aggregate-only) |
|---|---|
| `POST /api/embed/v1/handshake` | `{ participant_token, session: { code, status, title, anonymity_mode }, branding }` |
| `GET /api/embed/v1/sessions/:idOrCode/state` | `{ status, active_question, response_count }` |
| `GET /api/embed/v1/sessions/:idOrCode/results` | `{ question_id, counts_by_option, total }` |

**Token** (HMAC-SHA-256, `functions/api/lib/embed-token.ts`): claims
`{ v:1, wid, sid, code, tid, ao:string[], scp:'read', iat, exp }`. TTL default
3600s, max 86400s. Signed with `EMBED_WIDGET_SECRET` (Pages secret). Read scope
only this sprint — no vote-over-embed write path.

**Structural anonymity (Pentest #5).** The read plane has NO endpoint or query
shape capable of emitting per-participant identity. The results/state queries are
`COUNT(*)` / `GROUP BY option_id` aggregates exclusively (see
`repositories/embedWidgetRepository.ts`) — no `voter_id`, hash, IP, fingerprint,
or name ever crosses `/api/embed/v1/*`. The handshake's `participant_token` is an
anonymous, session-scoped opaque id with no identity.
