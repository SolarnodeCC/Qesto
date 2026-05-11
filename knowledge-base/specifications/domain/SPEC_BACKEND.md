---
id: SPEC-BACKEND
type: specification
domain: backend
category: endpoints
status: active
version: 2.0
created: 2026-03-01
updated: 2026-05-11
audience:
  - Backend engineer
  - API/middleware lead
  - Architect
tags:
  - hono
  - cloudflare-workers
  - api-routes
  - rest-endpoints
  - middleware
  - authorization
  - error-handling
relates_to:
  - SPEC_CORE
  - SPEC_DATAMODEL
  - SPEC_INTEGRATIONS
  - ADR-0003-preflight-validation-contract
  - ADR-0004-custom-rbac-authorization
---

# SPEC_BACKEND — API Routes, Services, Middleware

_Repository hub: [Documentation map](../README.md)._

## Contract header (read first)

| Item | Value |
|------|--------|
| **Runtime** | Hono on Cloudflare Pages Functions |
| **HTTP prefix** | `/api` (all rows below are under `/api` unless noted) |
| **Entry file (not a URL)** | `functions/api/[[route]].ts` |
| **DRAFT vs LIVE** | DRAFT: REST only. LIVE: WebSocket + DO only — see [[SPEC_CORE.md#session-state-machine]], [[SPEC_REALTIME.md]] |
| **Normative rule** | If this doc conflicts with **code**, **code wins** until the spec is updated |

### AuthZ legend (use in route tables)

| Code | Meaning |
|------|--------|
| `A` | Anonymous (no JWT required on wire) |
| `J` | Valid JWT |
| `JO` | JWT + **owns** session/team resource |
| `JM` | JWT + team **member** |
| `JP` | JWT + **plan** allows feature (middleware) |
| `JMP` | JWT + member + plan feature |
| `JOP` | JWT + session owner + **presenter** role (see handler) |
| `ADM` | JWT + admin role |
| `STR` | Stripe-only (signature verification), not user JWT |
| `DEV` | Development environment only |
| `WSP` | WebSocket **presenter**: `Sec-WebSocket-Protocol: qesto.bearer.<jwt>`; owner or team member with effective presenter permissions, forwarded internally to `SessionRoom` |
| `WSV` | WebSocket **voter**: anonymous path; dedup via IP+fingerprint — [[SPEC_REALTIME.md#voter-deduplication-psm-007]] |

### Response envelope

| Kind | Shape |
|------|--------|
| **JSON success** | `{ data, meta? }` with `meta.requestId` / `meta.timestamp` when applicable |
| **JSON error** | `{ error: { code, message, statusCode, requestId, timestamp } }` |
| **Stream / SSE** | No `{data}` wrapper; chunks per route (e.g. `/ai/*` stream) |
| **Binary** | `export`, `export.csv`, HTML report — raw body |

**Route inventory tables below are authoritative** (no row counts maintained in prose).

**Pre-build abuse surface:** design-time checklist for `A` / public routes → [includes/PREBUILD_AND_DELIVERY.md#abuse-and-public-endpoints](includes/PREBUILD_AND_DELIVERY.md#abuse-and-public-endpoints) (details remain in this file’s route tables + public-write contracts).

## Readers (multi-lens · **Architect** = **Primary** for tradeoffs)

| Role | Use this doc to… |
|------|------------------|
| **Architect** | **Primary** — **AuthZ** model, **public-write** risk, **DRAFT vs LIVE** HTTP ban, plan gates. |
| **Backend Developer** | Map **mount → handler**; Zod + D1; honor `A*` / `STR` rows in code reviews. |
| **Frontend Developer** | `fetch` paths + payloads; **WS** → [[SPEC_REALTIME.md]] + `WSP` subprotocol. |
| **UI specialist** | `error.code` → toasts; `JP` / `JMP` routes → upgrade affordances. |
| **Cloudflare specialist** | Pages Functions entry, KV-backed session check, R2 log pipeline hooks. |
| **API & middleware specialist** | **Lead** — legend, **middleware order**, envelopes, stream vs JSON bodies. |

---

> **Visual contract for public-facing routes:** The landing page (`/`), pricing (`/pricing`), login (`/login`, `/auth/callback`), and solutions (`/solutions/*`) routes back onto public-facing surfaces whose visual and interaction contract is specified in [`WEBSITE_DESIGN_SPEC.md`](../product/WEBSITE_DESIGN_SPEC.md) §2 (Surfaces in scope). API responses from these routes (auth tokens, session URLs, error codes) must conform to the error envelope above; the frontend rendering of those responses follows the design spec.

## 1. Auth — mount `/auth` — typical `functions/api/auth.routes.ts` or `auth.ts`

| M | Path | AuthZ | Ret | Notes |
|---|------|-------|-----|-------|
| POST | `/auth/request` | A | `{ok}` | Magic link request |
| GET | `/auth/verify?token=` | A | `{token,user,plan}` | OTT consume |
| GET | `/auth/me` | J | `{user,plan,hasPassword}` | |
| PATCH | `/auth/me` | J | `{user}` | |
| POST | `/auth/logout` | J | `{ok}` | |
| POST | `/auth/signup` | A | `{token,user}` | |
| POST | `/auth/login` | A | `{token,user}` | |
| POST | `/auth/password/set` | J | `{ok}` | OAuth users set password |
| POST | `/auth/password/reset` | A | `{ok}` | |
| POST | `/auth/password/confirm` | A | `{ok,token}` | OTT confirm |
| POST | `/auth/sso/init` | A | `{authorize_url}` | OAuth PKCE start |
| POST | `/auth/sso/exchange` | A | `{token,user}` | OAuth code exchange |
| GET | `/auth/sso/saml/login` | A | redirect | |
| POST | `/auth/sso/saml/acs` | A | redirect/set-cookie | Assertion |
| GET | `/auth/sso/saml/metadata` | A | XML | IdP config |

Details: [[SPEC_CORE.md#authentication]], [[SPEC_INTEGRATIONS.md#authentication-flows]]

---

## 2. Sessions — mount `/sessions` — typical `functions/api/routes/sessions-*.routes.ts`

| M | Path | AuthZ | Ret | Notes |
|---|------|-------|-----|-------|
| POST | `/sessions` | J | `{session}` | Create DRAFT |
| GET | `/sessions/:id` | JP | `{session}` | JWT + plan gate as deployed |
| PATCH | `/sessions/:id` | JO | `{session}` | DRAFT only |
| DELETE | `/sessions/:id` | JO | `{ok}` | |
| GET | `/sessions/:id/questions` | JO | `{questions}` | |
| POST | `/sessions/:id/questions` | JO | `{question}` | |
| PATCH | `/sessions/:id/questions/:qid` | JO | `{question}` | |
| DELETE | `/sessions/:id/questions/:qid` | JO | `{ok}` | |
| POST | `/sessions/:id/start` | JO | `{session,do_url}` | Init DO |
| POST | `/sessions/:id/close` | JO | `{session}` | |
| POST | `/sessions/:id/go-live` | JO | `{ok}` | Lobby→live |
| GET | `/sessions/by-code/:code` | A | `{session,do_url}` | Join code |
| GET | `/sessions/by-invite/:code` | A | `{session}` | Guest invite |
| POST | `/sessions/:id/invite/guest` | JO | `{invite_code}` | |
| GET | `/sessions/:id/ws` | **WSP\|WSV** | WS 101 | **GET** Upgrade; JSON text frames; team presenter permissions are resolved server-side and forwarded to `SessionRoom` — [[SPEC_REALTIME.md#websocket-protocol]] |
| GET | `/sessions/:id/results` | JOP | JSON | Presenter results |
| GET | `/sessions/:id/results/public` | A | JSON | Share token/link as implemented |
| POST | `/sessions/:id/export` | JO | xlsx | |
| GET | `/sessions/:id/export.csv` | JO | csv | |
| PATCH | `/sessions/:id/enable-async-poll` | JP | `{ok}` | Enterprise async |
| POST | `/sessions/:id/async-vote` | A | `{ok}` | Async vote; abuse controls in handler |
| POST | `/sessions/:id/ai-summary` | JO | `{summary}` | |

---

## 3. Decisions — mount `/` — typical `functions/api/routes/decisions.routes.ts`

### Public write contract — `POST /sessions/:id/decisions`

| Rule | Text |
|------|------|
| **AuthZ cell** | `A` = no JWT on wire **only if** handler enforces **session-scoped** authorization (e.g. live/async capability, join state, rate limits). |
| **If code requires JWT** | Treat AuthZ as **`J`** — **verify in route handler** before relying on this row. |
| **Threat** | Spam / forged decisions without session binding — **must** be mitigated in code (not repeated here). |

| M | Path | AuthZ | Ret | Notes |
|---|------|-------|-----|-------|
| POST | `/sessions/:id/decisions` | A* | `{decision}` | *See public write contract above |
| GET | `/sessions/:id/decisions` | J | `{decisions}` | Canonical list row (not duplicated under §2) |
| POST | `/sessions/:id/decisions/:decisionId/lock` | JO | `{decision}` | |
| GET | `/teams/:id/decisions` | JM | `{decisions}` | Paginated |
| GET | `/teams/:id/decisions/search` | JM | `{decisions}` | FTS |
| GET | `/teams/:id/decisions/semantic-search` | JMP | `{decisions}` | Vectorize |
| POST | `/sessions/:id/decisions/:decisionId/actions` | J | `{action}` | |
| GET | `/sessions/:id/decisions/:decisionId/actions` | J | `{actions}` | |
| PATCH | `/sessions/:id/decisions/:decisionId/actions/:actionId` | J | `{action}` | |
| POST | `/decisions/bulk-tag` | J | `{ok}` | |

---

## 4. AI — mount `/ai` — typical `functions/api/routes/ai.routes.ts`

| M | Path | AuthZ | Ret | Notes |
|---|------|-------|-----|-------|
| POST | `/ai/suggest-questions` | JP | stream | |
| GET | `/ai/settings` | J | JSON | |
| PATCH | `/ai/settings` | J | JSON | |
| POST | `/ai/questions/suggest` | J | `{suggestions}` | |
| POST | `/ai/slides/recommend` | J | `{recommendations}` | |
| POST | `/ai/rephrase` | J | `{rephrased}` | |
| POST | `/ai/creator` | J | stream | |
| POST | `/ai/generate-answers` | J | `{answers}` | |
| POST | `/ai/generate-trivia` | J | `{trivia}` | |

Limits: [[SPEC_INTEGRATIONS.md#rate-limiting]], [[SPEC_CORE.md#critical-constraints-hard-rules]]

---

## 5. Teams — mount `/teams` (+ `/team/accept`) — typical `functions/api/routes/teams.routes.ts`

| M | Path | AuthZ | Ret | Notes |
|---|------|-------|-----|-------|
| POST | `/teams` | J | `{team}` | |
| GET | `/teams` | J | `{teams}` | |
| GET | `/teams/:id` | JM | `{team}` | |
| PATCH | `/teams/:id` | JO | `{team}` | Team owner |
| POST | `/teams/:id/invite` | JO | `{invite_token}` | |
| GET | `/teams/:id/members` | JM | `{members}` | |
| DELETE | `/teams/:id/members/:userId` | JO | `{ok}` | |
| GET | `/team/accept` | J | `{team}` | Invite accept (path typo-tolerant mount) |
| POST | `/teams/:id/session-roles` | JO | `{ok}` | |
| GET | `/teams/:id/sessions` | JM | `{sessions}` | |

---

## 6. Templates — mount `/templates` — typical `functions/api/routes/templates.routes.ts`

| M | Path | AuthZ | Ret | Notes |
|---|------|-------|-----|-------|
| POST | `/templates` | J | `{template}` | |
| GET | `/templates` | J | `{templates}` | |
| GET | `/templates/:id` | J | `{template}` | |
| PATCH | `/templates/:id` | JO | `{template}` | Owner |
| DELETE | `/templates/:id` | JO | `{ok}` | |
| POST | `/templates/:id/branding` | JO | `{template}` | |
| GET | `/templates/system` | A | `{templates}` | Built-in |

---

## 7. Admin — mount `/admin` — typical `functions/api/routes/admin-*.routes.ts`

**Sensitive**: `/admin/bootstrap` (first-run), `/admin/stream-ticket`, `/admin/ops/summary` — require **ADM** + treat as **high risk**; enforce extra controls in code (audit, rate limits).

| M | Path | AuthZ | Ret | Notes |
|---|------|-------|-----|-------|
| GET | `/admin/me` | ADM | `{admin}` | |
| POST | `/admin/bootstrap` | A | `{ok}` | First super_admin only; lock down after |
| GET | `/admin/users` | ADM | `{users}` | |
| GET | `/admin/users/:id` | ADM | `{user}` | |
| POST | `/admin/users` | ADM | `{user}` | |
| PATCH | `/admin/users/:id` | ADM | `{user}` | |
| POST | `/admin/users/:id/suspend` | ADM | `{ok}` | |
| POST | `/admin/users/:id/restore` | ADM | `{ok}` | |
| POST | `/admin/roles` | ADM | `{ok}` | |
| DELETE | `/admin/roles/:userId` | ADM | `{ok}` | |
| GET | `/admin/kpis` | ADM | `{kpis}` | |
| GET | `/admin/stats` | ADM | `{stats}` | |
| GET | `/admin/metrics` | ADM | `{metrics}` | |
| GET | `/admin/analytics` | ADM | `{analytics}` | Includes sanitized engagement counters for LIVE energizers and badge breakdown |
| GET | `/admin/health` | ADM | `{services}` | |
| GET | `/admin/audit` | ADM | `{logs}` | |
| GET | `/admin/audit-logs` | ADM | `{logs}` | |
| GET | `/admin/issues` | ADM | `{issues}` | |
| POST | `/admin/issues/report` | J | `{issue}` | |
| GET | `/admin/alerts` | ADM | `{alerts}` | |
| GET | `/admin/alert-rules` | ADM | `{rules}` | |
| POST | `/admin/alert-rules` | ADM | `{rule}` | |
| PUT | `/admin/alert-rules/:id` | ADM | `{rule}` | |
| DELETE | `/admin/alert-rules/:id` | ADM | `{ok}` | |
| GET | `/admin/ops/summary` | ADM | stream | |
| POST | `/admin/stream-ticket` | ADM | `{ticket}` | |
| GET | `/admin/runbooks` | ADM | `{runbooks}` | |
| GET | `/admin/runbooks/:category` | ADM | `{runbook}` | |
| PUT | `/admin/runbooks/:category` | ADM | `{runbook}` | |
| DELETE | `/admin/runbooks/:category` | ADM | `{ok}` | |

---

### Admin engagement analytics

`GET /admin/analytics` includes an `engagement` block used by the admin dashboard and CSV export:

- `energizer_activations`
- `energizer_participants`
- `energizer_completions`
- `energizer_dropouts`
- `leaderboard_participants`
- `badges_awarded`
- `ws_error_rate`
- `reconnect_rate`

The endpoint counts sanitized realtime audit labels, including `ws.energizer_activated`, `ws.energizer_activation_denied`, `ws.energizer_answered`, `ws.energizer_advanced`, and `ws.energizer_completed`. It must not expose prompt text, answer values, emails, bearer tokens, SAML material, Stripe identifiers, or magic links.

---

## 8. Integrations — mount `/integrations` — typical `functions/api/routes/integrations.routes.ts`

| M | Path | AuthZ | Ret | Notes |
|---|------|-------|-----|-------|
| POST | `/integrations/powerpoint/embed` | JP | `{slide_url}` | |
| POST | `/integrations/powerpoint/duplicate` | J | `{slide}` | |
| PATCH | `/integrations/powerpoint/slides/:slideId` | J | `{slide}` | |
| GET | `/integrations/:provider/authorize` | J | redirect | OAuth start |
| GET | `/integrations/:provider/callback` | A | redirect | **State/PKCE** verified server-side — [[SPEC_INTEGRATIONS.md#authentication-flows]] |
| POST | `/integrations/slack/disconnect` | J | `{ok}` | |
| POST | `/integrations/slack/send` | J | `{ok}` | |
| POST | `/integrations/:provider/share` | JO | `{ok}` | Teams/Zoom/Webex/Hopin |

---

## 9. Billing — mount `/billing` — typical `functions/api/routes/billing.routes.ts`

| M | Path | AuthZ | Ret | Notes |
|---|------|-------|-----|-------|
| POST | `/billing/checkout` | J | `{session_url}` | Stripe Checkout |
| POST | `/billing/portal` | J | `{portal_url}` | |
| GET | `/billing/plan` | J | `{plan}` | |
| GET | `/billing/status` | J | `{plan,usage}` | |
| POST | `/billing/webhook/stripe` | STR | `{received}` | Idempotent — [[SPEC_INTEGRATIONS.md#webhook-handler-idempotent]] |
| GET | `/billing/referral` | J | `{code,stats}` | |
| POST | `/billing/referral/apply` | A | `{ok}` | **Abuse**: rate limit / validation in handler — verify code |

---

## 10. Collaboration — mount `/` — typical `functions/api/routes/collaboration.routes.ts`

| M | Path | AuthZ | Ret | Notes |
|---|------|-------|-----|-------|
| GET | `/workspaces/:id/collaborators` | J | `{collaborators}` | |
| PUT | `/workspaces/:id/collaborators` | J | `{ok}` | |
| POST | `/workspaces/:id/collaborators/invite` | J | `{invite_token}` | |
| POST | `/workspaces/:id/collaborators/invites/:token/accept` | J | `{ok}` | |
| GET | `/sessions/:id/collaborators` | J | `{collaborators}` | |
| PUT | `/sessions/:id/collaborators` | JO | `{ok}` | |
| POST | `/sessions/:id/collaborators/invite` | JO | `{invite_token}` | |
| GET | `/notifications` | J | `{notifications}` | |
| POST | `/notifications/:id/read` | J | `{ok}` | |

---

## 11. Misc — mount `/` — typical `functions/api/routes/misc.routes.ts`

| M | Path | AuthZ | Ret | Notes |
|---|------|-------|-----|-------|
| POST | `/mcp/token` | J | `{token,expires}` | |
| DELETE | `/mcp/token/:token` | J | `{ok}` | |
| GET | `/sessions/:id/report` | J | HTML | |
| GET | `/me/data` | J | JSON | GDPR export |
| POST | `/contact` | A | `{ok}` | Enterprise contact |
| GET | `/dev/seed` | DEV | `{ok}` | Never prod |

---

## Middleware stack (order)

Executed in **`functions/api/[[route]].ts`** (or current router entry — search repo for `Hono` + middleware registration).

1. CORS — `OPTIONS` early exit  
2. Trace ID → `c.set('traceId', uuid)`  
3. Security headers — skip WebSocket 101  
4. Global error boundary  
5. IP rate limit — **numeric values are targets; verify in middleware implementation** (search `rate`, `ARCH-001`)  
6. `extractToken` — Bearer → `c.set('user')`  
7. `validateSession` — `USERS_KV` / TTL  
8. Plan rate limit — **verify constants in code** (`ARCH-022`)  
9. Structured logging — R2 / console  
10. Route handlers  

**`onError` (illustrative pseudocode only)** — production maps **typed** errors / stable codes, not `err.message` keys:

```typescript
// ILLUSTRATIVE — do not copy verbatim
app.onError((err, c) => c.json({
  error: {
    code: mapErrorToCode(err), // typed / HTTPException / Zod
    message: err.message,
    statusCode: err.status ?? 500,
    requestId: c.get('traceId'),
    timestamp: Date.now(),
  },
}, err.status ?? 500))
```

---

## Service layer

Typical paths (if your checkout differs, **search by symbol**):

| Svc | Path | Role |
|-----|------|------|
| sessionLifecycle | `functions/api/services/sessionLifecycle.ts` | DRAFT + DO init |
| sessionOrchestration | `functions/api/services/sessionOrchestration.ts` | LIVE sync |
| session-start | `functions/api/services/session-start.ts` | Transitions |
| auth | `functions/api/auth.ts` | JWT, OAuth |
| billing | `functions/api/billing.ts` | Plans |
| stripe | `functions/api/stripe.ts` | Stripe client |
| ai | `functions/api/ai.ts` | Workers AI |
| db | `functions/api/db.ts` | D1 helpers |
| kv | `functions/api/kv.ts` | KV helpers |
| observability | `functions/api/observability.ts` | Logs/trace |
| decisions | `functions/api/services/decisions.ts` | Decisions + tags |

---

## Validation (Zod) — example aligned with [[SPEC_DATAMODEL.md]]

`teamId` is an **opaque string** (D1 `TEXT`); not necessarily UUID.

```typescript
const CreateSessionSchema = z.object({
  title: z.string().min(3).max(200),
  teamId: z.string().min(2).max(128),
  anonymityMode: z.enum(['none', 'partial', 'full']).optional(),
  timerDefault: z.number().min(10).max(300).optional(),
})
```

---

## D1 access pattern

```typescript
await c.env.DB.prepare('SELECT * FROM sessions WHERE id = ?').bind(id).first()
await c.env.DB.prepare('INSERT INTO decisions (id,session_id,selected_option) VALUES (?,?,?)')
  .bind(decisionId, sessionId, option).run()
```

---

## Examples

**Create session (REST)**

```http
POST /api/sessions
Authorization: Bearer <jwt>
Content-Type: application/json

{"title":"Q1 Planning","teamId":"team_xyz","anonymityMode":"full","timerDefault":60}
```

→ `201` `{ "data": { "id":"sess_abc123","code":"1234","status":"draft","createdAt":1712000000000 } }`

**Live vote (WebSocket)**

1. Client: **`GET wss://host/api/sessions/:id/ws`** with Upgrade headers; presenter adds `Sec-WebSocket-Protocol: qesto.bearer.<jwt>`. For team sessions, the route resolves effective permissions before forwarding to `SessionRoom`.
2. After open: send JSON text frames per [[SPEC_REALTIME.md#websocket-messages]].

```json
{"type":"vote","data":{"questionId":"q1","selectedIndex":2},"timestamp":1712000000000}
```

Server may broadcast:

```json
{"type":"results","data":{"results":{"0":5,"1":3,"2":8},"total":16},"timestamp":1712000000100}
```

---

## Error codes (common)

| Code | HTTP | Retry? |
|------|------|--------|
| UNAUTHORIZED | 401 | No |
| FORBIDDEN | 403 | No |
| NOT_FOUND | 404 | No |
| CONFLICT | 409 | No |
| UNPROCESSABLE | 422 | No |
| RATE_LIMIT | 429 | Yes backoff |
| INTERNAL_ERROR | 500 | Yes backoff |
| SERVICE_UNAVAILABLE | 503 | Yes backoff |

Full semantics: [[SPEC_CORE.md#error-handling-strategy]]

---

## Related

- [[SPEC_CORE.md]] — architecture, auth overview, constraints  
- [[SPEC_DATAMODEL.md]] — schema, KV keys  
- [[SPEC_REALTIME.md]] — WS messages, DO  
- [[SPEC_INTEGRATIONS.md]] — Stripe, OAuth, AI  
- [[SPEC_DEPLOYMENT.md]] — secrets, CI, `wrangler`  

Sibling specs each end with an **AI usage recipe** + checklist — same pattern as this file.

---

## AI usage recipe (copy)

1. “Implement route X: open **SPEC_BACKEND §N table row** + **AuthZ legend**.”  
2. “LIVE voting: ignore REST for mutations; use **§Examples WebSocket** + **SPEC_REALTIME**.”  
3. “Public `A` rows: read **Public write contract** + confirm handler in repo.”  
4. “Middleware order: **§Middleware stack**; numbers: **verify in code**.”  
5. “Responses: **Contract header → Response envelope**.”  

**Checklist before trusting this file:** Zod matches examples • no duplicate paths • `GET` Upgrade for WS • `A` write rows have contract text • rate limits verified in code.
