---
name: developing-backend
description: Implements Hono API routes, KV/D1 patterns, Durable Objects, and external integrations on Cloudflare Workers. Use when working on functions/api/, worker/, schema.sql, or any backend service. See backend-integrations.md for Stripe/Resend/AI/Vectorize patterns, backend-perf.md for performance budgets.
---

Follow `.claude/skills/COMMON_RULES.md` for global constraints.

You are a senior backend developer on Qesto. You own the Hono API, D1 schema, KV layer, Durable Object logic, and external integrations. You write edge-compatible TypeScript — no Node.js-only APIs.

**No Node.js APIs**: no `fs`, no `Buffer` (use `Uint8Array`), no `process.env` (use `c.env`).
**Integrations / performance**: See [backend-integrations.md](backend-integrations.md) · [backend-perf.md](backend-perf.md)

## Route Pattern

```typescript
import { Hono } from 'hono'
import { authMiddleware } from '../auth'
import { requirePlan } from '../plan-middleware'
import type { Env } from '../auth-types'

export const myRoutes = new Hono<{ Bindings: Env; Variables: { user: User | null } }>()

myRoutes.get('/:id', authMiddleware, async (c) => {
  const user = c.var.user!
  const { id } = c.req.param()
  if (!id) return c.json({ error: { code: 'BAD_REQUEST', message: 'Missing id', statusCode: 400, requestId: c.get('traceId'), timestamp: Date.now() } }, 400)
  const raw = await c.env.SESSIONS_KV.get(`sessions:${id}`)
  if (!raw) return c.json({ error: { code: 'NOT_FOUND', message: 'Not found', statusCode: 404, requestId: c.get('traceId'), timestamp: Date.now() } }, 404)
  const session = JSON.parse(raw)
  if (session.ownerId !== user.id) return c.json({ error: { code: 'FORBIDDEN', message: 'Forbidden', statusCode: 403, requestId: c.get('traceId'), timestamp: Date.now() } }, 403)
  return c.json(session)
})
```

## Error Response Contract

```typescript
// All errors — no exceptions
{ error: { code: string, message: string, statusCode: number, requestId: string, timestamp: number } }

// Standard codes
400 UNPROCESSABLE  | 401 UNAUTHORIZED | 403 FORBIDDEN | 404 NOT_FOUND
409 CONFLICT       | 422 VALIDATION   | 429 RATE_LIMIT | 500 INTERNAL_ERROR
```

## KV Patterns

```typescript
// Key conventions
`sessions:${id}`           // SessionMeta
`questions:${sessionId}`   // Question[] — DRAFT only, deleted on DO init
`sessions:user:${userId}`  // string[] — session ID index
`teams:${teamId}` · `users:${userId}` · `audit:${teamId}:${ts}`

// Read/write
const raw = await c.env.SESSIONS_KV.get(`questions:${sessionId}`)
const questions: Question[] = raw ? JSON.parse(raw) : []
await c.env.SESSIONS_KV.put(`questions:${sessionId}`, JSON.stringify(questions), { expirationTtl: 30 * 86400 })
await c.env.SESSIONS_KV.delete(`questions:${sessionId}`)
```

## D1 Patterns

```typescript
// Single row
const row = await c.env.DB.prepare('SELECT * FROM sessions WHERE id = ?').bind(id).first()

// Multiple rows
const { results } = await c.env.DB.prepare(
  'SELECT * FROM sessions WHERE owner_id = ? ORDER BY created_at DESC'
).bind(userId).all()

// Mutation
await c.env.DB.prepare(
  'INSERT INTO sessions (id, owner_id, status, created_at) VALUES (?, ?, ?, ?)'
).bind(id, userId, 'draft', new Date().toISOString()).run()
```

D1 rules: always use migrations (never ALTER TABLE without schema.sql entry), `INTEGER` for booleans, `TEXT` for enums, ISO 8601 timestamps, add index for any WHERE column with >1k expected rows.

## Durable Object (SessionRoom)

```typescript
// Always use session code as DO name (not session ID)
const doId = c.env.SESSION_ROOM.idFromName(sessionCode)
const stub = c.env.SESSION_ROOM.get(doId)

// HTTP to DO
const resp = await stub.fetch('https://do/init', {
  method: 'POST', body: JSON.stringify({ questions, config })
})

// WebSocket — return DO's response directly (never proxy WS through Pages Function)
return stub.fetch(c.req.raw)
```

```typescript
// DO schema — always init in constructor
export class SessionRoom implements DurableObject {
  private db: SqlStorage
  constructor(private state: DurableObjectState, private env: Env) {
    this.db = state.storage.sql
    this.db.exec(`CREATE TABLE IF NOT EXISTS responses (
      id TEXT PRIMARY KEY, question_id TEXT NOT NULL,
      participant_id TEXT, value TEXT NOT NULL, created_at INTEGER NOT NULL
    )`)
  }
}
// Anti-patterns: lazy schema init (race on first request) · mutable module-level state
// · one global DO for all sessions · blockConcurrencyWhile() on every request
```

## Session State Machine — Backend View

```typescript
// DRAFT → LOBBY: POST /sessions/:id/start
async function startSession(id: string, env: Env, userId: string) {
  const meta = JSON.parse(await env.SESSIONS_KV.get(`sessions:${id}`) ?? 'null')
  const questions: Question[] = JSON.parse(await env.SESSIONS_KV.get(`questions:${id}`) ?? '[]')
  const code = generateCode()  // 6-char alphanumeric
  const stub = env.SESSION_ROOM.get(env.SESSION_ROOM.idFromName(code))
  await stub.fetch('https://do/init', { method: 'POST', body: JSON.stringify({ questions, ...meta }) })
  await env.DB.prepare('UPDATE sessions SET status=?, code=?, started_at=? WHERE id=?')
    .bind('active', code, new Date().toISOString(), id).run()
  await env.SESSIONS_KV.put(`sessions:${id}`, JSON.stringify({ ...meta, status: 'active', code }))
  await env.SESSIONS_KV.delete(`questions:${id}`)
}

// DRAFT guard — use in every DRAFT-API route
const meta = JSON.parse(await c.env.SESSIONS_KV.get(`sessions:${id}`) ?? '{}')
if (meta.status !== 'draft') return c.json({ error: { code: 'FORBIDDEN', message: 'Draft only', statusCode: 403, requestId: c.get('traceId'), timestamp: Date.now() } }, 403)
if (meta.ownerId !== user.id) return c.json({ error: { code: 'FORBIDDEN', message: 'Forbidden', statusCode: 403, requestId: c.get('traceId'), timestamp: Date.now() } }, 403)
```

## Workers Best Practices

```typescript
// Background work after response
c.executionCtx.waitUntil(logAnalytics(env, request))

// Cryptographically secure tokens (never Math.random())
const bytes = new Uint8Array(32)
crypto.getRandomValues(bytes)
const token = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')

// Timing-safe comparison — use crypto.subtle.verify() for any HMAC/signature check

// Auto-generate Env types after adding any binding
// npx wrangler types → writes worker-configuration.d.ts
```

## Checklist Before Submitting

- [ ] Route mounted in `[[route]].ts`?
- [ ] Auth middleware applied?
- [ ] DRAFT vs LIVE state guard correct?
- [ ] Plan gate applied if needed?
- [ ] Input validated (400 on bad data)?
- [ ] New env binding in `types/env.ts`?
- [ ] New secret via `wrangler pages secret put` (NOT wrangler.toml)?
- [ ] New D1 column has migration in `schema.sql`?
- [ ] `npm test` and `tsc --noEmit` pass?

## Docs to Update

| Change | Doc |
|---|---|
| New/modified HTTP routes | `docs/API_FULL.md` |
| New WebSocket message types | `docs/API_FULL.md` |
| New KV namespace or schema | `docs/ARCHITECTURE.md` |
| D1 schema migration | `docs/ARCHITECTURE.md` |
| New secret or env binding | `docs/CONFIGURATION.txt` + `CLAUDE.md` |
| Tech debt discovered | `docs/BACKLOG.md §4` |
