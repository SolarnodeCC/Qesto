# Software Architecture Audit — Qesto

**Date:** 2026-05-03  
**Branch:** `claude/audit-code-duplication-MQdYH`  
**Scope:** Full stack — `functions/api/`, `src/`, `worker/`

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Evaluation Criteria](#2-evaluation-criteria)
3. [Architecture Diagrams](#3-architecture-diagrams)
4. [Anti-Pattern Findings](#4-anti-pattern-findings)
5. [Modularity Rating](#5-modularity-rating)

---

## 1. Architecture Overview

Qesto is a **Layered Monolith deployed to the Cloudflare edge**. It is not MVC (no server-rendered views), not microservices (single Worker), and not hexagonal (ports/adapters are not formalized). The closest canonical name is a **Modular Monolith** with a stateful sidecar (Durable Object) for the realtime path.

### Deployment topology

| Component | Runtime | Location |
|-----------|---------|----------|
| Static SPA | Cloudflare Pages (CDN) | `src/` |
| REST API | Hono on Cloudflare Workers | `functions/api/` |
| Realtime host | Durable Object `SessionRoom` | `functions/api/SessionRoom.ts` |
| Scheduled tasks | `worker/index.ts` ExportedHandler | `worker/` |

### Layer model

```
┌──────────────────────────────────────────────────────────────┐
│  Presentation Layer                                          │
│  React 19, Vite, Tailwind v4                                 │
│  src/pages/   src/components/   src/hooks/   src/api/        │
└───────────────────────┬──────────────────────────────────────┘
                        │ HTTP / WebSocket
┌───────────────────────▼──────────────────────────────────────┐
│  API Gateway Layer                                           │
│  functions/api/app.ts (Hono)                                 │
│  Middleware chain: trace → CORS → logger → CSRF → rate-limit │
│                    → RBAC → (auth) → (plan) → route handler  │
└───────────────────────┬──────────────────────────────────────┘
                        │
┌───────────────────────▼──────────────────────────────────────┐
│  Domain Layer (routes + lib)                                 │
│  routes/  sessions  auth  teams  billing  admin              │
│           energizers  insights  gamification  ai-insights    │
│  lib/     jwt  validation  ai-wizard  ai-insights  idempotency│
│           quota  entitlements  audit  oauth  saml  email     │
└───────────────────────┬──────────────────────────────────────┘
                        │
┌───────────────────────▼──────────────────────────────────────┐
│  Data Layer                                                  │
│  D1 (SQL)     USERS/SESSIONS/TEAMS/TEMPLATES/DECISIONS KV    │
│  ACTIONS_KV   AUDIT_KV   METRICS_KV   METRICS_AE (AE)       │
│  SESSION_ROOM DO          DECISIONS_VECTORIZE                │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. Evaluation Criteria

### 2.1 Separation of Concerns

**Score: 5/10**

The middleware layer is excellent — each of the 9 middleware modules has a single, well-defined responsibility (auth, CSRF, rate-limit, RBAC, plan, logger, feature-gate, do-tracing, admin). The `lib/` layer is mostly clean.

The route layer violates SRP aggressively:

| File | Lines | Responsibilities |
|------|-------|-----------------|
| `routes/sessions.ts` | 1863 | Session CRUD, question CRUD, AI generation (2 endpoints), schema migration, DO proxy, CSV export, preflight, insights precomputation, grounding hash |
| `routes/auth.ts` | 680 | Magic link, password auth, Google OAuth, Microsoft OAuth, SAML SSO, password reset, logout — 7 protocols |
| `routes/admin.ts` | 872 | Live metrics, historical metrics, CSV export, audit log, KPI dashboard, user CRUD (create/suspend/restore), ops health summary, analytics |
| `routes/energizers.ts` | 758 | 6 distinct energizer game types, all inline |

Business logic (plan enforcement, quota checks, AI calls) lives directly inside route handlers rather than in a service layer. The schema migration (`patchSchemaIfNeeded`, `sessions.ts:59–72`) and the AI background job (`precomputeInsights`, `sessions.ts:198–293`) are embedded in the route module.

### 2.2 Architectural Pattern

**Pattern: Modular Monolith (edge-first)**

Not MVC — there are no server-rendered views.  
Not microservices — a single Worker binary handles all API concerns.  
Not hexagonal — no formal port/adapter abstraction.

The closest match is a **Layered Monolith** with:
- An **Application Factory** (`app.ts`) composing a **Chain of Responsibility** middleware pipeline
- A **Route + Handler** domain layer without a formal service tier
- A **stateful sidecar** (`SessionRoom` DO) for the WebSocket realtime path, effectively a separate bounded context accessible only via HTTP proxy from `sessions.ts`

The DO boundary (`doStub`/`postDO` at `sessions.ts:181–196`) is the only context boundary in the system. Every other concern shares the same module and namespace.

### 2.3 God Objects / Modules

Three clear God modules, one near-God:

**`routes/sessions.ts` — 1863 lines, 16 route handlers, 9 private helpers, 20 imports**

Handles: session lifecycle state machine, question CRUD, AI wizard (2 flows), results computation, WebSocket proxy to DO, CSV export, session preflight checks, schema migration, background AI precomputation, grounding hash caching, SSE streaming.

Private helpers buried inside this file that should be shared services:
- `fetchSession` / `fetchSessionByCode` / `fetchQuestions` — Repository methods
- `doStub` / `postDO` — DO access layer
- `precomputeInsights` — background job / service
- `patchSchemaIfNeeded` — migration runner
- `hashGrounding` — pure utility

**`routes/energizers.ts` — 758 lines, CC ≈ 91 for `mountEnergizerRoutes`**

All 6 energizer types (`battle_royale`, `bracket`, `emoji_poll`, `quick_finger`, `team_quiz`, `word_cloud`) handled as inline `if/else` chains within a single mount function. Type-safe configuration, validation, and state management for each type are interleaved rather than separated.

**`routes/auth.ts` — 680 lines, 16 imports**

7 authentication protocols as inline closures inside one `mountAuthRoutes` function. SAML callback at line 582, Google at 440, Microsoft at 497, magic-link at 69, password at 225, reset-request at 325, reset-confirm at 365.

**`routes/admin.ts` — 872 lines**  
Admin metrics, user management, ops health, KPI dashboard, CSV export, and audit query in one module.

### 2.4 Dependency Flow

**Overall: clean, with two exceptions.**

The general direction is correct:
```
app.ts → routes/* → lib/* → types.ts
```

**Exception 1 — Route-to-route import:**

```ts
// auth.ts:29
import { attachUserToTeam, loadTeam } from './teams'
```

`auth.ts` imports business logic from `teams.ts`. `teams.ts` exports `attachUserToTeam` and `consumeInvite` as public API alongside its route-mounting function. Business logic that crosses route domains should live in `lib/`, not in a peer route file.

**Exception 2 — Dead module (`kv-cache.ts`):**

`functions/api/middleware/kv-cache.ts` (205 lines) is imported by nothing. Confirmed by:
```bash
grep -rn "kv-cache" functions/api/  # zero results outside the file itself
```
It exports `cachePlanUsage`, `cacheTeamMetadata`, `cacheUserRoles`, and `cacheLeaderboard` — none of which are ever called. It queries non-existent DB columns and uses `DECISIONS_KV` for non-decision data.

**No circular dependencies detected** across the codebase.

### 2.5 Modularity Rating

**5/10** — see Section 5 for detailed per-layer breakdown.

---

## 3. Architecture Diagrams

### Diagram A — Full System Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│  CLIENT TIER                                                         │
│                                                                      │
│  Browser                                                             │
│    ├── Static SPA (React/Vite/Tailwind)  ←── Cloudflare Pages CDN   │
│    │     src/pages/   src/components/                                │
│    │     src/hooks/   src/api/client.ts ──── centralized API client  │
│    │                                                                 │
│    ├── REST  ──────────────────────────── POST/GET/PATCH/DELETE      │
│    └── WebSocket ──────────────────────── wss://.../ws upgrade       │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────────────┐
│  EDGE API TIER  (Cloudflare Workers)                                 │
│                                                                      │
│  ┌─── Middleware Pipeline (app.ts) ─────────────────────────────┐   │
│  │  trace-id → CORS → logger → CSRF → rate-limit (KV-backed)    │   │
│  │  → rbac (D1) → [authMiddleware (JWT)] → [planMiddleware (D1)] │   │
│  └───────────────────────────┬───────────────────────────────────┘   │
│                              │                                       │
│  ┌──────────────────────────▼───────────────────────────────────┐   │
│  │  Route Handlers                                              │   │
│  │                                                              │   │
│  │  /api/auth/*         auth.ts    (7 protocols, 680L)         │   │
│  │  /api/sessions/*     sessions.ts (state machine, 1863L)     │   │  ← GOD MODULE
│  │  /api/teams/*        teams.ts   (452L)                      │   │
│  │  /api/billing/*      billing.ts (160L) ──────► Stripe API   │   │
│  │  /api/admin/*        admin.ts   (872L) ──────► METRICS_AE   │   │  ← GOD MODULE
│  │  /api/sessions/*/    energizers (758L)                      │   │  ← GOD MODULE
│  │    energizers                                                │   │
│  │  /api/sessions/*/    insights.ts (292L) ────► Workers AI    │   │
│  │    insights                                                  │   │
│  │  /api/sessions/*/    gamification (244L)                    │   │
│  │    close/badges                                              │   │
│  │  /api/sessions/*/    ai-insights (344L) ────► Workers AI    │   │
│  │    ai/*                                                      │   │
│  │  /api/templates/*    templates.ts (367L)                    │   │
│  │  /api/users/*        users.ts    (58L)                      │   │
│  └──────────────────────────┬───────────────────────────────────┘   │
│                             │ sessions.ts only                      │
│  ┌──────────────────────────▼───────────────────────────────────┐   │
│  │  Durable Object: SessionRoom (716L)                          │   │
│  │  /init  /close  /state  /ws (WebSocket upgrade)              │   │
│  │  Vote counting, question advance, fun-mode alarm             │   │
│  └──────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────────────┐
│  DATA TIER                                                           │
│                                                                      │
│  D1 (SQLite)       ─── sessions, questions, votes, users, magic_links│
│                        teams (partial), audit_events, badges         │
│                        metrics_summary, insights_daily               │
│                                                                      │
│  KV Namespaces                                                       │
│   USERS_KV         ─── OAuth/password/Stripe creds, preferences     │
│   SESSIONS_KV      ─── Quota counters, insights cache               │
│   TEAMS_KV         ─── Team membership (full source of truth)       │
│   TEMPLATES_KV     ─── Template blobs                               │
│   DECISIONS_KV     ─── AI insights cache (precomputed)              │
│   ACTIONS_KV       ─── Rate limit counters, idempotency keys        │
│   AUDIT_KV         ─── (bound but unused — audit uses D1)           │
│   METRICS_KV       ─── Live metric 1-min buckets                    │
│                                                                      │
│  Other                                                               │
│   METRICS_AE       ─── Analytics Engine (write-only, event stream)  │
│   DECISIONS_VECTORIZE── 768d cosine embeddings for semantic search  │
└──────────────────────────────────────────────────────────────────────┘
```

### Diagram B — Data Flow: Session Lifecycle

```
CREATE (DRAFT)                    START (DRAFT→LIVE)
─────────────────                 ──────────────────────────────────
POST /api/sessions                POST /api/sessions/:id/start
       │                                 │
  D1 INSERT sessions                conditional UPDATE sessions
  SESSIONS_KV quota++              (status=live only if draft)
  idempotency (ACTIONS_KV)                │
       │                           POST DO /init (seed state)
  201 { session }                         │
                                   ┌─────▼──────────────────┐
                                   │  SessionRoom DO        │
                                   │  ctx.storage:          │
                                   │   K_META, K_QUESTION   │
                                   │   K_COUNTS, K_VOTERS   │
                                   │   K_STATUS='live'      │
                                   └─────────────────────────┘

LIVE (WebSocket)                  CLOSE (LIVE→CLOSED)
────────────────────              ──────────────────────────────────
GET /api/sessions/:id/ws          POST /api/sessions/:id/close
       │                                 │
  DO WebSocket upgrade             POST DO /close
  SessionRoom.handleUpgrade               │
       │                          D1 INSERT votes (bulk)
  ws: vote/advance/back           D1 UPDATE sessions (status=closed)
       │                          waitUntil precomputeInsights()
  DO ctx.storage mutations               │
  broadcast debounce (100ms)      200 { counts, total }
```

### Diagram C — Potential Bottlenecks

```
┌──────────────────────────────────────────────────────────┐
│  BOTTLENECK MAP                                          │
│                                                          │
│  1. planMiddleware (plan.ts:33)                          │
│     Every auth'd request: D1 SELECT on users table       │
│     No caching — O(1) D1 read but serial per request     │
│     ████████████  HIGH FREQUENCY, no cache               │
│                                                          │
│  2. rbacMiddleware (rbac.ts:137)                         │
│     Every auth'd request: D1 SELECT on user_roles        │
│     In-request cache only (resets each request)          │
│     ████████████  HIGH FREQUENCY, no cache               │
│                                                          │
│  3. gamification close handler (gamification.ts:162-210) │
│     N+1 D1 queries: for each voter_id:                   │
│       SELECT COUNT(*) WHERE voter_id=?  (×N)             │
│       SELECT MIN(submitted_at)...       (×N)             │
│       SELECT started_at...              (×N)             │
│     ████████  N+1, O(participants) queries               │
│                                                          │
│  4. SessionRoom single-instance per session              │
│     All votes for a session serialized in one DO         │
│     By design (strong consistency) but caps throughput   │
│     ██████  ARCHITECTURAL CONSTRAINT, not a bug          │
│                                                          │
│  5. AI generation endpoints (no global circuit breaker)  │
│     Workers AI timeout → hangs Worker thread             │
│     ai-insights.ts has no retry (1 attempt only)        │
│     ██████  RELIABILITY GAP                              │
│                                                          │
│  6. DECISIONS_VECTORIZE semantic search                  │
│     Used in templates/insights; latency unknown          │
│     Unable to verify — no span instrumentation           │
│     ████  UNOBSERVABLE                                   │
└──────────────────────────────────────────────────────────┘
```

### Diagram D — Dependency Graph (simplified)

```
                        app.ts
                          │
          ┌───────────────┼───────────────────┐
          │               │                   │
      middleware/      routes/             lib/
          │               │                   │
    auth.ts         sessions.ts ──────► ai-wizard.ts
    csrf.ts              │          ──► ai-insights.ts
    rate-limit.ts        │          ──► idempotency.ts
    rbac.ts ─────► D1   │          ──► quota.ts
    plan.ts ─────► D1   │          ──► entitlements.ts
    logger.ts            │          ──► rate-limit.ts
    feature-gate.ts ─►  │          ──► validation.ts
    do-tracing.ts        │          ──► observability.ts
    kv-cache.ts  ◄──── NOT IMPORTED (dead code)
                         │
                    auth.ts ──────────────► teams.ts (⚠ cross-route)
                    teams.ts ─► attachUserToTeam (exported)
                    billing.ts ─────────────────────────────► Stripe
                    energizers.ts (27 × `any`)
                    gamification.ts (13 × `any`)
                    admin.ts ───────────────────────────────► METRICS_AE

                         │
                    SessionRoom.ts
                    (only accessible via sessions.ts:doStub/postDO)
```

---

## 4. Anti-Pattern Findings

---

### SA-01 — God Module: `sessions.ts` does 9 different things in 1863 lines
**Importance: 9/10**

**Location:** `functions/api/routes/sessions.ts`

`sessions.ts` contains:

| Concern | Lines | Should be in |
|---------|-------|--------------|
| Session CRUD + state machine | 425–930 | `routes/sessions.ts` (keep) |
| Question CRUD (add/edit/delete/reorder) | 1221–1422 | `routes/questions.ts` |
| AI wizard — batch generate | 1004–1096 | `routes/sessions.ts` or dedicate to `routes/ai-wizard.ts` |
| AI wizard — SSE streaming | 1104–1220 | ditto |
| AI refine flow | 1650–1786 | ditto |
| Insights themes query | 1793–1851 | `routes/insights.ts` |
| CSV export | 1508–1559 | `routes/sessions.ts` or `routes/exports.ts` |
| Preflight checks | 1561–1648 | `routes/sessions.ts` (keep, small) |
| Schema migration | 59–72 | `lib/migrations.ts` or startup hook |
| DO proxy helpers | 181–196 | `lib/session-room-client.ts` |
| `precomputeInsights` (background AI) | 198–293 | `lib/insights-service.ts` |
| `hashGrounding` | 1858–1863 | `lib/ai-wizard.ts` (already there, duplication) |

**Fix — extract question routes:**

```ts
// NEW: functions/api/routes/questions.ts
import { Hono } from 'hono'
import type { Env } from '../types'
import { authMiddleware } from '../middleware/auth'
import { planMiddleware } from '../middleware/plan'
import { AddQuestionSchema, ReorderQuestionsSchema } from '../lib/validation'
import { ulid } from '../lib/ulid'

export function mountQuestionRoutes(parent: Hono<{ Bindings: Env; Variables: Vars }>) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()
  app.use('*', authMiddleware)
  app.use('*', planMiddleware)

  app.post('/:id/questions', async (c) => { /* moved from sessions.ts:1221 */ })
  app.put('/:id/questions/reorder', async (c) => { /* moved from sessions.ts:1279 */ })
  app.patch('/:id/questions/:questionId', async (c) => { /* moved from sessions.ts:1372 */ })
  app.delete('/:id/questions/:questionId', async (c) => { /* moved from sessions.ts:1423 (inferred) */ })

  parent.route('/api/sessions', app)
}
```

**Fix — extract DO proxy to shared lib:**

```ts
// NEW: functions/api/lib/session-room-client.ts
import type { Env } from '../types'

export function getSessionRoomStub(env: Env, sessionId: string): DurableObjectStub {
  return env.SESSION_ROOM.get(env.SESSION_ROOM.idFromName(sessionId))
}

export async function postSessionRoom(
  env: Env,
  sessionId: string,
  path: string,
  body: unknown,
): Promise<Response> {
  const stub = getSessionRoomStub(env, sessionId)
  return stub.fetch(`https://do.internal${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}
```

---

### SA-02 — God Module: `energizers.ts` — CC ≈ 91, 6 types inline
**Importance: 8/10**

**Location:** `functions/api/routes/energizers.ts:32–758`

All 6 energizer types (`battle_royale`, `bracket`, `emoji_poll`, `quick_finger`, `team_quiz`, `word_cloud`) are handled as inline `if/else` branches inside `mountEnergizerRoutes`. Each type has distinct config shape, state machine, vote semantics, and advancement logic — all interleaved.

```ts
// CURRENT — energizers.ts:63–91 (one of many inline type branches)
if (body.kind === 'emoji_poll') {
  config = { emojis } satisfies EmojiPollConfig
} else if (body.kind === 'quick_finger') {
  config = { options, correct_index } satisfies QuickFingerConfig
} else if (body.kind === 'team_quiz') {
  config = { questions: [...], current_index: -1 }
} else if (body.kind === 'word_cloud') {
  config = { max_words_per_participant: 1 }
} else {
  // battle_royale / bracket
}
```

**Fix — Strategy pattern per type:**

```ts
// NEW: functions/api/lib/energizer-types.ts
export interface EnergizerStrategy {
  buildConfig(body: CreateEnergizerBody): object
  validateBody(body: CreateEnergizerBody): string | null   // returns error or null
  advance(state: string, config: object): object           // returns new state
}

export const ENERGIZER_STRATEGIES: Record<EnergizerKind, EnergizerStrategy> = {
  emoji_poll:    new EmojiPollStrategy(),
  quick_finger:  new QuickFingerStrategy(),
  battle_royale: new BattleRoyaleStrategy(),
  bracket:       new BracketStrategy(),
  team_quiz:     new TeamQuizStrategy(),
  word_cloud:    new WordCloudStrategy(),
}

// Route handler becomes:
app.post('/sessions/:sessionId/energizers', async (c) => {
  const raw = await c.req.json().catch(() => null)
  const parsed = CreateEnergizerSchema.safeParse(raw)
  if (!parsed.success) return c.json({ ... }, 400)

  const strategy = ENERGIZER_STRATEGIES[parsed.data.kind]
  const validationError = strategy.validateBody(parsed.data)
  if (validationError) return c.json({ ok: false, error: { code: 'validation', message: validationError } }, 400)

  const config = strategy.buildConfig(parsed.data)
  // ... rest is generic
})
```

---

### SA-03 — Cross-route coupling: `auth.ts` imports business logic from `teams.ts`
**Importance: 7/10**

**Location:** `functions/api/routes/auth.ts:29`

```ts
import { attachUserToTeam, loadTeam } from './teams'
```

Route modules should not import from peer route modules. `attachUserToTeam` and `consumeInvite` are business logic functions, not route-mounting functions. Their presence in `teams.ts` means `auth.ts` depends on a peer rather than on a shared lib.

```ts
// teams.ts:420 — exported from a route file (wrong layer)
export async function attachUserToTeam(kv, db, teamId, userId, email, role): Promise<void>
export async function consumeInvite(kv, tokenHash): Promise<{...} | null>
export { loadTeam, saveTeam }
```

**Fix — move team business logic to `lib/`:**

```ts
// NEW: functions/api/lib/team-service.ts
// Move attachUserToTeam, consumeInvite, loadTeam, saveTeam here.
// teams.ts:420–452 can then import from '../lib/team-service'
// auth.ts:29 becomes: import { attachUserToTeam } from '../lib/team-service'
```

No code changes to logic — only relocation to the correct layer.

---

### SA-04 — Copy-paste: `sha256Hex` and `clientIp` duplicated across modules
**Importance: 6/10**

**`sha256Hex`:**
- `functions/api/lib/voter.ts:8–15`
- `functions/api/middleware/rate-limit.ts:23–28`

Byte-for-byte identical implementations.

**`clientIp`:**
- `functions/api/lib/voter.ts:31–38`
- `functions/api/middleware/rate-limit.ts:31–37`

Again, byte-for-byte identical.

**`extractJson` (AI response parser):**
- `functions/api/lib/ai-wizard.ts:101–113`
- `functions/api/lib/ai-insights.ts:98–107`

Structurally identical — strip markdown fences, find first/last JSON brace/bracket. Different only in the error class thrown.

**Fix — consolidate into `lib/crypto.ts` and `lib/ai-common.ts`:**

```ts
// NEW: functions/api/lib/crypto.ts
const TE = new TextEncoder()

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', TE.encode(input))
  const bytes = new Uint8Array(digest)
  let out = ''
  for (const b of bytes) out += b.toString(16).padStart(2, '0')
  return out
}

export function clientIp(req: Request): string {
  return (
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-forwarded-for') ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}
```

```ts
// NEW: functions/api/lib/ai-common.ts
export function extractJsonFromAIResponse(raw: string): string {
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  const body = (fenceMatch ? fenceMatch[1] : raw).trim()
  const firstBrace = body.indexOf('{')
  const firstBracket = body.indexOf('[')
  const startsWithArray = firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)
  const first = startsWithArray ? firstBracket : firstBrace
  const last = startsWithArray ? body.lastIndexOf(']') : body.lastIndexOf('}')
  if (first === -1 || last === -1 || last <= first) {
    throw new Error('AI response did not contain a JSON object or array')
  }
  return body.slice(first, last + 1)
}
```

---

### SA-05 — Copy-paste: 4 identical admin React hooks, no abstraction
**Importance: 6/10**

**Location:** `src/hooks/useAdminAnalytics.ts`, `useAdminKpis.ts`, `useAdminOps.ts`, `useAdminUsers.ts`

All 4 hooks are structurally identical — `useState × 3`, `useCallback` fetch, `useEffect` with `setInterval`. Only the endpoint URL and poll interval differ.

```ts
// useAdminAnalytics.ts (representative)
const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
const [loading, setLoading] = useState(true)
const [error, setError] = useState<string | null>(null)
const fetchAnalytics = useCallback(async () => { ... }, [])
useEffect(() => {
  fetchAnalytics()
  const interval = setInterval(fetchAnalytics, 60_000)
  return () => clearInterval(interval)
}, [fetchAnalytics])
return { analytics, loading, error, refresh: fetchAnalytics }
```

**Fix — generic `usePolledApi` hook (already recommended in code-duplication-audit.md):**

```ts
// src/hooks/usePolledApi.ts
export function usePolledApi<T>(endpoint: string, intervalMs: number) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const refresh = useCallback(async () => {
    const res = await api<T>(endpoint)
    if (res.ok) { setData(res.data); setError(null) }
    else setError(res.error.message)
    setLoading(false)
  }, [endpoint])
  useEffect(() => {
    refresh()
    const id = setInterval(refresh, intervalMs)
    return () => clearInterval(id)
  }, [refresh, intervalMs])
  return { data, loading, error, refresh }
}

// useAdminAnalytics.ts becomes:
export function useAdminAnalytics() {
  return usePolledApi<AnalyticsData>('/api/admin/analytics', 60_000)
}
```

---

### SA-06 — Dead abstraction: `kv-cache.ts` (205 lines, never imported)
**Importance: 5/10**

**Location:** `functions/api/middleware/kv-cache.ts`

This file exports `cachePlanUsage`, `cacheTeamMetadata`, `cacheUserRoles`, and `cacheLeaderboard`. None are imported anywhere:

```bash
grep -rn "kv-cache" functions/api/  # zero results
```

The file also contains defects: it reads from `DECISIONS_KV` for plan and team data (wrong namespace), and calls `getPlanUsageWithCache` which queries columns that do not exist in `schema.sql`. Meanwhile, `perf-optimize.ts:106–122` documents the KV caching strategy that `kv-cache.ts` was meant to implement — a further sign that both files are aspirational rather than operational.

**Fix — delete it:**

```bash
git rm functions/api/middleware/kv-cache.ts
```

If plan/RBAC KV caching is implemented in the future, build it correctly from `perf-optimize.ts:106–122`'s documented key schema.

---

### SA-07 — `perf-optimize.ts`: documentation masquerading as code
**Importance: 5/10**

**Location:** `functions/api/lib/perf-optimize.ts`

`batchQueryPatterns` at lines 81–100 documents the correct approach to N+1 queries — but the actual production code in `gamification.ts:162–210` still executes N+1 queries per participant. The fix exists as a comment in a lib file; it is never used.

```ts
// perf-optimize.ts:82-93 — documented but never called
fetchQuestionsBatch: (sessionIds: string[]) =>
  `SELECT * FROM questions WHERE session_id IN (${sessionIds.map(() => '?').join(',')}) …`
```

```ts
// gamification.ts:162-210 — still running N+1 in production
for (const { voter_id } of participants) {
  const voteCountResult = await db.prepare(`SELECT COUNT(*) WHERE voter_id = ?`).bind(sessionId, voter_id).first()
  const firstVoteResult = await db.prepare(`SELECT MIN(submitted_at) WHERE voter_id = ?`).bind(sessionId, voter_id).first()
  const sessionStartResult = await db.prepare(`SELECT started_at WHERE id = ?`).bind(sessionId).first()
}
```

**Fix — apply the documented pattern to `gamification.ts`:**

```ts
// Replace the N+1 loop in gamification.ts:162-210
const voteStats = await (c.env.DB.prepare as any)(
  `SELECT voter_id,
          COUNT(*) AS vote_count,
          MIN(submitted_at) AS first_vote_at
   FROM votes
   WHERE session_id = ?1
   GROUP BY voter_id`,
).bind(sessionId).all()

const sessionRow = await (c.env.DB.prepare as any)(
  `SELECT started_at FROM sessions WHERE id = ?1`,
).bind(sessionId).first()
const sessionStartTime = sessionRow?.started_at

for (const { voter_id, vote_count, first_vote_at } of voteStats.results ?? []) {
  const sessionStats = {
    first_answer: first_vote_at && sessionStartTime && (first_vote_at - sessionStartTime < 1000),
    answer_count: vote_count,
    engagement: vote_count > 8,
  }
  // … badge logic unchanged
}
```

---

### SA-08 — `any` type proliferation in three route files
**Importance: 5/10**

**Locations:**
- `routes/energizers.ts` — 27 `any` usages (DB prepare cast, result iteration)
- `routes/gamification.ts` — 13 `any` usages
- `middleware/rbac.ts` — `c: any`, `c.env.DB.prepare as any`, `c.get('_rbac_cache') as any`

`any` in route files primarily exists because D1's TypeScript bindings require a cast for `.prepare()` on typed databases, and because the Hono context generic is sometimes omitted.

The real harm is in rbac.ts, where `getUserRoles(c: any, userId: string)` loses all type safety on the context object — any typo in `c.env.DB`, `c.get(...)` etc. is invisible to the compiler.

**Fix — replace `any` in rbac.ts:**

```ts
// rbac.ts:132 — add proper context typing
import type { Context } from 'hono'
import type { Env } from '../types'
import type { AuthVariables, RbacVariables } from './auth'

type RbacContext = Context<{ Bindings: Env; Variables: AuthVariables & RbacVariables }>

async function getUserRoles(c: RbacContext, userId: string): Promise<string[]> {
  const cached = c.get('_rbac_cache' as never) as { roles: string[] } | undefined
  if (cached?.roles) return cached.roles
  try {
    const rows = await c.env.DB
      .prepare(`SELECT role FROM user_roles WHERE user_id = ?1`)
      .bind(userId)
      .all<{ role: string }>()
    const roles = rows.results.map((r) => r.role)
    if (roles.length === 0) roles.push('viewer')
    c.set('_rbac_cache' as never, { roles })
    return roles
  } catch {
    return ['viewer']
  }
}
```

---

### SA-09 — `patchSchemaIfNeeded` — migration logic embedded in a route module
**Importance: 4/10**

**Location:** `functions/api/routes/sessions.ts:56–72`

Schema migration is not route logic. `patchSchemaIfNeeded` runs idempotent `ALTER TABLE` statements on cold-start to backfill missing columns. It:
1. Lives inside `routes/sessions.ts`, not in a migration layer
2. Uses `.catch(() => {})` to suppress all errors (including D1 outages)
3. Sets `_schemaPatchDone = true` before DB calls complete

**Fix — move to `lib/migrations.ts` and call from `app.ts` or `worker/index.ts`:**

```ts
// NEW: functions/api/lib/migrations.ts
let _done = false
export async function runMigrationsIfNeeded(db: D1Database): Promise<void> {
  if (_done) return
  try { await db.prepare('SELECT 1').first() } catch { return }  // probe before marking done
  _done = true
  const alters = [
    `ALTER TABLE sessions ADD COLUMN vote_policy TEXT NOT NULL DEFAULT 'once' …`,
    // … other alters
  ]
  for (const sql of alters) {
    await db.prepare(sql).run().catch(() => {})
  }
}

// worker/index.ts or app.ts startup:
app.use('*', async (c, next) => {
  await runMigrationsIfNeeded(c.env.DB)
  return next()
})
```

---

### SA-10 — `auth.ts` embeds 7 authentication protocols with no strategy abstraction
**Importance: 4/10**

**Location:** `functions/api/routes/auth.ts:60–670`

7 authentication protocols as inline handler closures inside `mountAuthRoutes`:
1. Magic link request (line 69)
2. Magic link callback (line 137)
3. Password sign-up (line 225)
4. Password sign-in (line 279)
5. Password reset request (line 325)
6. Password reset confirm (line 365)
7. Google OAuth (lines 430–481)
8. Microsoft OAuth (lines 487–524)
9. SAML callback (line 582)
10. Logout (line 648)

Each protocol has different input validation, different state mutations, different redirects. All share the same function scope.

**Fix — split by protocol family:**

```ts
// NEW: functions/api/routes/auth/
//   magic-link.ts    — /api/auth/request + /api/auth/callback
//   password.ts      — /api/auth/signup + /api/auth/login + /api/auth/reset*
//   oauth.ts         — /api/auth/google + /api/auth/microsoft
//   saml.ts          — /api/auth/saml/*
//   session.ts       — /api/auth/logout + /api/auth/invite/*

// auth/index.ts — compose
export function mountAuthRoutes(parent) {
  mountMagicLinkRoutes(parent)
  mountPasswordRoutes(parent)
  mountOAuthRoutes(parent)
  mountSamlRoutes(parent)
  mountSessionRoutes(parent)
}
```

No logic changes — pure file organization with a thin coordinator.

---

## 5. Modularity Rating

**Overall: 5/10**

| Layer | Score | Rationale |
|-------|-------|-----------|
| Middleware pipeline | **8/10** | 9 modules, each single-responsibility. `kv-cache.ts` is dead but contained. |
| `lib/` utilities | **7/10** | Well-scoped. `perf-optimize.ts` is doc-as-code. `ai-wizard.ts` (404L) could split AI orchestration from prompt building. |
| `realtime.ts` / `types.ts` | **8/10** | Clean wire-format separation. WebSocket protocol in one file, shared types in one file. |
| Route handlers | **3/10** | Four God modules. Cross-route coupling. Business logic in handlers. No service layer. |
| `SessionRoom.ts` | **6/10** | Well-bounded as a DO. `webSocketMessage` switch (CC≈22) handles too many message types inline but containment is correct. |
| Frontend hooks | **5/10** | 4 structurally identical hooks. `api/client.ts` is excellent — single, typed fetch wrapper. |
| Frontend pages | **6/10** | 17 pages with clear routing boundaries. Some pages mix data fetching with rendering (no hook abstraction). |

**What raises it above 4:** The middleware chain is genuinely well-designed. `lib/` utilities are clean and focused. `types.ts` + `realtime.ts` give a shared vocabulary. `api/client.ts` on the frontend is a textbook thin client.

**What holds it at 5:** The route layer — which is where 70% of the code lives — has no service layer, no Repository pattern, and three God modules above 680 lines. Fixing SA-01, SA-02, and SA-03 alone would raise this to 7/10.

---

## Finding Summary

| ID | Pattern | Location | Importance |
|----|---------|----------|-----------|
| SA-01 | God Module — `sessions.ts` does 9 concerns | `routes/sessions.ts` (1863L) | **9/10** |
| SA-02 | God Module — `energizers.ts` CC≈91, 6 types inline | `routes/energizers.ts` (758L) | **8/10** |
| SA-03 | Tight coupling — `auth.ts` imports from peer `teams.ts` | `auth.ts:29` | **7/10** |
| SA-04 | Copy-paste — `sha256Hex`, `clientIp`, `extractJson` tripled | `voter.ts`, `rate-limit.ts`, `ai-*.ts` | **6/10** |
| SA-05 | Copy-paste — 4 identical admin hooks | `src/hooks/useAdmin*.ts` | **6/10** |
| SA-06 | Dead abstraction — `kv-cache.ts` imported nowhere | `middleware/kv-cache.ts` | **5/10** |
| SA-07 | Doc-as-code — `perf-optimize.ts` documents N+1 fix not applied | `lib/perf-optimize.ts` | **5/10** |
| SA-08 | `any` proliferation — 40+ usages lose compiler safety | `energizers.ts`, `gamification.ts`, `rbac.ts` | **5/10** |
| SA-09 | Missing abstraction — migration logic in route module | `sessions.ts:56-72` | **4/10** |
| SA-10 | God Module (auth) — 10 auth protocols, no strategy | `routes/auth.ts` (680L) | **4/10** |
