# Error Flow Audit — Qesto Backend

**Date:** 2026-05-03  
**Branch:** `claude/audit-code-duplication-MQdYH`  
**Scope:** `functions/api/`, `worker/`

---

## Table of Contents

1. [Critical Path Analysis](#1-critical-path-analysis)
2. [Error Flow Diagrams](#2-error-flow-diagrams)
3. [Anti-Pattern Findings](#3-anti-pattern-findings)
4. [Standardized Error Handling Template](#4-standardized-error-handling-template)

---

## 1. Critical Path Analysis

### Path 1 — Database (D1) Connection Failure

> D1 is used via `c.env.DB.prepare(...).bind(...).run()/.first()/.all()`. None of these calls are wrapped in a shared try/catch at the middleware level.

#### Where is it caught?

| Location | Behaviour |
|----------|-----------|
| `middleware/plan.ts:33` | **NOT caught.** `DB.prepare(...).first()` throws to `onError`. |
| `middleware/rbac.ts:137–153` | Caught. Returns `['viewer']` silently (no log). |
| `routes/sessions.ts:108–121` (`fetchSession`) | **NOT caught.** Throws to `onError`. |
| `routes/sessions.ts:592` (`PATCH /:id`) | **NOT caught.** All `await DB...` calls are bare. |
| `routes/sessions.ts:727–733` (`POST /:id/start`) | **NOT caught.** Conditional UPDATE throws to `onError`. |
| `routes/energizers.ts:93–112` | Caught by outer try/catch. Returns 500. |
| `routes/gamification.ts:35–66` | Caught by outer try/catch. Returns 500. |
| `lib/audit.ts:63–82` | Caught. Fail-safe: logs and continues. |
| `app.ts:85–107` (`onError`) | Final catch-all for all uncaught DB errors. |

#### How is it transformed?

```
D1 throws CloudflareError("D1_ERROR: UNIQUE constraint failed: users.email")
  └── No route-level catch
       └── Hono onError (app.ts:85)
            └── err.message extracted verbatim → returned as JSON 500
```

The `sanitizeError()` utility is never called from `onError`. Raw D1 error messages (including table/column names) are returned in production.

#### What gets logged?

- `loggerMiddleware` records the 500 status after the fact, but the error is not logged before `onError` responds.
- `onError` writes `error.api` to `METRICS_AE` (line 91) — this is the only structured trace.
- No `console.error` — the DB error string exists only in the HTTP response body.

#### What does the user see?

```json
{ "ok": false, "error": { "code": "internal", "message": "D1_ERROR: SQLITE_CONSTRAINT_PRIMARYKEY" }, "trace_id": "..." }
```

Raw constraint details in production.

#### Is the system state consistent?

- **Plan middleware D1 failure**: all authenticated routes fail at plan check with 500. No state mutation occurred — consistent.
- **`POST /sessions/:id/start` D1 failure** mid-way (after the conditional UPDATE succeeded but before the DO init): the rollback at `sessions.ts:776–784` attempts to restore `status='draft'`, but if the rollback also fails, DB says LIVE and DO does not exist — **permanently inconsistent**. This is documented but has no automated reconciliation.
- **Schema patch** (`patchSchemaIfNeeded`) at lines 62–71: `.catch(() => {})` silently ignores ALL errors including genuine D1 outages — the patch is marked done (`_schemaPatchDone = true` at line 61) even if D1 was unreachable.

---

### Path 2 — Third-party API Timeout

Three external APIs are called: **Resend** (email), **Stripe** (billing), **Workers AI**, and **OAuth JWKS** fetches.

#### Resend (email)

```
email.ts:18-19   AbortController, 10s timeout
email.ts:22-37   fetch() — abort → TypeError("signal is aborted")
email.ts:40-42   Non-2xx → throw new Error("resend 429: ...")
```

**Caller — `auth.ts:119–132`:**
```ts
try {
  await sendEmail(...)
} catch (err) {
  console.error(`[auth] email delivery failed: ${(err as Error).message}`)
  // ↑ error logged, execution continues
}
return c.json({ ok: true, data: { accepted: true } }, 202)
```

| Question | Answer |
|----------|--------|
| Caught? | Yes — `auth.ts:127` |
| Transformed? | Logged to `console.error`, discarded |
| Logged? | `console.error` string only — no structured trace_id, no METRICS_AE event |
| User sees? | `202 Accepted { accepted: true }` — **misleading**; token is in DB, no email sent |
| State consistent? | Token persists in `magic_links` table. User cannot log in. Token expires after TTL. |

#### Stripe (billing portal)

```
billing.ts:30-41  fetch() with 10s AbortController
billing.ts:42-47  Non-2xx → throw new Error(stripeError.message)
```

**Caller — `billing.ts:151`:**
```ts
const session = await stripe.billingPortal.sessions.create(...)  // NO try/catch
return c.json({ ok: true, data: { url: session.url } ... })
```

| Question | Answer |
|----------|--------|
| Caught? | No — reaches `onError` |
| Transformed? | `err.message` (raw Stripe error string) returned verbatim |
| Logged? | `METRICS_AE error.api` only — no structured Stripe error log |
| User sees? | `500 { "code": "internal", "message": "No such customer: 'cus_xxx'" }` |
| State consistent? | No Stripe session created — consistent, but error is exposed |

#### Workers AI

```
ai-wizard.ts:228-275  Retry loop, 2 retries, exponential backoff (150ms, 300ms)
ai-wizard.ts:278-295  Model fallback chain (8B → 70B)
```

**Caller — `sessions.ts:1060–1094`:**
```ts
} catch (err) {
  if (err instanceof WizardValidationError) return c.json({...}, 502)
  if (err instanceof WizardAIError) {
    const sanitized = sanitizeError(err, c.env.ENV, 500)
    return c.json({ ok: false, error: { ...sanitized, code: 'ai_failed' } }, 500)
  }
  throw err  // ← re-throw unexpected errors to onError
}
```

AI errors are well-handled here. The `ai-insights.ts` path has **no retry** — single attempt only.

#### OAuth JWKS Fetch

```
oauth.ts:215   const res = await fetch(jwksUrl)  // NO AbortController — can hang indefinitely
oauth.ts:218   if (!res.ok) throw new Error("JWKS fetch failed: ...")
```

**Caller — `auth.ts:460–468`:**
```ts
try {
  providerUser = await exchangeGoogleCode(...)
} catch {                        // ← empty catch
  return c.redirect(`${c.env.PAGES_URL}/login?error=sso_failed`, 302)
}
```

| Question | Answer |
|----------|--------|
| Caught? | Yes — empty catch |
| Transformed? | Discarded — zero logging |
| Logged? | Nothing |
| User sees? | Redirect to `/login?error=sso_failed` |
| State consistent? | No session created — consistent, but timeout can hold the Worker thread for minutes |

---

### Path 3 — Invalid User Input

The codebase uses two patterns:

**Pattern A (correct — 16 routes):**
```ts
const body = await c.req.json().catch(() => null)
const parsed = Schema.safeParse(body)
if (!parsed.success) return c.json({ code: 'validation', details: parsed.error.flatten() }, 400)
```

**Pattern B (broken — 2 routes):**
```ts
const body = await c.req.json<T>()   // throws SyntaxError on malformed JSON
// no .catch(), inside outer try/catch → returns 500
```

| Route | Pattern | Malformed JSON result |
|-------|---------|----------------------|
| `POST /sessions` | A | 400 + Zod details |
| `PATCH /sessions/:id` | A | 400 + Zod details |
| `POST /sessions/:id/energizers` | **B** | **500** (caught by outer catch) |
| `POST /admin/metrics/export` | **B** | **500** (reaches `onError`) |
| All `routes/auth.ts` | A | 400 |
| `routes/teams.ts` | A | 400 |

**Transformation:** Zod errors are always `parsed.error.flatten()` — `{ fieldErrors: {}, formErrors: [] }`. This format is consistent but the `details` field is sometimes omitted in older handlers (e.g., `auth.ts:74`: no `details`).

**What does the user see?**
```json
{ "ok": false, "error": { "code": "validation", "message": "Invalid session payload",
  "details": { "fieldErrors": { "title": ["String must contain at least 1 character(s)"] }, "formErrors": [] } } }
```

---

### Path 4 — Authentication Failure

**JWT verification flow** (`middleware/auth.ts` → `lib/jwt.ts`):

```
Request
  │
  ├─ No cookie AND no Authorization header
  │    └─ 401 { code: 'unauthenticated', message: 'Missing session cookie' }
  │
  ├─ Token present → verifyJwt(token, JWT_SECRET)
  │    ├─ Wrong format (≠ 3 parts)   → returns null → 401
  │    ├─ Wrong header (not HS256)   → returns null → 401
  │    ├─ HMAC mismatch              → timingSafeEqual fails → null → 401
  │    ├─ JSON.parse failure         → try/catch → null → 401
  │    ├─ exp < now                  → null → 401 { message: 'Invalid or expired session' }
  │    └─ Valid token                → c.set('user', claims) → next()
  │
  └─ planMiddleware (runs after auth)
       ├─ user == null (should not happen if auth ran first)
       │    └─ 401 { code: 'unauthorized', message: 'Not authenticated' }   ← CODE MISMATCH
       └─ DB.prepare(...).first() — NO try/catch
            └─ D1 failure → onError → 500
```

**Code inconsistency:**
- `auth.ts:19` → `code: 'unauthenticated'`
- `plan.ts:22` → `code: 'unauthorized'`

**What gets logged?** Nothing — all 401 paths are synchronous returns with no side effects.

**State consistent?** Yes — auth is pure validation, no mutations.

---

### Path 5 — Storage (KV/DO) Errors

In the Workers runtime there is no traditional filesystem. "Storage errors" means KV namespace failures or Durable Object storage failures.

#### KV Namespace Failures

| KV Binding | Failure handling | Effect |
|------------|-----------------|--------|
| `ACTIONS_KV` (rate-limit middleware) | `catch` → fail-open, `console.log` | Rate limit bypassed |
| `ACTIONS_KV` (lib/rate-limit.ts) | **No try/catch** — throws to caller | Depends on caller |
| `ACTIONS_KV` (idempotency.ts:55) | **No try/catch** — throws to caller | Bubbles to onError |
| `SESSIONS_KV` (insights cache read) | **No try/catch** — throws to caller | Bubbles to onError |
| `TEAMS_KV` (sessions.ts:484) | try/catch → `teamId = null` | Analytics attribution lost |
| `USERS_KV` (billing.ts:140) | **No try/catch** — throws to caller | Bubbles to onError |
| `DECISIONS_KV` (precomputeInsights) | `.catch()` on outer promise | Error logged, not surfaced |

**`lib/rate-limit.ts` (used in sessions and insights routes) has no error handling:**
```ts
// lib/rate-limit.ts:51
const raw = await kv.get(key, 'json')    // ← throws if KV is down
```
If `ACTIONS_KV` is down, any route calling `rateLimit(c.env.ACTIONS_KV, ...)` from `lib/rate-limit.ts` will throw to `onError` with a 500, not fail-open like the middleware version.

#### Durable Object Storage Failures

```
SessionRoom.webSocketMessage (lines 337-432)
  ├─ case 'vote':   handleVote() → ensureVoters() → ctx.storage.get() → NO catch in webSocketMessage
  ├─ case 'advance': ctx.storage.get(K_QUESTIONS) → NO catch
  └─ case 'back':   ctx.storage.get(K_QUESTIONS) → NO catch
```

No try/catch wraps `webSocketMessage`. A DO storage failure during vote processing throws an unhandled exception from the hibernation callback. The DO runtime terminates the callback; the WebSocket client gets no response.

---

## 2. Error Flow Diagrams

### Diagram A — HTTP Request Error Propagation

```
Browser Request
      │
      ▼
┌──────────────────────────────────────────────────────┐
│  Middleware Chain (app.ts)                           │
│                                                      │
│  trace-id ──► CORS ──► logger ──► CSRF ──► rate-limit│
│                                           │          │
│                         KV down ──────────┤          │
│                         (fail-open) ◄─────┘          │
│                                                      │
│  ──► rbac ──► authMiddleware ──► planMiddleware ──►  │
│       │            │                   │             │
│       │       No token/bad JWT    DB fails           │
│       │       └─► 401 JSON        └─► onError→500   │
│       │                                              │
│  DB fails  → ['viewer'] silently  (no log)          │
└──────────────────────────────────────────────────────┘
      │
      ▼
┌──────────────────────────────────────────────────────┐
│  Route Handler                                       │
│                                                      │
│  c.req.json().catch(→null)                           │
│       │                                              │
│       ├── null/invalid ──► Schema.safeParse          │
│       │                         │                    │
│       │              !success ──►  400 JSON          │
│       │              success  ──►  business logic    │
│       │                                              │
│  DB call (bare await)                                │
│       ├── null result ──────────► 404 JSON           │
│       ├── D1 error ─────────────► ▼ (unhandled)     │
│       └── success ──────────────► 200/201 JSON       │
│                                                      │
│  External API (Stripe/Resend/AI)                     │
│       ├── timeout ──────────────► varies (see below)│
│       └── success ──────────────► 200 JSON           │
└──────────────────────────────────────────────────────┘
      │ (unhandled throws)
      ▼
┌──────────────────────────────────────────────────────┐
│  app.onError (app.ts:85)                             │
│                                                      │
│  err.message ──────────────────────► 500 JSON       │
│  (RAW, no ENV check, no sanitizeError)               │
│  METRICS_AE error.api ─────────────► fire-and-forget│
└──────────────────────────────────────────────────────┘
```

### Diagram B — Third-party API Error Paths

```
                    Resend Timeout
                         │
                  email.ts:18 AbortController
                         │ throws TypeError
                         ▼
               auth.ts:119 try { sendEmail }
                         │
                    catch (err) {
                    console.error(...)    ← logged
                    }                    ← discarded
                         │
                    returns 202 ◄────── USER SEES: success
                    (token in DB,         STATE: inconsistent
                     no email sent)


                    Stripe Timeout / Error
                         │
                  billing.ts:30 AbortController
                         │ throws Error("Stripe API error")
                         ▼
               billing.ts:151  (no try/catch)
                         │
                         ▼
                    onError (app.ts:85)
                         │
                    500 { message: raw Stripe msg }  ◄── USER SEES: 500
                                                         STATE: consistent


                    OAuth JWKS Fetch (no timeout!)
                         │
                  oauth.ts:215  fetch(jwksUrl)  ← CAN HANG INDEFINITELY
                         │
               auth.ts:460  try { exchangeGoogleCode }
                         │
                    catch { }   ← EMPTY, discarded, no log
                         │
                    redirect /login?error=sso_failed  ◄── USER SEES: redirect
                                                          STATE: consistent
                                                          DEBUG: impossible


                    Workers AI Timeout
                         │
                  ai-wizard.ts:228  retry loop (3 attempts)
                         │ exhausted → WizardAIError
                         ▼
               sessions.ts:1083  catch (err instanceof WizardAIError)
                         │
                  sanitizeError(err, ENV, 500)   ← SANITIZED ✓
                         │
                    500 { code: 'ai_failed', message: (sanitized) }  ◄── USER SEES: safe 500
```

### Diagram C — WebSocket / Durable Object Error Paths

```
WebSocket Client Message
      │
      ▼
SessionRoom.webSocketMessage (lines 337–432)
      │
      ├─ JSON.parse fails
      │    └─► ws.send(errorMessage('bad_json',...))   ← client notified
      │
      ├─ Missing attachment
      │    └─► ws.close(1008, 'missing attachment')    ← client disconnected
      │
      └─ case 'vote' → handleVote()
           │
           ├─ Rate limit exceeded
           │    └─► ws.send(errorMessage('rate_limited'))  ← internal code exposed
           │        ws.close(1008)
           │
           ├─ ensureVoters() → ctx.storage.get()
           │    └─► _votersInitPromise has NO .catch()
           │         If storage fails: unhandled rejection
           │         DO runtime terminates message callback
           │         WebSocket client: NO response ← SILENT FAILURE
           │
           └─ ctx.storage.get(K_QUESTION) — bare await
                If storage fails: exception propagates
                webSocketMessage has NO outer try/catch
                DO runtime terminates callback
                WebSocket client: NO response ← SILENT FAILURE
```

### Diagram D — D1 Database Failure Cascade

```
D1 Connectivity Lost
      │
      ├─► planMiddleware (plan.ts:33)
      │    └─ bare DB.prepare(...).first()
      │         └─► onError → 500 raw D1 error
      │              ALL plan-gated routes fail
      │
      ├─► rbacMiddleware (rbac.ts:137)
      │    └─ caught: return ['viewer']   ← degraded silently
      │         ALL users see 403 on write routes
      │         No log emitted            ← UNOBSERVABLE
      │
      ├─► fetchSession (sessions.ts:108)
      │    └─ bare DB.prepare(...).first()
      │         └─► onError → 500 raw D1 error
      │
      ├─► audit.ts:63
      │    └─ caught: console.error, continues   ← fail-safe ✓
      │
      └─► patchSchemaIfNeeded (sessions.ts:62–71)
           └─ .catch(() => {}) on all ALTER TABLEs
                _schemaPatchDone = true even if D1 down   ← MASKED
```

---

## 3. Anti-Pattern Findings

---

### EF-01 — Empty catch blocks in OAuth callbacks swallow all errors
**Importance: 8/10**

**Location:** `functions/api/routes/auth.ts:467` (Google), `auth.ts:520` (Microsoft)

```ts
// CURRENT — auth.ts:460–468
try {
  providerUser = await exchangeGoogleCode(code, redirectUri, clientId, clientSecret)
} catch {   // ← completely empty
  return c.redirect(`${c.env.PAGES_URL}/login?error=sso_failed`, 302)
}
```

`exchangeGoogleCode` throws 15+ distinct errors from `oauth.ts` (wrong secret, JWKS fetch failure, audience mismatch, key rotation, JWT expiry). All collapse to `sso_failed`. An outage of `accounts.google.com` JWKS is indistinguishable from a misconfigured client secret in the logs.

Additionally, `oauth.ts:215` has **no `AbortController`** on the JWKS fetch — a hung JWKS endpoint holds the Worker thread indefinitely.

**Fix:**

```ts
// auth.ts:460–468 (Google), apply same to Microsoft
try {
  providerUser = await exchangeGoogleCode(code, redirectUri, clientId, clientSecret)
} catch (err) {
  console.log(JSON.stringify({
    ts: new Date().toISOString(), level: 'error',
    msg: 'auth.oauth.google.failed',
    error: (err as Error).message,
    trace_id: c.get('trace_id') ?? 'unknown',
  }))
  return c.redirect(`${c.env.PAGES_URL}/login?error=sso_failed`, 302)
}
```

Fix the JWKS timeout in `lib/oauth.ts:215`:

```ts
// oauth.ts — add AbortController to JWKS fetch
const ac = new AbortController()
const timer = setTimeout(() => ac.abort(), 8_000)
let jwksRes: Response
try {
  jwksRes = await fetch(jwksUrl, { signal: ac.signal })
} finally {
  clearTimeout(timer)
}
```

---

### EF-02 — `planMiddleware` has no try/catch around D1 query — all plan-gated routes fail with raw 500
**Importance: 8/10**

**Location:** `functions/api/middleware/plan.ts:33`

```ts
// CURRENT
const result = await c.env.DB.prepare('SELECT plan FROM users WHERE id = ?1')
  .bind(user.sub).first<{ plan: PlanTier }>()
```

If D1 is degraded, every route using `planMiddleware` returns a raw 500 with a D1 error string. `planMiddleware` is applied to all session, template, team, billing, and insights routes. This is the widest single point of failure in the request path.

**Fix:**

```ts
let result: { plan: PlanTier } | null = null
try {
  result = await c.env.DB.prepare('SELECT plan FROM users WHERE id = ?1')
    .bind(user.sub).first<{ plan: PlanTier }>()
} catch (err) {
  console.log(JSON.stringify({
    ts: new Date().toISOString(), level: 'error',
    msg: 'plan_middleware.db_failure',
    user_id: user.sub,
    trace_id: c.get('trace_id' as never) as string | undefined,
    error: (err as Error).message,
  }))
  // Degrade to free plan rather than hard-fail the entire request.
  result = null
}
const plan = result?.plan ?? 'free'
```

---

### EF-03 — Stripe billing portal call has no error boundary
**Importance: 7/10**

**Location:** `functions/api/routes/billing.ts:151`

```ts
// CURRENT — no try/catch
const session = await stripe.billingPortal.sessions.create({
  customer: record.customerId,
  return_url: c.env.PAGES_URL + '/dashboard',
})
return c.json({ ok: true, data: { url: session.url } ... })
```

Any Stripe error (invalid customer ID, Stripe outage, timeout) bubbles to `onError`, returning `err.message` verbatim. This can include Stripe customer IDs and internal Stripe messaging.

**Fix:**

```ts
let session: { url: string }
try {
  session = await stripe.billingPortal.sessions.create({
    customer: record.customerId,
    return_url: c.env.PAGES_URL + '/dashboard',
  })
} catch (err) {
  const { message } = sanitizeError(err, c.env.ENV, 500)
  return c.json(
    { ok: false, error: { code: 'billing_error', message }, trace_id: c.get('trace_id') },
    502,
  )
}
```

---

### EF-04 — `SessionRoom.webSocketMessage` has no outer try/catch — DO crash on storage fault
**Importance: 7/10**

**Location:** `functions/api/SessionRoom.ts:337–432`

```ts
async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
  // JSON parse is try/caught (line 340) — good
  // But the entire switch block is bare:
  switch (parsed.type) {
    case 'vote': await this.handleVote(ws, att, parsed.data); break      // ctx.storage calls inside
    case 'advance': const allQs = await this.ctx.storage.get(K_QUESTIONS) // ← bare await
    …
  }
  // If any storage call throws → exception propagates out of webSocketMessage
  // DO runtime terminates the callback; client receives no response
}
```

**Fix:**

```ts
async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
  const text = typeof message === 'string' ? message : new TextDecoder().decode(message)
  let parsed: ClientMessage | null = null
  try {
    parsed = JSON.parse(text) as ClientMessage
  } catch {
    ws.send(errorMessage('bad_json', 'Message is not valid JSON'))
    return
  }
  // … attachment check …

  try {
    switch (parsed.type) {
      case 'vote': await this.handleVote(ws, att, parsed.data); break
      case 'advance': /* … */ break
      // … other cases …
      default: ws.send(errorMessage('unknown_type', `Unknown type`))
    }
  } catch (err) {
    // Storage failure — notify client and close gracefully rather than crashing.
    try {
      ws.send(errorMessage('internal', 'Temporary error. Please reconnect.'))
    } catch { /* WS may already be closed */ }
  }
}
```

---

### EF-05 — `patchSchemaIfNeeded` marks itself done even when D1 is unreachable
**Importance: 6/10**

**Location:** `functions/api/routes/sessions.ts:58–72`

```ts
let _schemaPatchDone = false
async function patchSchemaIfNeeded(db: D1Database): Promise<void> {
  if (_schemaPatchDone) return
  _schemaPatchDone = true          // ← set BEFORE the DB calls
  await db.prepare(`ALTER TABLE sessions ADD COLUMN vote_policy ...`).run().catch(() => {})
  // …7 more ALTER TABLE calls, all silently swallowed
}
```

`_schemaPatchDone = true` is set at line 61, before any DB work. If D1 is unreachable on cold-start, all ALTER TABLE calls are swallowed silently. The module-level flag is set, so the function never retries — the schema is left un-patched for the lifetime of the worker instance.

The pattern is intentional (ALTER TABLE is idempotent once columns exist), but D1 unavailability is not distinguishable from "column already exists" in the catch.

**Fix — reset the flag on genuine connection failure:**

```ts
async function patchSchemaIfNeeded(db: D1Database): Promise<void> {
  if (_schemaPatchDone) return
  try {
    await db.prepare('SELECT 1').first()  // fast connectivity probe
  } catch {
    return  // D1 unavailable — leave flag false, retry on next request
  }
  _schemaPatchDone = true
  await db.prepare(`ALTER TABLE sessions ADD COLUMN vote_policy ...`).run().catch(() => {})
  // … rest unchanged
}
```

---

### EF-06 — `lib/rate-limit.ts` has no error handling — KV failure throws to caller
**Importance: 6/10**

**Location:** `functions/api/lib/rate-limit.ts:51–68`

```ts
// CURRENT — no try/catch
export async function rateLimit(kv, id, opts): Promise<RateLimitResult> {
  if (!kv) return { allowed: true, remaining: opts.max, resetAt: … }
  const raw = await kv.get(key, 'json')    // ← throws if ACTIONS_KV is down
  // …
  await kv.put(key, JSON.stringify(next), { expirationTtl: ttl })   // ← throws
```

The middleware version (`middleware/rate-limit.ts:58–90`) wraps KV in try/catch and fails open. But `lib/rate-limit.ts` (used by `sessions.ts:1108`, `insights.ts:215`) throws uncaught. An ACTIONS_KV outage fails any AI generation or insights request with a 500 instead of allowing through.

**Fix:**

```ts
export async function rateLimit(kv, id, opts): Promise<RateLimitResult> {
  if (!kv) return { allowed: true, remaining: opts.max, resetAt: Date.now() + opts.windowSeconds * 1000 }
  try {
    const raw = await kv.get(key, 'json')
    // … existing logic …
  } catch {
    // Fail-open: KV outage must not block the primary operation.
    return { allowed: true, remaining: opts.max, resetAt: Date.now() + opts.windowSeconds * 1000 }
  }
}
```

---

### EF-07 — Errors used as flow control in `rbac.ts` and schema migration
**Importance: 5/10**

**Location A:** `functions/api/middleware/rbac.ts:150–153`

```ts
} catch (err) {
  // If DB fails, default to viewer (fail-safe)
  return ['viewer']
}
```

The D1 exception is not examined — any exception (connection failure, query timeout, missing table, permissions error) results in viewer role. A logic bug in the roles query (e.g., wrong column name) would silently degrade all users to viewer rather than failing loudly.

**Location B:** `functions/api/routes/sessions.ts:62–71` — ALL `ALTER TABLE` exceptions suppressed with `.catch(() => {})`. A genuine SQL error (e.g., bad syntax, constraint violation) is indistinguishable from "column already exists."

**Fix A** — narrow the catch to expected errors:

```ts
} catch (err) {
  const msg = (err as Error).message ?? ''
  // Only silently degrade if it's a missing-table condition (cold deploy).
  // Any other DB error should be visible in logs.
  if (!msg.includes('no such table') && !msg.includes('no such column')) {
    console.log(JSON.stringify({ level: 'error', msg: 'rbac.db_error', error: msg,
      trace_id: c.get('trace_id') ?? 'unknown' }))
  }
  return ['viewer']
}
```

---

### EF-08 — Inconsistent `401` error codes across middleware
**Importance: 5/10**

**Location A:** `functions/api/middleware/auth.ts:19` → `code: 'unauthenticated'`  
**Location B:** `functions/api/middleware/plan.ts:22` → `code: 'unauthorized'`

Both return HTTP 401, but different `code` strings. Frontend code checking `error.code === 'unauthenticated'` to trigger redirect-to-login would miss `'unauthorized'` errors from plan middleware.

**Fix — `plan.ts:22`:**

```ts
return c.json({ ok: false, error: { code: 'unauthenticated', message: 'Not authenticated' } }, 401)
```

---

### EF-09 — `gamification.ts` and `energizers.ts` expose raw DB errors — full catch blocks used as generic handlers
**Importance: 5/10**

**Location:** `functions/api/routes/gamification.ts:61–66, 122–127, 234–239`  
**Location:** `functions/api/routes/energizers.ts:109–112, 139–142` (and 7 more)

```ts
// gamification.ts:60–65 — representative pattern
} catch (err) {
  console.error('[gamification] get badges failed:', err)
  return c.json({ ok: false, error: { code: 'internal', message: (err as Error).message }, trace_id }, 500)
}
```

All errors — D1 errors, KV errors, validation errors, and logic errors — collapse to a single 500 with the raw `err.message`. A 404 condition inside the try block (checking session ownership) is wrapped in the outer try/catch, meaning a missing session returns `200 { ok: false, ... }` (via the inner not-found check) OR `500 { message: ... }` if the DB itself fails — two very different scenarios mapped identically.

**Fix — use `sanitizeError` and re-throw HTTP-classified errors:**

```ts
import { sanitizeError } from '../lib/error-handler'

} catch (err) {
  console.error('[gamification] get badges failed:', err)
  const { message } = sanitizeError(err, c.env.ENV, 500)
  return c.json({ ok: false, error: { code: 'internal', message }, trace_id }, 500)
}
```

---

### EF-10 — Missing error boundary for `USERS_KV.get()` in billing route
**Importance: 4/10**

**Location:** `functions/api/routes/billing.ts:140–141`

```ts
const raw = await c.env.USERS_KV.get(stripeCustomerKey(user.sub))
const record = raw ? (JSON.parse(raw) as { customerId: string }) : null
```

Two issues:
1. `USERS_KV.get()` has no try/catch — KV failure throws to `onError` with raw KV error
2. `JSON.parse(raw)` has no try/catch — a corrupted KV value throws `SyntaxError` to `onError`

**Fix:**

```ts
let record: { customerId: string } | null = null
try {
  const raw = await c.env.USERS_KV.get(stripeCustomerKey(user.sub))
  record = raw ? JSON.parse(raw) as { customerId: string } : null
} catch {
  return c.json(
    { ok: false, error: { code: 'internal', message: 'Could not retrieve billing info' }, trace_id: c.get('trace_id') },
    500,
  )
}
```

---

### EF-11 — `webSocketError` hibernation callback discards the error entirely
**Importance: 4/10**

**Location:** `functions/api/SessionRoom.ts:444–450`

```ts
async webSocketError(ws: WebSocket, _err: unknown): Promise<void> {
  try {
    ws.close(CLOSE_POLICY_VIOLATION, 'error')
  } catch {
    /* ignore */
  }
}
```

The `_err` parameter (the WebSocket protocol-level error) is completely ignored — underscore-prefixed and discarded. There is no logging of the error type, frequency, or context. WebSocket protocol errors are invisible in the operational logs.

**Fix:**

```ts
async webSocketError(ws: WebSocket, err: unknown): Promise<void> {
  const att = ws.deserializeAttachment() as { voterId?: string } | null
  console.log(JSON.stringify({
    ts: new Date().toISOString(), level: 'warn',
    msg: 'ws.protocol_error',
    voterId: att?.voterId ?? 'unknown',
    error: err instanceof Error ? err.message : String(err),
  }))
  try { ws.close(CLOSE_POLICY_VIOLATION, 'error') } catch { /* ignore */ }
}
```

---

### EF-12 — Resend email failure returns misleading `202 Accepted`
**Importance: 4/10**

**Location:** `functions/api/routes/auth.ts:119–132`

Already identified as EH-09 in the previous audit. Included here as an anti-pattern: **using try/catch for flow control that silently changes observable state** (token is in DB, email is not sent, user is told success).

The same issue exists at:
- `auth.ts:358–370` (password-reset email)  
- `teams.ts:353–365` (invite email)

---

## 4. Standardized Error Handling Template

The following template captures all patterns the codebase should use consistently. It can be dropped into any route handler.

### 4.1 — Standard Route Handler Shape

```ts
import { sanitizeError } from '../lib/error-handler'
import { z } from 'zod'

const CreateFooSchema = z.object({
  name: z.string().min(1).max(120),
})

app.post('/foo', authMiddleware, planMiddleware, async (c) => {
  const traceId = c.get('trace_id')
  const user = c.get('user')

  // ── 1. Input validation ──────────────────────────────────────────────────
  const raw = await c.req.json().catch(() => null)
  const parsed = CreateFooSchema.safeParse(raw)
  if (!parsed.success) {
    return c.json(
      { ok: false, error: { code: 'validation', message: 'Invalid payload', details: parsed.error.flatten() }, trace_id: traceId },
      400,
    )
  }

  // ── 2. Resource existence check (D1) ────────────────────────────────────
  // fetchFoo already returns null on DB error (wrap it if needed)
  const foo = await fetchFoo(c.env.DB, parsed.data.id, user.sub)
  if (!foo) {
    return c.json(
      { ok: false, error: { code: 'not_found', message: 'Foo not found' }, trace_id: traceId },
      404,
    )
  }

  // ── 3. State / authorization guard ──────────────────────────────────────
  if (foo.status !== 'active') {
    return c.json(
      { ok: false, error: { code: 'conflict', message: 'Foo must be active' }, trace_id: traceId },
      409,
    )
  }

  // ── 4. External call with error boundary ────────────────────────────────
  let externalResult: ExternalResult
  try {
    externalResult = await callExternalApi(parsed.data)
  } catch (err) {
    const { message } = sanitizeError(err, c.env.ENV, 502)
    return c.json(
      { ok: false, error: { code: 'upstream_error', message }, trace_id: traceId },
      502,
    )
  }

  // ── 5. D1 mutation ───────────────────────────────────────────────────────
  // Bare D1 calls are acceptable here because:
  // (a) onError is the safety net for unexpected DB failures
  // (b) sanitizeError is called from onError (after EH-01 is fixed)
  await c.env.DB.prepare('INSERT INTO foos (id, name) VALUES (?1, ?2)')
    .bind(externalResult.id, parsed.data.name)
    .run()

  return c.json(
    { ok: true, data: { id: externalResult.id }, trace_id: traceId },
    201,
  )
})
```

### 4.2 — Standard Error Response Shape

All error responses MUST match this shape (already established in the codebase):

```ts
type ErrorResponse = {
  ok: false
  error: {
    code: ErrorCode   // see registry below
    message: string   // user-facing, sanitized in production
    details?: unknown // Zod flatten() or structured info — 400s only
  }
  trace_id: string
}
```

**Error code registry** (extend as needed):

| HTTP | Code | When |
|------|------|------|
| 400 | `validation` | Zod failure, missing field |
| 400 | `bad_request` | Generic malformed request |
| 401 | `unauthenticated` | Missing/invalid JWT (ALL 401s, not `unauthorized`) |
| 403 | `forbidden` | RBAC / ownership check |
| 403 | `plan_limit` | Feature gate |
| 404 | `not_found` | Resource does not exist |
| 409 | `conflict` | State machine violation |
| 409 | `idem_in_flight` | Idempotency pending |
| 429 | `rate_limited` | Rate limit exceeded |
| 500 | `internal` | Unexpected server error (sanitized in prod) |
| 502 | `upstream_error` | External API failure |
| 502 | `ai_failed` | Workers AI failure |
| 503 | `misconfigured` | Missing required env var |

### 4.3 — Standard External API Call Wrapper

```ts
// Drop-in wrapper for any external fetch with timeout + sanitized error
async function fetchExternal<T>(
  url: string,
  init: RequestInit,
  timeoutMs = 10_000,
): Promise<T> {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), timeoutMs)
  let res: Response
  try {
    res = await fetch(url, { ...init, signal: ac.signal })
  } finally {
    clearTimeout(timer)
  }
  if (!res.ok) {
    const body = await res.text().catch(() => 'no body')
    throw new Error(`HTTP ${res.status} from ${new URL(url).hostname}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}
```

### 4.4 — Standard WebSocket Message Handler Shape

```ts
async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
  // Layer 1: JSON parse guard
  let parsed: ClientMessage | null = null
  try {
    parsed = JSON.parse(typeof message === 'string' ? message : new TextDecoder().decode(message)) as ClientMessage
  } catch {
    ws.send(errorMessage('bad_json', 'Message is not valid JSON'))
    return
  }

  // Layer 2: Attachment / auth guard
  const att = ws.deserializeAttachment() as Attachment | null
  if (!att) { ws.close(CLOSE_POLICY_VIOLATION, 'missing attachment'); return }

  // Layer 3: Business logic guard (storage errors)
  try {
    switch (parsed.type) {
      case 'vote': await this.handleVote(ws, att, parsed.data); break
      // …
      default: ws.send(errorMessage('unknown_type', 'Unknown message type'))
    }
  } catch (err) {
    // Storage fault — client must reconnect, DO state is unknown
    try { ws.send(errorMessage('internal', 'Temporary error. Please reconnect.')) } catch { /* already closed */ }
  }
}
```

### 4.5 — Corrected `onError` Handler

```ts
// app.ts — replaces lines 85–107
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
    : status === 502 ? 'upstream_error'
    : status === 503 ? 'misconfigured'
    : sanitized.code

  return c.json(
    { ok: false, error: { code, message: sanitized.message }, trace_id },
    status as 400 | 401 | 403 | 404 | 409 | 429 | 500 | 502 | 503,
  )
})
```

---

## Finding Summary

| ID | Anti-Pattern | Location | Importance |
|----|-------------|----------|-----------|
| EF-01 | Empty OAuth catch blocks + no JWKS timeout | `auth.ts:467,520`, `oauth.ts:215` | **8/10** |
| EF-02 | `planMiddleware` bare D1 call — widest failure surface | `plan.ts:33` | **8/10** |
| EF-03 | Stripe call has no error boundary | `billing.ts:151` | **7/10** |
| EF-04 | `webSocketMessage` has no outer try/catch | `SessionRoom.ts:337` | **7/10** |
| EF-05 | Schema patch marks done before DB confirms | `sessions.ts:61` | **6/10** |
| EF-06 | `lib/rate-limit.ts` no error handling — throws to caller | `lib/rate-limit.ts:51` | **6/10** |
| EF-07 | Errors as flow control (RBAC, schema migration) | `rbac.ts:150`, `sessions.ts:62` | **5/10** |
| EF-08 | Inconsistent 401 code: `unauthenticated` vs `unauthorized` | `plan.ts:22` vs `auth.ts:19` | **5/10** |
| EF-09 | Generic catch-all exposes raw DB errors in gamification/energizers | `gamification.ts:61,122,234` | **5/10** |
| EF-10 | Missing error boundary for `USERS_KV.get()` in billing | `billing.ts:140` | **4/10** |
| EF-11 | `webSocketError` discards error parameter entirely | `SessionRoom.ts:444` | **4/10** |
| EF-12 | Email failure returns misleading 202 (flow-control anti-pattern) | `auth.ts:119`, `teams.ts:353` | **4/10** |
