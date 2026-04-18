# SPEC_CORE — System Architecture & Design

## Overview
Qesto is a real-time interactive session platform (Mentimeter-style) built on Cloudflare Workers, D1, and Durable Objects. Teams create question-driven sessions with AI-powered insights. **Core insight**: Stateless DRAFT API → stateful LIVE WebSocket via Durable Objects.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Browser (React + Vite)                       │
│  Home │ Login │ Dashboard │ Present │ Vote │ Admin │ Results  │
└──────────┬────────────┬────────────┬──────────────────────────┘
           │            │            │
        HTTP API      HTTP API    WebSocket
           │            │            │
┌──────────▼────────────▼────────────▼─────────────────────────┐
│         Cloudflare Pages Functions (Hono)                    │
│  /api/[[route]].ts → Middleware Stack → Route Handlers      │
│  • Auth (JWT, OAuth, SAML)                                  │
│  • Rate limiting (IP, per-plan)                             │
│  • Error handling, CORS, security headers                   │
│  • Structured logging → R2                                  │
└─────────┬──────────────────┬────────────┬──────────────────┘
          │                  │            │
      D1 Database         KV Stores   Durable Objects
      (D1)                (7 NS)        (SessionRoom)
      • sessions          • Users       • Live state
      • decisions         • Teams       • WebSocket mgmt
      • audit_log         • Sessions    • Vote accumulation
      • actions           • Templates   • Timer sync
      • tags              • Decisions   • Voter dedup
      • tokens            • Audit
      • webhooks          • Actions
```

**Request Flow**:
1. Browser HTTP → Pages Functions
2. Middleware: auth extract, rate limit, error handling
3. Route handler: validate, mutate KV/D1, return JSON
4. WebSocket upgrade: `/api/sessions/:id/ws` → SessionRoom DO
5. DO handles all real-time state (never REST for LIVE)

---

## Tech Stack

| Layer | Technology | Version | Binding | Purpose |
|-------|------------|---------|---------|---------|
| **Frontend** | React | 18.3.1 | — | UI framework |
| | TypeScript | 5.5 | — | Type safety |
| | Vite | 5.2 | — | Bundle/dev server |
| | Tailwind CSS | 4.2 | — | Styling |
| | i18next | 26.0.4 | — | i18n (5 langs) |
| **Runtime** | Cloudflare Pages | — | — | Static + Functions |
| | Hono | 4.3 | — | Web framework |
| **Database** | D1 (SQLite) | — | `DB` | Persistent data |
| **Cache** | Workers KV | — | `*_KV` (7) | Session state, tokens |
| **Realtime** | Durable Objects | — | `SessionRoom` | Live WebSocket |
| **Vector** | Vectorize | 768-d | `DECISIONS_VECTORIZE` | Semantic search |
| **AI** | Workers AI | — | Gateway | LLM (Llama 3.3) |
| **Analytics** | Analytics Engine | — | `EVENTS` | KPI tracking |
| **Storage** | R2 Bucket | — | `LOGS_BUCKET` | Audit logs |
| **Email** | Resend API | — | Secret | Transactional email |
| **Payments** | Stripe | — | Secret | Billing, webhooks |
| **Auth** | Magic Link + OAuth | — | — | Microsoft, Google |
| | SAML 2.0 | — | — | Enterprise SSO |

---

## Session State Machine

```
                   ┌─────────┐
                   │ DRAFT   │ ← CREATE /sessions
                   │ (Stateless) │
                   └────┬────┘
                        │ start() via POST /sessions/:id/start
                        ↓
                   ┌─────────┐
         ┌────────→│ LOBBY   │ ← (optional gateway state)
         │         │ (DO init)  │
         │         └────┬────┘
         │              │ go-live() or auto-start
         │              ↓
         │         ┌─────────┐
         │         │ LIVE    │ ← Presenter + voters connected
    close()        │ (DO active) │ ← WebSocket only (NO REST!)
         │         │ Results accumulate │
         │         └────┬────┘
         │              │ close() via POST /sessions/:id/close
         │              ↓
         │         ┌─────────┐
         │         │ CLOSED  │ ← Results finalized
         │         │ (stateless) │
         │         └────┬────┘
         │              │ archive (auto or manual)
         │              ↓
         └─────────┼─────────┐
                   │ ARCHIVED│ ← Retention policy (90d)
                   │ (D1 only)  │
                   └─────────┘

KEY RULE:
  • DRAFT state: REST API only, DO doesn't exist
  • LIVE state: WebSocket only, REST forbidden
  • CLOSED/ARCHIVED: REST for results/analytics
```

---

## Critical Constraints (Hard Rules)

1. **No Anthropic API Key**
   - Use only `c.env.AI.run()` (Workers AI)
   - Rate limit: 10 req/min per user (free), 50 req/min (pro)
   - Model: `@cf/meta/llama-3.3-70b-instruct-fp8-fast`

2. **Secrets Never in wrangler.toml**
   - Use `wrangler pages secret put KEY`
   - Store in CI/CD secrets or local `.env.local`
   - Never commit to git

3. **npm test + tsc Must Pass**
   - Before every commit: `npm test` (Vitest in `tests/unit/`)
   - TypeScript: `tsc --noEmit` (no JS output, type-check only)
   - e2e: optional for features, required for critical paths

4. **DRAFT-API vs LIVE-WebSocket**
   - Draft config changes: PATCH `/sessions/:id`
   - Live config changes: WebSocket `ClientMessage` types
   - Never mix (no REST during LIVE)

5. **Update CLAUDE.md When Patterns Discovered**
   - Add new KV patterns, error codes, integrations
   - Document architectural decisions
   - Link to relevant code files

---

## Authentication & Authorization

```
Magic Link Flow:
  1. POST /auth/request {email}
     → Email sent (via Resend)
     → Token stored in USERS_KV (15min TTL)
  2. GET /auth/verify?token=X
     → Verify OTT from DB (USERS_KV)
     → Issue JWT (signed with SECRET)
     → Return JWT in response (browser stores in localStorage)
  3. All protected requests: Authorization: Bearer JWT

OAuth Flow (Microsoft/Google):
  1. GET /auth/sso/init?provider=microsoft
     → Generate PKCE state, save to KV
     → Redirect to OAuth provider
  2. GET /auth/sso/exchange?code=X&state=Y
     → Verify state, exchange code for token
     → Lookup/create user
     → Issue JWT

SAML Flow (Enterprise):
  1. GET /auth/sso/saml/login
     → Generate AuthnRequest, redirect to IdP
  2. POST /auth/sso/saml/acs
     → Receive & verify Assertion
     → Create/link user
     → Issue JWT

JWT Validation:
  • Header: Bearer <token>
  • Stored in USERS_KV as session_token:${token}
  • TTL: 30 days (or custom via Stripe plan)
  • Revoke: DELETE from KV on logout
```

**Plan-Based Access Control**:
- **Free**: 5 sessions/month, 50 participants/session, no integrations
- **Starter**: 50 sessions/month, 500 participants/session, Slack
- **Team**: Unlimited, all integrations, team members
- **Enterprise**: Custom limits, SSO, audit logs, SLA

Enforced via middleware `planMiddleware()` before route handlers.

---

## Real-Time Architecture

**Key Insight**: Durable Objects maintain session state; no polling.

```
SessionRoom DO (1 per session in LIVE state)
├── State (persisted to storage)
│   ├── currentQuestion: Question
│   ├── votes: {voterId → answer}
│   ├── participants: Set<voterId>
│   ├── names: {voterId → name} (presenter only)
│   ├── timer: {endsAt, totalSeconds}
│   └── consentLog: {...}
│
├── WebSocket Handlers
│   ├── Presenter (authenticated via JWT)
│   │   ├── Can: advance question, start timer, see all names
│   │   ├── Receives: all results, all feedback
│   │   └── Max connections: 1 per session
│   │
│   └── Voters (anonymous or fingerprinted)
│       ├── Can: vote, send emoji, feedback
│       ├── Receives: sanitized results (no names)
│       └── Max connections: plan-based (100-1000)
│
└── Deduplication
    ├── IP hash + browser fingerprint = voterId
    ├── Prevents duplicate voting
    ├── Tracks in SESSIONS_KV (voted_voters:${sessionId})
    └── Used for consent/ranking accuracy
```

**Message Protocol**:
```typescript
// ClientMessage (voter/presenter → server)
interface ClientMessage {
  type: 'vote' | 'feedback' | 'emoji' | 'name' | 'advance' | 'lock' | ...
  data: {...}
  timestamp: number
}

// ServerMessage (server → client)
interface ServerMessage {
  type: 'init' | 'results' | 'participants' | 'timer' | 'locked' | ...
  data: {...}
  timestamp: number
}
```

See [[SPEC_REALTIME.md#websocket-protocol]] for full message types.

---

## Data Lifecycle

```
Session Creation (DRAFT):
  1. POST /sessions → D1 (sessions table) + SESSIONS_KV (meta)
  2. Add questions via POST /sessions/:id/questions
  3. Customize via PATCH /sessions/:id (timer, anonymity, etc.)
  4. [Optional] Apply template
  5. [Optional] AI-suggest questions via /ai/suggest-questions

Session Start (DRAFT → LIVE):
  1. POST /sessions/:id/start
  2. Initialize SessionRoom DO
  3. Load questions into DO state
  4. Generate join code (4-digit)
  5. Return session code + DO URL to presenter

Live Session (LIVE):
  1. Presenter + voters connect via WebSocket
  2. Presenter advances questions
  3. Voters vote (accumulate in DO state)
  4. Decisions recorded to SESSIONS_KV (async-vote:...)
  5. Real-time results broadcast

Session Close (LIVE → CLOSED):
  1. POST /sessions/:id/close
  2. Freeze results, close DO
  3. Finalize decisions: D1 (decisions table)
  4. Trigger AI tagging (async via waitUntil)
  5. Audit log entry

Results Access:
  1. GET /sessions/:id/results → presenter only
  2. GET /sessions/:id/results/public → shareable link (no auth)
  3. GET /sessions/:id/decisions → list decisions
  4. GET /sessions/:id/export → Excel export
```

---

## Error Handling Strategy

**Standard Response Format**:
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid session token",
    "statusCode": 401,
    "requestId": "uuid-here",
    "timestamp": 1234567890
  }
}
```

**Common Codes**:
- `UNAUTHORIZED` (401): Missing/expired JWT
- `FORBIDDEN` (403): User lacks plan feature or ownership
- `NOT_FOUND` (404): Resource doesn't exist
- `RATE_LIMIT` (429): Too many requests
- `CONFLICT` (409): Session state violation (e.g., REST during LIVE)
- `UNPROCESSABLE` (422): Invalid input (Zod validation)
- `INTERNAL_ERROR` (500): Unexpected server error

See [[SPEC_BACKEND.md#error-codes]] for complete list.

---

## Deployment Targets

```
Production:
  • Cloudflare Pages (pages.dev domain)
  • D1 database: qesto-prod
  • KV namespaces: qesto-* (prod)
  • Custom domain: qesto.com

Staging:
  • Cloudflare Pages (staging.pages.dev)
  • D1 database: qesto-staging
  • KV namespaces: qesto-*-staging
  • Custom domain: staging.qesto.com

Development:
  • Local: npm run dev (Vite dev server)
  • Wrangler: wrangler pages dev (local Functions)
```

**Deployment Command**:
```bash
npm run build          # Vite bundle
wrangler pages deploy  # Upload to Cloudflare Pages (qesto project)
```

See [[SPEC_DEPLOYMENT.md]] for secrets, CI/CD, monitoring.

---

## Key Files Reference

| File | Purpose | Lines |
|------|---------|-------|
| `src/App.tsx` | React router, Auth wrapper | 150 |
| `functions/api/[[route]].ts` | Main API router + middleware | 200 |
| `functions/api/SessionRoom.ts` | Durable Object for live sessions | 800 |
| `src/hooks/useSession.ts` | WebSocket state reducer | 600 |
| `src/hooks/useAuth.tsx` | Auth context + user state | 400 |
| `functions/api/db.ts` | D1 query helpers | 150 |
| `functions/api/auth.ts` | Auth routes + JWT signing | 300 |
| `functions/api/billing.ts` | Stripe integration | 250 |
| `functions/api/ai.ts` | Workers AI gateway | 200 |
| `src/lib/api.ts` | WebSocket client + fetch wrapper | 180 |
| `CLAUDE.md` | Project context (this file) | 200 |

---

## Quick Reference: Bindings & Secrets

```typescript
// Environment bindings (c.env.*)
c.env.DB                    // D1 database
c.env.SESSIONS_KV           // Session state
c.env.USERS_KV              // Users & tokens
c.env.TEAMS_KV              // Teams
c.env.TEMPLATES_KV          // Templates
c.env.DECISIONS_KV          // Decisions cache
c.env.AUDIT_KV              // Audit logs
c.env.ACTIONS_KV            // Action items
c.env.DECISIONS_VECTORIZE   // Vector store
c.env.AI                    // Workers AI gateway
c.env.EVENTS                // Analytics Engine
c.env.LOGS_BUCKET           // R2 logs

// Secrets (via wrangler pages secret put)
c.env.RESEND_API_KEY        // Email service
c.env.STRIPE_SECRET_KEY     // Stripe API
c.env.STRIPE_WEBHOOK_SECRET // Webhook verification
c.env.JWT_SECRET            // JWT signing key
c.env.SAML_CERT             // SAML certificate
c.env.OAUTH_*_SECRET        // OAuth client secrets
```

---

## Next Steps

1. Review [[SPEC_DATAMODEL.md]] for schema + types
2. Review [[SPEC_FRONTEND.md]] for component architecture
3. Review [[SPEC_BACKEND.md]] for API endpoints + middleware
4. Review [[SPEC_REALTIME.md]] for WebSocket + DO details
5. Review [[SPEC_INTEGRATIONS.md]] for 3rd-party APIs
6. Review [[SPEC_DEPLOYMENT.md]] for build + deploy
