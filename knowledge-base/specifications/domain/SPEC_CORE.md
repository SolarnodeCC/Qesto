---
id: SPEC-CORE
type: specification
domain: architecture
category: core
status: active
version: 2.1
created: 2026-03-01
updated: 2026-05-11
audience:
  - Architect
  - Backend engineer
  - Tech lead
tags:
  - architecture
  - system-design
  - cloudflare-workers
  - tech-stack
  - session-state-machine
  - constraints
relates_to:
  - SPEC_BACKEND
  - SPEC_FRONTEND
  - SPEC_DATAMODEL
  - SPEC_REALTIME
  - ADR-0001-do-per-session
---

# SPEC_CORE — System Architecture & Design

_Repository hub: [Documentation map](../README.md)._

## Doc contract
Diagrams + constraint list = **intent**; **code wins** on conflict until a spec PR updates this file.

## Readers (multi-lens · **Architect** = **Primary** for system design)

| Role | Use this doc to… |
|------|------------------|
| **Architect** | **Primary** — state machine, **DRAFT/LIVE** split, hard constraints, trust zones, NFRs. |
| **Backend Developer** | **Lead** — where truth lives (D1/KV/DO), lifecycle hooks, async `waitUntil` patterns. |
| **Frontend Developer** | JWT vs public journeys; plan tiers → gating (detail [[SPEC_FRONTEND.md]]). |
| **UI specialist** | Modes (present/vote/results) + plan limits → skeletons, upsell, disabled tools. UX constraints, colour/typography/spacing tokens, AI sparkle mark iconography, and component specs → [[SPEC_FRONTEND.md]] + [`WEBSITE_DESIGN_SPEC.md`](../product/WEBSITE_DESIGN_SPEC.md). |
| **Cloudflare specialist** | Binding map: Pages, D1, 7×KV, DO `SessionRoom`, Workers AI, Vectorize, R2, Analytics. |
| **API & middleware specialist** | Rationale for routes; concrete paths + AuthZ in [[SPEC_BACKEND.md]]. |

## Invariant strip (non-negotiable)

| ID | Rule |
|----|------|
| I1 | **LIVE** session mutations via **WebSocket only** — no REST that changes live vote/question state ([[SPEC_REALTIME.md]]). |
| I2 | **DRAFT** session config via **REST** (`PATCH /sessions/:id`, questions CRUD) — [[SPEC_BACKEND.md]]. |
| I3 | **AI** via **`c.env.AI.run` only** — no third-party LLM API keys in repo ([[SPEC_INTEGRATIONS.md]]). |
| I4 | **Secrets** not in `wrangler.toml` / git — Pages secrets + CI ([[SPEC_DEPLOYMENT.md]]). |
| I5 | **Numeric rate limits** in prose are **targets** — verify in middleware code. |

**Pre-build (scope, spike, gates):** canonical tables live in **[includes/PREBUILD_AND_DELIVERY.md](includes/PREBUILD_AND_DELIVERY.md)** — read before expanding surface area beyond one vertical slice.

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
| **Frontend** | React | 19 | — | UI framework |
| | TypeScript | 5.7 | — | Type safety |
| | Vite | 8 | — | Bundle/dev server |
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
   - Rate limit: 10 req/min per user (free), 50 req/min (pro) — **verify constants in code**
   - Model: `@cf/meta/llama-3.3-70b-instruct-fp8-fast`

2. **Secrets Never in wrangler.toml**
   - Use `wrangler pages secret put KEY`
   - Store in CI/CD secrets or local `.env.local`
   - Never commit to git

3. **npm test + tsc Must Pass**
   - Before every commit: `npm test` (Vitest in `tests/unit/`)
   - TypeScript: `npm run typecheck` (runs `tsc --noEmit`)
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
     → OTT row in D1 `one_time_tokens` (~15m); optional KV cache per implementation
  2. GET /auth/verify?token=X
     → Verify OTT (D1), consume, issue JWT
     → Return JWT (browser stores in localStorage)
  3. All protected requests: Authorization: Bearer JWT

OAuth Flow (Microsoft/Google) — **verbs per** [[SPEC_BACKEND.md]]:
  1. POST /auth/sso/init?provider=microsoft
     → PKCE state in KV, redirect to IdP
  2. POST /auth/sso/exchange (body/query per handler) with code + state
     → Verify state, exchange code, issue JWT

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
  1. GET /sessions/:id/results → presenter (AuthZ `JOP` — see [[SPEC_BACKEND.md]])
  2. GET /sessions/:id/results/public → shareable link
  3. GET /sessions/:id/decisions → list (canonical row in [[SPEC_BACKEND.md]] §3)
  4. `POST /sessions/:id/export` (xlsx) + `GET …/export.csv` — [[SPEC_BACKEND.md]] §2
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

See [[SPEC_BACKEND.md#error-codes-common]] for the shared table.

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

| File | Purpose |
|------|---------|
| `src/App.tsx` | React router, Auth wrapper |
| `functions/api/[[route]].ts` | Main API router + middleware |
| `functions/api/SessionRoom.ts` | Durable Object for live sessions |
| `src/hooks/useSession.ts` | WebSocket client state reducer |
| `src/hooks/useAuth.tsx` | Auth context + user state |
| `functions/api/db.ts` | D1 query helpers |
| `functions/api/auth.ts` | Auth routes + JWT signing |
| `functions/api/billing.ts` | Stripe integration |
| `functions/api/ai.ts` | Workers AI gateway |
| `src/lib/api.ts` | WebSocket client + fetch wrapper |
| `CLAUDE.md` | Project context for contributors |

Line counts omitted — **search repo** for current size.

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

---

## AI usage recipe (copy)

1. “Explain **DRAFT vs LIVE**” → **Invariant strip** + **Session State Machine**.  
2. “Where does X live?” → **System Architecture** + [[SPEC_DATAMODEL.md]].  
3. “Auth flow” → **Authentication** + [[SPEC_INTEGRATIONS.md#authentication-flows]].  
4. “REST path for Y” → [[SPEC_BACKEND.md]] route tables.  

**Checklist:** OAuth verbs match BACKEND • OTT = D1 • no line-count promises in Key Files • rate limits marked verify-in-code.
