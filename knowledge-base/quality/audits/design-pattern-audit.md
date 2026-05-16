---
id: AUDIT-DESIGN_PATTERN_AUDIT
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

# Design Pattern Audit — Qesto

**Date:** 2026-05-02  
**Scope:** Full codebase (`functions/`, `src/`)  
**Verdict scale:** ✅ Correctly implemented · ⚠️ Partially implemented · ❌ Anti-pattern or missing

---

## Summary Table

| # | Pattern | Location | Verdict | Importance |
|---|---------|----------|---------|-----------|
| CR-01 | Factory — `createApp`, `requireFeature`, `makeStripeClient` | `app.ts`, `feature-gate.ts`, `billing.ts` | ✅ | 6/10 |
| CR-02 | Factory — `mountXxxRoutes` as route-group factories | All route files | ✅ | 5/10 |
| CR-03 | Singleton — Module-level `_schemaPatchDone` flag | `sessions.ts:58` | ⚠️ | 6/10 |
| CR-04 | Builder — Dynamic SQL query builder in `queryAuditEvents` | `audit.ts:109` | ❌ | 7/10 |
| ST-01 | Facade — `makeStripeClient` over Stripe REST API | `billing.ts:23` | ✅ | 6/10 |
| ST-02 | Decorator — Hono middleware chain | `app.ts:34–83` | ✅ | 8/10 |
| ST-03 | Proxy — `ensureVoters()` virtual proxy | `SessionRoom.ts:158` | ✅ | 7/10 |
| ST-04 | Proxy — `kv-cache.ts` cache proxy wired to wrong KV namespace | `middleware/kv-cache.ts:30` | ❌ | 8/10 |
| ST-05 | Adapter — `toInsightsInput`, SAML lib, OAuth lib | `session-bundle.ts:36`, `lib/saml.ts`, `lib/oauth.ts` | ✅ | 6/10 |
| BH-01 | Strategy — Vote policy as if/else chain | `SessionRoom.ts:551–584` | ⚠️ | 8/10 |
| BH-02 | Strategy — Auth protocols in one monolith | `routes/auth.ts:59` | ⚠️ | 7/10 |
| BH-03 | Chain of Responsibility — middleware stack | `app.ts:34–84` | ✅ | 7/10 |
| BH-04 | Command — `withIdempotency` | `lib/idempotency.ts:43` | ✅ | 8/10 |
| BH-05 | Template Method — AI invocation pipeline duplicated | `ai-wizard.ts` vs `ai-insights.ts` | ⚠️ | 7/10 |
| BH-06 | Observer — `writeEvent` (single subscriber, no bus) | `lib/observability.ts:121` | ⚠️ | 5/10 |
| DM-01 | Repository — partial (quota, audit, teams KV helpers) | Multiple files | ⚠️ | 9/10 |
| DM-02 | Repository — missing for sessions and questions | `routes/sessions.ts` | ❌ | 9/10 |
| DM-03 | DTO / Value Objects — correctly used | `session-bundle.ts`, `ai-wizard.ts`, `entitlements.ts` | ✅ | 7/10 |
| DM-04 | State pattern — session lifecycle implicit | `routes/sessions.ts` | ⚠️ | 7/10 |
| DM-05 | Service Layer — libs are services; routes mix HTTP + business logic | `routes/sessions.ts` | ⚠️ | 8/10 |

---

## 1. Creational Patterns

### CR-01 — Factory functions: `createApp`, `requireFeature`, `makeStripeClient`

**Importance: 6/10** | ✅ Correctly implemented

**`createApp`** (`functions/api/app.ts:26`) is a pure Application Factory: creates a configured Hono instance, wires middleware, mounts sub-apps, and returns the object. No global state is captured. This is the correct pattern for edge runtime (Workers create a new isolate per request cold-start; singletons would be unsafe).

**`requireFeature(feature)`** (`functions/api/middleware/feature-gate.ts:15`) is a clean Middleware Factory:
```ts
export function requireFeature(feature: FeatureKey): MiddlewareHandler { … }
// Usage:
app.get('/:id/export.csv', requireFeature('resultsExport'), async (c) => { … })
```
The factory returns a closure capturing `feature`; no shared state. Correctly implemented.

**`makeStripeClient(secretKey)`** (`functions/api/routes/billing.ts:23`) creates a Stripe-SDK-shaped object over raw `fetch`. Correctly namespaced:
```ts
const stripe = makeStripeClient(c.env.STRIPE_SECRET_KEY)
await stripe.billingPortal.sessions.create({ customer, return_url })
```
The nesting mirrors the official Stripe SDK, reducing migration cost if the package becomes available.

---

### CR-02 — `mountXxxRoutes(parent)` as route-group factories

**Importance: 5/10** | ✅ Correctly implemented

Each `mountXxxRoutes` function creates a sub-Hono app, registers route handlers, and attaches it to the parent. This is a Factory that encapsulates route construction. `app.ts:148–158` composes them cleanly.

No remediation needed. The pattern is appropriate and consistently used.

---

### CR-03 — Module-level `_schemaPatchDone` flag (pseudo-Singleton)

**Importance: 6/10** | ⚠️ Partially implemented

`functions/api/routes/sessions.ts:58–72`:
```ts
let _schemaPatchDone = false
async function patchSchemaIfNeeded(db: D1Database): Promise<void> {
  if (_schemaPatchDone) return
  _schemaPatchDone = true
  await db.prepare(`ALTER TABLE sessions ADD COLUMN …`).run().catch(() => {})
  // 7 more ALTER TABLE statements…
}
```

The flag acts as a per-isolate Singleton. It works for its intended purpose (skip migrations after the first request per cold-start), but has three problems:

1. **Test bleed**: `_schemaPatchDone = true` leaks across test cases in the same Vitest process. Tests that run after a first call see no migration attempt.
2. **Indefinite growth**: Each new sprint added another `ALTER TABLE`. There are now 8. These should be proper D1 migrations in `schema.sql`.
3. **No rollback**: If an `ALTER` fails mid-list (anything after `catch(() => {})`), subsequent requests skip the remaining migrations silently.

**Fix — promote to schema.sql and remove entirely:**
```sql
-- schema.sql (proper migrations)
ALTER TABLE sessions ADD COLUMN vote_policy TEXT NOT NULL DEFAULT 'once'
  CHECK (vote_policy IN ('once','multi','react'));
ALTER TABLE sessions ADD COLUMN session_mode TEXT NOT NULL DEFAULT 'reflection'
  CHECK (session_mode IN ('reflection','fun'));
-- etc.
```

If the runtime patch must remain temporarily, at minimum export a reset for tests:
```ts
// sessions.ts — export for test isolation
export const __resetSchemaPatch = () => { _schemaPatchDone = false }
```

---

### CR-04 — `queryAuditEvents` builds SQL by string concatenation

**Importance: 7/10** | ❌ Anti-pattern

`functions/api/lib/audit.ts:109–130`:
```ts
let query = `SELECT * FROM audit_events WHERE 1=1`
const params: any[] = []
if (options.actor_id) {
  query += ` AND actor_id = ?${params.length + 1}`
  params.push(options.actor_id)
}
// … 4 more identical blocks
const countResult = await c.env.DB.prepare(
  query.replace('SELECT *', 'SELECT COUNT(*) as count')  // ← fragile
).bind(...params).first()
```

Issues:
1. **SQL injection surface**: `params.length + 1` positional binding is correct, but `query.replace('SELECT *', 'SELECT COUNT(*) as count')` assumes `SELECT *` appears exactly once and is not present in any filter value — this is fragile.
2. **`SELECT *`**: Fetches all columns including `before_snapshot` / `after_snapshot` blobs on every row even when only counting.
3. **`any[]` params**: Bypasses TypeScript type checking on bound values.
4. **Not a Builder**: It's inline imperative SQL construction, not an encapsulated Builder. The result is a leaky abstraction that exposes raw D1 `prepare` details.

**Fix — typed query builder using an allowed-list:**
```ts
// audit.ts — replace the dynamic SQL block

type AuditFilter = {
  actor_id?: string
  action?: AuditAction
  subject_type?: string
  since_ts?: number
  until_ts?: number
}

type AuditClause = { sql: string; value: string | number }

function buildAuditClauses(filter: AuditFilter): AuditClause[] {
  const clauses: AuditClause[] = []
  if (filter.actor_id)     clauses.push({ sql: 'actor_id = ?',     value: filter.actor_id })
  if (filter.action)       clauses.push({ sql: 'action = ?',       value: filter.action })
  if (filter.subject_type) clauses.push({ sql: 'subject_type = ?', value: filter.subject_type })
  if (filter.since_ts)     clauses.push({ sql: 'ts >= ?',          value: filter.since_ts })
  if (filter.until_ts)     clauses.push({ sql: 'ts <= ?',          value: filter.until_ts })
  return clauses
}

// Usage:
const clauses = buildAuditClauses(options)
const where = clauses.length > 0
  ? 'WHERE ' + clauses.map(c => c.sql).join(' AND ')
  : ''
const values = clauses.map(c => c.value)

const count = await db.prepare(`SELECT COUNT(*) as n FROM audit_events ${where}`)
  .bind(...values).first<{ n: number }>()
const rows = await db.prepare(
  `SELECT id, ts, actor_id, action, subject_type, subject_id, before_snapshot, after_snapshot, trace_id
   FROM audit_events ${where} ORDER BY ts DESC LIMIT ? OFFSET ?`
).bind(...values, limit, offset).all()
```

Note the explicit column list (not `SELECT *`) and typed `AuditClause` removes the `any[]` issue.

---

## 2. Structural Patterns

### ST-01 — Facade: `makeStripeClient`

**Importance: 6/10** | ✅ Correctly implemented

`functions/api/routes/billing.ts:23–61` is a textbook Facade:
- Hides raw `fetch` with URL construction, auth header injection, and AbortController timeout.
- Presents only the subset of Stripe API the app needs.
- Namespace structure (`stripe.billingPortal.sessions.create`) mirrors the official SDK.

One minor issue: `makeStripeClient` is created inside the route handler on every request:
```ts
app.post('/billing/portal', authMiddleware, async (c) => {
  // …
  const stripe = makeStripeClient(c.env.STRIPE_SECRET_KEY)   // ← per-request instantiation
  const session = await stripe.billingPortal.sessions.create(…)
})
```

The client itself is stateless (no pooling needed at edge), so per-request instantiation is fine and actually correct for Workers. No change needed.

---

### ST-02 — Decorator: Hono middleware chain

**Importance: 8/10** | ✅ Correctly implemented

`functions/api/app.ts:34–84` layers decorators in the correct dependency order:

```
trace-id → CORS → logger → CSRF → rate-limit (per route) → RBAC → route handler
                                                                  ↑
                                                            auth → plan → feature-gate
                                                                (applied per-route)
```

Each middleware decorates the handler without knowing about the others. `csrfMiddleware` correctly runs before `authMiddleware` to avoid spending JWT verification on blocked requests. `loggerMiddleware` runs after `next()` to capture the final response status.

`recordSpan` / `recordSpanSafe` in `lib/observability.ts:41` extend the Decorator pattern to arbitrary async operations:
```ts
const result = await recordSpan('d1.sessions.select', () => db.prepare(…).first(), ctx)
```
This wraps any async op with latency timing and error metrics without modifying the operation itself. Well-implemented.

---

### ST-03 — Virtual Proxy: `ensureVoters()` in `SessionRoom`

**Importance: 7/10** | ✅ Correctly implemented

`functions/api/SessionRoom.ts:158–167`:
```ts
private async ensureVoters(): Promise<Votes> {
  if (this._voters !== null) return this._voters
  if (!this._votersInitPromise) {
    this._votersInitPromise = this.ctx.storage
      .get<Record<string, string | string[]>>(K_VOTERS)
      .then(raw => { this._voters = normaliseVotes(raw) })
  }
  await this._votersInitPromise
  return this._voters!
}
```

This is a textbook Virtual Proxy with deduplication: the storage read fires exactly once even when two concurrent `handleVote` calls arrive in the same microtask queue slot. The shared `_votersInitPromise` ensures the second caller awaits the same storage read rather than issuing a second one. Correctly implemented.

---

### ST-04 — Cache Proxy: `kv-cache.ts` uses wrong KV namespace

**Importance: 8/10** | ❌ Anti-pattern

`functions/api/middleware/kv-cache.ts:30, 74, 95, 139, 162, 183`:
```ts
// getCached
const cached = await c.env.DECISIONS_KV.get(key, 'json')   // ← DECISIONS_KV

// cachePlanUsage
await c.env.DECISIONS_KV.put(key, JSON.stringify({ data: usage, expires_at: … }), …)

// cacheTeamMetadata
await c.env.DECISIONS_KV.put(`cache:team:${teamId}`, …)     // ← DECISIONS_KV for team data
```

**Problems:**
1. Plan usage, team metadata, and user roles are being written into `DECISIONS_KV`, which is documented as the store for AI decisions/vectorized embeddings. This mixes unrelated data domains, making namespace analysis impossible and risking eviction/collision with actual decision records.
2. The middleware pre-loads `cachedPlanUsage` (line 46–53) but nothing in any route handler actually reads `c.get('cachedPlanUsage')` — the cache hit is loaded and discarded.
3. `getPlanUsageWithCache` (line 87) queries columns `sessions_used`, `sessions_limit`, `results_viewed`, etc. that **do not exist** in `schema.sql`'s `users` table. The D1 query will return `null` on every call, defeating the cache entirely.
4. None of the cache write functions (`cachePlanUsage`, `cacheTeamMetadata`, `cacheUserRoles`, `cacheLeaderboard`) are called from any route handler — the middleware is inert dead code.

**Fix — use the correct namespace and wire the cache into callers:**
```ts
// kv-cache.ts — use SESSIONS_KV for plan/session data, TEAMS_KV for team data
async function getCachedPlan(kv: KVNamespace, userId: string): Promise<PlanTier | null> {
  const raw = await kv.get(`cache:plan:${userId}`, 'json') as { plan: PlanTier; exp: number } | null
  if (raw && raw.exp > Date.now()) return raw.plan
  return null
}

async function setCachedPlan(kv: KVNamespace, userId: string, plan: PlanTier, ttlSeconds = 300): Promise<void> {
  await kv.put(
    `cache:plan:${userId}`,
    JSON.stringify({ plan, exp: Date.now() + ttlSeconds * 1000 }),
    { expirationTtl: ttlSeconds },
  )
}
```

Then update `middleware/plan.ts` to use the cache:
```ts
// plan.ts — before D1 query, check KV cache
const cached = await getCachedPlan(c.env.SESSIONS_KV, user.sub)
const plan = cached ?? (await db.prepare('SELECT plan …').first<{plan: PlanTier}>())?.plan ?? 'free'
if (!cached) await setCachedPlan(c.env.SESSIONS_KV, user.sub, plan)
```

---

### ST-05 — Adapter: `toInsightsInput`, SAML, OAuth libs

**Importance: 6/10** | ✅ Correctly implemented

**`toInsightsInput(bundle)`** in `functions/api/lib/session-bundle.ts:36` is a textbook Adapter: converts the raw `SessionBundle` (D1-derived, deterministic) into the AI input format `InsightsInput`. The file comment explicitly names this as the "deterministic→AI boundary". The separation makes the AI call independently testable without D1.

**`lib/saml.ts`** adapts raw XML/SAML assertions (`parseAssertion`, `buildAuthnRequest`) into typed TypeScript objects. Correctly hides SAML protocol complexity.

**`lib/oauth.ts`** adapts Google and Microsoft OAuth endpoints into a unified interface (`buildGoogleAuthUrl`, `exchangeGoogleCode`, `buildMicrosoftAuthUrl`, `exchangeMicrosoftCode`). The adapters are similar enough that a single `OAuthProvider` interface would reduce duplication (see BH-02).

---

## 3. Behavioral Patterns

### BH-01 — Strategy: Vote policy as if/else chain

**Importance: 8/10** | ⚠️ Partially implemented

`functions/api/SessionRoom.ts:551–584` implements three vote policies (`once`, `multi`, `react`) and multi-vote kinds (`MULTI_VOTE_KINDS`) as nested if/else:

```ts
if (MULTI_VOTE_KINDS.has(question.kind)) {
  // multi_select / upvote / word_cloud logic
} else if (votePolicy === 'once') {
  // once policy
} else if (votePolicy === 'multi') {
  // multi (allow change)
} else {
  // react: accumulate
}
```

The policies are logically independent but share mutable access to `voters` and `counts`. Adding a new policy (e.g., `ranked_choice`) requires editing this block and re-reasoning about all four branches. There is no way to test a single policy in isolation.

**Fix — Strategy objects:**
```ts
// SessionRoom.ts — extracted strategy type
type PolicyResult = { countKey: string; countDecKey: string | null } | 'duplicate' | 'error'

type VoteStrategy = (voters: Votes, voterId: string, optionId: string) => PolicyResult

const onceStrategy: VoteStrategy = (voters, voterId, optionId) => {
  if ((voters[voterId]?.length ?? 0) > 0) return 'duplicate'
  voters[voterId] = [optionId]
  return { countKey: optionId, countDecKey: null }
}

const multiStrategy: VoteStrategy = (voters, voterId, optionId) => {
  const previous = voters[voterId]?.[0]
  if (previous === optionId) return 'duplicate'
  voters[voterId] = [optionId]
  return { countKey: optionId, countDecKey: previous ?? null }
}

const reactStrategy: VoteStrategy = (voters, voterId, optionId) => {
  voters[voterId] = [optionId]
  return { countKey: optionId, countDecKey: null }
}

const multiSelectStrategy: VoteStrategy = (voters, voterId, optionId) => {
  const previous = voters[voterId] ?? []
  if (previous.includes(optionId)) return 'duplicate'
  voters[voterId] = [...previous, optionId]
  return { countKey: optionId, countDecKey: null }
}

const VOTE_STRATEGIES: Record<VotePolicy, VoteStrategy> = {
  once:  onceStrategy,
  multi: multiStrategy,
  react: reactStrategy,
}

// handleVote — strategy selection:
const strategy = MULTI_VOTE_KINDS.has(question.kind)
  ? multiSelectStrategy
  : VOTE_STRATEGIES[votePolicy]
const result = strategy(voters, att.voterId, optionId)
if (result === 'duplicate') { ws.send(errorMessage('duplicate', '…')); return }
if (result === 'error') { ws.send(errorMessage('bad_option', '…')); return }
const { countKey, countDecKey } = result
```

Each strategy is now a pure function, independently unit-testable without a DO instance.

---

### BH-02 — Strategy: Auth protocols as monolith

**Importance: 7/10** | ⚠️ Partially implemented

`functions/api/routes/auth.ts` mounts seven distinct auth strategies (magic link, verify, password set, password reset, Google OAuth, Microsoft OAuth, SAML init/callback, logout) as inline closures within one `mountAuthRoutes` function (621 lines, CC ≈ 46). Each protocol is a distinct Strategy for the "authenticate user" use case.

There is no common interface between them — the coupling is all via the shared Hono `app` instance. Adding a new provider (e.g., Apple OAuth) means editing a 680-line file.

**Fix — protocol-per-file with a shared `AuthProvider` interface:**
```ts
// functions/api/routes/auth/types.ts
export interface AuthProvider {
  /** Mount all routes this provider handles onto `app`. */
  mount(app: Hono<{ Bindings: Env; Variables: Vars }>): void
}
```

```ts
// functions/api/routes/auth/magic-link.ts
export class MagicLinkProvider implements AuthProvider {
  mount(app) {
    app.post('/request', …)
    app.get('/verify', …)
  }
}
```

```ts
// functions/api/routes/auth/index.ts — thin orchestrator
export function mountAuthRoutes(parent) {
  const app = new Hono<…>()
  const providers: AuthProvider[] = [
    new MagicLinkProvider(),
    new PasswordProvider(),
    new GoogleOAuthProvider(),
    new MicrosoftOAuthProvider(),
    new SamlProvider(),
  ]
  for (const p of providers) p.mount(app)
  parent.route('/api/auth', app)
}
```

Each strategy file stays under 100 lines and is independently testable.

The `lib/oauth.ts` Adapters (`buildGoogleAuthUrl`/`buildMicrosoftAuthUrl`) already hint at this structure — they could move into their respective provider files.

---

### BH-03 — Chain of Responsibility: middleware stack

**Importance: 7/10** | ✅ Correctly implemented

`functions/api/app.ts:34–84` is a well-ordered CoR:

1. `trace-id` (first — sets context for all downstream)
2. `cors` (before auth — must respond to OPTIONS without auth)
3. `loggerMiddleware` (wraps entire chain — sees final status)
4. `csrfMiddleware` (after CORS, before auth — reject before JWT verify)
5. Per-route `rateLimit` (after CSRF, before auth — reject before DB work)
6. `rbacMiddleware` (roles fetched once, cached on context)
7. Per-route `authMiddleware` + `planMiddleware` + `requireFeature` (applied by individual route groups)

The `app.onError` global error handler at line 85 is the terminal handler in the chain — unhandled exceptions propagate up to it. Well-implemented.

Minor gap: `rbacMiddleware` makes a D1 query (`SELECT role FROM user_roles`) on every authenticated request, but is applied globally at `app.use('/api/*')` — including public routes like `GET /api/sessions/by-code/:code` where `user` is null. The middleware correctly short-circuits for null user (line 173–177), so the D1 query is skipped. Correct but worth noting.

---

### BH-04 — Command: `withIdempotency`

**Importance: 8/10** | ✅ Correctly implemented

`functions/api/lib/idempotency.ts:43`:
```ts
export async function withIdempotency<T>(
  kv: KVNamespace | undefined,
  userId: string,
  key: string | undefined,
  exec: () => Promise<{ status: number; body: T }>,
): Promise<{ status: number; body: T; replayed: boolean }>
```

`exec` is the Command — a deferred operation that may or may not be invoked depending on cached state. The PENDING sentinel (`__qesto_pending__`) is a Command lock. The wrapper is the Invoker that:
1. Checks if the command result is already cached (replay)
2. Writes a PENDING lock before executing
3. Releases the lock on handler failure
4. Caches the result for future replays

The 30-second PENDING TTL prevents deadlock from crashed handlers. Correctly implemented. The `IdempotencyInFlightError` gives callers a specific error to handle the in-flight case.

---

### BH-05 — Template Method: AI invocation pipeline duplicated

**Importance: 7/10** | ⚠️ Partially implemented

Both `lib/ai-wizard.ts` and `lib/ai-insights.ts` implement the same pipeline:
1. Build system prompt + user prompt → `messages[]`
2. Call `ai.run(model, { messages, max_tokens, stream: false })`
3. Normalise response (`string | { response?: string }`)
4. Strip JSON from potential markdown fences (`extractJson`)
5. `JSON.parse`
6. Validate with Zod schema
7. Return typed result

The implementations are duplicated with minor variations:

| Step | `ai-wizard.ts` | `ai-insights.ts` |
|------|---------------|-----------------|
| Retry | 3 attempts with backoff | 0 retries |
| Model fallback | `invokeWithFallback` to 70B | None |
| JSON extraction | `extractJson` (handles arrays too) | `extractJson` (objects only) |
| Repair | `repairAIOutput` normalises malformed output | No repair |
| Confidence | `scoreConfidence` heuristic | Not scored |
| Logging | structured JSON events | inline `console.log` |

**Fix — shared `invokeAI` primitive in `lib/ai-core.ts`:**
```ts
// functions/api/lib/ai-core.ts
export type AIInvokeOptions = {
  model: string
  fallbackModel?: string
  maxTokens?: number
  retries?: number       // default 2
}

export type AIInvokeResult = {
  raw: string
  latencyMs: number
  attempts: number
}

export async function invokeAI(
  ai: Ai,
  messages: Array<{ role: 'system' | 'user'; content: string }>,
  opts: AIInvokeOptions,
): Promise<AIInvokeResult>

export function extractJsonFromAI(raw: string, mode: 'object' | 'object-or-array' = 'object'): string
```

`ai-wizard.ts` and `ai-insights.ts` import these primitives instead of reimplementing them. The Template Method becomes:

```ts
// ai-wizard.ts
export async function generateQuestions(ai: Ai, input: GenerateInput): Promise<GenerateResult> {
  const { messages, approxInputChars } = buildMessages(input)          // Step 1 (wizard-specific)
  const { raw } = await invokeAI(ai, messages, { model: FAST_MODEL })  // Steps 2–3 (shared)
  const json = extractJsonFromAI(raw, 'object-or-array')               // Step 4 (shared)
  const parsed = JSON.parse(json)                                       // Step 5 (shared)
  return parseAIQuestions(raw, parsed)                                  // Steps 6–7 (wizard-specific)
}
```

---

### BH-06 — Observer: `writeEvent` (single subscriber, fire-and-forget)

**Importance: 5/10** | ⚠️ Partially implemented

`writeEvent(ae, event)` in `lib/observability.ts:121` is the only observable emission mechanism in the codebase. It dispatches to a single subscriber (Cloudflare Analytics Engine) with no typing on the subscriber.

```ts
export function writeEvent(ae: AnalyticsEngineDataset | undefined, event: QestoEvent): void {
  if (!ae) return
  try {
    ae.writeDataPoint({ blobs, doubles })
  } catch { /* swallow */ }
}
```

This is appropriate for the current scale — AE is the only analytics backend. The limitation becomes visible when more than one subscriber is needed (e.g., a webhook, an internal audit bus, a Slack alert on `error.api`).

The `alerts.ts` module (`checkAlert`, `checkAlertInput`) is a separate alerting path that reads KV thresholds — it is not connected to `writeEvent`. These two concern areas (`lib/alerts.ts` and `writeEvent`) should converge into one event pipeline rather than two parallel mechanisms.

**Minimal fix — no change needed now**, but document the intended extension point:
```ts
// lib/observability.ts — add if a second subscriber ever appears
export type EventSubscriber = (event: QestoEvent) => void
const subscribers: EventSubscriber[] = []
export function subscribeEvents(fn: EventSubscriber) { subscribers.push(fn) }
```

---

## 4. Domain Patterns

### DM-01 — Repository: partial implementations (quota, audit, team KV helpers)

**Importance: 9/10** | ⚠️ Partially implemented

Three modules follow Repository semantics correctly:

| Module | Storage | Operations |
|--------|---------|-----------|
| `lib/quota.ts` | `SESSIONS_KV` | `incrementSessionQuota`, `getQuotaUsage`, `resetQuota` |
| `lib/audit.ts` | D1 `audit_events` | `recordAuditEvent`, `queryAuditEvents` |
| `routes/teams.ts:66–94` | `TEAMS_KV` | `loadTeam`, `saveTeam`, `loadUserTeamIds`, `addUserTeam`, `removeUserTeam` |

The team KV helpers are module-level functions that act as a repository — but they are **private to `teams.ts`** and cannot be reused. When `auth.ts` needs to `loadTeam` it must import the function directly from `teams.ts` (it does: `import { attachUserToTeam, loadTeam } from './teams'` at `auth.ts:29`), creating a route-to-route dependency that bypasses any service layer.

**Fix — promote team helpers to `lib/team-repository.ts`:**
```ts
// functions/api/lib/team-repository.ts
export const TeamRepository = {
  find:        (kv: KVNamespace, id: string) => readKvJson<Team>(kv, teamKey(id)),
  save:        (kv: KVNamespace, team: Team) => writeKvJson(kv, teamKey(team.id), team),
  findUserIds: (kv: KVNamespace, userId: string) => readKvJson<string[]>(kv, userTeamsKey(userId)) ?? [],
  addMember:   async (kv: KVNamespace, userId: string, teamId: string) => { … },
  removeMember:async (kv: KVNamespace, userId: string, teamId: string) => { … },
}
```

`teams.ts` and `auth.ts` both import from `lib/team-repository.ts`, eliminating the cross-route import.

---

### DM-02 — Repository: missing for sessions and questions

**Importance: 9/10** | ❌ Missing

All session and question data access is embedded directly in route handlers inside `routes/sessions.ts`. There is no `SessionRepository` or `QuestionRepository`. Every handler issues its own raw D1 `prepare` call:

```ts
// sessions.ts — same SELECT column list written 3× (lines 111-119, 164-174, 336-343)
db.prepare(`SELECT id, owner_id, code, title, status, anonymity, vote_policy, session_mode,
            created_at, started_at, closed_at, archived_at, team_id,
            ai_generated, ai_consent_at, ai_grounding_hash, ai_accepted_count, ai_dismissed_count
            FROM sessions WHERE id = ?1 AND owner_id = ?2`)
```

Consequences:
1. Adding a new column to the `SELECT` list requires finding every call site manually.
2. The `fetchSession` and `fetchSessionByCode` helper functions exist but are private — they cannot be used from `insights.ts` which reinvents the same query (see `routes/insights.ts:59–73`).
3. `fetchQuestions` is duplicated: `routes/sessions.ts:123` and implicitly in `precomputeInsights:230–237` (a raw D1 query for questions).

**Fix — `lib/session-repository.ts` and `lib/question-repository.ts`:**
```ts
// functions/api/lib/session-repository.ts
const SESSION_COLUMNS = `
  id, owner_id, code, title, status, anonymity, vote_policy, session_mode,
  created_at, started_at, closed_at, archived_at, team_id,
  ai_generated, ai_consent_at, ai_grounding_hash, ai_accepted_count, ai_dismissed_count
`

export const SessionRepository = {
  findById: (db: D1Database, id: string, ownerId: string): Promise<Session | null> =>
    db.prepare(`SELECT ${SESSION_COLUMNS} FROM sessions WHERE id = ?1 AND owner_id = ?2`)
      .bind(id, ownerId).first<Session>().then(r => r ?? null),

  findByCode: (db: D1Database, code: string): Promise<Session | null> =>
    db.prepare(`SELECT ${SESSION_COLUMNS} FROM sessions WHERE code = ?1`)
      .bind(code).first<Session>().then(r => r ?? null),

  updateStatus: (db: D1Database, id: string, ownerId: string, status: SessionStatus, extra?: Partial<Session>) =>
    buildStatusUpdate(db, id, ownerId, status, extra),
}
```

```ts
// functions/api/lib/question-repository.ts
export const QuestionRepository = {
  findBySession: (db: D1Database, sessionId: string): Promise<Question[]> =>
    db.prepare(`SELECT id, session_id, position, kind, prompt, options_json, created_at
                FROM questions WHERE session_id = ?1 ORDER BY position ASC`)
      .bind(sessionId).all<QuestionRow>()
      .then(r => (r.results ?? []).map(rowToQuestion)),
}
```

`routes/sessions.ts`, `routes/insights.ts`, and `precomputeInsights` all import from these repositories instead of writing their own queries.

---

### DM-03 — DTO / Value Objects: correctly used

**Importance: 7/10** | ✅ Correctly implemented

Several well-defined DTOs:

| Type | File | Role |
|------|------|------|
| `SessionBundle` | `lib/session-bundle.ts:22` | Deterministic data handoff before AI call |
| `InsightsInput` | `lib/ai-insights.ts:14` | AI input contract |
| `InsightTheme`, `InsightsResult` | `lib/ai-insights.ts:21` | AI output value objects |
| `GenerateResult`, `GeneratedQuestion` | `lib/ai-wizard.ts:22` | Wizard output value objects |
| `EntitlementDenial` | `lib/entitlements.ts:5` | Typed error value object |
| `QuotaRecord` | `lib/quota.ts:4` | KV-persisted state DTO |
| `AuditContext` | `lib/audit.ts:32` | Audit event creation DTO |
| `SpanContext`, `SpanResult` | `lib/observability.ts:20` | Observability value objects |
| `CachedResponse` | `lib/idempotency.ts:16` | Idempotency cache DTO |

`SessionBundle`'s comment is particularly notable: *"nothing probabilistic appears in SessionBundle — every field comes from D1/KV queries"*. This explicit boundary between deterministic and AI-produced data is best practice.

One gap: `AuditContext.before_snapshot` and `after_snapshot` are typed as `Record<string, any>`. These should be typed more narrowly per `AuditAction`, or at minimum as `Record<string, unknown>`:
```ts
// audit.ts — tighten any → unknown
export interface AuditContext {
  before_snapshot?: Record<string, unknown>
  after_snapshot?: Record<string, unknown>
}
```

---

### DM-04 — State Pattern: session lifecycle implicit

**Importance: 7/10** | ⚠️ Partially implemented

The session state machine (`DRAFT → LIVE → CLOSED → ARCHIVED`) is well-documented (CLAUDE.md, file header of `sessions.ts`) but implemented as a D1 string field checked in each handler:

```ts
// Repeated in handlers: /:id/start, /:id/close, PATCH /:id, POST /:id/questions, etc.
if (session.status !== 'draft') {
  return c.json({ ok: false, error: { code: 'conflict', message: 'Only DRAFT sessions can …' } }, 409)
}
```

The state-specific guard is duplicated 7× across `sessions.ts`. There is no central place to add behaviour for a new state (e.g., `paused`).

**Fix — state guard helper:**
```ts
// lib/session-state.ts
export type SessionTransition = {
  from: SessionStatus
  errorCode: string
  errorMessage: string
}

export function requireStatus(session: Session, expected: SessionStatus): EntitlementDenial | null {
  if (session.status === expected) return null
  return {
    code: 'conflict',
    message: `Only ${expected.toUpperCase()} sessions can perform this action (current: ${session.status})`,
    details: { current_plan: 'free', upgrade_url: '' },
  }
}

// Usage in handler:
const guard = requireStatus(session, 'draft')
if (guard) return c.json({ ok: false, error: guard, trace_id }, 409)
```

A full State object pattern (with `DraftSession`, `LiveSession` classes) is not warranted at this scale — the helper above removes the duplication without over-engineering.

---

### DM-05 — Service Layer: libs are services, routes mix HTTP + business logic

**Importance: 8/10** | ⚠️ Partially implemented

The `lib/` directory correctly contains service-layer modules:
- `lib/ai-wizard.ts` — AI Question Generation Service
- `lib/ai-insights.ts` — AI Insights Extraction Service
- `lib/quota.ts` — Quota Service
- `lib/idempotency.ts` — Idempotency Service
- `lib/observability.ts` — Observability Service
- `lib/audit.ts` — Audit Service (partial — see CR-04)

However, the `routes/` files act as both **Controller** (HTTP) and **Service** (business logic), violating Service Layer separation:

```ts
// sessions.ts — business logic embedded in HTTP handler
app.post('/', async (c) => {
  // … HTTP concerns (parse body, validate schema, read headers) …
  // … Business logic (quota check, team attribution, idempotency) …
  // … Data access (D1 INSERT, KV read) …
  // … HTTP response …
})
```

The `precomputeInsights` function (lines 198–293) is a background service that has no HTTP dependency — it takes `Env, sessionId, sessionTitle, ownerId` — but lives in a route file. It cannot be unit-tested without importing the full sessions route module.

**Fix — extract background services from route files:**

```ts
// lib/insights-service.ts (new)
export async function precomputeInsights(
  env: Env,
  sessionId: string,
  sessionTitle: string,
  ownerId: string,
): Promise<void> { … }  // moved from sessions.ts:198–293
```

```ts
// lib/session-service.ts (new)
export async function createSession(
  db: D1Database,
  teamsKv: KVNamespace,
  userId: string,
  title: string,
): Promise<Session> { … }  // business logic extracted from POST / handler

export async function startSession(
  env: Env,
  session: Session,
  questions: Question[],
  plan: PlanTier,
): Promise<void> { … }  // extracted from POST /:id/start handler
```

Route handlers then become thin coordinators:
```ts
// sessions.ts — after extraction
app.post('/', async (c) => {
  const parsed = CreateSessionSchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return err(c, 'validation', '…', 400)
  const session = await SessionService.createSession(c.env.DB, c.env.TEAMS_KV, user.sub, parsed.data.title)
  return ok(c, { session, questions: [] }, 201)
})
```

---

## 5. Missing Patterns

### MP-01 — Unit of Work: multi-step mutations have no rollback coordination

**Importance: 7/10**

`POST /:id/close` in `sessions.ts:832–930` performs:
1. DO `/close` → get vote list
2. D1 batch INSERT votes
3. D1 UPDATE session status
4. Analytics Engine event
5. KV background insight precompute

Steps 1–3 are not wrapped in a transaction. If step 3 fails after step 2, votes are persisted but the session remains `live`. There is no Unit of Work to coordinate these as an atomic operation.

D1 does not support distributed transactions with DO, so a perfect UoW is impossible. However, an **idempotent retry protocol** can approximate it:

```ts
// lib/session-close.ts — Unit of Work with idempotency guard
export async function closeSession(env: Env, sessionId: string, ownerId: string): Promise<CloseResult> {
  // 1. Pessimistic lock via idempotency key
  return withIdempotency(env.ACTIONS_KV, ownerId, `close:${sessionId}`, async () => {
    const votes = await drainDO(env, sessionId)    // idempotent: DO returns same data
    await persistVotes(env.DB, sessionId, votes)   // idempotent: INSERT OR IGNORE
    await markClosed(env.DB, sessionId, ownerId)   // idempotent: UPDATE WHERE status='live'
    return { status: 200, body: { votes, counts: tally(votes) } }
  })
}
```

---

### MP-02 — Specification: feature/quota checks lack a composable interface

**Importance: 5/10**

`lib/entitlements.ts` provides `featureAllowed`, `questionKindFeature`, `denyFeature`. These are correct but not composable — there is no way to express "feature X AND quota Y must both pass" as a single specification.

`deniedQuestionFeature(plan, quotas, kind)` in `sessions.ts:102` is an ad-hoc composition. A Specification pattern would allow:

```ts
const canAddRankingQuestion = new FeatureSpec('rankingQuestions')
  .and(new QuotaSpec('maxSessionsPerMonth', used, limit))

const result = canAddRankingQuestion.isSatisfiedBy({ plan, quotas, usage })
```

Not urgent but would reduce the inline if-chains in route handlers.

---

## Pattern Verdict Summary

| Category | Correctly used | Needs work | Missing |
|----------|---------------|------------|---------|
| Creational | Factory (3 instances) | Singleton (module flag) | — |
| Structural | Facade, Decorator, Proxy (Voters), Adapter | Cache Proxy (wrong namespace, dead code) | — |
| Behavioral | CoR (middleware), Command (idempotency) | Strategy (vote policy), Template Method (AI pipeline) | Unit of Work |
| Domain | DTO/Value Objects | Repository (partial), Service Layer (mixed), State (implicit) | Session/Question Repository |
