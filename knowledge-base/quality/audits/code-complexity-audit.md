---
id: AUDIT-CODE_COMPLEXITY_AUDIT
type: audit
category: quality
status: active
version: 1.0
created: 2026-04-20
updated: 2026-05-11
tags:
  - audit
  - quality
  - findings
relates_to:
  - REMEDIATION_PLAN
---

# Code Complexity Audit — Qesto

**Date:** 2026-05-02  
**Scope:** Full codebase (`functions/`, `src/`, `worker/`)  
**Methodology:** Manual static analysis — cyclomatic complexity approximated as decision-point count + 1 (each `if`, `else if`, ternary `?:`, `&&`, `||`, `for`, `while`, `catch`, `switch case`, `??` counts as +1).

---

## Executive Summary

| Severity | Findings | Top offender |
|----------|----------|-------------|
| Critical (CC > 40) | 3 | `mountEnergizerRoutes` — CC ≈ 91, 726 LOC |
| High (CC 15–40) | 9 | `mountAuthRoutes` — CC ≈ 46, 621 LOC |
| Medium (CC 10–14) | 8 | `precomputeInsights`, `GET /analytics`, etc. |
| LOC violations (file > 300) | 9 files | `sessions.ts` — 1 864 lines |
| Coupling hotspots | 3 | `sessions.ts` — 17 imports, 13 route handlers |

---

## 1. Cyclomatic Complexity

### C-01 — `mountEnergizerRoutes` is a God Function

**Importance: 10/10**

| Metric | Value |
|--------|-------|
| File | `functions/api/routes/energizers.ts:32–758` |
| LOC | 726 |
| CC (approx) | **≈ 91** |
| Max nesting depth | **7** |
| Route handlers inside | 8 |
| Energizer types handled | 6 (battle_royale, bracket, emoji_poll, quick_finger, team_quiz, word_cloud) |

All energizer business logic — creation, listing, voting, state advancement, leaderboard — is fused into a single exported function. The voting handler alone contains a `switch` over 6 energizer kinds, each with 3–8 nested conditions. Depth-7 nesting appears in the vote/word-cloud path.

**Structural symptom:**
```ts
// energizers.ts:52 — kind discriminated by string at every call site
if (!['battle_royale', 'bracket', 'emoji_poll', 'quick_finger', 'team_quiz', 'word_cloud'].includes(body.kind)) { … }
// … 700 more lines of if/else if chains for each kind inside each handler
```

**Refactoring plan:**

Split into one file per energizer family + a thin router:

```
functions/api/routes/energizers/
  index.ts          ← mounts sub-routers, <30 lines
  battle-royale.ts  ← mountBattleRoyaleRoutes()
  bracket.ts        ← mountBracketRoutes()
  emoji-poll.ts     ← mountEmojiPollRoutes()
  quick-finger.ts   ← mountQuickFingerRoutes()
  team-quiz.ts      ← mountTeamQuizRoutes()
  word-cloud.ts     ← mountWordCloudRoutes()
  shared.ts         ← common auth check, ownership guard
```

Each sub-router handles only its own kind; `shared.ts` provides:
```ts
export async function requireOwner(c: Context, sessionId: string): Promise<boolean> {
  const user = c.get('user')
  const session = await c.env.DB.prepare('SELECT owner_id FROM sessions WHERE id = ?1')
    .bind(sessionId).first<{ owner_id: string }>()
  return session?.owner_id === user.sub
}
```

Estimated CC reduction: 91 → ~8 per sub-router (≈ 90% reduction).

---

### C-02 — `mountAuthRoutes` is a mega-function spanning all auth flows

**Importance: 9/10**

| Metric | Value |
|--------|-------|
| File | `functions/api/routes/auth.ts:59–680` |
| LOC | **621** |
| CC (approx) | **≈ 46** |
| Max nesting depth | 6 |
| Distinct auth flows | 7 (magic link, verify, password set/reset, Google OAuth, Microsoft OAuth, SAML, logout) |

The outer function `mountAuthRoutes` is the registration site for seven independent auth protocols. Each protocol has its own branching logic, error paths, and KV keys. A change to magic-link flow risks breaking SAML because they share the same function closure and the same `app` instance.

**Refactoring plan — split by auth protocol:**
```
functions/api/routes/auth/
  index.ts         ← 20 lines, mounts sub-apps
  magic-link.ts    ← /request, /verify (CC ≈ 8)
  password.ts      ← /set-password, /reset (CC ≈ 6)
  oauth-google.ts  ← /oauth/google, /oauth/google/callback (CC ≈ 7)
  oauth-microsoft.ts
  saml.ts          ← /saml/init, /saml/callback (CC ≈ 8)
  session.ts       ← /refresh, /logout (CC ≈ 3)
```

Each file would be ~60–100 lines and independently testable.

---

### C-03 — `mountAIInsightsRoutes` bundles AI orchestration + Vectorize + caching

**Importance: 8/10**

| Metric | Value |
|--------|-------|
| File | `functions/api/routes/ai-insights.ts:37–344` |
| LOC | **308** |
| CC (approx) | **≈ 42** |
| Max nesting depth | 6 |

Handles: insights cache read, Vectorize similarity search, AI model invocation, fallback logic, cache write, semantic search, and all error paths in a single nested function. The Vectorize path alone has 4 levels of try/catch with branching on missing bindings, query failures, and parse errors.

**Refactoring:**
```ts
// Extract three focused helpers:
async function getCachedInsights(kv: KVNamespace, sessionId: string): Promise<CachedInsight | null>
async function searchSimilarSessions(vi: VectorizeIndex, embedding: number[], limit: number): Promise<string[]>
async function generateAndCacheInsights(env: Env, sessionId: string, input: InsightsInput): Promise<InsightResult>
```

Each helper has CC ≈ 5. The route handler becomes a coordinator of ≤ 20 lines.

---

### C-04 — `handleVote` in `SessionRoom.ts`

**Importance: 8/10**

| Metric | Value |
|--------|-------|
| File | `functions/api/SessionRoom.ts:496–596` |
| LOC | **101** |
| CC (approx) | **≈ 18** |
| Max nesting depth | 5 |

Handles rate limiting, pause checking, question validation, option validation, vote-policy branching (once / multi / react / multi_select kinds), and count mutation all in one function. The branching on `MULTI_VOTE_KINDS`, `votePolicy === 'once'`, `votePolicy === 'multi'`, and the fallback `react` case creates four parallel execution paths that each independently mutate `voters` and `counts`.

**Refactoring — extract vote-policy strategies:**
```ts
// SessionRoom.ts — before: 40-line if/else chain
// After: table-driven dispatch
type VoteResult = { countKey: string | null; countDecKey: string | null }

function applyOncePolicy(voters: Voters, voterId: string, optionId: string): VoteResult | 'duplicate' { … }
function applyMultiPolicy(voters: Voters, voterId: string, optionId: string): VoteResult | 'duplicate' { … }
function applyMultiSelectPolicy(voters: Voters, voterId: string, optionId: string): VoteResult | 'duplicate' { … }

const POLICY_HANDLERS = {
  once: applyOncePolicy,
  multi: applyMultiPolicy,
  react: applyReactPolicy,
} satisfies Record<VotePolicy, PolicyHandler>
```

`handleVote` becomes: validate inputs → call `POLICY_HANDLERS[votePolicy]()` → update counts.

---

### C-05 — `webSocketMessage` in `SessionRoom.ts`

**Importance: 7/10**

| Metric | Value |
|--------|-------|
| File | `functions/api/SessionRoom.ts:337–433` |
| LOC | **97** |
| CC (approx) | **≈ 22** |
| Max nesting depth | 5 |

Dispatches on `msg.type` with a `switch` over 9 cases, each containing nested auth checks, state checks, and mutations. The `navigate` case re-fetches the question list and validates index bounds inside the switch arm.

**Fix — extract each message type into a named handler:**
```ts
const MESSAGE_HANDLERS: Record<string, (ws: WebSocket, att: Attachment, data: unknown, ctx: DO) => Promise<void>> = {
  vote:       handleVote,
  navigate:   handleNavigate,
  set_paused: handleSetPaused,
  // …
}

// webSocketMessage becomes:
async webSocketMessage(ws: WebSocket, event: MessageEvent<string>) {
  const msg = parseMsg(event.data)
  if (!msg) return
  const handler = MESSAGE_HANDLERS[msg.type]
  if (!handler) { ws.send(errorMessage('unknown', `Unknown type: ${msg.type}`)); return }
  await handler(ws, ws.deserializeAttachment(), msg.data, this)
}
```

---

### C-06 — `useLiveSession` hook

**Importance: 7/10**

| Metric | Value |
|--------|-------|
| File | `src/hooks/useLiveSession.ts:146–321` |
| LOC | **176** |
| CC (approx) | **≈ 24** |
| Max nesting depth | 5 |

One hook handles: URL construction, subprotocol selection, WebSocket lifecycle, 9-case message dispatch, exponential backoff reconnect, cleanup on unmount, and message sending. The `connect` callback (lines 162–282) is 121 lines on its own.

**Refactoring — separate concerns:**
```ts
// useWebSocket.ts — raw lifecycle (connect/reconnect/close)
export function useWebSocket(url: string | null, subprotocols?: string[]):
  { ws: WebSocket | null; status: 'connecting' | 'open' | 'closed' }

// useLiveSession.ts — only message dispatch and state
// connect callback shrinks from 121 → ~20 lines
```

The `reducer` (lines 87–138, 52 LOC, CC ≈ 13) can stay as-is since it is pure and already isolated.

---

### C-07 — `POST /:id/start` (session start) handler

**Importance: 7/10**

| Metric | Value |
|--------|-------|
| File | `functions/api/routes/sessions.ts:687–830` |
| LOC | **144** |
| CC (approx) | **≈ 18** |
| Max nesting depth | 5 |

The start flow handles: ownership guard, status guard, question existence check, conditional D1 UPDATE (optimistic concurrency), concurrent-win branch, DO `/init` call, three DO failure branches (already_initialised / generic failure / rollback failure), rollback attempt, analytics event, first-session analytics event. All in one handler.

**Refactoring — extract coordination steps:**
```ts
// sessions.ts
async function transitionToLive(db: D1Database, sessionId: string, ownerId: string, now: number): Promise<boolean>
async function initSessionRoom(env: Env, session: Session, liveQ: LiveQuestion): Promise<void>

// Handler body becomes:
const changed = await transitionToLive(db, id, user.sub, now)
if (!changed) return handleConcurrentStart(c, session, liveQ)
await initSessionRoom(c.env, session, liveQ)
return c.json({ ok: true, data: { session, question: liveQ }, trace_id })
```

CC of handler drops from 18 to ≈ 4; rollback logic moves to `initSessionRoom` which is independently testable.

---

### C-08 — `PATCH /:id` — session field update handler

**Importance: 6/10**

| Metric | Value |
|--------|-------|
| File | `functions/api/routes/sessions.ts:574–684` |
| LOC | **111** |
| CC (approx) | **≈ 20** |
| Max nesting depth | 4 |

Eight independent `if (parsed.data.fieldName !== undefined)` blocks each issue a separate `DB.prepare().bind().run()`. This is structural duplication (8 sequential mutations) rather than branching logic, but it inflates CC because of the ternary in each `bind()` call.

**Fix — build a single dynamic UPDATE:**
```ts
// sessions.ts — PATCH handler
const ALLOWED_SCALAR_FIELDS = [
  'title', 'anonymity', 'vote_policy', 'session_mode',
  'ai_generated', 'ai_consent_at', 'ai_grounding_hash',
  'ai_accepted_count', 'ai_dismissed_count',
] as const

const sets: string[] = []
const vals: unknown[] = []
for (const field of ALLOWED_SCALAR_FIELDS) {
  if (parsed.data[field] !== undefined) {
    sets.push(`${field} = ?${vals.length + 1}`)
    vals.push(field === 'ai_generated' ? (parsed.data[field] ? 1 : 0) : parsed.data[field])
  }
}
if (sets.length > 0) {
  vals.push(id, user.sub)
  await c.env.DB.prepare(
    `UPDATE sessions SET ${sets.join(', ')} WHERE id = ?${vals.length - 1} AND owner_id = ?${vals.length}`
  ).bind(...vals).run()
}
```

Reduces 8 DB round-trips to 1, and CC from 20 to ≈ 5.

---

### C-09 — `verifyJwtWithJwks` in `lib/oauth.ts`

**Importance: 6/10**

| Metric | Value |
|--------|-------|
| File | `functions/api/lib/oauth.ts:147–205` |
| LOC | **59** |
| CC (approx) | **≈ 18** |
| Max nesting depth | 4 |

Performs header decode, key matching, issuer check, audience check, expiry check, signature verify, and claim extraction — each with an early-return guard. This is inherently sequential validation. The high CC comes from the density of guards, not control flow complexity.

**Fix — Extract a sequential validator array:**
```ts
type JwtCheck = (claims: JwtClaims, env: { clientId: string; issuer: string }) => string | null

const JWT_CHECKS: JwtCheck[] = [
  (c, e) => c.iss === e.issuer ? null : 'issuer mismatch',
  (c, e) => (Array.isArray(c.aud) ? c.aud : [c.aud]).includes(e.clientId) ? null : 'audience mismatch',
  (c)    => c.exp > Date.now() / 1000 ? null : 'token expired',
]

// verifyJwtWithJwks body:
for (const check of JWT_CHECKS) {
  const err = check(claims, { clientId, issuer })
  if (err) return null
}
```

This trades implicit CC for an explicit data-driven list, making new checks trivial to add.

---

### C-10 — `precomputeInsights` in `sessions.ts`

**Importance: 6/10**

| Metric | Value |
|--------|-------|
| File | `functions/api/routes/sessions.ts:198–293` |
| LOC | **96** |
| CC (approx) | **≈ 11** |
| Max nesting depth | 4 |

Background insight generation mixes data collection (D1 queries for open responses + poll breakdowns), AI model invocation, and KV cache write in a single function. The inner `for` loop over `qRows` with nested vote aggregation and option parsing creates a 4-level nest.

**Fix — extract two data-fetching helpers:**
```ts
async function collectOpenResponses(db: D1Database, sessionId: string): Promise<string[]>
async function collectPollBreakdown(db: D1Database, sessionId: string): Promise<QuestionBreakdown[]>

// precomputeInsights becomes:
const [openResponses, pollBreakdown] = await Promise.all([
  collectOpenResponses(env.DB, sessionId),
  collectPollBreakdown(env.DB, sessionId),
])
```

Both helpers are also reusable from `mountInsightsRoutes` which currently duplicates the same queries at `insights.ts:75–141`.

---

## 2. Lines of Code Violations

### L-01 — `sessions.ts` is a monolith (1 864 lines, 13 route handlers)

**Importance: 9/10**

| File | Lines | Route handlers |
|------|-------|---------------|
| `functions/api/routes/sessions.ts` | **1 864** | 13 |

Contains: session CRUD, AI question generation (JSON + SSE), AI refinement, preflight checks, results retrieval, CSV export, session duplicate, WebSocket upgrade, background insight precomputation. These are distinct sub-domains sharing only the database binding.

**Split proposal:**

```
functions/api/routes/sessions/
  index.ts          ← mountSessionRoutes, <50 lines
  crud.ts           ← POST, GET, PATCH, DELETE, duplicate (CC each ≤ 8)
  lifecycle.ts      ← /start, /close (the two state machine transitions)
  questions.ts      ← POST /questions, PUT /questions/reorder, PATCH /questions/:id
  ai.ts             ← /questions/generate, /ai/generate, /ai/refine
  results.ts        ← GET /results, GET /export.csv
  preflight.ts      ← GET /preflight
  ws.ts             ← GET /:id/ws, GET /by-code/:code (public routes)
  insights-bg.ts    ← precomputeInsights (background function)
```

Each file would be 60–150 lines. `lifecycle.ts` alone removes the most complex handlers from the main file.

---

### L-02 — `admin.ts` (873 lines), 9 route handlers in one file

**Importance: 7/10**

Handlers span three unrelated concerns: metrics (live KV + historical D1 + CSV export), user management (CRUD + suspend/restore), and operational health (ops summary + analytics).

**Split proposal:**
```
functions/api/routes/admin/
  index.ts      ← mountAdminRoutes, apply shared middleware
  metrics.ts    ← /metrics/live, /metrics/historical, /metrics/export
  users.ts      ← /users (CRUD), /users/:id/suspend, /users/:id/restore
  platform.ts   ← /kpis, /ops/summary, /analytics, /audit
```

---

### L-03 — `auth.ts` (680 lines), `energizers.ts` (758 lines), `SessionRoom.ts` (717 lines)

**Importance: 7/10** (all three)

All three exceed the 300-line target and should be split as described in C-01 and C-02.

`SessionRoom.ts` is a Durable Object class — the class itself cannot be split across files, but the 22 methods could be extracted to module-level functions (which is already done for some, e.g., `normaliseVotes`, `isFreeTextKind`) and imported back. The DO class itself would shrink to ~200 lines of delegation.

---

### L-04 — `teams.ts` (452 lines), `ai-wizard.ts` (404 lines), `templates.ts` (367 lines)

**Importance: 5/10**

These are over the 300-line threshold but cohesive enough that splitting is lower priority. No function in these files exceeds 270 lines individually.

---

## 3. Cognitive Complexity

### CC-01 — `POST /:id/ai/generate` — SSE stream inside nested error handler

**Importance: 7/10**

File: `functions/api/routes/sessions.ts:1104–1215` (112 LOC)

The SSE `ReadableStream` controller closure contains a try/catch with two `instanceof` branches, each calling a different sanitizer:

```ts
const stream = new ReadableStream<Uint8Array>({
  async start(controller) {
    controller.enqueue(sse('ready', { … }))
    try {
      const result = await generateQuestions(…)   // level 3
      controller.enqueue(sse('questions', { … }))
      controller.enqueue(sse('done', { ok: true }))
    } catch (err) {
      if (err instanceof WizardValidationError) {  // level 4
        controller.enqueue(sse('error', { … }))
      } else if (err instanceof WizardAIError) {   // level 4
        …
      } else {                                     // level 4
        …
      }
    } finally {
      controller.close()                           // level 3
    }
  },
})
```

This is the same error-handling logic as `POST /:id/questions/generate` (lines 1068–1095), which is NOT inside a stream. The duplication means future error codes must be added in two places.

**Fix — extract error-to-SSE mapper:**
```ts
function wizardErrToSsePayload(err: unknown, env: Env): { code: string; message: string; details?: unknown } {
  if (err instanceof WizardValidationError) return { code: 'ai_output_invalid', message: '…', details: err.details }
  if (err instanceof WizardAIError) return { ...sanitizeError(err, env.ENV, 500), code: 'ai_failed' }
  return { code: 'internal_error', message: err instanceof Error ? err.message : 'Unexpected error' }
}
```

Reused in both the SSE stream and the JSON endpoint.

---

### CC-02 — `POST /:id/close` — multi-phase vote persist inside close handler

**Importance: 6/10**

File: `functions/api/routes/sessions.ts:832–930` (99 LOC)

Vote persistence (DO → JSON parse → D1 batch insert), session status update, analytics event, and background `waitUntil` are sequentially mixed in one handler. The `try/catch` around `c.executionCtx.waitUntil` (lines 909–922) with a silent catch is particularly opaque — it only exists because Hono throws when no ExecutionContext is passed (test environment).

**Fix:**
```ts
// Extract vote persistence as a testable helper:
async function persistVotes(
  db: D1Database,
  sessionId: string,
  questionId: string,
  votes: VoteRow[],
): Promise<void>

// Document the waitUntil guard explicitly:
function safeWaitUntil(ctx: ExecutionContext | undefined, promise: Promise<void>): void {
  try { ctx?.waitUntil(promise) } catch { /* no ExecutionContext in test env */ }
}
```

---

### CC-03 — Mixed abstraction levels in `mountTeamRoutes`

**Importance: 6/10**

File: `functions/api/routes/teams.ts:153–412` (260 LOC, CC ≈ 38)

The function registers 6 route handlers directly as inline async functions. KV access, D1 role management, email invitation, and RBAC enforcement are interleaved at the same indentation level. Higher-level operations (`inviteMember`) and low-level KV helpers (`loadTeam`, `saveTeam`) live inside the same closure scope even though the KV helpers are already extracted as module-level functions.

**Fix — mount routes on a sub-app, extract invite logic:**
```ts
// teams.ts — before: 260-line mount function
// After: each route handler delegates to a named action
app.post('/:id/members', authMiddleware, planMiddleware, async (c) => {
  return inviteMember(c, c.req.param('id'))   // ← extracted, testable
})

async function inviteMember(c: Context, teamId: string): Promise<Response> { … } // ~40 lines
```

---

## 4. Coupling Metrics

### CP-01 — `sessions.ts` has the highest efferent coupling in the codebase

**Importance: 8/10**

| File | Import count | Unique modules depended on |
|------|-------------|--------------------------|
| `sessions.ts` | **17** | `ulid`, `code`, `idempotency`, `voter`, `observability`, `auth`, `plan`, `feature-gate`, `jwt`, `quota`, `entitlements`, `validation`, `ai-wizard`, `ai-insights`, `session-bundle`, `rate-limit`, `error-handler`, `realtime`, `types` |
| `auth.ts` | 15 | `jwt`, `tokens`, `email`, `rate-limit`, `ulid`, `observability`, `auth`, `plan`, `password`, `oauth`, `saml`, `teams` |
| `app.ts` | 12 | All route mount functions + middleware |
| `teams.ts` | 11 | |

`sessions.ts` depends on every AI lib, every auth primitive, the quota system, the idempotency lib, the voter identity lib, and the observability system. Any change to any of these 17 modules risks requiring a `sessions.ts` change. This is largely a consequence of the God-file problem (L-01) — splitting the file by concern would distribute dependencies naturally.

**Instability index** (I = Ce / (Ca + Ce)):

| Module | Ca (afferent) | Ce (efferent) | I |
|--------|--------------|--------------|---|
| `lib/jwt.ts` | 4 | 0 | 0.0 (stable) |
| `lib/entitlements.ts` | 5 | 1 | 0.17 (stable) |
| `lib/quota.ts` | 2 | 0 | 0.0 (stable) |
| `routes/sessions.ts` | 1 (app.ts) | 17 | **0.94 (unstable)** |
| `routes/auth.ts` | 1 (app.ts) | 15 | **0.94 (unstable)** |
| `routes/energizers.ts` | 1 (app.ts) | 4 | 0.8 |
| `lib/ai-wizard.ts` | 3 | 2 | 0.4 (balanced) |

Route files are correctly high-instability (they depend on everything). The issue is they are also very large, making the unstable surface area large.

---

### CP-02 — `admin.ts` uses `any` cast to access optional KV binding

**Importance: 5/10**

File: `functions/api/routes/admin.ts:227, 443, 720`

```ts
const kv = (c.env as unknown as Record<string, KVNamespace | undefined>)['METRICS_KV']
```

This cast is repeated 3× because `Env` declares `METRICS_KV?: KVNamespace` (optional), but Hono's `Context` types do not narrow optional properties gracefully. The cast breaks type safety.

**Fix — add a typed accessor:**
```ts
// functions/api/lib/env.ts
export function getMetricsKv(env: Env): KVNamespace | undefined {
  return env.METRICS_KV
}
```

This isolates the cast to one place and makes the optional access explicit in callers.

---

### CP-03 — `app.ts` is the pure integration point but contains its own route

**Importance: 4/10**

File: `functions/api/app.ts:117–126`

```ts
app.get('/api/version', (c) =>
  c.json({ ok: true, data: { env: c.env.ENV, commit: … }, trace_id: c.get('trace_id')! })
)
```

`app.ts` should be a pure wiring file. Embedding a live route creates a coupling between the integration layer and route-level concerns, making the version endpoint impossible to test without booting the full app.

**Fix:** Move to `functions/api/routes/health.ts` and call `mountHealthRoutes(app)` from `app.ts`.

---

## 5. Cohesion Analysis

### COH-01 — `sessions.ts` violates Single Responsibility at the file level

**Importance: 9/10** (see also L-01)

Responsibilities in one file:

| Responsibility | Handler |
|---------------|---------|
| Session CRUD | `POST /`, `GET /`, `GET /:id`, `DELETE /:id` |
| Question management | `POST /:id/questions`, `PUT .../reorder`, `PATCH .../questions/:id` |
| State machine | `POST /:id/start`, `POST /:id/close` |
| AI generation (JSON) | `POST /:id/questions/generate` |
| AI generation (SSE) | `POST /:id/ai/generate` |
| AI refinement | `POST /:id/ai/refine` |
| Preflight | `GET /:id/preflight` |
| Results | `GET /:id/results` |
| CSV export | `GET /:id/export.csv` |
| Duplicate | `POST /:id/duplicate` |
| Insights themes | `GET /:id/insights/themes` |
| WebSocket upgrade | `GET /:id/ws` |
| Public join-by-code | `GET /by-code/:code` |

This is 13 handler responsibilities across 1 864 lines. The split proposed in L-01 restores cohesion.

---

### COH-02 — `lib/gamification.ts` mixes two independent game types

**Importance: 5/10**

File: `functions/api/lib/gamification.ts` (197 lines)

Contains: `BattleRoyaleState`, `BracketState`, `EmojiPollConfig`, `QuickFingerConfig`, `TeamQuizConfig`, `WordCloudConfig` — six different game type definitions + algorithms in one module. `initializeBattleRoyale` and `initializeBracket` share no code. `determineBadgesAwarded` is also in this file despite being specific to gamification results.

**Fix:** Separate into `lib/game-battle-royale.ts`, `lib/game-bracket.ts`, and `lib/badges.ts`. The energizer sub-router split (C-01) would naturally drive this.

---

### COH-03 — `realtime.ts` is coherent but mislocated

**Importance: 3/10**

File: `functions/api/realtime.ts` (108 lines, type definitions only)

All types (`ClientMessage`, `ServerMessage`, `LiveQuestion`, etc.) defined here are WebSocket-protocol types. They are imported by `SessionRoom.ts`, `sessions.ts`, and `src/hooks/useLiveSession.ts`. The file is already single-purpose (good cohesion), but its name suggests it contains implementation — it only contains types. Rename to `ws-protocol.ts` for clarity.

---

## 6. Additional Findings

### A-01 — `patchSchemaIfNeeded` uses a module-level flag (hidden global state)

**Importance: 6/10**

File: `functions/api/routes/sessions.ts:58–72`

```ts
let _schemaPatchDone = false
async function patchSchemaIfNeeded(db: D1Database): Promise<void> {
  if (_schemaPatchDone) return
  _schemaPatchDone = true
  await db.prepare(`ALTER TABLE sessions ADD COLUMN …`).run().catch(() => {})
  // 7 more ALTER TABLE statements …
}
```

Module-level flag survives across requests in the same Worker isolate (intended), but:
1. Test isolation is broken — `_schemaPatchDone = true` leaks between test cases.
2. The function fires on every cold start regardless of migration state.

**Fix:** Remove once the D1 migrations are applied in `schema.sql`. Until then, expose a reset for tests:
```ts
export function _resetSchemaPatchFlag() { _schemaPatchDone = false } // test-only
```

---

### A-02 — `rowToCsv` has an inner function declaration inside a loop body

**Importance: 3/10**

File: `functions/api/routes/admin.ts:199–209`

```ts
function rowToCsv(row: MetricsSummaryRow): string {
  const escape = (v: string | number | null): string => {  // ← closure re-created per call
    …
  }
  return CSV_HEADERS.map((h) => escape(row[h] …)).join(',')
}
```

`escape` is re-created on every `rowToCsv` call. In a 10 000-row export this means 10 000 closure allocations. Minor, but avoidable.

**Fix:**
```ts
function escapeCsv(v: string | number | null): string { … }  // module-level
function rowToCsv(row: MetricsSummaryRow): string {
  return CSV_HEADERS.map((h) => escapeCsv(row[h] as string | number | null)).join(',')
}
```

---

## Refactoring Priority Queue

| Priority | Finding | File | Effort | Impact |
|----------|---------|------|--------|--------|
| 1 | C-01 Split energizers into 6 sub-routers | `energizers.ts` | 3–4 h | CC 91 → ≈ 8 |
| 2 | L-01 Split `sessions.ts` into 8 files | `sessions.ts` | 4–6 h | 1864 LOC → 8 × ~150 |
| 3 | C-02 Split `auth.ts` into protocol files | `auth.ts` | 3–4 h | CC 46 → ≈ 8 |
| 4 | C-04+C-05 Extract DO message handlers | `SessionRoom.ts` | 2–3 h | CC 18+22 → ≈ 5 each |
| 5 | C-08 Dynamic UPDATE in PATCH handler | `sessions.ts` | 1 h | CC 20 → 5; 8 → 1 DB round-trips |
| 6 | C-06 Extract WebSocket lifecycle hook | `useLiveSession.ts` | 2 h | CC 24 → ≈ 8 |
| 7 | L-02 Split `admin.ts` into 3 files | `admin.ts` | 2 h | 873 LOC → 3 × ~200 |
| 8 | C-10 Extract `precomputeInsights` helpers | `sessions.ts` | 1 h | CC 11 → 5; removes query duplication |
| 9 | CC-01 Shared WizardErr → SSE mapper | `sessions.ts` | 0.5 h | Removes handler duplication |
| 10 | CP-02 `getMetricsKv` typed accessor | `admin.ts` | 0.5 h | Removes 3× unsafe casts |
