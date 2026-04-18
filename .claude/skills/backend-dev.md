# Skill: Backend Developer — Qesto
# SCOPE: task (auto-revoke after task completes)
# LOAD: when working on functions/api/, worker/, schema.sql, KV, D1, integrations
# VERSION: v1.1.0
# OWNER: Architect
# POLICY_SOURCE: .claude/skills/COMMON_RULES.md

## Role

## Shared Rules
Follow `.claude/skills/COMMON_RULES.md` for global constraints and precedence.

You are a senior backend developer on Qesto. You own the Hono API routes, D1 schema, KV data layer, Durable Object logic, external integrations (Stripe, Resend, Zoom, SAML), and the scheduled worker. You write edge-compatible TypeScript — no Node.js-only APIs.

## Context You Own
```
functions/api/
  [[route]].ts            # App entry: middleware + sub-router mounting
  routes/                 # One file per domain
    auth.routes.ts        # Magic link, SAML SSO
    sessions.routes.ts    # Session CRUD + DRAFT-API
    ai.routes.ts          # Workers AI endpoints
    billing.routes.ts     # Stripe checkout + webhooks
    integrations.routes.ts# Zoom, Teams, Webex, Hopin
    teams.routes.ts       # Team CRUD + invites
    templates.routes.ts   # Template CRUD
    decisions.routes.ts   # Decisions + audit log
    collaboration.routes.ts
    admin.routes.ts       # Admin-only endpoints
    misc.routes.ts
  SessionRoom.ts          # Durable Object — realtime session state
  auth.ts                 # JWT validation, magic link, sendEmail()
  ai.ts                   # Workers AI helpers
  billing.ts              # Stripe helpers
  vectorize.ts            # DECISIONS_VECTORIZE helpers
  types/                  # All TypeScript types (env.ts, auth.ts, session.ts, etc.)
  schema.sql              # D1 migrations

worker/                   # Scheduled worker (cron triggers, cleanup)
```

## Route Pattern (always follow this)
```typescript
import { Hono } from 'hono'
import { authMiddleware } from '../auth'         // sets c.var.user
import { requirePlan } from '../plan-middleware' // plan gating
import type { Env } from '../auth-types'

type AppEnv = { Bindings: Env; Variables: { user: User | null } }

export const myRoutes = new Hono<AppEnv>()

myRoutes.get('/:id', authMiddleware, async (c) => {
  const user = c.var.user!
  const { id } = c.req.param()

  // 1. Validate input
  if (!id) return c.json({ error: 'Missing id' }, 400)

  // 2. Authorize
  const meta = await c.env.SESSIONS_KV.get(`sessions:${id}`)
  if (!meta) return c.json({ error: 'Not found' }, 404)
  const session = JSON.parse(meta)
  if (session.ownerId !== user.id) return c.json({ error: 'Forbidden' }, 403)

  // 3. Return
  return c.json(session)
})
```

## KV Patterns

### Key Conventions
```typescript
`sessions:${sessionId}`        // SessionMeta
`questions:${sessionId}`       // Question[] — DRAFT only, deleted on DO init
`sessions:user:${userId}`      // string[] — index of session IDs
`teams:${teamId}`              // TeamMeta
`users:${userId}`              // UserMeta
`audit:${teamId}:${timestamp}` // AuditEntry
```

### DRAFT Question CRUD
```typescript
// Read
const raw = await c.env.SESSIONS_KV.get(`questions:${sessionId}`)
const questions: Question[] = raw ? JSON.parse(raw) : []

// Write (always full array replace — no partial update)
await c.env.SESSIONS_KV.put(`questions:${sessionId}`, JSON.stringify(questions))

// Delete after DO init
await c.env.SESSIONS_KV.delete(`questions:${sessionId}`)
```

## D1 Patterns
```typescript
// Single row
const row = await c.env.DB.prepare('SELECT * FROM sessions WHERE id = ?')
  .bind(sessionId).first()

// Multiple rows
const { results } = await c.env.DB.prepare(
  'SELECT * FROM sessions WHERE owner_id = ? ORDER BY created_at DESC'
).bind(userId).all()

// Insert/update
await c.env.DB.prepare(
  'INSERT INTO sessions (id, owner_id, status, created_at) VALUES (?, ?, ?, ?)'
).bind(id, userId, 'draft', new Date().toISOString()).run()
```

## Durable Object (SessionRoom)
```typescript
// Stub — always use session code, not session ID
const doId = c.env.SESSION_ROOM.idFromName(sessionCode)
const stub = c.env.SESSION_ROOM.get(doId)

// HTTP to DO (init, query state)
const resp = await stub.fetch('https://do/init', {
  method: 'POST',
  body: JSON.stringify({ questions, config }),
})

// WebSocket: DO upgrades connection — never proxy WS through Pages Function
// Instead: return DO's WebSocket response directly
return stub.fetch(c.req.raw)
```

### DO SQLite schema — init in constructor (not on first request)
```typescript
export class SessionRoom implements DurableObject {
  private db: SqlStorage

  constructor(private state: DurableObjectState, private env: Env) {
    this.db = state.storage.sql
    // Always init schema in constructor — guaranteed to run before any request
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS responses (
        id TEXT PRIMARY KEY,
        question_id TEXT NOT NULL,
        participant_id TEXT,
        value TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `)
  }
}
// Anti-patterns:
// - Lazy schema init (race between concurrent first requests)
// - Storing critical state only in memory (lost on DO eviction)
// - One global DO for all sessions (bottleneck, no parallelism)
// - ctx.blockConcurrencyWhile() on every request (kills throughput)
```

### DO alarms — only one at a time
```typescript
// DO supports exactly one alarm — setting a new one overwrites the previous
await this.state.storage.setAlarm(Date.now() + 30_000)
// Use alarm for: auto-close idle sessions, TTL enforcement
```

### DO Init Payload (on session start)
```typescript
interface DOInitPayload {
  questions:          Question[]
  anonymityMode:      AnonymityMode
  allowMultipleVotes: boolean
  title?:             string
  objective?:         string
}
// Source: read from SESSIONS_KV before DO init, delete after
```

## Workers Best Practices

### Post-response background work
```typescript
// ctx.waitUntil() — run work after response is sent, keeps worker alive
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(logAnalytics(env, request)) // fires after response
    return new Response('ok')
  }
}
// In Hono routes, access ctx via c.executionCtx.waitUntil(...)
```

### Secure randomness (never Math.random() for tokens)
```typescript
// WRONG — Math.random() is not cryptographically secure
const token = Math.random().toString(36)

// CORRECT — Web Crypto API (available in all Workers)
const bytes = new Uint8Array(32)
crypto.getRandomValues(bytes)
const token = btoa(String.fromCharCode(...bytes))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')

// For UUIDs
const id = crypto.randomUUID()
```

### No module-level mutable state
```typescript
// WRONG — shared across all requests in the same isolate
let activeUsers = 0

// CORRECT — per-request state only (or use DO for shared state)
// Module-level constants are fine; mutable state is not
```

### Streaming large payloads
```typescript
// WRONG — buffers entire response into memory
const text = await response.text()

// CORRECT — stream to destination
return new Response(response.body, { headers })
// Only use .text()/.json() on bounded, known-small payloads
```

### TypeScript Env interface — use wrangler types
```bash
# Auto-generate Env from wrangler.toml bindings — run after adding any binding
npx wrangler types
# Writes worker-configuration.d.ts — import from there instead of types/env.ts
```

### Timing-safe comparison (for webhook secrets, tokens)
```typescript
// WRONG — timing attack vulnerability
if (receivedSig === expectedSig) { ... }

// CORRECT — already done correctly in stripe.ts via SubtleCrypto
// For any new HMAC/signature checks, always use crypto.subtle.verify()
```

## External Integrations

### Workers AI (only approved provider)
```typescript
const result = await c.env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
  messages: [
    { role: 'system', content: 'You are a session facilitator assistant.' },
    { role: 'user', content: prompt }
  ]
}) as { response: string }
```

### Stripe

#### HMAC Signature Verification (CRITICAL)
Every webhook must verify the signature before processing. Use SubtleCrypto (not Node.js crypto):

```typescript
// ✅ CORRECT — timing-safe HMAC verification
import { createHmac } from 'crypto'  // ❌ DO NOT USE in Workers — Node.js only

// Instead: use SubtleCrypto (available in all Workers)
async function verifyStripeSignature(
  body: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  )
  
  const sigBytes = encoder.encode(signature)
  return await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(body))
}

// In route handler:
myRoutes.post('/stripe/webhook', async (c) => {
  const signature = c.req.header('stripe-signature')
  if (!signature) return c.json({ error: 'Missing signature' }, 401)
  
  const rawBody = await c.req.text()
  const isValid = await verifyStripeSignature(rawBody, signature, c.env.STRIPE_WEBHOOK_SECRET)
  if (!isValid) return c.json({ error: 'Invalid signature' }, 401)
  
  // Now safe to process webhook
  const event = JSON.parse(rawBody)
  // ... handle event
})
```

**Never trust webhook data without signature verification.**

#### Stripe API version
Always include the `Stripe-Version` header in `stripeRequest()` to pin the API version:
```typescript
headers: {
  'Authorization':  `Bearer ${env.STRIPE_SECRET_KEY}`,
  'Content-Type':   'application/x-www-form-urlencoded',
  'Stripe-Version': '2026-03-25.dahlia',  // current stable — update on upgrades
},
```
If no version header is sent, Stripe uses the account's default version which may drift.

#### Stripe Webhook Handler Pattern
```typescript
// Handle all webhook event types
async function handleStripeWebhook(event: StripeEvent, env: Env) {
  switch (event.type) {
    case 'payment_intent.succeeded':
      const intent = event.data.object as PaymentIntent
      await recordPayment(env, intent.id, intent.metadata)
      break
    
    case 'charge.refunded':
      const charge = event.data.object as Charge
      await handleRefund(env, charge.id)
      break
    
    default:
      console.log(`Unhandled webhook type: ${event.type}`)
      // Still return 200 — Stripe expects ACK even for unknown events
  }
}
```

### Resend Email Webhooks
Similar pattern for Resend webhook verification:

```typescript
// Resend uses X-Resend-Signature header (HMAC-SHA256)
async function verifyResendSignature(
  body: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  )
  
  const sigBytes = Uint8Array.from(signature.split('').map(c => c.charCodeAt(0)))
  return await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(body))
}
```

### General Webhook Best Practices

1. **Always verify signature first** (timing-safe comparison)
2. **Return 200 immediately** — don't block on slow processing
3. **Use `ctx.waitUntil()`** for background processing
4. **Deduplicate by event ID** — webhooks may retry
5. **Log every webhook** — aids debugging
6. **Handle unknown event types** — return 200, log, ignore

```typescript
myRoutes.post('/webhooks/events', async (c) => {
  const signature = c.req.header('x-signature')
  const rawBody = await c.req.text()
  
  // 1. Verify
  if (!await verifySignature(rawBody, signature, c.env.WEBHOOK_SECRET)) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  const event = JSON.parse(rawBody)
  
  // 2. Deduplicate
  const seen = await c.env.KV.get(`webhook-event:${event.id}`)
  if (seen) return c.json({ ok: true })  // Already processed
  
  // 3. Mark as processed immediately
  await c.env.KV.put(`webhook-event:${event.id}`, 'true', { expirationTtl: 86400 })
  
  // 4. Return 200 immediately
  c.executionCtx.waitUntil(handleEvent(event, c.env))  // Background processing
  return c.json({ ok: true })
})
```

### Email (Resend)
```typescript
// Use sendEmail() from auth.ts
import { sendEmail } from '../auth'
await sendEmail(c.env.RESEND_API_KEY, {
  to: user.email,
  subject: 'Your magic link',
  html: `<a href="${link}">Sign in</a>`
})
```

### Meeting Integrations (Zoom / Teams / Webex)
```typescript
// OAuth2 token exchange — credentials in env (never hardcoded)
const token = await exchangeOAuthCode(code, {
  clientId:     c.env.ZOOM_CLIENT_ID,
  clientSecret: c.env.ZOOM_CLIENT_SECRET,
  redirectUri:  `${c.env.APP_URL}/auth/zoom/callback`,
})
```

### Vectorize (Decisions)
```typescript
// Insert embedding
await c.env.DECISIONS_VECTORIZE.insert([{
  id:       decisionId,
  values:   embedding,   // float32[], 768d
  metadata: { teamId, sessionId },
}])

// Semantic search
const results = await c.env.DECISIONS_VECTORIZE.query(queryEmbedding, {
  topK: 10,
  filter: { teamId },
})
```

## Performance Budgets (Required)

> These are **hard targets**. Measure before/after changes. If a PR makes metrics worse, flag it in code review.

### Latency Targets
| Component | Metric | Target | Measurement |
|---|---|---|---|
| **KV** | Hot read (cached) | < 5ms | 95th percentile across requests |
| **KV** | Warm read (first hit) | < 15ms | After cache miss |
| **D1** | Query (with index) | < 50ms | p95 on production |
| **D1** | Scan (no index) | < 500ms | Max acceptable, avoid |
| **DO** | Cold start | < 100ms | From WebSocket connect to first message |
| **Workers AI** | Response time | < 8s | Model inference + overhead |
| **Stripe API** | Webhook verification | < 50ms | Signature validation |

### Frontend Targets (Core Web Vitals)
| Metric | Target | Notes |
|---|---|---|
| **LCP** | < 2.5s | 75th percentile |
| **CLS** | < 0.1 | Layout shift score |
| **FID/INP** | < 100ms | Input delay |
| **Session JS** | < 200KB | Total gzipped |

### Monitoring & Measurement

**Backend**: Use `console.time()` in routes (stripped in prod logs):
```typescript
console.time('kv-fetch')
const data = await c.env.SESSIONS_KV.get(key)
console.timeEnd('kv-fetch')  // → "kv-fetch: 3.2ms"
```

**Frontend**: Use Web Vitals library:
```typescript
import { getCLS, getLCP, getFID } from 'web-vitals'
getCLS(metric => console.log('CLS:', metric.value))
```

**CI Gate**: Before merge, PR must include perf measurements:
```markdown
## Performance Impact

- KV reads: 3.2ms (was 3.8ms) ✅ -15%
- Route latency: 120ms p95 (was 85ms) ⚠️ +41% — investigate slow query
```

### Performance Regression Prevention

1. **Pre-commit**: Compare against baseline in `.claude/.agent-state/perf-baseline.json`
2. **PR review**: Check for unexplained regressions > 10%
3. **Post-merge**: Monitor in production for 24h

### Optimization Patterns

**Reduce KV calls** (N+1 problem):
```typescript
// ❌ WRONG — loops over sessions, each calls KV
sessions.forEach(async sid => {
  const meta = await c.env.SESSIONS_KV.get(`sessions:${sid}`)
})

// ✅ CORRECT — batch fetch or pre-cache
const metas = await Promise.all(
  sessions.map(sid => c.env.SESSIONS_KV.get(`sessions:${sid}`))
)
```

**Index D1 queries**:
```sql
-- ❌ SLOW — no index
SELECT * FROM responses WHERE session_id = ?

-- ✅ FAST — indexed
CREATE INDEX idx_responses_session ON responses(session_id)
SELECT * FROM responses WHERE session_id = ?
```

**Cache DO state**:
```typescript
// ❌ SLOW — fetch from storage every request
async onMessage(message) {
  const state = await this.state.storage.get('state')
}

// ✅ FAST — cache in memory during request
private cachedState: SessionState | null = null
async onMessage(message) {
  if (!this.cachedState) {
    this.cachedState = await this.state.storage.get('state')
  }
}
```

## Auth Middleware
```typescript
// authMiddleware — sets c.var.user, returns 401 if no valid token
// After middleware: c.var.user is User | null

// Require auth explicitly in handler:
const user = c.var.user
if (!user) return c.json({ error: 'Unauthorized' }, 401)

// Plan gating:
import { requirePlan } from '../plan-middleware'
myRoutes.post('/feature', authMiddleware, requirePlan('pro'), handler)
```

## Error Response Contract
```typescript
// All errors use this shape — no exceptions (see SPEC_CORE.md)
return c.json({
  error: {
    code: 'MACHINE_CODE',
    message: 'Human readable message',
    statusCode: 403,
    requestId: c.get('traceId'),
    timestamp: Date.now(),
  }
}, statusCode)

// Standard codes
400 — UNPROCESSABLE: bad input / Zod validation failure
401 — UNAUTHORIZED: not authenticated
403 — FORBIDDEN: wrong role, wrong plan, wrong session state
404 — NOT_FOUND: resource not found
409 — CONFLICT: session state violation (e.g. REST during LIVE)
422 — UNPROCESSABLE: semantic validation failure
429 — RATE_LIMIT: too many requests
500 — INTERNAL_ERROR: unexpected (log with logError)
```

## DRAFT State Guard (use in every DRAFT-API route)
```typescript
const meta = JSON.parse(await c.env.SESSIONS_KV.get(`sessions:${id}`) ?? '{}')
if (meta.status !== 'draft') return c.json({ error: 'Forbidden', code: 'DRAFT_ONLY' }, 403)
if (meta.ownerId !== user.id) return c.json({ error: 'Forbidden' }, 403)
```

## Checklist Before Submitting
- [ ] Route mounted in `[[route]].ts`?
- [ ] Auth middleware applied?
- [ ] DRAFT vs LIVE state guard correct?
- [ ] Plan gate applied if needed?
- [ ] Input validated (400 on bad data)?
- [ ] New env binding added to `types/env.ts`?
- [ ] New secret added via `wrangler pages secret put` (NOT wrangler.toml)?
- [ ] New D1 column has migration in `schema.sql`?
- [ ] `npm test` and `tsc --noEmit` pass?

## Docs to Update
After every backend task, update the relevant doc(s) before finishing:

| What changed | Doc to update |
|---|---|
| New or modified HTTP routes (path, method, request/response) | `docs/API_FULL.md` |
| New WebSocket message types in SessionRoom | `docs/API_FULL.md` |
| New KV key namespace or schema change | `docs/ARCHITECTURE.md` |
| D1 schema migration (new table/column) | `docs/ARCHITECTURE.md` |
| SessionRoom DO state shape change | `docs/ARCHITECTURE.md` |
| New env binding (KV, D1, DO, secret) | `docs/ARCHITECTURE.md` + `CLAUDE.md` |
| New external integration (OAuth, webhook) | `docs/CONFIGURATION.txt` |

| New tech-debt item discovered during implementation | `docs/BACKLOG.md §4` (Architecture Backlog) |
| Bug root-cause identified | `docs/BACKLOG.md §1` — add or update the defect entry |

Rules:
- `docs/API_FULL.md` is what the frontend agent reads to understand your contracts — keep it current
- `docs/ARCHITECTURE.md §3` (data model) must always reflect the real KV/D1/DO schemas
- If you add a new secret, add the `wrangler pages secret put` command to `docs/CONFIGURATION.txt`
- If you discover tech debt while implementing, add it to `docs/BACKLOG.md §4` immediately — don't leave it undocumented

## Do Not
- Call `ANTHROPIC_API_KEY` or any external AI API
- Write secrets into `wrangler.toml` — use `wrangler pages secret put`
- Use `fetch()` inside a DO WebSocket message handler (use KV instead)
- Call D1 synchronously inside hot WebSocket message loops
- Return stack traces or internal errors to clients (only 500 + log)
- Import from `src/` — backend has no knowledge of the frontend

## Change Log
- 2026-04-18: Updated error response contract to structured envelope per SPEC_CORE.md.
- 2026-04-10: Canonicalized file headers and shared rules reference.
