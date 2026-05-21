# Input Validation Patterns — HLT-031 Remediation

This guide demonstrates the **proof-aware decoder** pattern for all boundary crossings in Qesto.

## Core Principle

**Validate the value first, then narrow it with a proof-aware decoder.**

All data crossing trust boundaries (network, storage, middleware context) must be validated against a Zod schema before being used in application code.

---

## Pattern 1: Request Body Validation

### Before (Risky)
```typescript
app.post('/api/sessions', authMiddleware, async (c) => {
  const body = await c.req.json() // ❌ unknown type, not validated
  const sessionId = body.id as string // ❌ unchecked cast
  await db.query(`SELECT * FROM sessions WHERE id = ?`, [sessionId]) // ❌ trust boundary violated
})
```

### After (Safe)
```typescript
// 1. Define schema in validators.ts
export const CreateSessionSchema = z.object({
  id: z.string().ulid(),
  title: z.string().min(1).max(255),
  is_public: z.boolean().optional().default(false),
})

// 2. Use in route
app.post('/api/sessions', authMiddleware, async (c) => {
  const rawBody = await c.req.json()
  const body = validateData(rawBody, CreateSessionSchema)
  if (!body) {
    return c.json({ error: 'invalid_request' }, 400)
  }
  
  // Now body is fully typed and validated
  await db.query(`SELECT * FROM sessions WHERE id = ?`, [body.id])
})
```

---

## Pattern 2: Context/Middleware Validation

### Before (Risky)
```typescript
export async function recordAuditEvent(c: any, ctx: AuditContext): Promise<void> {
  const user = c.get('user') as any // ❌ cast without validation
  const actor_id = user?.sub || null // ❌ trusting unknown structure
  // ... use actor_id in database
}
```

### After (Safe)
```typescript
// 1. Define schema
export const UserContextSchema = z.object({
  sub: z.string().min(1),
  email: z.string().email(),
  teams: z.array(z.string()).optional(),
})

// 2. Validate before use
export async function recordAuditEvent(
  c: { get(key: string): unknown },
  ctx: AuditContext,
): Promise<void> {
  const validUser = validateData(c.get('user'), UserContextSchema)
  if (!validUser) {
    console.warn('[audit] Invalid user context')
    return // Fail-safe
  }
  
  const actor_id = validUser.sub
  // ... now safe to use
}
```

---

## Pattern 3: WebSocket Message Validation

### Before (Risky)
```typescript
// client sends JSON, DO receives it
ws.on('message', (msg) => {
  const parsed = JSON.parse(msg) as ClientMessage // ❌ unchecked
  if (parsed.type === 'vote') {
    handleVote(parsed.data) // ❌ data shape unknown
  }
})
```

### After (Safe)
```typescript
// validators.ts already has ClientMessageSchema (comprehensive)
// SessionRoom.ts should use it:

ws.on('message', (msg) => {
  const rawMsg = JSON.parse(msg)
  const parsed = validateData(rawMsg, ClientMessageSchema)
  if (!parsed) {
    ws.send(JSON.stringify({ error: 'invalid_message' }))
    return
  }
  
  // Now safe to dispatch by type
  if (parsed.type === 'vote') {
    handleVote(parsed.data) // data shape guaranteed
  }
})
```

---

## Pattern 4: File I/O Validation

### Before (Risky)
```typescript
const fileContent = await Deno.readTextFile(path)
const json = JSON.parse(fileContent) as Record<string, any> // ❌ unchecked
processMarkdown(json.content) // ❌ trusting unknown structure
```

### After (Safe)
```typescript
export const KBFileSchema = z.object({
  content: z.string().min(1),
  metadata: z.object({
    title: z.string(),
    updated_at: z.number(),
  }).optional(),
})

const fileContent = await Deno.readTextFile(path)
const rawJson = JSON.parse(fileContent)
const validated = validateData(rawJson, KBFileSchema)
if (!validated) {
  throw new Error(`Invalid KB file: ${path}`)
}

processMarkdown(validated.content) // safe
```

---

## Pattern 5: Database Result Validation

### Before (Risky)
```typescript
const result = await db.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first<any>()
const email = result.email // ❌ assuming column exists
sendEmail(email) // ❌ type unknown
```

### After (Safe)
```typescript
export const UserRowSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  created_at: z.number(),
})

const result = await db.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first()
const validUser = validateData(result, UserRowSchema)
if (!validUser) {
  throw new Error('User not found or invalid schema')
}

sendEmail(validUser.email) // safe
```

---

## Zod Helper Functions

All validators use these helpers from `functions/api/lib/validators.ts`:

```typescript
// Parse JSON string and validate (two-step)
export function validateJson<T>(
  raw: string,
  schema: z.ZodSchema<T>,
): T | null {
  try {
    const parsed = JSON.parse(raw)
    return schema.parse(parsed)
  } catch {
    return null
  }
}

// Validate already-parsed object (one-step)
export function validateData<T>(
  data: unknown,
  schema: z.ZodSchema<T>,
): T | null {
  try {
    return schema.parse(data)
  } catch {
    return null
  }
}
```

---

## Checklist for Boundary Crossings

Before shipping code, verify:

- [ ] **Request body:** Schema defined in `validators.ts`, validated with `validateBody()`
- [ ] **Route params:** Validated before database query (use `z.coerce.number()` for numeric params)
- [ ] **Query strings:** Validated (e.g., `?page=1&limit=10`)
- [ ] **Headers:** Validated before trust decision (e.g., auth headers)
- [ ] **WebSocket messages:** Validated against schema before dispatch
- [ ] **Middleware context:** User, trace_id, etc. validated before downstream use
- [ ] **File I/O:** JSON parsed, schema validated before processing
- [ ] **Database results:** Row shape validated against schema
- [ ] **External API responses:** Validated before use

---

## Error Handling

### Validation Failure Modes

**HTTP Routes:** Return 400 with error detail
```typescript
const data = validateData(raw, MySchema)
if (!data) {
  return c.json({ error: { code: 'validation', message: 'Invalid input' } }, 400)
}
```

**WebSocket:** Send error message, disconnect if critical
```typescript
const msg = validateData(raw, ClientMessageSchema)
if (!msg) {
  ws.send(JSON.stringify({ type: 'error', reason: 'invalid_message' }))
  // optionally: ws.close(4001, 'Invalid message schema')
}
```

**Internal Functions:** Return null or throw
```typescript
const ctx = validateData(raw, AuditContextSchema)
if (!ctx) {
  console.warn('[audit] Invalid context, skipping event')
  return // fail-safe
}
```

---

## Real Examples in Codebase

### ✅ Done
- `functions/api/lib/audit.ts` — AuditContextSchema validation

### 📋 Todo
- `functions/api/routes/admin.ts` — validateBody already used, extend to all endpoints
- `functions/api/lib/authz.ts` — Validate permission context
- `src/hooks/useLiveSession.ts` — Validate WS messages from SessionRoom
- `src/pages/JoinPage.tsx` — Validate route params

---

## Testing Validation

```typescript
// tests/unit/validators.test.ts

describe('AuditContextSchema', () => {
  it('accepts valid context', () => {
    const ctx = {
      action: 'session.create',
      subject_type: 'session',
      subject_id: '123',
    }
    expect(validateData(ctx, AuditContextSchema)).not.toBeNull()
  })

  it('rejects missing required fields', () => {
    const ctx = { action: 'session.create' } // missing subject_id
    expect(validateData(ctx, AuditContextSchema)).toBeNull()
  })

  it('rejects invalid action enum', () => {
    const ctx = {
      action: 'invalid_action',
      subject_type: 'session',
      subject_id: '123',
    }
    expect(validateData(ctx, AuditContextSchema)).toBeNull()
  })
})
```

---

## References

- **Zod Docs:** https://zod.dev
- **OWASP Input Validation:** https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html
- **Branch:** `claude/fix-input-validation-G8p6R`
- **Jankurai Rule:** HLT-031 — TYPESCRIPT-BAD-BEHAVIOR
