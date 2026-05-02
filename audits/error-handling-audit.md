# Error Handling Audit — Qesto Backend

**Date:** 2026-05-02  
**Branch:** `claude/audit-code-duplication-MQdYH`  
**Scope:** `functions/api/`, `worker/`

---

## Executive Summary

| ID | Category | Location | Importance |
|----|----------|----------|-----------|
| EH-01 | Error Information | `app.ts:101` | **9/10** |
| EH-02 | Error Information | `energizers.ts` (9 handlers) | **8/10** |
| EH-03 | Async Error Handling | `SessionRoom.ts:163` | **7/10** |
| EH-04 | Error Categories | `energizers.ts:42` | **7/10** |
| EH-05 | Error Recovery/Logging | `rbac.ts:152` | **6/10** |
| EH-06 | Async Error Handling | `auth.ts:467, 520` | **6/10** |
| EH-07 | Error Consistency | `app.ts:99–105` | **5/10** |
| EH-08 | Error Categories | `admin.ts:336` | **5/10** |
| EH-09 | Error Recovery | `auth.ts:119–132` | **4/10** |
| EH-10 | Error Logging | `rate-limit.ts:80` | **4/10** |
| EH-11 | Error Logging | `logger.ts:35–38` | **3/10** |
| EH-12 | Error Information | `SessionRoom.ts:121–123` | **3/10** |
| EH-13 | Code Organisation | `lib/error-handler.ts` | **3/10** |

**Positive practices** (no action required): centralized `app.onError`, `app.notFound`, `Idempotency` sentinel cleanup, AI wizard retry/fallback, uniform `safeParse` Zod pattern, `trace_id` on every error response, `sanitizeError` utility for AI paths, rate-limit fail-open.

---

## Findings

---

### EH-01 — Global `onError` leaks raw `err.message` in production
**Importance: 9/10**

**Location:** `functions/api/app.ts:96–106`

```ts
// CURRENT — app.ts:85–107
app.onError((err, c) => {
  const status = typeof maybeStatus === 'number' ? maybeStatus : 500
  …
  return c.json(
    {
      ok: false,
      error: {
        code: status >= 500 ? 'internal' : 'bad_request',
        message: err.message ?? 'Unexpected error',  // ← raw, unconditional
      },
      trace_id,
    },
    status as 400 | 401 | 403 | 404 | 500,
  )
})
```

`err.message` is returned verbatim regardless of `c.env.ENV`. D1 errors expose constraint names (`UNIQUE constraint failed: users.email`), KV errors expose key structure, DO errors expose internal routing. The `sanitizeError()` utility in `lib/error-handler.ts` exists for exactly this purpose but is never called here.

**Fix — `functions/api/app.ts:85`:**

```ts
import { sanitizeError } from './lib/error-handler'

app.onError((err, c) => {
  const trace_id = c.get('trace_id') ?? 'unknown'
  const maybeStatus = (err as unknown as { status?: number }).status
  const status = typeof maybeStatus === 'number' ? maybeStatus : 500
  if (status >= 500) {
    writeEvent(c.env.METRICS_AE, { name: 'error.api', traceId: trace_id })
  }
  const sanitized = sanitizeError(err, c.env.ENV ?? 'production', status)
  const code =
    status === 401 ? 'unauthenticated'
    : status === 403 ? 'forbidden'
    : status === 404 ? 'not_found'
    : status === 409 ? 'conflict'
    : status === 429 ? 'rate_limited'
    : sanitized.code
  return c.json(
    { ok: false, error: { code, message: sanitized.message }, trace_id },
    status as 400 | 401 | 403 | 404 | 409 | 429 | 500,
  )
})
```

---

### EH-02 — `energizers.ts` returns raw DB/runtime error messages as 500 responses
**Importance: 8/10**

**Location:** `functions/api/routes/energizers.ts:111, 141, 275, 353, 453, 520, 632, 726, 753`

All nine route-level catch blocks follow this pattern:

```ts
// CURRENT — e.g. energizers.ts:109–112
} catch (err) {
  console.error('[energizers] create failed:', err)
  return c.json({ ok: false, error: { code: 'internal', message: (err as Error).message }, trace_id }, 500)
}
```

`(err as Error).message` is sent to the client unconditionally. A D1 constraint violation, a network timeout, or an unexpected value will expose internal details (table names, column constraints, timeouts) to any caller in production.

**Fix — replace all nine occurrences with a single helper call:**

```ts
// Add once at top of file
import { sanitizeError } from '../lib/error-handler'

// Replace every catch block
} catch (err) {
  console.error('[energizers] create failed:', err)
  const { message } = sanitizeError(err, c.env.ENV, 500)
  return c.json({ ok: false, error: { code: 'internal', message }, trace_id }, 500)
}
```

Because `sanitizeError` returns a generic message in production and the real message in dev, this is a one-line change per handler.

---

### EH-03 — `SessionRoom.ts:163` — unguarded `.then()` on Durable Object storage read
**Importance: 7/10**

**Location:** `functions/api/SessionRoom.ts:160–166`

```ts
// CURRENT
if (!this._votersInitPromise) {
  this._votersInitPromise = this.ctx.storage
    .get<Record<string, string | string[]>>(K_VOTERS)
    .then(raw => { this._voters = normaliseVotes(raw) })  // ← no .catch()
}
await this._votersInitPromise
```

If `ctx.storage.get()` rejects (DO storage error, eviction, or transient fault), `_votersInitPromise` holds a rejected promise. All callers of `ensureVoters()` — `handleVote`, `handleClose`, `handleState` — then propagate an unhandled rejection. In the DO runtime this terminates the DO instance without sending a response to the waiting HTTP caller (`postDO`/`doStub`). The caller gets a network error, not a clean 500.

**Fix:**

```ts
if (!this._votersInitPromise) {
  this._votersInitPromise = this.ctx.storage
    .get<Record<string, string | string[]>>(K_VOTERS)
    .then(raw => { this._voters = normaliseVotes(raw) })
    .catch(err => {
      // Reset so the next call retries rather than caching the rejection.
      this._votersInitPromise = null
      throw err
    })
}
await this._votersInitPromise
```

---

### EH-04 — `energizers.ts` POST handler uses untyped `req.json()` — malformed JSON returns 500 instead of 400
**Importance: 7/10**

**Location:** `functions/api/routes/energizers.ts:41–112`

```ts
// CURRENT
try {
  const body = await c.req.json<{
    kind: 'battle_royale' | …
    …
  }>()
  // manual kind check only
  if (!['battle_royale', …].includes(body.kind)) {
    return c.json({ ok: false, error: { code: 'validation', … }, trace_id }, 400)
  }
  …
} catch (err) {
  console.error('[energizers] create failed:', err)
  return c.json({ ok: false, error: { code: 'internal', message: (err as Error).message }, trace_id }, 500)
}
```

`c.req.json<T>()` is a cast — it does not validate. Two problems:
1. If the client sends malformed JSON, Hono's `json()` throws a `SyntaxError`, which the outer `catch` returns as a **500** instead of a **400**.
2. Any field (e.g. `body.prompt`) can be undefined without a type error, yet the code inserts it directly into D1.

Every other route in the codebase uses the `c.req.json().catch(() => null)` + `safeParse()` pattern. Energizers is the only exception.

**Fix:**

```ts
import { z } from 'zod'

const CreateEnergizerSchema = z.object({
  kind: z.enum(['battle_royale', 'bracket', 'emoji_poll', 'quick_finger', 'team_quiz', 'word_cloud']),
  prompt: z.string().min(1).max(400),
  participants: z.array(z.string()).optional(),
  bracket_size: z.union([z.literal(4), z.literal(8), z.literal(16)]).optional(),
  emojis: z.array(z.string()).optional(),
  options: z.array(z.string()).optional(),
  correct_index: z.number().int().nonnegative().optional(),
})

app.post('/sessions/:sessionId/energizers', async (c) => {
  const trace_id = c.get('trace_id')
  const raw = await c.req.json().catch(() => null)
  const parsed = CreateEnergizerSchema.safeParse(raw)
  if (!parsed.success) {
    return c.json(
      { ok: false, error: { code: 'validation', message: 'Invalid energizer payload', details: parsed.error.flatten() }, trace_id },
      400,
    )
  }
  const body = parsed.data
  // … rest of handler
})
```

---

### EH-05 — `rbac.ts:152` — DB failure silently defaults to viewer with no log or metric
**Importance: 6/10**

**Location:** `functions/api/middleware/rbac.ts:136–154`

```ts
// CURRENT
async function getUserRoles(c: any, userId: string): Promise<string[]> {
  …
  try {
    const rows = await (c.env.DB.prepare as any)(…).bind(userId).all()
    …
  } catch (err) {
    // If DB fails, default to viewer (fail-safe)
    return ['viewer']   // ← error swallowed, no logging
  }
}
```

If D1 is down or the `user_roles` table is missing, every authenticated request silently downgrades to `viewer`. No log is emitted. A total D1 outage would manifest as confusing 403 responses on every mutating endpoint with no observable cause in the logs.

**Fix:**

```ts
} catch (err) {
  console.log(JSON.stringify({
    ts: new Date().toISOString(),
    level: 'error',
    msg: 'rbac.db_failure',
    user_id: userId,
    trace_id: c.get('trace_id') ?? 'unknown',
    error: (err as Error).message,
  }))
  return ['viewer']
}
```

---

### EH-06 — OAuth callback errors silently swallowed — no logging, no trace
**Importance: 6/10**

**Location:** `functions/api/routes/auth.ts:460–468` (Google), `auth.ts:511–521` (Microsoft)

```ts
// CURRENT — Google callback
try {
  providerUser = await exchangeGoogleCode(…)
} catch {   // ← empty catch
  return c.redirect(`${c.env.PAGES_URL}/login?error=sso_failed`, 302)
}
```

`exchangeGoogleCode` and `exchangeMicrosoftCode` in `lib/oauth.ts` throw descriptive errors (e.g. "Google token exchange failed: 400", "JWT audience mismatch"). These are completely discarded. A misconfigured `GOOGLE_CLIENT_SECRET`, a JWKS fetch failure, or a token exchange timeout are all indistinguishable from "user cancelled the flow" in production.

**Fix:**

```ts
} catch (err) {
  console.log(JSON.stringify({
    ts: new Date().toISOString(),
    level: 'error',
    msg: 'auth.oauth.callback_failed',
    provider: 'google',
    trace_id: c.get('trace_id') ?? 'unknown',
    error: (err as Error).message,
  }))
  return c.redirect(`${c.env.PAGES_URL}/login?error=sso_failed`, 302)
}
```

Apply the same pattern to the Microsoft callback at `auth.ts:511–521`.

---

### EH-07 — `onError` status cast and error code mapping are incomplete
**Importance: 5/10**

**Location:** `functions/api/app.ts:99–105`

```ts
// CURRENT
code: status >= 500 ? 'internal' : 'bad_request',
…
status as 400 | 401 | 403 | 404 | 500,  // missing 409, 429, 502
```

**Problem A:** Any error with `status: 401`, `403`, `409`, or `429` that reaches `onError` returns `code: 'bad_request'`. For example, if a Hono built-in throws `{ status: 401 }`, the response code will say `bad_request` not `unauthenticated`.

**Problem B:** The TypeScript cast `status as 400 | 401 | 403 | 404 | 500` drops 409 and 429 from the union. Routes in `sessions.ts` return 502 for AI validation errors; if such a throw ever reaches `onError`, TypeScript would silently cast it to 500.

**Fix:** Already shown in EH-01's remediation — expand the union and add a code mapping switch.

---

### EH-08 — `admin.ts:336` — `c.req.json()` without `.catch()` turns malformed body into 500
**Importance: 5/10**

**Location:** `functions/api/routes/admin.ts:336`

```ts
// CURRENT
app.post('/metrics/export', async (c) => {
  const body = await c.req.json<{ start?: string; end?: string }>()  // ← no .catch()
  …
})
```

Unlike every other mutation handler in the codebase (which uses `.catch(() => null)`), this one calls `.json()` raw. A request with a malformed body or a `Content-Type` mismatch throws a `SyntaxError` that bubbles to `onError` as a 500. This is the only such occurrence in `admin.ts`.

**Fix:**

```ts
const raw = await c.req.json().catch(() => null) as { start?: unknown; end?: unknown } | null
if (!raw?.start || !raw?.end) {
  return c.json({ ok: false, error: { code: 'validation', message: 'start and end are required (ISO 8601)' }, trace_id }, 400)
}
```

---

### EH-09 — Email delivery failure silently returns 202 to caller
**Importance: 4/10**

**Location:** `functions/api/routes/auth.ts:119–132`

```ts
// CURRENT
try {
  await sendEmail(c.env.RESEND_API_KEY, { … })
} catch (err) {
  console.error(`[auth] email delivery failed: ${(err as Error).message}`)
  // ↑ error logged but response is still 202 Accepted
}
return c.json({ ok: true, data: { accepted: true }, trace_id: … }, 202)
```

A Resend API failure, a missing `RESEND_API_KEY`, or a network timeout logs to the error stream but the caller receives `202 Accepted { accepted: true }`. The user expects an email but none was sent. The same pattern applies to the password-reset email at `auth.ts:358–370` and the team invite at `teams.ts:353–365`.

**Fix (magic-link flow):**

```ts
let delivered = false
try {
  const result = await sendEmail(c.env.RESEND_API_KEY, { … })
  delivered = result.delivered
} catch (err) {
  console.error(`[auth] email delivery failed: ${(err as Error).message}`)
}
// Return 202 regardless (email enumeration protection), but include
// delivered:false so monitoring dashboards can alert on delivery rate.
return c.json({ ok: true, data: { accepted: true, delivered }, trace_id: … }, 202)
```

For internal visibility: track `delivered: false` occurrences in the Analytics Engine dashboard.

---

### EH-10 — `rate-limit.ts:80` logs KV errors with `console.log` not `console.error`
**Importance: 4/10**

**Location:** `functions/api/middleware/rate-limit.ts:77–90`

```ts
// CURRENT
} catch (err) {
  kvAvailable = false
  console.log(              // ← should be console.error
    JSON.stringify({
      …
      level: 'error',
      msg: 'rate_limit_kv_error',
      …
    }),
  )
}
```

The structured JSON payload includes `level: 'error'` but uses `console.log`. Cloudflare Logpush streams differentiate between `console.error` (stderr) and `console.log` (stdout). Any alerting rule that filters on the log stream type will miss this. All other error conditions in the codebase that warrant `level: 'error'` use `console.error`.

**Fix:**

```ts
console.error(JSON.stringify({ ts: new Date().toISOString(), level: 'error', msg: 'rate_limit_kv_error', … }))
```

---

### EH-11 — `loggerMiddleware` silences all structured request logs in `preview` and `dev`
**Importance: 3/10**

**Location:** `functions/api/middleware/logger.ts:34–38`

```ts
// CURRENT
if (env !== 'production' && env !== 'staging') {
  await next()
  return  // no log emitted
}
```

Preview deployments (`ENV=preview`) receive zero structured per-request log lines. A 500 on a preview deploy has no `trace_id`, no `error_code`, no `user_id` in the log stream. The `app.onError` fires and returns JSON to the client, but the request record is lost.

**Fix — log warnings and errors in preview:**

```ts
const SILENT_ENVS = new Set(['dev'])

export const loggerMiddleware = async (c, next) => {
  const env = c.env.ENV
  const start = Date.now()
  await next()
  if (SILENT_ENVS.has(env)) return        // keep dev quiet for Vitest

  const status = c.res.status
  if (env !== 'production' && env !== 'staging' && status < 400) return  // skip 2xx/3xx in preview

  // … rest of logger unchanged
}
```

---

### EH-12 — `SessionRoom` broadcasts internal error codes to WebSocket clients
**Importance: 3/10**

**Location:** `functions/api/SessionRoom.ts:121–123`

```ts
function errorMessage(code: string, message: string): string {
  return serverMessage({ type: 'error', data: { code, message }, timestamp: now() })
}
```

Error codes like `vote_bucket_exhausted`, `vote_rejected`, `unknown_question`, and `not_live` (plus the full string from internal guards) are sent as WebSocket messages to every connected client. A malicious attendee can observe these error codes and infer session state machine internals (e.g. confirming a session is closed, inferring vote-bucket limits).

**Fix — separate internal code from client-facing code:**

```ts
const CLIENT_ERROR_MESSAGES: Record<string, string> = {
  vote_bucket_exhausted: 'You are voting too quickly. Please slow down.',
  not_live: 'Session is not active.',
  vote_rejected: 'Your vote could not be recorded.',
  capacity_exceeded: 'This session is full.',
}

function errorMessage(code: string, _internalMessage: string): string {
  const message = CLIENT_ERROR_MESSAGES[code] ?? 'An error occurred.'
  return serverMessage({ type: 'error', data: { code, message }, timestamp: now() })
}
```

---

### EH-13 — `sanitizeError()` is underused — imported in 2 files but not in `onError`
**Importance: 3/10**

**Location:** `functions/api/lib/error-handler.ts`

`sanitizeError` is imported in:
- `functions/api/routes/sessions.ts` (3 call sites)
- `functions/api/routes/insights.ts` (1 call site)

It is **not** used in:
- `app.ts:onError` (global handler)
- `energizers.ts` (9 catch blocks)
- `gamification.ts` (3 catch blocks)
- `ai-insights.ts` (2 catch blocks)
- `admin.ts` (1 catch block)

The result is inconsistent production safety: AI errors in `sessions.ts` are sanitized; identical AI errors via `ai-insights.ts` expose the raw message.

The fix is covered by EH-01 (onError) and EH-02 (energizers). For the remaining files, apply the same `sanitizeError(err, c.env.ENV, 500)` call in every catch block that returns a 500.

---

## Async Error Handling: Coverage Table

| Pattern | File | Status |
|---------|------|--------|
| `Promise.allSettled` with fulfilled check | `ai-wizard.ts:376–390` | ✅ handled |
| `waitUntil` fire-and-forget | `sessions.ts:910` | ✅ `.catch()` present |
| `_votersInitPromise` chain | `SessionRoom.ts:163` | ❌ no `.catch()` |
| `precomputeInsights` background task | `sessions.ts:911` | ✅ `.catch()` present |
| Storage reads in `handleClose`, `handleState` | `SessionRoom.ts:226–271` | ⚠️ no try/catch but DO runtime handles uncaught |
| `ctx.storage.setAlarm` | `SessionRoom.ts` | ⚠️ bare await, no catch |

---

## Error Category Coverage

| HTTP Code | Codes Used | Gap |
|-----------|-----------|-----|
| 400 | `validation`, `bad_request` | `energizers.ts` returns 500 for malformed body (EH-04) |
| 401 | `unauthenticated` | ✅ consistent |
| 403 | `forbidden`, `forbidden_origin`, `plan_limit` | ✅ consistent |
| 404 | `not_found` | ✅ consistent; `notFound` handler covers unknown routes |
| 409 | `conflict`, `idem_in_flight`, `already_initialised` | ✅ semantically rich |
| 429 | `rate_limited` | ✅ includes `retryAfter` field |
| 500 | `internal` | raw `err.message` exposed (EH-01, EH-02) |
| 502 | `ai_failed`, `ai_output_invalid` | ✅ correctly scoped to AI paths |

---

## Error Recovery: What Exists vs. What's Missing

| Mechanism | Present | Location |
|-----------|---------|----------|
| Retry with exponential backoff | ✅ | `ai-wizard.ts:208–275` (2 retries + fallback model) |
| Idempotency sentinel + PENDING lock | ✅ | `lib/idempotency.ts` |
| Rate-limit fail-open | ✅ | `middleware/rate-limit.ts:77–90` |
| DO rollback on failed start | ✅ | `sessions.ts:776–784` |
| AI model fallback chain | ✅ | `ai-wizard.ts:278–295` |
| Best-effort cache (KV write never blocks) | ✅ | `insights.ts:276–280` |
| Circuit breaker | ❌ None | — |
| `ai-insights.ts` retry | ❌ None | single attempt only |
| Stripe retry | ❌ None | `billing.ts:29–48` — one fetch, no retry |

**Missing: `ai-insights.ts` retry.** The wizard (`ai-wizard.ts`) retries up to 3 times. The insights extractor (`ai-insights.ts:128–155`) makes a single attempt and throws. A transient Workers AI timeout on a closed session forces the user to reload.

**Fix — `functions/api/lib/ai-insights.ts:128`:**

```ts
const RETRY_DELAYS_MS = [200, 400] as const

export async function extractThemes(ai: Ai, input: InsightsInput, model = '…'): Promise<InsightsResult> {
  …
  let lastErr: Error = new InsightsAIError('No attempts')
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) await new Promise<void>(r => setTimeout(r, RETRY_DELAYS_MS[attempt - 1]))
    try {
      const res = (await ai.run(model, { messages: […], max_tokens: MAX_TOKENS })) as …
      // … existing parse logic
      return { themes: result.data.themes }
    } catch (err) {
      if (err instanceof InsightsValidationError) throw err  // schema errors: no point retrying
      lastErr = err instanceof Error ? err : new Error(String(err))
    }
  }
  throw new InsightsAIError(`AI invocation failed after ${RETRY_DELAYS_MS.length + 1} attempts: ${lastErr.message}`)
}
```

---

## Remediation Priority Queue

| Priority | Finding | Effort | Risk |
|----------|---------|--------|------|
| P0 | EH-01 — `onError` leaks `err.message` in production | 30 min | Information disclosure |
| P0 | EH-02 — `energizers.ts` exposes raw errors (9 handlers) | 20 min | Information disclosure |
| P1 | EH-03 — `SessionRoom` unguarded `.then()` | 15 min | DO crash on storage fault |
| P1 | EH-04 — Energizer POST schema validation | 45 min | 500s on bad input |
| P2 | EH-05 — RBAC DB failure silent | 10 min | Unobservable outage |
| P2 | EH-06 — OAuth callback swallows errors | 10 min | Undiagnosable auth failures |
| P2 | EH-08 — `admin.ts:336` bare `.json()` | 5 min | 500 on malformed body |
| P3 | EH-07 — `onError` status/code mapping | 15 min | Type safety + correctness |
| P3 | AI insights missing retry | 30 min | Transient 500s for closed sessions |
| P4 | EH-09 — Email 202 on delivery failure | 20 min | UX / monitoring |
| P4 | EH-10 — `console.log` for error | 2 min | Alerting miss |
| P4 | EH-11 — Preview logs silenced | 10 min | Debug friction |
| P5 | EH-12 — WS error code leakage | 20 min | Minor info disclosure |
| P5 | EH-13 — `sanitizeError` coverage | 20 min | Consistency |
