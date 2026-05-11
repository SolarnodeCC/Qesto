---
id: AUDIT-NAMING_READABILITY_AUDIT
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

# Naming Conventions & Readability Audit

**Date:** 2026-05-03  
**Branch:** `claude/audit-code-duplication-MQdYH`  
**Scope:** `functions/api/` (backend) + `src/` (frontend)

---

## Executive Summary

| Category | Findings | Avg Severity |
|---|---|---|
| snake_case / camelCase mixing | 3 | 7.3 |
| Cryptic identifiers (single-letter, abbrev.) | 6 | 6.2 |
| British vs American spelling | 1 | 6 |
| Function naming (noun vs verb) | 2 | 4.5 |
| Magic literals | 2 | 6 |
| Boolean parameters | 1 | 5 |
| Import aliasing / shadowing | 1 | 5 |
| **Total** | **16** | |

---

## Findings

---

### NC-01 — TypeScript interfaces carry raw D1 column names (snake_case)

**Importance: 8 / 10**

`functions/api/types.ts` defines the canonical `Question` and `Session` types that flow through every route handler, KV payload, and WebSocket message. Both types use raw D1 column name casing (snake_case) even though all other TypeScript code is camelCase.

```
types.ts:74   session_id: string
types.ts:79   created_at: number
types.ts:84   owner_id: string
types.ts:89   vote_policy: VotePolicy
types.ts:90   session_mode: SessionMode
types.ts:91   created_at: number
types.ts:96   team_id?: string | null
types.ts:98   ai_generated?: number
types.ts:100  ai_consent_at?: number | null
types.ts:102  ai_grounding_hash?: string | null
types.ts:104  ai_accepted_count?: number
types.ts:106  ai_dismissed_count?: number
types.ts:112  display_name: string | null
types.ts:175  export type ApiSuccess<T> = { ok: true; data: T; trace_id: string }
types.ts:179  trace_id: string   ← in ApiError too
```

`PlanQuotas` (line 120+) uses camelCase (`maxSessionsPerMonth`) while `Question` and `Session` use snake_case. This inconsistency forces every consumer to mix both conventions in the same scope.

**Fix options:**

*Option A* — Add a mapping layer at the D1 boundary only. Types stay camelCase; SQL `AS` aliases handle the mapping:

```sql
-- schema.sql: no change needed; alias in queries
SELECT id, session_id AS sessionId, created_at AS createdAt FROM questions
```

```typescript
// types.ts — after the change
export type Question = {
  id: string
  sessionId: string       // was: session_id
  position: number
  kind: QuestionKind
  prompt: string
  options: PollOption[]
  createdAt: number       // was: created_at
}

export type Session = {
  id: string
  ownerId: string         // was: owner_id
  code: string
  title: string
  status: SessionStatus
  anonymity: Anonymity
  votePolicy: VotePolicy  // was: vote_policy
  sessionMode: SessionMode // was: session_mode
  createdAt: number
  startedAt: number | null
  closedAt: number | null
  archivedAt: number | null
  teamId?: string | null
  aiGenerated?: number
  aiConsentAt?: number | null
  aiGroundingHash?: string | null
  aiAcceptedCount?: number
  aiDismissedCount?: number
}

export type ApiSuccess<T> = { ok: true; data: T; traceId: string }
export type ApiError = { ok: false; error: { code: string; message: string }; traceId: string }
```

*Option B (minimal)* — Accept the snake_case on wire types (D1-driven), but document it explicitly at the top of `types.ts` and enforce it via ESLint `@typescript-eslint/naming-convention` rule set to `snake_case` for database entity types.

---

### NC-02 — `trace_id` used as a local camelCase-context variable in every route

**Importance: 7 / 10**

Every route handler starts with:
```typescript
// energizers.ts:38, gamification.ts, billing.ts, etc.
const trace_id = c.get('trace_id')
```

This snake_case local variable is then spread into every `c.json(...)` response. The variable is used camelCase in context (`c.get('trace_id')`) but stored as snake_case. This is the most pervasive mixed-casing pattern in the codebase — appears in **at least 12 route files**.

**Fix:** Decide on one spelling at the context key level and use it everywhere.

```typescript
// middleware/logger.ts — set the key camelCase
c.set('traceId', traceId)

// Every route handler — read camelCase
const traceId = c.get('traceId')
return c.json({ ok: true, data: { ... }, traceId }, 201)
```

If the API wire format requires `trace_id` (e.g., existing clients read it), add a serialization transform at `app.onError` only:

```typescript
// app.ts — keep wire format separate from internal naming
return c.json({ ok: false, error: { code, message }, trace_id: traceId }, status)
```

---

### NC-03 — Cryptic 2-letter abbreviations in `energizers.ts`

**Importance: 7 / 10**

`functions/api/routes/energizers.ts` uses several non-obvious abbreviations for config objects that are cast from JSON blobs. The handler logic is already complex (CC≈91); abbreviations make it harder to follow.

| Location | Identifier | Meaning | Severity |
|---|---|---|---|
| `energizers.ts:182` | `qf` | `QuickFingerConfig` | 7 |
| `energizers.ts:204` | `tq` | `TeamQuizConfig` | 7 |
| `energizers.ts:205` | `qi` | `current_index` | 7 |
| `energizers.ts:209` | `cnt` | count (D1 result) | 6 |
| `energizers.ts:312` | `paramIdx` | SQL bind parameter index | 5 |

```typescript
// Before
const qf = config as QuickFingerConfig
const correctAnswer = qf.options[qf.correct_index]
// ...
const tq = config as TeamQuizConfig
const qi = tq.current_index
const cnt = await (c.env.DB.prepare as any)(...)
  .bind(energizer.id, qi)
  .first<{ n: number }>()
responseCount = (cnt?.n as number) ?? 0

// After
const quickFinger = config as QuickFingerConfig
const correctAnswer = quickFinger.options[quickFinger.correct_index]
// ...
const teamQuiz = config as TeamQuizConfig
const currentIndex = teamQuiz.current_index
const countRow = await (c.env.DB.prepare as any)(...)
  .bind(energizer.id, currentIndex)
  .first<{ n: number }>()
responseCount = (countRow?.n as number) ?? 0
```

```typescript
// energizers.ts:312 — paramIdx → sqlParamIndex
let sqlParamIndex = 2
if (body.state !== undefined) sets.push(`state = ?${sqlParamIndex++}`)
```

---

### NC-04 — Single-letter variables in multi-line callbacks and loops

**Importance: 6 / 10**

Single-letter identifiers are acceptable in 1-line lambdas (e.g., `arr.find(x => x.id === id)`) but the codebase uses them across 5–15 line blocks where context is lost.

**Backend occurrences:**

| File | Line | Identifier | Actual meaning | Lines used across |
|---|---|---|---|---|
| `energizers.ts` | 128 | `e` | energizer object in map | 9 |
| `energizers.ts` | 223 | `r` | participant score row | 5 |
| `energizers.ts` | 429 | `q` | current question | 8 |
| `energizers.ts` | 670 | `r` | emoji result entry | 4 |
| `gamification.ts` | 49 | `b` | badge row (D1 result) | 3 |
| `teams.ts` | 215 | `t` | team object | 3 |
| `ai-wizard.ts` | 158 | `q` | question record | 12 |
| `ai-wizard.ts` | 174 | `o` | option record | 5 |
| `insights.ts` | 114 | `q` | question row | 8 |
| `insights.ts` | 134 | `c` | vote count row | 6 |
| `admin.ts` | 158 | `d` | Date object | 3 |
| `admin.ts` | 202 | `s` | string conversion | 1 |
| `csrf.ts` | 35 | `u` | URL object | 2 |
| `idempotency.ts` | 54 | `k` | derived KV key | 3 |
| `rbac.ts` | 115 | `b` | path segment array copy | 5 |
| `rbac.ts` | 122 | `v` | path variant | 3 |

**Frontend occurrences:**

| File | Line | Identifier | Actual meaning |
|---|---|---|---|
| `src/hooks/useInsights.ts` | 110 | `d` | response data | 4 |
| `src/pages/Dashboard.tsx` | 185 | `a` | `<a>` DOM element | 3 |
| `src/components/SessionWizard.tsx` | 522 | `q` | question object | 3 |
| `src/components/SessionWizard.tsx` | 707 | `s` | WizardStep enum value | 2 |
| `src/pages/Present.tsx` | 35 | `r` | seconds remaining | 2 |

**Fix (representative examples):**

```typescript
// energizers.ts:128 — e → energizer
energizers.map((energizer: Energizer) => ({ ... }))

// gamification.ts:49 — b → badge
badges.map((badge: BadgeRow) => ({
  type: badge.badge_type,
  session_id: badge.session_id,
  awarded_at: badge.awarded_at,
}))

// insights.ts:134 — c → voteCount
for (const voteCount of counts ?? []) {
  const match = options.find((o) => o.id === voteCount.option_id)
  topLabels.push(match?.label ?? voteCount.option_id)
}

// csrf.ts:35 — u → parsedUrl
const parsedUrl = new URL(url)
return parsedUrl.origin

// idempotency.ts:54 — k → kvEntryKey
const kvEntryKey = kvKey(userId, key)
const existing = (await kv.get(kvEntryKey, 'json')) as StoredValue | null
```

Loop index variables (`i`, `j`) in numeric `for` loops are acceptable; the fix targets only named-entity callbacks.

---

### NC-05 — British spelling in `SessionRoom.ts` error codes, method names, and comments

**Importance: 6 / 10**

`SessionRoom.ts` consistently uses British English while the rest of the codebase uses American English (`sanitizeError`, `normalize`, etc.). The most critical instances are the **wire-format error codes** sent to WebSocket clients — these become part of the public API surface.

| Location | Identifier | British | American equivalent |
|---|---|---|---|
| `SessionRoom.ts:71` | comment | `denormalised` | `denormalized` |
| `SessionRoom.ts:75` | comment | `normaliseVotes` | `normalizeVotes` |
| `SessionRoom.ts:79` | function | `normaliseVotes()` | `normalizeVotes()` |
| `SessionRoom.ts:163` | method call | `normaliseVotes(raw)` | `normalizeVotes(raw)` |
| `SessionRoom.ts:173` | **wire error code** | `'already_initialised'` | `'already_initialized'` |
| `SessionRoom.ts:217` | **wire response key** | `initialised: true` | `initialized: true` |
| `SessionRoom.ts:263` | **wire error code** | `'uninitialised'` | `'uninitialized'` |
| `SessionRoom.ts:615` | **wire error code** | `'not_initialised'` | `'not_initialized'` |

The wire-format codes (`already_initialised`, `uninitialised`, `not_initialised`) are received by frontend WebSocket handlers. Renaming them is a **breaking change** for any existing client that pattern-matches on these strings.

**Fix — internal function first (non-breaking):**

```typescript
// SessionRoom.ts:79 — rename internal function
function normalizeVotes(raw: Record<string, string | string[]> | undefined): Votes {
  // ...
}
// SessionRoom.ts:163
.then(raw => { this._voters = normalizeVotes(raw) })
```

**Fix — wire codes (requires coordinated client update):**

```typescript
// SessionRoom.ts:173
return this.jsonError(409, 'already_initialized', 'Session already initialized')
// SessionRoom.ts:217
return this.jsonOk({ initialized: true })
// SessionRoom.ts:263
const status = (await this.ctx.storage.get<string>(K_STATUS)) ?? 'uninitialized'
// SessionRoom.ts:615
ws.send(errorMessage('not_initialized', 'Session has not been initialized'))
```

Search frontend for all pattern matches on these codes before renaming:
```bash
grep -rn "initialised\|uninitialised" src/
```

---

### NC-06 — Key-generator functions named as nouns, not verbs

**Importance: 5 / 10**

Several helper functions that derive KV key strings are named as nouns, giving no indication they compute a value.

**`functions/api/routes/teams.ts`:**
```typescript
// teams.ts:62-64 — current
const teamKey = (id: string) => `team:${id}`
const userTeamsKey = (uid: string) => `user-teams:${uid}`
const inviteKey = (code: string) => `invite:${code}`

// Fixed — verb prefix makes intent clear
const getTeamKey = (id: string) => `team:${id}`
const getUserTeamsKey = (userId: string) => `user-teams:${userId}`
const getInviteKey = (code: string) => `invite:${code}`
```

Note also: `userTeamsKey` uses `uid` (abbreviation) in its parameter while the renamed version should use `userId`.

**`functions/api/routes/auth.ts`** (same pattern):
```typescript
// auth.ts — current
const pwdKey = (email: string) => `pwd:${email}`
const oauthKey = (provider: string, sub: string) => `oauth:${provider}:${sub}`
const resetKey = (token: string) => `reset:${token}`

// Fixed
const getPasswordKey = (email: string) => `pwd:${email}`
const getOAuthKey = (provider: string, sub: string) => `oauth:${provider}:${sub}`
const getResetKey = (token: string) => `reset:${token}`
```

---

### NC-07 — `idemKey` abbreviation creates a local name that diverges from its use site

**Importance: 5 / 10**

`src/hooks/useSessions.ts:61`:
```typescript
const idemKey = crypto.randomUUID()   // abbreviated local name
// ...
idempotencyKey: idemKey,             // full name at call site
```

The variable is named `idemKey` but used immediately as `idempotencyKey`. This forces readers to map between two names for the same value.

**Fix:**
```typescript
const idempotencyKey = crypto.randomUUID()
// ...
idempotencyKey,  // shorthand property — no duplication
```

---

### NC-08 — `PLAN_QUOTAS` aliased to `QUOTAS_MAP` at import, creating two names for one constant

**Importance: 5 / 10**

`functions/api/middleware/plan.ts:6`:
```typescript
import { PLAN_QUOTAS as QUOTAS_MAP } from '../types'
```

`PLAN_QUOTAS` is the canonical export name used everywhere else. The alias `QUOTAS_MAP` exists only in `plan.ts`, so grepping for either name returns different results in different files. The alias adds no clarity; the original name already describes its purpose.

**Fix:** Remove the alias. Use `PLAN_QUOTAS` directly.

```typescript
import { PLAN_QUOTAS } from '../types'
// ...
c.set('planQuotas', { ...PLAN_QUOTAS['team'], maxSessionsPerMonth: Number.MAX_SAFE_INTEGER })
// ...
c.set('planQuotas', PLAN_QUOTAS[plan])
```

Also update the local type annotation at line 12:
```typescript
planQuotas: (typeof PLAN_QUOTAS)[PlanTier]
```

---

### NC-09 — snake_case local variables in `middleware/logger.ts`

**Importance: 5 / 10**

`logger.ts` declares local variables using snake_case even though they are not D1 column names or wire-format keys. They are then serialized into a `LogLine` struct that also uses snake_case, but the struct itself is only written to `console.log` (not sent to clients), so the casing is a pure internal style choice.

```typescript
// logger.ts:26,29,42,48,56,72,75,82,89
let duration_ms: number  // → durationMs
let error_code: string   // → errorCode
```

The `LogLine` interface itself is consistent internally, but mixing with the surrounding camelCase code looks inconsistent:

```typescript
// logger.ts — before
const duration_ms = Date.now() - start
let error_code: string | undefined
// ...
doubles: [duration_ms, status >= 500 ? 1 : 0, status]
writeLiveMetricBucket(c.env.METRICS_KV, duration_ms, status >= 500)

// logger.ts — after
const durationMs = Date.now() - start
let errorCode: string | undefined
// ...
doubles: [durationMs, status >= 500 ? 1 : 0, status]
writeLiveMetricBucket(c.env.METRICS_KV, durationMs, status >= 500)
```

The `LogLine` interface properties can stay snake_case if the log format is intentional (e.g., feeding into a log aggregator that expects `duration_ms`), but local variables should mirror camelCase convention.

---

### NC-10 — Magic error code strings scattered across files

**Importance: 6 / 10**

Error code strings are inlined as literals throughout route handlers and `SessionRoom.ts`. A typo produces a silent inconsistency visible to API clients. Currently there is no central registry.

**Sample occurrences:**

```typescript
// app.ts:100
code: status >= 500 ? 'internal' : 'bad_request'

// SessionRoom.ts:148
{ code: 'not_found', message: 'Unknown DO route' }
// SessionRoom.ts:173 — also British spelling
'already_initialised'
// SessionRoom.ts:224
'not_live'

// middleware/feature-gate.ts — uses denyFeature() helper — correct pattern
// middleware/rbac.ts — uses hardcoded string in catch silently
```

**Fix:** Centralize error codes in `functions/api/lib/error-codes.ts`:

```typescript
// NEW: functions/api/lib/error-codes.ts
export const ErrorCode = {
  BAD_REQUEST:       'bad_request',
  UNAUTHENTICATED:   'unauthenticated',
  FORBIDDEN:         'forbidden',
  NOT_FOUND:         'not_found',
  CONFLICT:          'conflict',
  RATE_LIMITED:      'rate_limited',
  INTERNAL:          'internal',
  // DO-specific
  ALREADY_INITIALIZED: 'already_initialized',
  NOT_LIVE:            'not_live',
  NOT_INITIALIZED:     'not_initialized',
} as const

export type ErrorCodeValue = typeof ErrorCode[keyof typeof ErrorCode]
```

Then replace all raw string literals with `ErrorCode.*` references. TypeScript will catch any typo at compile time.

---

### NC-11 — `writeLiveMetricBucket` takes an unnamed boolean parameter

**Importance: 5 / 10**

`functions/api/lib/metrics-kv.ts:192`:
```typescript
export async function writeLiveMetricBucket(
  kv: KVNamespace,
  latency_ms: number,
  isError: boolean,       // ← boolean positional parameter
  now: Date = new Date(),
): Promise<void>
```

Call site in `logger.ts:89`:
```typescript
writeLiveMetricBucket(c.env.METRICS_KV, duration_ms, status >= 500)
```

The `status >= 500` expression is clear at the call site, but the function signature accepts a raw `boolean` which could be passed as `true`/`false` literals in tests or other callers without obvious semantics.

**Fix — option A:** Named options object for clarity:
```typescript
export async function writeLiveMetricBucket(
  kv: KVNamespace,
  options: { latencyMs: number; isError: boolean; now?: Date },
): Promise<void>

// call site
writeLiveMetricBucket(c.env.METRICS_KV, { latencyMs: durationMs, isError: status >= 500 })
```

**Fix — option B (minimal):** Rename parameter to be self-documenting; the call site expression `status >= 500` already communicates intent well enough, so no change to callers needed:
```typescript
// metrics-kv.ts — rename parameter only, no structural change
latency_ms: number → latencyMs: number
isError: boolean   // keep — already descriptive
```

Also note: `latency_ms` is a snake_case parameter name on a function that is not a D1 wrapper — consistent with NC-09.

---

### NC-12 — `next` reused as a variable name for three different state updates in `Dashboard.tsx`

**Importance: 4 / 10**

`src/pages/Dashboard.tsx` uses the same variable name `next` for three separate functional state update patterns across 40 lines:

```typescript
// Dashboard.tsx:148
setFeedback(prev => {
  const next = { ...prev }  // ← next = Record<sessionId, string>
  delete next[sessionId]
  return next
})

// Dashboard.tsx:163
setLoadingAction(prev => {
  const next = { ...prev }  // ← next = Record<sessionId, boolean>
  delete next[sessionId]
  return next
})

// Dashboard.tsx:180
setActionFeedback(prev => {
  const next = { ...prev }  // ← next = Record<sessionId, ActionFeedback>
  delete next[sessionId]
  return next
})
```

While each `next` is scoped to its lambda, using the same generic name for all three creates visual noise and makes diffs harder to read.

**Fix:**
```typescript
setFeedback(prev => {
  const { [sessionId]: _, ...remaining } = prev
  return remaining
})

setLoadingAction(prev => {
  const { [sessionId]: _, ...remaining } = prev
  return remaining
})

setActionFeedback(prev => {
  const { [sessionId]: _, ...remaining } = prev
  return remaining
})
```

The destructured-omit pattern removes the need for `next` entirely and is more idiomatic.

---

### NC-13 — `idemKey` abbreviation vs `idempotencyKey` in `useSessions.ts`

*(Covered under NC-07)*

---

### NC-14 — `_rbac_cache` context key uses underscore as "private" marker on a plain string

**Importance: 4 / 10**

`functions/api/middleware/rbac.ts:133`:
```typescript
const cached = c.get('_rbac_cache')?.roles
// ...
c.set('_rbac_cache', { roles })
```

The leading underscore on a string key mimics a TypeScript private-member convention, but it has no effect here — the key is a plain string accessible to any middleware. The convention is also not documented.

**Fix:** Use a clearly named constant:

```typescript
// rbac.ts
const RBAC_CACHE_KEY = 'rbacCache' as const

const cached = c.get(RBAC_CACHE_KEY)?.roles
// ...
c.set(RBAC_CACHE_KEY, { roles })
```

---

### NC-15 — `normaliseVotes` second occurrence — `MULTI_VOTE_KINDS` name vs domain terminology

**Importance: 3 / 10**

`SessionRoom.ts:90`:
```typescript
const MULTI_VOTE_KINDS = new Set(['multi_select', 'upvote', 'word_cloud'])
```

The constant name combines two concepts (`MULTI` from `multi_select` and `VOTE` from all question kinds being vote-based). The set actually captures **question kinds that accept multiple votes per participant**, not kinds that are "multi-kind votes". A clearer name:

```typescript
const MULTI_VOTE_QUESTION_KINDS = new Set(['multi_select', 'upvote', 'word_cloud'])
// or more precisely:
const ACCUMULATIVE_VOTE_KINDS = new Set(['multi_select', 'upvote', 'word_cloud'])
```

---

### NC-16 — Frontend `e` event parameters in components

**Importance: 4 / 10**

`src/components/TeamSwitcher.tsx` and other components use `e` for event parameters across multi-line handlers:

```typescript
// TeamSwitcher.tsx:75
const handleMouseEnter = (e: MouseEvent) => { ... }  // e unused
// TeamSwitcher.tsx:93
const handleKeyDown = (e: React.KeyboardEvent) => {
  if (e.key === 'Escape') ...
  if (e.key === 'Enter') ...
}
// TeamSwitcher.tsx:128
const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault()
  ...
}
```

**Fix:** Use `event` for handlers that reference the parameter, `_event` or `_` if unused (TypeScript will warn on unused parameters with `noUnusedParameters`):

```typescript
const handleMouseEnter = (_event: MouseEvent) => { ... }
const handleKeyDown = (event: React.KeyboardEvent) => {
  if (event.key === 'Escape') ...
}
const handleSubmit = (event: React.FormEvent) => {
  event.preventDefault()
}
```

---

## Naming Convention Guide

Based on the above findings, this section establishes the agreed conventions for the Qesto codebase.

---

### 1. Casing Rules

| Context | Convention | Example |
|---|---|---|
| Local variables | `camelCase` | `const traceId = ...` |
| Function parameters | `camelCase` | `(userId: string)` |
| Function names | `camelCase`, verb-first | `getTeamKey`, `normalizeVotes` |
| React components | `PascalCase` | `TeamSwitcher` |
| React hooks | `camelCase`, `use` prefix | `useSessions`, `useAuth` |
| Constants (module-level) | `SCREAMING_SNAKE_CASE` | `MULTI_VOTE_QUESTION_KINDS` |
| TypeScript interfaces/types | `PascalCase` | `PlanQuotas`, `ApiSuccess` |
| TypeScript enum members | `PascalCase` | `QuestionKind.WordCloud` |
| D1 column names in SQL | `snake_case` (SQL standard) | `SELECT created_at FROM sessions` |
| D1 column names in TS types | `camelCase` | `createdAt: number` |
| Wire format (HTTP response JSON) | `snake_case` for legacy fields; `camelCase` for new fields; **document the choice** | `trace_id` (legacy), `sessionId` (new) |

---

### 2. Spelling

**American English throughout.** British spellings are banned in identifiers, comments, and wire-format strings.

| British (banned) | American (required) |
|---|---|
| `normalise` | `normalize` |
| `initialised` | `initialized` |
| `uninitialised` | `uninitialized` |
| `denormalised` | `denormalized` |
| `colour` | `color` |
| `serialise` | `serialize` |

---

### 3. Variable naming rules

**Single-letter variables** are only allowed in:
- Numeric `for` loop indices: `for (let i = 0; i < n; i++)`
- One-line arrow functions where the type is declared: `arr.find(x => x.id === id)`

Banned in multi-line blocks: `e`, `q`, `r`, `b`, `t`, `u`, `k`, `s`, `d`, `o`, `v`.

**Abbreviations** must be universally understood or spelled out:

| Banned | Required |
|---|---|
| `qf` | `quickFinger` |
| `tq` | `teamQuiz` |
| `qi` | `currentIndex` |
| `cnt` | `count` |
| `paramIdx` | `sqlParamIndex` |
| `idemKey` | `idempotencyKey` |
| `uid` | `userId` |
| `tid` | `teamId` |
| `sid` | `sessionId` |
| `pwd` | `password` |
| `cred` | `credential` |
| `tmpl` | `template` |
| `ac` (for AbortController) | `abortController` |

Accepted abbreviations (domain-standard, universally understood):
- `id`, `url`, `ws` (WebSocket — acceptable in networking context), `jwt`, `kv`, `ai`, `db`

---

### 4. Function naming rules

- **Functions that return a value** must start with a verb: `get`, `build`, `create`, `compute`, `load`, `fetch`, `parse`, `format`, `normalize`.
- **Functions that perform a side effect** must start with an action verb: `send`, `save`, `write`, `record`, `delete`, `clear`, `apply`, `emit`.
- **Boolean-returning functions** must start with `is`, `has`, `can`, `should`, or `was`.
- **Key-derivation helpers** must use `get*Key` pattern, not noun form: `getTeamKey()` not `teamKey()`.

```typescript
// ✗ Banned
const teamKey = (id: string) => `team:${id}`
const userTeamsKey = (uid: string) => `user-teams:${uid}`

// ✓ Required
const getTeamKey = (id: string) => `team:${id}`
const getUserTeamsKey = (userId: string) => `user-teams:${userId}`
```

---

### 5. Parameter rules

- Maximum **3 positional parameters**. Beyond that, use a named options object.
- **Boolean positional parameters** require a named options object:

```typescript
// ✗ Banned
function writeLiveMetricBucket(kv: KVNamespace, latencyMs: number, isError: boolean)

// ✓ Required
function writeLiveMetricBucket(kv: KVNamespace, opts: { latencyMs: number; isError: boolean })
```

- Parameters must be camelCase. No snake_case parameter names even when wrapping D1 columns.

---

### 6. Event handler naming (React)

| Handler type | Convention |
|---|---|
| DOM event handlers | `handle` prefix: `handleSubmit`, `handleKeyDown` |
| Prop callbacks (parent → child) | `on` prefix: `onSelect`, `onDismiss` |
| Unused event parameter | `_event` or omit |
| Used event parameter | Full name: `event`, `keyboardEvent`, `formEvent` |

---

### 7. Magic literals

- Error code strings → `ErrorCode.*` constants from `lib/error-codes.ts`
- Plan tier strings → `PlanTier` type (already defined); never raw `'free' | 'starter' | 'team'` in logic branches
- KV key prefixes → centralized in each route module as `const GET_*_KEY = (id: string) => ...`
- WebSocket message types → `ClientMessage` / `ServerMessage` discriminated unions (already in `realtime.ts`) — never raw strings in `switch` arms

---

## Remediation Priority Queue

| Priority | Finding | Effort | Risk |
|---|---|---|---|
| **P0** | NC-01: camelCase TypeScript interfaces (types.ts) | High | Medium — cascading rename across all routes |
| **P0** | NC-10: magic error code strings → `ErrorCode` enum | Medium | Low |
| **P1** | NC-02: `trace_id` local var → `traceId` in all route handlers | Medium | Low |
| **P1** | NC-05: British spelling in SessionRoom wire codes | Low | Medium — breaking for existing WS clients |
| **P1** | NC-03: cryptic 2-letter abbrevs in energizers.ts | Low | Low |
| **P2** | NC-04: single-letter callback variables (backend) | Medium | Low |
| **P2** | NC-06: noun-named key functions → `get*Key` | Low | Low |
| **P2** | NC-08: `QUOTAS_MAP` alias removal | Low | Low |
| **P3** | NC-07: `idemKey` → `idempotencyKey` | Low | Low |
| **P3** | NC-09: snake_case local vars in logger.ts | Low | Low |
| **P3** | NC-11: boolean param in `writeLiveMetricBucket` | Low | Low |
| **P3** | NC-16: `e` event params in React components | Low | Low |
| **P4** | NC-12: `next` repeated name in Dashboard.tsx | Low | Low |
| **P4** | NC-14: `_rbac_cache` string key → constant | Low | Low |
| **P5** | NC-15: `MULTI_VOTE_KINDS` rename | Low | Low |
