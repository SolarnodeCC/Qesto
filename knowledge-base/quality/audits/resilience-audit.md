# System Resilience Audit

**Date:** 2026-05-03  
**Branch:** `claude/audit-code-duplication-MQdYH`  
**Scope:** `functions/api/` (backend) + `functions/api/SessionRoom.ts` (Durable Object)

---

## Overall Resilience Score: **4 / 10**

| Dimension | Score | Rationale |
|---|---|---|
| Timeout Handling | 5 / 10 | All 3rd-party HTTP calls guarded; Workers AI and D1 have no explicit timeouts |
| Retry Logic | 4 / 10 | AI wizard has retry + fallback; insights, Stripe, Resend, OAuth have zero retries |
| Circuit Breaker | 1 / 10 | Health endpoint exists for observability only; no runtime state machine |
| Bulkhead Pattern | 5 / 10 | DO-per-session and voter capacity caps are strong; D1 is fully shared |
| Graceful Degradation | 5 / 10 | KV and Vectorize degrade cleanly; plan middleware is a hard failure point |

---

## Section 1 — Timeout Handling

---

### RES-01 — Workers AI calls have no timeout (insights route)

**Importance: 8 / 10**

`functions/api/routes/ai-insights.ts:140` and `:244` call `c.env.AI.run('@cf/baai/bge-m3', ...)` with no `AbortController`. The embedding model for Vectorize and the insights theme-extraction model (`ai-insights.ts:129` via `extractThemes`) both run without an explicit deadline. Workers AI has a platform-level timeout (~60 s) but it is undocumented and may vary by model.

```typescript
// ai-insights.ts:140 — no timeout guard
const embedResult = (await c.env.AI.run('@cf/baai/bge-m3', {
  text: embedText,
})) as { data: number[][] }

// ai-insights.ts:129 — no timeout guard  
const res = (await ai.run(model, {
  messages: [...],
  max_tokens: MAX_TOKENS,
})) as { response?: string } | string
```

Contrast with `email.ts:18-19` and `billing.ts:26-27` which consistently use:
```typescript
const ac = new AbortController()
const timeout = setTimeout(() => ac.abort(), 10_000)
try { res = await fetch(url, { signal: ac.signal }) }
finally { clearTimeout(timeout) }
```

**Fix — add AbortController to every `AI.run()` call:**
```typescript
// functions/api/lib/ai-insights.ts — add before AI call
const ac = new AbortController()
const aiTimeout = setTimeout(() => ac.abort(), 25_000)  // 25s: models are slower than HTTP APIs
let raw: string
try {
  const res = (await ai.run(model, {
    messages: [{ role: 'system', content: THEME_SYSTEM_PROMPT }, { role: 'user', content: userPrompt }],
    max_tokens: MAX_TOKENS,
    // Workers AI run() does not yet accept signal= but wrapping with a race is equivalent:
  })) as { response?: string } | string
  // ...
} finally {
  clearTimeout(aiTimeout)
}
```

Because the Workers AI binding does not expose an `AbortSignal` parameter, use `Promise.race`:
```typescript
const AI_TIMEOUT_MS = 25_000

async function runWithTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    clearTimeout(timeoutId!)
  }
}

// Usage in ai-insights.ts and ai-wizard.ts
const res = await runWithTimeout(
  ai.run(model, { messages, max_tokens: MAX_TOKENS }),
  AI_TIMEOUT_MS,
  'Workers AI theme extraction',
)
```

---

### RES-02 — `plan` middleware D1 query has no timeout and no catch

**Importance: 8 / 10**

`functions/api/middleware/plan.ts:33`:
```typescript
// No try-catch. D1 transient failure → 500 with raw error message to client.
const result = await c.env.DB
  .prepare('SELECT plan FROM users WHERE id = ?1')
  .bind(user.sub)
  .first<{ plan: PlanTier }>()
const plan = result?.plan ?? 'free'
```

This middleware runs on **every authenticated route**. A D1 transient error (network blip, cold worker, D1 maintenance window) propagates as an uncaught exception to `app.onError`, which returns `err.message` verbatim (finding EH-01 from error-handling audit). The safe fallback is already implicit — `null` from `.first()` gives `'free'` — but the exception prevents that path from being reached.

**Fix:**
```typescript
// middleware/plan.ts:33 — add try-catch
let planRow: { plan: PlanTier } | null = null
try {
  planRow = await c.env.DB
    .prepare('SELECT plan FROM users WHERE id = ?1')
    .bind(user.sub)
    .first<{ plan: PlanTier }>()
} catch (err) {
  console.log(JSON.stringify({
    level: 'error', msg: 'plan_middleware.db_failure',
    error: (err as Error).message,
    userId: user.sub,
    traceId: c.get('trace_id'),
  }))
  // Fallback to free plan — safer than 500-ing every authenticated request
}
const plan = planRow?.plan ?? 'free'
```

---

### RES-03 — Admin middleware D1 query has no catch

**Importance: 6 / 10**

`functions/api/middleware/admin.ts:60`:
```typescript
const row = await c.env.DB
  .prepare(`SELECT role FROM user_roles WHERE user_id = ?1 AND role IN ('owner', 'admin') LIMIT 1`)
  .bind(user.sub)
  .first<UserRoleRow>()
```

D1 failure here throws through to `app.onError`. The correct fallback is to return `403` (deny on uncertainty), not `500`.

**Fix:**
```typescript
let row: UserRoleRow | null = null
try {
  row = await c.env.DB
    .prepare(`SELECT role FROM user_roles WHERE user_id = ?1 AND role IN ('owner', 'admin') LIMIT 1`)
    .bind(user.sub)
    .first<UserRoleRow>()
} catch {
  return c.json({ ok: false, error: { code: 'forbidden', message: 'Admin access check failed' } }, 403)
}
if (!row || ...) { /* existing 403 path */ }
```

---

### RES-04 — SAML metadata fetch has no timeout

**Importance: 5 / 10**

**Unable to verify:** No `fetch()` calls were found in `functions/api/lib/saml.ts`. The SAML assertion parsing is done from existing XML blobs passed in from the route. If SAML metadata (IdP certificate) fetching is done at a higher level (route handler), verify by grepping:

```bash
grep -rn "fetch.*metadata\|idp.*url\|metadataUrl" functions/api/routes/auth.ts
```

If IdP metadata is fetched at runtime, it must be wrapped with a 10 s `AbortController` following the same pattern as `oauth.ts:28-29`.

---

## Section 2 — Retry Logic

---

### RES-05 — AI insights has zero retry logic (contrast with AI wizard)

**Importance: 8 / 10**

`functions/api/lib/ai-insights.ts:128-165` — single `ai.run()` call with no retry:

```typescript
// ai-insights.ts:128 — single attempt, no retry
try {
  const res = (await ai.run(model, { messages, max_tokens: MAX_TOKENS })) as ...
  // on empty response: throw InsightsAIError
  // on exception: rethrow as InsightsAIError
} catch (err) {
  throw new InsightsAIError(`AI invocation failed: ...`)
}
```

The wizard (`ai-wizard.ts:209,228-274`) has:
```typescript
const RETRY_DELAYS_MS = [150, 300]  // 3 total attempts
for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
  if (attempt > 0) await sleep(RETRY_DELAYS_MS[attempt - 1])
  try { return await invokeAI(...) }
  catch { lastErr = err; continue }
}
throw new WizardAIError(`failed after ${RETRY_DELAYS_MS.length + 1} attempts`)
```

Workers AI returns transient empty responses or rate-limit errors. Insights already logs `ai.insights.error` events, confirming failures occur in production.

**Fix — extract shared retry wrapper:**
```typescript
// NEW: functions/api/lib/ai-retry.ts
export const AI_RETRY_DELAYS_MS = [200, 400] as const

export async function invokeAIWithRetry(
  ai: Ai,
  model: string,
  messages: Array<{ role: string; content: string }>,
  maxTokens: number,
): Promise<string> {
  let lastErr: Error = new Error('No attempts made')
  for (let attempt = 0; attempt <= AI_RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) {
      await new Promise<void>((r) => setTimeout(r, AI_RETRY_DELAYS_MS[attempt - 1]))
    }
    try {
      const res = (await ai.run(model, { messages, max_tokens: maxTokens, stream: false })) as
        | { response?: string }
        | string
      const raw = typeof res === 'string' ? res : res?.response ?? ''
      if (!raw.trim()) { lastErr = new Error('Empty response'); continue }
      return raw
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err))
    }
  }
  throw lastErr
}
```

---

### RES-06 — External API calls (Stripe, Resend, OAuth) have no retry

**Importance: 7 / 10**

All three critical external services use a single-attempt fetch:

| Service | File | Line | Has retry? |
|---|---|---|---|
| Stripe billing portal | `billing.ts` | 29-41 | No |
| Resend email | `email.ts` | 21-39 | No |
| Google OAuth token | `oauth.ts` | 31-56 | No |
| Microsoft OAuth token | `oauth.ts` | 89-125 | No |
| JWKS endpoint | `oauth.ts` | 215-220 | No |

A transient 503 from Stripe means users cannot access their billing portal. A transient Resend failure means magic links are never delivered — users are locked out.

**Fix — idempotent-safe retry for non-mutating calls:**

Non-mutating fetches (JWKS, OAuth token exchange read path) can be retried freely. Mutating calls (Stripe portal create, Resend send) should use retry only on network errors (not on 4xx), since the underlying operation may already have succeeded:

```typescript
// NEW: functions/api/lib/fetch-with-retry.ts
export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  opts: { maxAttempts?: number; retryDelaysMs?: number[]; retryOn?: (res: Response) => boolean },
): Promise<Response> {
  const delays = opts.retryDelaysMs ?? [500, 1000]
  const shouldRetry = opts.retryOn ?? ((res) => res.status >= 500)
  let lastRes: Response | undefined
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, delays[attempt - 1]))
    try {
      lastRes = await fetch(url, init)
      if (!shouldRetry(lastRes)) return lastRes
    } catch (err) {
      if (attempt === delays.length) throw err
    }
  }
  return lastRes!
}
```

Apply to Resend (magic link send is idempotent for the same token), OAuth JWKS (pure read), and JWKS rotation detection.

---

### RES-07 — Retry delays in AI wizard are linear, not exponential

**Importance: 4 / 10**

`functions/api/lib/ai-wizard.ts:209`:
```typescript
const RETRY_DELAYS_MS = [150, 300]
```

The ratio is 2× — linear doubling but not exponential. True exponential backoff (plus jitter) reduces thundering-herd on transient capacity spikes:

```typescript
// Exponential backoff with ±20% jitter
const RETRY_DELAYS_MS = [
  200 + Math.random() * 80,   // 200-280ms
  800 + Math.random() * 320,  // 800-1120ms
]
```

Because this is module-level code evaluated once, the jitter should be computed per-attempt rather than at module load:

```typescript
function retryDelayMs(attempt: number): number {
  const base = 200 * Math.pow(2, attempt - 1)  // 200, 400
  const jitter = base * 0.2 * Math.random()
  return base + jitter
}
```

---

## Section 3 — Circuit Breaker Pattern

---

### RES-08 — No circuit breaker for any external service

**Importance: 9 / 10**

The health endpoint (`admin.ts:709-756`) detects service status but it is **observability-only** — it does not gate runtime requests:

```typescript
// admin.ts:709 — read-only probe, not a runtime gate
const [d1Health, kvHealth, aiHealth] = await Promise.all([
  c.env.DB.prepare('SELECT 1').first()
    .then(() => 'healthy' as ServiceStatus)
    .catch(() => 'down' as ServiceStatus),
  c.env.SESSIONS_KV.get('__health_probe__')
    .then(() => 'healthy' as ServiceStatus)
    .catch(() => 'degraded' as ServiceStatus),
  Promise.resolve<ServiceStatus>('healthy'), // AI binding assumed always present
])
```

With no circuit breaker:
1. When Stripe is degraded, every billing portal request hangs for 10 s (the timeout) before failing, consuming Workers CPU and blocking response queues.
2. When Workers AI is overloaded, every insight request runs the full retry loop (3 attempts × 25 s each = 75 s worst case), burning quota for all users.
3. When D1 is degraded, every plan middleware call fails rather than serving cached plan data.

**Recommended — KV-backed lightweight circuit breaker (no Durable Object needed):**

```typescript
// NEW: functions/api/lib/circuit-breaker.ts
export type CircuitState = 'closed' | 'open' | 'half-open'

export interface CircuitBreakerOptions {
  failureThreshold: number   // failures in window before opening
  successThreshold: number   // successes in half-open before closing
  openWindowMs: number       // time to stay open before moving to half-open
  prefix: string             // KV key prefix — isolates per service
}

interface CircuitRecord {
  state: CircuitState
  failures: number
  lastFailureAt: number
  successes: number          // counts only in half-open
}

export class CircuitBreaker {
  constructor(
    private readonly kv: KVNamespace,
    private readonly opts: CircuitBreakerOptions,
  ) {}

  private key(): string { return `cb:${this.opts.prefix}` }

  async call<T>(fn: () => Promise<T>): Promise<T> {
    const raw = await this.kv.get(this.key(), 'json') as CircuitRecord | null
    const now = Date.now()
    const state = this.resolveState(raw, now)

    if (state === 'open') {
      throw new Error(`Circuit breaker OPEN for ${this.opts.prefix} — service unavailable`)
    }

    try {
      const result = await fn()
      await this.recordSuccess(raw, state, now)
      return result
    } catch (err) {
      await this.recordFailure(raw, state, now)
      throw err
    }
  }

  private resolveState(rec: CircuitRecord | null, now: number): CircuitState {
    if (!rec) return 'closed'
    if (rec.state === 'open' && (now - rec.lastFailureAt) >= this.opts.openWindowMs) return 'half-open'
    return rec.state
  }

  private async recordFailure(rec: CircuitRecord | null, state: CircuitState, now: number): Promise<void> {
    const failures = (rec?.failures ?? 0) + 1
    const nextState: CircuitState =
      state === 'half-open' || failures >= this.opts.failureThreshold ? 'open' : 'closed'
    await this.kv.put(this.key(), JSON.stringify({
      state: nextState, failures, lastFailureAt: now, successes: 0,
    } satisfies CircuitRecord), { expirationTtl: Math.ceil(this.opts.openWindowMs / 1000) * 2 })
  }

  private async recordSuccess(rec: CircuitRecord | null, state: CircuitState, now: number): Promise<void> {
    if (state !== 'half-open') {
      if (rec?.failures) {
        await this.kv.put(this.key(), JSON.stringify({
          state: 'closed', failures: 0, lastFailureAt: rec.lastFailureAt, successes: 0,
        } satisfies CircuitRecord), { expirationTtl: 300 })
      }
      return
    }
    const successes = (rec?.successes ?? 0) + 1
    const nextState: CircuitState = successes >= this.opts.successThreshold ? 'closed' : 'half-open'
    await this.kv.put(this.key(), JSON.stringify({
      state: nextState, failures: 0, lastFailureAt: rec?.lastFailureAt ?? now, successes,
    } satisfies CircuitRecord), { expirationTtl: 300 })
  }
}

// Pre-configured instances for each external service:
export function stripeCircuitBreaker(kv: KVNamespace): CircuitBreaker {
  return new CircuitBreaker(kv, {
    prefix: 'stripe', failureThreshold: 3, successThreshold: 1,
    openWindowMs: 30_000,
  })
}
export function aiCircuitBreaker(kv: KVNamespace): CircuitBreaker {
  return new CircuitBreaker(kv, {
    prefix: 'workers-ai', failureThreshold: 5, successThreshold: 2,
    openWindowMs: 60_000,
  })
}
```

Usage in `billing.ts`:
```typescript
const cb = stripeCircuitBreaker(c.env.ACTIONS_KV)
try {
  const portal = await cb.call(() => stripe.billingPortal.sessions.create({ customer, return_url }))
  return c.json({ ok: true, data: { url: portal.url } })
} catch (err) {
  if (err.message.startsWith('Circuit breaker OPEN')) {
    return c.json({ ok: false, error: { code: 'service_unavailable', message: 'Billing service temporarily unavailable' } }, 503)
  }
  throw err
}
```

---

## Section 4 — Bulkhead Pattern

---

### RES-09 — D1 database is shared across all tenants with no query isolation

**Importance: 7 / 10**

All users share a single D1 SQLite database. There are no per-tenant quotas, no query timeouts, and no query cancellation. A large session with thousands of votes running `SELECT ... GROUP BY voter_id` (e.g., `gamification.ts:162-210`) can saturate D1's I/O budget, degrading all other users' requests during the same time window.

The per-session Durable Object (one DO per session) provides excellent compute isolation for WebSocket traffic, but all REST API reads still hit shared D1.

**Partial mitigations present:**
- KV caches exist for plan/team/user data (`kv-cache.ts`) — but the cache functions are defined and never imported in routes (dead code, SA-09 from architecture audit)
- TTL-based KV expiry prevents indefinite stale reads

**Fix — implement per-request D1 statement timeout via `Promise.race`:**

D1 does not natively support statement timeouts. The `runWithTimeout` helper from RES-01 applies:

```typescript
// functions/api/lib/db.ts
const D1_QUERY_TIMEOUT_MS = 5_000

export async function d1First<T>(
  stmt: D1PreparedStatement,
): Promise<T | null> {
  return runWithTimeout(
    stmt.first<T>(),
    D1_QUERY_TIMEOUT_MS,
    'd1.first',
  )
}

export async function d1All<T>(
  stmt: D1PreparedStatement,
): Promise<D1Result<T>> {
  return runWithTimeout(
    stmt.all<T>(),
    D1_QUERY_TIMEOUT_MS,
    'd1.all',
  )
}
```

This doesn't cancel the D1 query server-side (D1 doesn't support that) but prevents the Worker from hanging indefinitely, freeing the CPU slot for other requests.

---

### RES-10 — `lib/rate-limit.ts` has no try-catch around KV operations

**Importance: 6 / 10**

`functions/api/lib/rate-limit.ts:54-69` — the `rateLimit()` function used by auth routes has no error handling:

```typescript
export async function rateLimit(
  kv: KVNamespace | undefined,
  id: string,
  opts: RateLimitOptions,
): Promise<RateLimitResult> {
  if (!kv) return { allowed: true, ... }  // graceful for tests
  const key = kvKey(opts.prefix, id)
  const raw = await kv.get(key, 'json')   // ← no try-catch
  // ...
  await kv.put(key, JSON.stringify(next), { expirationTtl: ttl })  // ← no try-catch
```

In contrast, `middleware/rate-limit.ts:77-88` correctly wraps KV in try-catch with fail-open behavior. The lib version is used by `auth.ts` for the magic-link rate limiter. A KV transient failure here causes a 500 instead of gracefully allowing the request through.

**Fix:**
```typescript
export async function rateLimit(
  kv: KVNamespace | undefined,
  id: string,
  opts: RateLimitOptions,
): Promise<RateLimitResult> {
  if (!kv) return { allowed: true, remaining: opts.max, resetAt: Date.now() + opts.windowSeconds * 1000 }
  try {
    const key = kvKey(opts.prefix, id)
    const raw = await kv.get(key, 'json')
    // ... existing logic ...
    await kv.put(key, JSON.stringify(next), { expirationTtl: ttl })
    return { allowed: true, remaining: opts.max - next.count, resetAt: existing.resetAt }
  } catch {
    // KV unavailable — fail open (same policy as middleware/rate-limit.ts)
    return { allowed: true, remaining: 1, resetAt: Date.now() + opts.windowSeconds * 1000 }
  }
}
```

---

### RES-11 — AI wizard parallel batch failures are fully isolated; insights has no parallelism

**Importance: 5 / 10**

`ai-wizard.ts:376-396` uses `Promise.allSettled` to run two parallel batch foci, merging only successful results:

```typescript
const settled = await Promise.allSettled(
  PARALLEL_BATCH_FOCI.map(async (batchFocus) => {
    const { messages, approxInputChars } = buildMessages(input, batchFocus)
    const raw = await invokeWithFallback(ai, model, messages, approxInputChars)
    return parseAIQuestions(raw)
  }),
)
const fulfilled = settled.filter((r): r is PromiseFulfilledResult<GenerateResult> =>
  r.status === 'fulfilled')
if (fulfilled.length > 0) return mergeQuestionBatches(fulfilled)
```

This is a correct bulkhead: one batch failure doesn't block the other. The insights route has no equivalent — a single AI call either succeeds or the entire route fails.

The insights route (`ai-insights.ts`) also calls `extractThemes` synchronously after all D1 data is collected. With multiple AI capabilities (embedding + theme extraction), these could be parallelized:

```typescript
// ai-insights.ts — current: sequential
const embedResult = await c.env.AI.run('@cf/baai/bge-m3', { text: embedText })
// ... vectorize query ...
const themeResult = await extractThemes(c.env.AI, input)

// ai-insights.ts — improved: parallel where independent
const [embedResult, themeResult] = await Promise.allSettled([
  c.env.AI.run('@cf/baai/bge-m3', { text: embedText }),
  extractThemes(c.env.AI, input),
])
// Use themeResult regardless of embedResult
```

---

## Section 5 — Graceful Degradation

---

### RES-12 — `_votersInitPromise` in `SessionRoom.ts` has no `.catch()` handler

**Importance: 8 / 10**

`functions/api/SessionRoom.ts:163`:
```typescript
this._votersInitPromise = this.ctx.storage.get<Record<string, string | string[]>>(K_VOTERS)
  .then(raw => { this._voters = normaliseVotes(raw) })
// ← no .catch() — unhandled rejection on DO storage fault
```

If DO persistent storage has a transient fault during hydration, this promise rejects silently (or as an unhandled rejection, which terminates the Worker in some runtimes). Subsequent calls to `ensureVoters()` would see `this._voters = {}` (the empty default) if the promise was awaited but failed — but the lack of `.catch()` means the error state is ambiguous.

**Fix:**
```typescript
this._votersInitPromise = this.ctx.storage
  .get<Record<string, string | string[]>>(K_VOTERS)
  .then((raw) => { this._voters = normalizeVotes(raw) })
  .catch((err) => {
    console.log(JSON.stringify({
      level: 'error',
      event: 'session_room.voters_hydration_failed',
      error: (err as Error).message,
    }))
    this._voters = {}  // safe default — no votes counted yet
    this._votersInitPromise = null  // allow retry on next vote
  })
```

---

### RES-13 — `webSocketMessage` switch handler has no outer try-catch

**Importance: 7 / 10**

`SessionRoom.ts:337-433` — the main message dispatch is unguarded:

```typescript
async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
  // JSON parse is guarded...
  switch (parsed.type) {
    case 'vote':
      await this.handleVote(ws, att, parsed.data)  // ← can throw on DO storage fault
      break
    case 'advance': {
      await this.ctx.storage.get<LiveQuestion[]>(K_QUESTIONS)  // ← throws on storage fault
      await this.ctx.storage.put(K_QUESTION_INDEX, nextIdx)    // ← throws on storage fault
      // ...
    }
  }
}
```

Any storage exception inside a `case` block propagates uncaught out of `webSocketMessage`. The Cloudflare runtime may close the WebSocket with an error frame, but the error is opaque to the client.

**Fix — wrap the switch body:**
```typescript
async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
  // ... JSON parse guards remain unchanged ...
  try {
    switch (parsed.type) {
      case 'vote':
        await this.handleVote(ws, att, parsed.data)
        break
      // ... all other cases ...
    }
  } catch (err) {
    console.log(JSON.stringify({
      level: 'error',
      event: 'ws.message_handler_failed',
      type: (parsed as { type?: string }).type,
      error: (err as Error).message,
    }))
    ws.send(errorMessage('internal', 'Message processing failed'))
  }
}
```

---

### RES-14 — RBAC DB failure silently demotes every user to `viewer` with no log

**Importance: 6 / 10**

`functions/api/middleware/rbac.ts:150-153`:
```typescript
} catch (err) {
  // If DB fails, default to viewer (fail-safe)
  return ['viewer']
}
```

The fail-safe intent is correct for production safety — a DB fault should not grant elevated privileges. However:
1. The error is silently swallowed — there is no log line, so DB failures are invisible in monitoring.
2. `err` is unused — any exception (including programming errors in the query itself) is treated identically to a transient DB outage.

**Fix — log and preserve fail-safe behavior:**
```typescript
} catch (err) {
  console.log(JSON.stringify({
    level: 'error',
    msg: 'rbac.db_failure',
    userId,
    error: (err as Error).message,
  }))
  return ['viewer']  // fail-safe: deny elevated access on DB fault
}
```

---

### RES-15 — Vectorize upsert after insights generation has no timeout

**Importance: 4 / 10**

`functions/api/routes/ai-insights.ts:244`:
```typescript
const upsertEmbedResult = (await c.env.AI.run('@cf/baai/bge-m3', { text: sessionResult.title })) as { data: number[][] }
// ...
await c.env.DECISIONS_VECTORIZE.upsert([...])
```

Both the embedding call and the Vectorize upsert are inside a try-catch, so a failure degrades correctly. However, there is no timeout on either operation, so a slow AI binding or Vectorize write can hold the Worker open for up to ~60 s after the insights response has already been sent to the client (this block executes synchronously before `return c.json(...)`).

**Fix — defer to `waitUntil`:**
```typescript
// Fire upsert after response is returned — never blocks the client
const upsertTask = async () => {
  try {
    let vector = sessionVector
    if (!vector) {
      const embedResult = (await runWithTimeout(
        c.env.AI.run('@cf/baai/bge-m3', { text: sessionResult.title }),
        20_000, 'vectorize-upsert-embed',
      )) as { data: number[][] }
      vector = embedResult?.data?.[0]
    }
    if (vector?.length === 768) {
      await c.env.DECISIONS_VECTORIZE.upsert([{ id: sessionId, values: vector, metadata: { ... } }])
    }
  } catch (err) {
    console.log(JSON.stringify({ event: 'vectorize.upsert.error', error: (err as Error).message }))
  }
}

// Return insights to client immediately
const response = c.json({ ok: true, data: payload, trace_id }, 200)
try { c.executionCtx.waitUntil(upsertTask()) } catch { /* no ctx in tests */ }
return response
```

---

## Resilience Inventory

### What works well

| Pattern | Implementation | File |
|---|---|---|
| HTTP timeout | AbortController + clearTimeout | `email.ts`, `billing.ts`, `oauth.ts` |
| AI retry + fallback model | 3-attempt loop + QUALITY_FALLBACK_MODEL | `ai-wizard.ts` |
| Parallel batch resilience | `Promise.allSettled` | `ai-wizard.ts:376` |
| WS rate limiting per voter | Token bucket (10 tokens, 1/s refill) | `SessionRoom.ts:107-109` |
| Per-session bulkhead | One Durable Object per session | `SessionRoom.ts` |
| Participant capacity cap | Plan-gated hard limit (50/500/5000) | `SessionRoom.ts:298-307` |
| Per-IP connection cap | `PER_IP_CONCURRENT_CAP = 5` | `SessionRoom.ts:111` |
| KV rate-limit fail-open | try-catch with allow-through | `middleware/rate-limit.ts:77` |
| Vectorize degradation | try-catch, insights generated without vector | `ai-insights.ts:136` |
| Background compute isolation | `waitUntil` for insight pre-computation | `sessions.ts:910` |
| KV TTL auto-expiry | `expirationTtl` on all KV writes | throughout |
| DO alarm for result debounce | Debounced broadcast (`BROADCAST_DEBOUNCE_MS = 100`) | `SessionRoom.ts` |
| Audit table graceful miss | try-catch → 0 fallback | `billing.ts:97-102` |
| DB degraded KPIs | try-catch → stub response | `admin.ts:470` |

### What is missing

| Gap | Affected services | Risk |
|---|---|---|
| Circuit breaker | Stripe, Resend, Workers AI, D1 | Cascading failures during outages |
| Retry on external HTTP | Stripe, Resend, OAuth | Single transient failure = full user impact |
| AI timeout (insights) | Workers AI | Worker hangs up to ~60 s |
| Retry on AI (insights) | Workers AI | No recovery from transient AI errors |
| Plan middleware catch | D1 | 500 on every authenticated route during D1 blip |
| `lib/rate-limit.ts` catch | ACTIONS_KV (auth rate limit) | 500 instead of allow-through |
| `_votersInitPromise` catch | DO storage | Silent unhandled rejection on storage fault |
| `webSocketMessage` outer catch | DO storage | Opaque WS close on storage fault |
| RBAC failure logging | D1 | Silent DB failures invisible in monitoring |
| Vectorize upsert timeout | Workers AI + Vectorize | Blocks response after insights sent |

---

## Remediation Priority Queue

| Priority | Finding | Effort | Blast radius |
|---|---|---|---|
| **P0** | RES-08: No circuit breaker for any service | High | All external service calls |
| **P0** | RES-12: `_votersInitPromise` unhandled rejection | Low | All live sessions on DO storage fault |
| **P0** | RES-13: `webSocketMessage` no outer try-catch | Low | All WebSocket message handling |
| **P0** | RES-02: Plan middleware unguarded D1 | Low | Every authenticated API request |
| **P1** | RES-05: AI insights no retry | Medium | All insights generation |
| **P1** | RES-06: External HTTP no retry | Medium | Stripe billing, magic-link auth |
| **P1** | RES-01: Workers AI no timeout | Medium | AI wizard + insights calls |
| **P1** | RES-10: `lib/rate-limit.ts` no catch | Low | Auth magic-link rate limiter |
| **P2** | RES-03: Admin middleware no catch | Low | Admin API only |
| **P2** | RES-09: D1 shared, no query timeout | High | All D1 queries |
| **P2** | RES-14: RBAC silent failure | Low | Role checks during DB blip |
| **P3** | RES-07: Linear retry delays in wizard | Low | AI wizard only |
| **P3** | RES-11: Insights AI calls not parallelized | Low | Insights latency |
| **P4** | RES-15: Vectorize upsert blocks response | Low | Post-insights delay |
