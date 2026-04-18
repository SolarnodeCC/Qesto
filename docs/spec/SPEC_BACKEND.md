# SPEC_BACKEND — API Routes, Services, Middleware

## Overview
Qesto backend is **Hono on Cloudflare Pages Functions**. All routes mounted at `/api/[[route]].ts`. 80+ endpoints organized by domain (auth, sessions, decisions, admin, etc.). Middleware stack handles auth, rate limiting, error handling, logging.

---

## Endpoint Directory (80+ Routes)

### 1. Authentication Routes (12 endpoints)
**Mount**: `/auth` | **File**: `functions/api/auth.routes.ts`

| Method | Path | Protected | Response | Purpose |
|--------|------|-----------|----------|---------|
| `POST` | `/auth/request` | No | `{ok: bool}` | Request magic link |
| `GET` | `/auth/verify?token=X` | No | `{token, user, plan}` | Magic link callback |
| `GET` | `/auth/me` | **JWT** | `{user, plan, hasPassword}` | Current user + plan |
| `PATCH` | `/auth/me` | **JWT** | `{user}` | Update name/language |
| `POST` | `/auth/logout` | **JWT** | `{ok}` | Logout (revoke token) |
| `POST` | `/auth/signup` | No | `{token, user}` | Password signup |
| `POST` | `/auth/login` | No | `{token, user}` | Password login |
| `POST` | `/auth/password/set` | **JWT** | `{ok}` | Set password (for OAuth users) |
| `POST` | `/auth/password/reset` | No | `{ok}` | Request password reset |
| `POST` | `/auth/password/confirm` | No | `{ok, token}` | Confirm reset via OTT |
| `POST` | `/auth/sso/init` | No | `{authorize_url}` | OAuth start (Microsoft, Google) |
| `POST` | `/auth/sso/exchange` | No | `{token, user}` | OAuth code → token |
| `GET` | `/auth/sso/saml/login` | No | — | SAML login redirect |
| `POST` | `/auth/sso/saml/acs` | No | — | SAML assertion consumer |
| `GET` | `/auth/sso/saml/metadata` | No | XML | SAML metadata |

---

### 2. Sessions Routes (25+ endpoints)
**Mount**: `/sessions` | **Files**: `functions/api/routes/sessions-*.routes.ts`

#### CRUD Operations
| Method | Path | Protected | Response | Purpose |
|--------|------|-----------|----------|---------|
| `POST` | `/sessions` | **JWT** | `{session}` | Create draft session |
| `GET` | `/sessions/:id` | **JWT+plan** | `{session}` | Get session metadata |
| `PATCH` | `/sessions/:id` | **JWT+owner** | `{session}` | Update session (DRAFT only) |
| `DELETE` | `/sessions/:id` | **JWT+owner** | `{ok}` | Delete session |

#### Questions (DRAFT API)
| Method | Path | Protected | Response | Purpose |
|--------|------|-----------|----------|---------|
| `GET` | `/sessions/:id/questions` | **JWT+owner** | `{questions: []}` | List questions |
| `POST` | `/sessions/:id/questions` | **JWT+owner** | `{question}` | Add question |
| `PATCH` | `/sessions/:id/questions/:qid` | **JWT+owner** | `{question}` | Update question |
| `DELETE` | `/sessions/:id/questions/:qid` | **JWT+owner** | `{ok}` | Delete question |

#### Session Lifecycle
| Method | Path | Protected | Response | Purpose |
|--------|------|-----------|----------|---------|
| `POST` | `/sessions/:id/start` | **JWT+owner** | `{session, do_url}` | Draft → Live (init DO) |
| `POST` | `/sessions/:id/close` | **JWT+owner** | `{session}` | Live → Closed |
| `POST` | `/sessions/:id/go-live` | **JWT+owner** | `{ok}` | Lobby → Live |

#### Join & Public Access
| Method | Path | Protected | Response | Purpose |
|--------|------|-----------|----------|---------|
| `GET` | `/sessions/by-code/:code` | No | `{session, do_url}` | Lookup by 4-digit code |
| `GET` | `/sessions/by-invite/:code` | No | `{session}` | Lookup by guest invite |
| `POST` | `/sessions/:id/invite/guest` | **JWT+owner** | `{invite_code}` | Create guest invite |
| `GET` | `/sessions/:id/ws` | No | WebSocket | Upgrade to DO WebSocket |

#### Results & Export
| Method | Path | Protected | Response | Purpose |
|--------|------|-----------|----------|---------|
| `GET` | `/sessions/:id/results` | **JWT+owner+presenter** | JSON | Results for presenter |
| `GET` | `/sessions/:id/results/public` | No | JSON | Shareable results |
| `POST` | `/sessions/:id/export` | **JWT+owner** | Excel file | Download results |
| `GET` | `/sessions/:id/export.csv` | **JWT+owner** | CSV file | CSV export |

#### Async Voting (Enterprise feature)
| Method | Path | Protected | Response | Purpose |
|--------|------|-----------|----------|---------|
| `PATCH` | `/sessions/:id/enable-async-poll` | **JWT+plan** | `{ok}` | Enable async voting |
| `POST` | `/sessions/:id/async-vote` | No | `{ok}` | Record async vote |

#### AI & Analytics
| Method | Path | Protected | Response | Purpose |
|--------|------|-----------|----------|---------|
| `POST` | `/sessions/:id/ai-summary` | **JWT+owner** | `{summary}` | Generate AI recap |
| `GET` | `/sessions/:id/decisions` | **JWT** | `{decisions: []}` | List session decisions |

---

### 3. Decisions Routes (8+ endpoints)
**Mount**: `/` | **File**: `functions/api/routes/decisions.routes.ts`

| Method | Path | Protected | Response | Purpose |
|--------|------|-----------|----------|---------|
| `POST` | `/sessions/:id/decisions` | No | `{decision}` | Record decision |
| `GET` | `/sessions/:id/decisions` | **JWT** | `{decisions: []}` | List session decisions |
| `POST` | `/sessions/:id/decisions/:decisionId/lock` | **JWT+owner** | `{decision}` | Lock decision |
| `GET` | `/teams/:id/decisions` | **JWT+member** | `{decisions: []}` | Paginated team decisions |
| `GET` | `/teams/:id/decisions/search` | **JWT+member** | `{decisions: []}` | Full-text search |
| `GET` | `/teams/:id/decisions/semantic-search` | **JWT+member+plan** | `{decisions: []}` | Vector search (Vectorize) |
| `POST` | `/sessions/:id/decisions/:decisionId/actions` | **JWT** | `{action}` | Add action item |
| `GET` | `/sessions/:id/decisions/:decisionId/actions` | **JWT** | `{actions: []}` | List actions |
| `PATCH` | `/sessions/:id/decisions/:decisionId/actions/:actionId` | **JWT** | `{action}` | Update action |
| `POST` | `/decisions/bulk-tag` | **JWT** | `{ok}` | Tag multiple decisions |

---

### 4. AI Routes (9+ endpoints)
**Mount**: `/ai` | **File**: `functions/api/routes/ai.routes.ts`

| Method | Path | Protected | Response | Purpose |
|--------|------|-----------|----------|---------|
| `POST` | `/ai/suggest-questions` | **JWT+plan** | Stream | Generate questions (LLM) |
| `GET` | `/ai/settings` | **JWT** | JSON | AI settings |
| `PATCH` | `/ai/settings` | **JWT** | JSON | Update AI settings |
| `POST` | `/ai/questions/suggest` | **JWT** | `{suggestions: []}` | Suggest questions |
| `POST` | `/ai/slides/recommend` | **JWT** | `{recommendations: []}` | Recommend slide types |
| `POST` | `/ai/rephrase` | **JWT** | `{rephrased}` | Improve question wording |
| `POST` | `/ai/creator` | **JWT** | Stream | Build session from chat |
| `POST` | `/ai/generate-answers` | **JWT** | `{answers: []}` | Generate answer options |
| `POST` | `/ai/generate-trivia` | **JWT** | `{trivia: []}` | Generate trivia questions |

---

### 5. Teams Routes (10 endpoints)
**Mount**: `/teams` | **File**: `functions/api/routes/teams.routes.ts`

| Method | Path | Protected | Response | Purpose |
|--------|------|-----------|----------|---------|
| `POST` | `/teams` | **JWT** | `{team}` | Create team |
| `GET` | `/teams` | **JWT** | `{teams: []}` | List user's teams |
| `GET` | `/teams/:id` | **JWT+member** | `{team}` | Get team details |
| `PATCH` | `/teams/:id` | **JWT+owner** | `{team}` | Update team |
| `POST` | `/teams/:id/invite` | **JWT+owner** | `{invite_token}` | Send team invite |
| `GET` | `/teams/:id/members` | **JWT+member** | `{members: []}` | List members |
| `DELETE` | `/teams/:id/members/:userId` | **JWT+owner** | `{ok}` | Remove member |
| `GET` | `/team/accept` | **JWT** | `{team}` | Accept team invite |
| `POST` | `/teams/:id/session-roles` | **JWT+owner** | `{ok}` | Assign session roles |
| `GET` | `/teams/:id/sessions` | **JWT+member** | `{sessions: []}` | List team sessions |

---

### 6. Templates Routes (7 endpoints)
**Mount**: `/templates` | **File**: `functions/api/routes/templates.routes.ts`

| Method | Path | Protected | Response | Purpose |
|--------|------|-----------|----------|---------|
| `POST` | `/templates` | **JWT** | `{template}` | Create template |
| `GET` | `/templates` | **JWT** | `{templates: []}` | List user's templates |
| `GET` | `/templates/:id` | **JWT** | `{template}` | Get template |
| `PATCH` | `/templates/:id` | **JWT+owner** | `{template}` | Update template |
| `DELETE` | `/templates/:id` | **JWT+owner** | `{ok}` | Delete template |
| `POST` | `/templates/:id/branding` | **JWT+owner** | `{template}` | Update branding |
| `GET` | `/templates/system` | No | `{templates: []}` | Get built-in templates |

---

### 7. Admin Routes (30+ endpoints)
**Mount**: `/admin` | **Files**: `functions/api/routes/admin-*.routes.ts`

#### Users Management
| Method | Path | Protected | Response | Purpose |
|--------|------|-----------|----------|---------|
| `GET` | `/admin/me` | **Admin** | `{admin}` | Current admin info |
| `POST` | `/admin/bootstrap` | No (first time) | `{ok}` | Create first super_admin |
| `GET` | `/admin/users` | **Admin** | `{users: []}` | List users |
| `GET` | `/admin/users/:id` | **Admin** | `{user}` | User details |
| `POST` | `/admin/users` | **Admin** | `{user}` | Create user |
| `PATCH` | `/admin/users/:id` | **Admin** | `{user}` | Update user |
| `POST` | `/admin/users/:id/suspend` | **Admin** | `{ok}` | Suspend account |
| `POST` | `/admin/users/:id/restore` | **Admin** | `{ok}` | Restore account |
| `POST` | `/admin/roles` | **Admin** | `{ok}` | Assign role |
| `DELETE` | `/admin/roles/:userId` | **Admin** | `{ok}` | Revoke role |

#### Analytics & Monitoring
| Method | Path | Protected | Response | Purpose |
|--------|------|-----------|----------|---------|
| `GET` | `/admin/kpis` | **Admin** | `{kpis}` | KPIs (active users, ARPU) |
| `GET` | `/admin/stats` | **Admin** | `{stats}` | System statistics |
| `GET` | `/admin/metrics` | **Admin** | `{metrics}` | Detailed metrics |
| `GET` | `/admin/health` | **Admin** | `{services: []}` | Health check |

#### Audit & Compliance
| Method | Path | Protected | Response | Purpose |
|--------|------|-----------|----------|---------|
| `GET` | `/admin/audit` | **Admin** | `{logs: []}` | Audit log |
| `GET` | `/admin/audit-logs` | **Admin** | `{logs: []}` | Filtered audit log |

#### Issues & Alerts
| Method | Path | Protected | Response | Purpose |
|--------|------|-----------|----------|---------|
| `GET` | `/admin/issues` | **Admin** | `{issues: []}` | Error tracking |
| `POST` | `/admin/issues/report` | **JWT** | `{issue}` | Report issue |
| `GET` | `/admin/alerts` | **Admin** | `{alerts: []}` | Active alerts |
| `GET` | `/admin/alert-rules` | **Admin** | `{rules: []}` | Alert rules |
| `POST` | `/admin/alert-rules` | **Admin** | `{rule}` | Create rule |
| `PUT` | `/admin/alert-rules/:id` | **Admin** | `{rule}` | Update rule |
| `DELETE` | `/admin/alert-rules/:id` | **Admin** | `{ok}` | Delete rule |

#### Operations
| Method | Path | Protected | Response | Purpose |
|--------|------|-----------|----------|---------|
| `GET` | `/admin/ops/summary` | **Admin** | Stream | Live ops summary |
| `POST` | `/admin/stream-ticket` | **Admin** | `{ticket}` | Create live stream ticket |

#### Runbooks
| Method | Path | Protected | Response | Purpose |
|--------|------|-----------|----------|---------|
| `GET` | `/admin/runbooks` | **Admin** | `{runbooks: []}` | List runbooks |
| `GET` | `/admin/runbooks/:category` | **Admin** | `{runbook}` | Get runbook |
| `PUT` | `/admin/runbooks/:category` | **Admin** | `{runbook}` | Update runbook |
| `DELETE` | `/admin/runbooks/:category` | **Admin** | `{ok}` | Delete runbook |

---

### 8. Integrations Routes (15+ endpoints)
**Mount**: `/integrations` | **File**: `functions/api/routes/integrations.routes.ts`

| Method | Path | Protected | Response | Purpose |
|--------|------|-----------|----------|---------|
| `POST` | `/integrations/powerpoint/embed` | **JWT+plan** | `{slide_url}` | Embed PowerPoint |
| `POST` | `/integrations/powerpoint/duplicate` | **JWT** | `{slide}` | Duplicate slide |
| `PATCH` | `/integrations/powerpoint/slides/:slideId` | **JWT** | `{slide}` | Update slide |
| `GET` | `/integrations/:provider/authorize` | **JWT** | — | OAuth authorize (Slack, Teams, etc.) |
| `GET` | `/integrations/:provider/callback` | No | — | OAuth callback |
| `POST` | `/integrations/slack/disconnect` | **JWT** | `{ok}` | Disconnect Slack |
| `POST` | `/integrations/slack/send` | **JWT** | `{ok}` | Send Slack message |
| `POST` | `/integrations/:provider/share` | **JWT+owner** | `{ok}` | Share to Teams/Zoom/Webex/Hopin |

---

### 9. Billing Routes (7 endpoints)
**Mount**: `/billing` | **File**: `functions/api/routes/billing.routes.ts`

| Method | Path | Protected | Response | Purpose |
|--------|------|-----------|----------|---------|
| `POST` | `/billing/checkout` | **JWT** | `{session_url}` | Create Stripe checkout |
| `POST` | `/billing/portal` | **JWT** | `{portal_url}` | Stripe customer portal |
| `GET` | `/billing/plan` | **JWT** | `{plan}` | User's current plan |
| `GET` | `/billing/status` | **JWT** | `{plan, usage}` | Plan + usage limits |
| `POST` | `/billing/webhook/stripe` | No (Stripe) | `{received}` | Stripe webhook |
| `GET` | `/billing/referral` | **JWT** | `{code, stats}` | Referral code + stats |
| `POST` | `/billing/referral/apply` | No | `{ok}` | Apply referral code |

---

### 10. Collaboration Routes (12+ endpoints)
**Mount**: `/` | **File**: `functions/api/routes/collaboration.routes.ts`

| Method | Path | Protected | Response | Purpose |
|--------|------|-----------|----------|---------|
| `GET` | `/workspaces/:id/collaborators` | **JWT** | `{collaborators: []}` | List workspace members |
| `PUT` | `/workspaces/:id/collaborators` | **JWT** | `{ok}` | Set collaborators |
| `POST` | `/workspaces/:id/collaborators/invite` | **JWT** | `{invite_token}` | Invite collaborators |
| `POST` | `/workspaces/:id/collaborators/invites/:token/accept` | **JWT** | `{ok}` | Accept invite |
| `GET` | `/sessions/:id/collaborators` | **JWT** | `{collaborators: []}` | List session collaborators |
| `PUT` | `/sessions/:id/collaborators` | **JWT+owner** | `{ok}` | Update collaborators |
| `POST` | `/sessions/:id/collaborators/invite` | **JWT+owner** | `{invite_token}` | Invite collaborators |
| `GET` | `/notifications` | **JWT** | `{notifications: []}` | List notifications |
| `POST` | `/notifications/:id/read` | **JWT** | `{ok}` | Mark as read |

---

### 11. Miscellaneous Routes (8+ endpoints)
**Mount**: `/` | **File**: `functions/api/routes/misc.routes.ts`

| Method | Path | Protected | Response | Purpose |
|--------|------|-----------|----------|---------|
| `POST` | `/mcp/token` | **JWT** | `{token, expires}` | Create MCP API token |
| `DELETE` | `/mcp/token/:token` | **JWT** | `{ok}` | Revoke MCP token |
| `GET` | `/sessions/:id/report` | **JWT** | HTML | Session report (HTML) |
| `GET` | `/me/data` | **JWT** | JSON | Export user data (GDPR) |
| `POST` | `/contact` | No | `{ok}` | Enterprise contact form |
| `GET` | `/dev/seed` | Dev only | `{ok}` | Seed dev database |

---

## Middleware Stack

**Execution Order** (in `functions/api/[[route]].ts`):

```
1. CORS Header Check (if OPTIONS, return early)
2. Trace ID Correlation (OBS-001)
   └─ Set c.set('traceId', uuid)
   
3. Security Headers (skip WebSocket 101)
   └─ CSP, HSTS, X-Frame-Options, etc.
   
4. Global Error Handler (errorHandlerMiddleware)
   └─ Catch errors from downstream, return JSON
   
5. IP-Based Rate Limit (ARCH-001)
   └─ 30 req/60s anonymous, 10 req/60s auth endpoints
   
6. Auth Extraction (extractToken)
   └─ Bearer JWT from Authorization header → c.set('user')
   
7. Session Validation (validateSession)
   └─ Lookup token in USERS_KV, check TTL
   
8. Per-Plan Rate Limit (ARCH-022)
   └─ Free: 60 req/60s, Pro: 300 req/60s
   
9. Structured Logging (ARCH-020)
   └─ JSON log to R2 bucket + console
   
10. Route Handlers (individual endpoint logic)
```

**Error Handling Middleware**:
```typescript
app.onError((err, c) => {
  const traceId = c.get('traceId')
  const statusCode = err.status || 500
  const code = errorCodeMap[err.message] || 'INTERNAL_ERROR'
  
  return c.json({
    error: {
      code,
      message: err.message,
      statusCode,
      requestId: traceId,
      timestamp: Date.now(),
    },
  }, statusCode)
})
```

---

## Service Layer

Services handle business logic, separate from routes:

| Service | File | Purpose |
|---------|------|---------|
| `sessionLifecycle` | `functions/api/services/sessionLifecycle.ts` | Draft state management, DO init |
| `sessionOrchestration` | `functions/api/services/sessionOrchestration.ts` | Live session state sync |
| `session-start` | `functions/api/services/session-start.ts` | Transition orchestration |
| `auth` | `functions/api/auth.ts` | JWT signing, OAuth flows |
| `billing` | `functions/api/billing.ts` | Plan enforcement, usage tracking |
| `stripe` | `functions/api/stripe.ts` | Stripe API client |
| `ai` | `functions/api/ai.ts` | Workers AI gateway |
| `db` | `functions/api/db.ts` | D1 query helpers |
| `kv` | `functions/api/kv.ts` | KV operations (bulk, TTL) |
| `observability` | `functions/api/observability.ts` | Tracing, logging |
| `decisions` | `functions/api/services/decisions.ts` | Decision logic, tagging |

---

## Standard Response Format

**Success**:
```json
{
  "data": {...},
  "meta": {
    "timestamp": 1712000000000,
    "requestId": "uuid-here"
  }
}
```

**Error**:
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Session not found",
    "statusCode": 404,
    "requestId": "uuid-here",
    "timestamp": 1712000000000
  }
}
```

---

## Error Codes

| Code | Status | Meaning | Retry? |
|------|--------|---------|--------|
| `UNAUTHORIZED` | 401 | Missing/expired JWT | No |
| `FORBIDDEN` | 403 | User lacks permission | No |
| `NOT_FOUND` | 404 | Resource doesn't exist | No |
| `CONFLICT` | 409 | State violation (e.g., REST during LIVE) | No |
| `UNPROCESSABLE` | 422 | Invalid input (Zod) | No |
| `RATE_LIMIT` | 429 | Too many requests | **Yes** (with backoff) |
| `INTERNAL_ERROR` | 500 | Unexpected error | **Yes** (with backoff) |
| `SERVICE_UNAVAILABLE` | 503 | Dependency down | **Yes** (with backoff) |

---

## Validation Patterns

All input validated with **Zod** before handler logic:

```typescript
const CreateSessionSchema = z.object({
  title: z.string().min(3).max(200),
  teamId: z.string().uuid(),
  anonymityMode: z.enum(['none', 'partial', 'full']).optional(),
  timerDefault: z.number().min(10).max(300).optional(),
})

app.post('/sessions', async (c) => {
  const body = await c.req.json()
  const validated = CreateSessionSchema.parse(body)  // Throws if invalid
  // ...
})
```

---

## Database Operations

**D1 Query Pattern**:
```typescript
// Safe queries with parameters (prevent SQL injection)
const session = await c.env.DB.prepare(
  'SELECT * FROM sessions WHERE id = ? AND team_id = ?'
).bind(sessionId, teamId).first()

// Bulk insert
await c.env.DB.prepare(`
  INSERT INTO decisions (id, session_id, selected_option)
  VALUES (?, ?, ?)
`).bind(decisionId, sessionId, option).run()
```

---

## Request/Response Examples

### Create Session
```bash
POST /api/sessions
Authorization: Bearer ${JWT}
Content-Type: application/json

{
  "title": "Q1 Planning",
  "teamId": "team_xyz",
  "anonymityMode": "full",
  "timerDefault": 60
}

Response 201:
{
  "data": {
    "id": "sess_abc123",
    "code": "1234",
    "status": "draft",
    "createdAt": 1712000000000
  }
}
```

### Vote (during LIVE session)
```bash
POST /api/sessions/sess_abc123/ws (WebSocket upgrade)

// After connection
{
  "type": "vote",
  "data": {"questionId": "q1", "selectedIndex": 2},
  "timestamp": 1712000000000
}

Response from server:
{
  "type": "results",
  "data": {"results": {"0": 5, "1": 3, "2": 8}, "total": 16},
  "timestamp": 1712000000100
}
```

---

## Related References

- [[SPEC_CORE.md#authentication]] — Auth flow details
- [[SPEC_DATAMODEL.md]] — Database schema
- [[SPEC_REALTIME.md]] — WebSocket protocol
- [[SPEC_INTEGRATIONS.md]] — Stripe, AI, OAuth details
