# Code Duplication Audit — Qesto

**Date:** 2026-05-02  
**Scope:** Full codebase (`functions/`, `src/`, `worker/`, `tests/`)  
**Method:** Static analysis + manual file review  

---

## Summary Table

| # | Category | Files Affected | Instances | Importance | Effort |
|---|----------|---------------|-----------|-----------|--------|
| F-01 | Admin polling hooks — identical fetch/state shape | 4 hooks | 4× | **9/10** | Low |
| F-02 | KV `get` → `JSON.parse` with try/catch | 5 route/lib files | 7× | **8/10** | Low |
| F-03 | API response envelope — repeated inline | All route files | 40+ | **8/10** | Medium |
| F-04 | Plan quota data — defined twice, different keys | 2 files | 2× | **8/10** | Low |
| F-05 | KV key generator functions — per-route silos | 3 route files | 9 fns | **7/10** | Low |
| F-06 | Session type declarations — frontend re-declares backend types | 2 files | Full struct | **7/10** | Medium |
| F-07 | KV `put` → `JSON.stringify` with TTL | 5 files | 5× | **6/10** | Low |
| F-08 | `setLoading/setError` boilerplate in `useSession` | 2 hook files | 2× | **5/10** | Low |
| F-09 | D1 `SELECT … WHERE id = ?1` user lookup | 3 files | 3× | **4/10** | Low |
| F-10 | TTL / rate-limit constants — scattered file-locals | 3 route files | 6 consts | **4/10** | Low |

---

## F-01 — Admin polling hooks: identical fetch/state shape

**Importance: 9/10**

### What

Four hooks share a byte-for-byte identical structure: three state variables (`data`, `loading`, `error`), one `useCallback` fetcher that calls `api<T>()`, sets state, and one `useEffect` that calls the fetcher and starts a `setInterval`.

| Hook | File | Endpoint | Interval |
|------|------|----------|----------|
| `useAdminAnalytics` | `src/hooks/useAdminAnalytics.ts:24` | `/api/admin/analytics` | 60 s |
| `useAdminKpis` | `src/hooks/useAdminKpis.ts:13` | `/api/admin/kpis` | 30 s |
| `useAdminOps` | `src/hooks/useAdminOps.ts:28` | `/api/admin/ops/summary` | 15 s |
| `useAdminMetrics` (live branch) | `src/hooks/useAdminMetrics.ts:30` | `/api/admin/metrics/live` | 5 s |

**Duplicated block (verbatim in each hook, only names differ):**
```ts
// useAdminAnalytics.ts:25–44
const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
const [loading, setLoading] = useState(true)
const [error, setError] = useState<string | null>(null)

const fetchAnalytics = useCallback(async () => {
  const res = await api<AnalyticsData>('/api/admin/analytics')
  if (res.ok) {
    setAnalytics(res.data)
    setError(null)
  } else {
    setError(res.error.message)
  }
  setLoading(false)
}, [])

useEffect(() => {
  fetchAnalytics()
  const interval = setInterval(fetchAnalytics, 60_000)
  return () => clearInterval(interval)
}, [fetchAnalytics])
```

### DRY Fix — `usePolledApi` generic hook

Create `src/hooks/usePolledApi.ts`:

```ts
import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'

export function usePolledApi<T>(
  endpoint: string,
  intervalMs: number,
): { data: T | null; loading: boolean; error: string | null; refresh: () => void } {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const res = await api<T>(endpoint)
    if (res.ok) {
      setData(res.data)
      setError(null)
    } else {
      setError(res.error.message)
    }
    setLoading(false)
  }, [endpoint])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, intervalMs)
    return () => clearInterval(id)
  }, [refresh, intervalMs])

  return { data, loading, error, refresh }
}
```

Replace each hook body, e.g. `useAdminKpis.ts`:

```ts
import { usePolledApi } from './usePolledApi'
import type { PlatformKpis } from './useAdminKpis'

export function useAdminKpis() {
  const { data: kpis, loading, error, refresh } = usePolledApi<PlatformKpis>(
    '/api/admin/kpis',
    30_000,
  )
  return { kpis, loading, error, refresh }
}
```

**Duplication removed:** ~60 lines × 4 hooks = ~240 lines → ~20 lines total.

---

## F-02 — KV `get` → `JSON.parse` with try/catch

**Importance: 8/10**

### What

Seven call sites repeat the same three-step pattern: read raw string, check for null, `JSON.parse` inside `try/catch`, warn on error.

| File | Lines | Variable returned on miss |
|------|-------|--------------------------|
| `functions/api/routes/users.ts` | 20–28 | `{}` |
| `functions/api/routes/users.ts` | 44–52 | `{}` |
| `functions/api/routes/sessions.ts` | 84–90 | `[]` (inside `rowToQuestion`) |
| `functions/api/lib/quota.ts` | 26–34 | default `QuotaRecord` object |
| `functions/api/lib/quota.ts` | 65–66 | `null` |
| `functions/api/routes/teams.ts` | 66–68 | `null` (`loadTeam`) |
| `functions/api/routes/teams.ts` | 75–77 | `[]` (`loadUserTeamIds`) |

Note: `functions/api/routes/admin.ts:128–136` already has a centralised `readKvJson<T>` helper — but it is **only used locally within admin.ts** and not exported for other routes.

**Duplicated pattern:**
```ts
// users.ts:20–28
const raw = await c.env.USERS_KV.get(prefsKey(user.sub))
let prefs: UserPrefs = {}
if (raw) {
  try {
    prefs = JSON.parse(raw) as UserPrefs
  } catch (parseErr) {
    console.warn(`[users] failed to parse preferences for user ${user.sub}:`, parseErr)
  }
}
```

### DRY Fix — Export `readKvJson` from `functions/api/lib/kv.ts`

Move the existing `readKvJson` helper (currently private in `admin.ts:128–136`) to a shared lib:

```ts
// functions/api/lib/kv.ts (new file)
export async function readKvJson<T>(kv: KVNamespace, key: string): Promise<T | null> {
  try {
    const raw = await kv.get(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export async function writeKvJson<T>(
  kv: KVNamespace,
  key: string,
  value: T,
  options?: KVNamespacePutOptions,
): Promise<void> {
  await kv.put(key, JSON.stringify(value), options)
}
```

Replace callers:

```ts
// users.ts — before
const raw = await c.env.USERS_KV.get(prefsKey(user.sub))
let prefs: UserPrefs = {}
if (raw) { try { prefs = JSON.parse(raw) as UserPrefs } catch { … } }

// users.ts — after
const prefs = (await readKvJson<UserPrefs>(c.env.USERS_KV, prefsKey(user.sub))) ?? {}
```

```ts
// teams.ts — before
async function loadTeam(kv: KVNamespace, id: string): Promise<Team | null> {
  const raw = await kv.get(teamKey(id))
  return raw ? (JSON.parse(raw) as Team) : null
}

// teams.ts — after
import { readKvJson } from '../lib/kv'
const loadTeam = (kv: KVNamespace, id: string) => readKvJson<Team>(kv, teamKey(id))
```

---

## F-03 — API response envelope repeated inline

**Importance: 8/10**

### What

Every route handler manually constructs `{ ok: true/false, data/error, trace_id }`. The types `ApiSuccess<T>` and `ApiError` are declared in `functions/api/types.ts:174–180` but are **never used to build responses** — only for typing. There are 40+ call sites.

```ts
// Repeated pattern A — success
return c.json({ ok: true, data: { team }, trace_id: c.get('trace_id') }, 201)

// Repeated pattern B — error
return c.json(
  { ok: false, error: { code: 'validation', message: 'Invalid email' }, trace_id: c.get('trace_id') },
  400,
)
```

Affected files: `auth.ts`, `admin.ts`, `billing.ts`, `sessions.ts`, `teams.ts`, `users.ts`, `templates.ts`, `middleware/auth.ts`, `middleware/plan.ts`, `app.ts`.

### DRY Fix — Response helper functions in `functions/api/lib/response.ts`

```ts
// functions/api/lib/response.ts
import type { Context } from 'hono'
import type { Env } from '../types'

type StatusCode = 200 | 201 | 202 | 204 | 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500

export function ok<T>(c: Context<{ Bindings: Env }>, data: T, status: StatusCode = 200) {
  return c.json({ ok: true as const, data, trace_id: c.get('trace_id') }, status)
}

export function err(
  c: Context<{ Bindings: Env }>,
  code: string,
  message: string,
  status: StatusCode = 400,
) {
  return c.json({ ok: false as const, error: { code, message }, trace_id: c.get('trace_id') }, status)
}
```

Call sites become one-liners:

```ts
// before
return c.json({ ok: true, data: { team }, trace_id: c.get('trace_id') }, 201)
// after
return ok(c, { team }, 201)

// before
return c.json(
  { ok: false, error: { code: 'validation', message: 'Invalid email' }, trace_id: c.get('trace_id') },
  400,
)
// after
return err(c, 'validation', 'Invalid email', 400)
```

---

## F-04 — Plan quota data defined twice

**Importance: 8/10**

### What

Plan limits and feature flags are declared in two separate files with different key names but identical numeric values. A change to one must be manually mirrored in the other.

| File | Object | Key style |
|------|--------|-----------|
| `functions/api/types.ts:132–172` | `PLAN_QUOTAS` | `maxSessionsPerMonth`, `maxParticipantsPerSession` |
| `src/config/plans.ts:26–87` | `PLANS[].features` | `sessionsPerMonth`, `participantsPerSession` |

`src/config/plans.ts:3` even has a comment acknowledging this: *"Quota values … must stay in sync with PLAN_QUOTAS in functions/api/types.ts."* — which is a smell that extraction is needed.

**Risk:** A quota change on the backend (e.g., raising `free.maxSessionsPerMonth` from 5 to 10) will silently show stale numbers on the Pricing page unless the frontend file is also edited.

### DRY Fix — Serve quota facts from the API

Option A (preferred — no shared module): Add a public `GET /api/plans` route that returns `PLAN_QUOTAS` and let the frontend fetch it. The `PLANS` array in `src/config/plans.ts` keeps only display fields (`name`, `description`, `price`, `cta`, `badge`).

```ts
// functions/api/routes/plans.ts (new, no auth required)
app.get('/api/plans', (c) =>
  c.json({ ok: true, data: PLAN_QUOTAS, trace_id: c.get('trace_id') })
)
```

```ts
// src/config/plans.ts — remove features object, keep display metadata only
export const PLANS: PlanDisplayConfig[] = [
  { id: 'free', name: 'Free', description: '…', price: 0, cta: 'Get Started', … },
  …
]
```

Option B (shared types package): Extract a `packages/plan-config/` workspace package — higher refactor cost, only worthwhile if the monorepo grows.

---

## F-05 — KV key generator functions scattered per-route

**Importance: 7/10**

### What

Each route file defines its own private key builder lambdas. No naming convention is enforced and the same namespace prefixes are repeated as string literals.

| File | Key functions |
|------|--------------|
| `functions/api/routes/users.ts:7–9` | `prefsKey(userId)` → `prefs:{userId}` |
| `functions/api/routes/auth.ts:53–55` | `pwdKey`, `oauthKey`, `resetKey` |
| `functions/api/routes/teams.ts:62–64` | `teamKey`, `userTeamsKey`, `inviteKey` |

There is also an inline key in `functions/api/lib/quota.ts:23`:  
```ts
const kvKey = `quota:sessions:${userId}:${monthKey}`
```

And in `functions/api/lib/idempotency.ts` (inline strings).

### DRY Fix — `functions/api/lib/kv-keys.ts`

```ts
// functions/api/lib/kv-keys.ts
export const kvKey = {
  userPrefs:   (userId: string)                  => `prefs:${userId}`,
  userPassword:(userId: string)                  => `pwd:${userId}`,
  oauth:       (provider: string, sub: string)   => `oauth:${provider}:${sub}`,
  pwdReset:    (tokenHash: string)               => `pwd-reset:${tokenHash}`,
  team:        (teamId: string)                  => `team:${teamId}`,
  userTeams:   (userId: string)                  => `user-teams:${userId}`,
  teamInvite:  (tokenHash: string)               => `team-invite:${tokenHash}`,
  sessionQuota:(userId: string, month: string)   => `quota:sessions:${userId}:${month}`,
  idempotency: (key: string)                     => `idem:${key}`,
}
```

Each route then imports and uses `kvKey.*` instead of a local lambda. This also makes it trivial to audit all KV namespaces in one place.

---

## F-06 — Session and Question types redeclared on the frontend

**Importance: 7/10**

### What

`src/hooks/useSessions.ts:4–31` redeclares `SessionStatus`, `SessionSummary`, `PollOption`, `Question`, and `SessionDetail` — all of which already exist in `functions/api/types.ts`. The frontend types have slightly narrower `kind` unions and omit some fields (e.g., `session_mode`, `vote_policy`, `anonymity`), but the core structure is structural duplication.

```ts
// functions/api/types.ts:55–80 (backend canonical)
export type SessionStatus = 'draft' | 'live' | 'closed' | 'archived'
export type QuestionKind = 'poll' | 'ranking' | 'consent' | 'open' | 'multi_select' | 'likert' | 'upvote' | 'word_cloud' | 'slider'
export type Question = { id: string; session_id: string; position: number; kind: QuestionKind; prompt: string; options: PollOption[]; created_at: number }

// src/hooks/useSessions.ts:4–26 (frontend copy)
export type SessionStatus = 'draft' | 'live' | 'closed' | 'archived'
export type Question = { id: string; session_id: string; position: number; kind: 'poll' | 'ranking' | …; prompt: string; options: PollOption[] }
```

Note: `created_at` is missing from the frontend `Question` type — a silent divergence that will cause compile errors if the field is ever used.

### DRY Fix — Shared types package or `src/types/api.ts` re-export

Minimal approach (no monorepo change): create `src/types/api.ts` that re-exports from a path-aliased import of the backend types file, or copy only the canonical types once into `src/types/api.ts` and make `useSessions.ts` import from there instead of re-declaring.

Preferred approach once the project is stable: extract a `packages/types/` workspace and import from both `functions/` and `src/`.

---

## F-07 — KV `put` → `JSON.stringify` with TTL options

**Importance: 6/10**

### What

Five call sites repeat `kv.put(key, JSON.stringify(value), { expirationTtl: N })`.

| File | Line | TTL variable |
|------|------|-------------|
| `functions/api/routes/users.ts` | 55 | `PREFS_TTL` |
| `functions/api/lib/quota.ts` | 49 | computed `ttlSeconds` |
| `functions/api/routes/teams.ts` | 72 | none (no TTL) |
| `functions/api/routes/teams.ts` | 84 | none |
| `functions/api/lib/idempotency.ts` | 74, 91 | `PENDING_TTL_SECONDS`, `TTL_SECONDS` |

### DRY Fix

The `writeKvJson` helper shown in F-02 covers this:

```ts
// usage
await writeKvJson(c.env.USERS_KV, prefsKey(user.sub), updated, { expirationTtl: PREFS_TTL })
```

---

## F-08 — `setLoading/setError` boilerplate in non-polled hooks

**Importance: 5/10**

### What

`src/hooks/useSessions.ts:74–111` (`useSession`) and `src/hooks/useAdminUsers.ts:29–42` (`useAdminUsers`) share a manual `setLoading(true) … setLoading(false)` wrapper that is slightly different from the polling pattern (no interval) but still duplicated structure.

```ts
// useSession:79–91
const load = useCallback(async () => {
  if (!id) return
  setLoading(true)
  const res = await api<SessionDetail>(`/api/sessions/${encodeURIComponent(id)}`)
  if (res.ok) { setData(res.data); setError(null) }
  else { setError(res.error); setData(null) }
  setLoading(false)
}, [id])

// useAdminUsers:29–42
const fetchUsers = useCallback(async (q: string, off: number) => {
  setLoading(true)
  const res = await api<UsersListResult>(`/api/admin/users?${params}`)
  if (res.ok) { setUsers(res.data.users); setTotal(res.data.total); setError(null) }
  else { setError(res.error.message) }
  setLoading(false)
}, [])
```

### DRY Fix

A lower-level `useApiRequest` that wraps a single async call:

```ts
export function useApiRequest<T>() {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const execute = useCallback(async (call: () => Promise<ReturnType<typeof api<T>>>) => {
    setLoading(true)
    const res = await call()
    if (res.ok) { setData(res.data); setError(null) }
    else { setError(res.error.message) }
    setLoading(false)
    return res
  }, [])

  return { data, loading, error, execute }
}
```

This is lower priority than F-01 because the two hooks have different additional state (`total`, `id` guard), so the net reduction is modest.

---

## F-09 — D1 user-lookup `SELECT … WHERE id = ?1` repeated

**Importance: 4/10**

### What

Three files execute a `SELECT` on the `users` table keyed by user ID, each selecting a different projection.

| File | Lines | Columns |
|------|-------|---------|
| `functions/api/middleware/plan.ts:33` | 1 | `plan` |
| `functions/api/routes/admin.ts:162` | 1 | `id` (existence check by email) |
| `functions/api/routes/sessions.ts:108` | multi-line | full session + owner_id |

These are narrow enough to not warrant a shared wrapper yet — the projections differ too much. Flag for extraction if a fourth site appears.

### Suggested action

Add a typed helper only if a shared projection emerges:

```ts
// functions/api/lib/db.ts
export async function getUserPlan(db: D1Database, userId: string): Promise<PlanTier | null> {
  const row = await db.prepare('SELECT plan FROM users WHERE id = ?1').bind(userId).first<{ plan: PlanTier }>()
  return row?.plan ?? null
}
```

---

## F-10 — TTL and rate-limit constants scattered as file-locals

**Importance: 4/10**

### What

Six time-window constants are defined as `const` inside individual route files with no cross-file discoverability.

| File | Constant | Value |
|------|----------|-------|
| `functions/api/routes/auth.ts:31` | `MAGIC_LINK_TTL_MS` | `15 * 60 * 1000` |
| `functions/api/routes/auth.ts:32` | `JWT_TTL_SECONDS` | `14 * 24 * 60 * 60` |
| `functions/api/routes/auth.ts:33` | `PASSWORD_RESET_TTL_SECONDS` | `60 * 60` |
| `functions/api/routes/auth.ts:39` | `MAGIC_LINK_WINDOW_SECONDS` | `15 * 60` |
| `functions/api/routes/teams.ts:31` | `INVITE_TTL_SECONDS` | `24 * 60 * 60` |
| `functions/api/routes/users.ts:5` | `PREFS_TTL` | `365 * 24 * 60 * 60` |

Not strictly duplication (different values), but a discoverability and configuration hazard — `JWT_TTL_SECONDS` in particular is security-sensitive and should be visible alongside secrets configuration.

### Fix

Centralise in `functions/api/lib/constants.ts`:

```ts
export const TTL = {
  JWT_SECONDS:           14 * 24 * 60 * 60,   // 14 days
  MAGIC_LINK_MS:         15 * 60 * 1000,       // 15 min
  MAGIC_LINK_WINDOW_S:   15 * 60,
  PASSWORD_RESET_S:      60 * 60,              // 1 hour
  TEAM_INVITE_S:         24 * 60 * 60,         // 1 day
  USER_PREFS_S:          365 * 24 * 60 * 60,   // 1 year
} as const

export const RATE_LIMIT = {
  MAGIC_LINK_MAX_PER_IP:    10,
  MAGIC_LINK_MAX_PER_EMAIL: 5,
} as const
```

---

## Recommended Utilities Module

Based on the findings above, create the following files:

| File | Exports | Fixes |
|------|---------|-------|
| `functions/api/lib/kv.ts` | `readKvJson`, `writeKvJson` | F-02, F-07 |
| `functions/api/lib/kv-keys.ts` | `kvKey.*` | F-05 |
| `functions/api/lib/response.ts` | `ok`, `err` | F-03 |
| `functions/api/lib/constants.ts` | `TTL`, `RATE_LIMIT` | F-10 |
| `src/hooks/usePolledApi.ts` | `usePolledApi` | F-01 |

Optional (medium effort):

| File | Exports | Fixes |
|------|---------|-------|
| `functions/api/lib/db.ts` | `getUserPlan` | F-09 |
| `src/hooks/useApiRequest.ts` | `useApiRequest` | F-08 |
| `functions/api/routes/plans.ts` | `GET /api/plans` | F-04 |

---

## Refactoring Effort Estimate

| Finding | Lines saved | Effort | Risk |
|---------|-------------|--------|------|
| F-01 (usePolledApi) | ~220 | 1–2 h | Low — pure React, well-tested surface |
| F-02 (readKvJson) | ~40 | 1 h | Low — wrap + re-test KV paths |
| F-03 (response helpers) | ~80+ | 2–3 h | Medium — touches every route file |
| F-04 (plan API route) | ~30 | 1 h | Low — additive change |
| F-05 (kv-keys) | ~20 | 1 h | Low — pure rename/import |
| F-06 (shared types) | ~25 | 1–2 h | Medium — may expose existing type drift |
| F-07 (writeKvJson) | ~15 | 0.5 h | Low — absorbed by F-02 work |
| F-08 (useApiRequest) | ~20 | 1 h | Low |
| F-09 (getUserPlan) | ~5 | 0.5 h | Low |
| F-10 (constants) | ~10 | 0.5 h | Low |

**Recommended order:** F-01 → F-05 → F-02+F-07 → F-03 → F-10 → F-04 → F-06 → F-08 → F-09
