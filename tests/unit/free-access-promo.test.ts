// ADR-0074 — temporary all-users free access.
//
// The load-bearing properties, in order of how much damage getting them wrong
// would do:
//   1. a paying customer is never downgraded, during OR after the window;
//   2. the window cannot be extended by leaving the flag on;
//   3. every reader that bypasses planMiddleware resolves the effective tier.

import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { effectivePlan, freeAccessActive, freeAccessStatus, grantedTier } from '../../functions/api/lib/free-access'
import { planMiddleware } from '../../functions/api/middleware/plan'
import { getPlanUsageWithCache } from '../../functions/api/middleware/kv-cache'
import { consumePromoAiRun, promoInsightsCap, DEFAULT_PROMO_AI_MONTHLY_CAP } from '../../functions/api/lib/promo-ai-quota'
import { isDisposableEmail, emailDomain } from '../../functions/api/lib/email-domain'
import type { AuthVariables } from '../../functions/api/middleware/auth'
import type { PlanVariables } from '../../functions/api/middleware/plan'
import type { Env, PlanTier } from '../../functions/api/types'
import { PLAN_QUOTAS } from '../../functions/api/types'
import { KVMock } from '../helpers/kv-mock'

const OPEN = '2026-12-12T23:59:59Z'
const DURING = Date.parse('2026-10-01T12:00:00Z')
const AFTER = Date.parse('2026-12-13T00:00:01Z')

// `Record<string, unknown>` rather than `Partial<Env>`: exactOptionalPropertyTypes
// forbids passing an explicit `undefined` for an optional var, and "the var is
// absent" is exactly what several of these cases need to exercise.
function promoEnv(partial: Record<string, unknown> = {}): Env {
  return {
    ENV: 'dev',
    PAGES_URL: 'http://local',
    API_URL: 'http://local',
    JWT_SECRET: 'integration-test-secret-at-least-32-bytes!',
    FREE_ACCESS_ALL: 'true',
    FREE_ACCESS_UNTIL: OPEN,
    FREE_ACCESS_TIER: 'team',
    ...partial,
  } as Env
}

describe('freeAccessActive — both gates must hold', () => {
  it('is active only when the flag is on AND the window is still open', () => {
    expect(freeAccessActive(promoEnv(), DURING)).toBe(true)
  })

  it('is inert once the date passes, even with the flag still on', () => {
    // The point of the second gate: forgetting to flip the flag back cannot
    // silently extend a promo that was announced with an end date.
    expect(freeAccessActive(promoEnv(), AFTER)).toBe(false)
  })

  it('is inert when the flag is off, however far away the date is', () => {
    expect(freeAccessActive(promoEnv({ FREE_ACCESS_ALL: 'false' }), DURING)).toBe(false)
  })

  it('is inert when the date is missing or unparseable', () => {
    expect(freeAccessActive(promoEnv({ FREE_ACCESS_UNTIL: undefined }), DURING)).toBe(false)
    expect(freeAccessActive(promoEnv({ FREE_ACCESS_UNTIL: 'whenever' }), DURING)).toBe(false)
  })

  it('treats any value other than the exact string "true" as off', () => {
    for (const value of ['TRUE', '1', 'yes', '']) {
      expect(freeAccessActive(promoEnv({ FREE_ACCESS_ALL: value }), DURING)).toBe(false)
    }
  })
})

describe('effectivePlan — only ever upgrades', () => {
  it('grants the promo tier to a free account while the window is open', () => {
    expect(effectivePlan(promoEnv(), 'free', DURING)).toBe('team')
  })

  it('never downgrades a paying customer during the window', () => {
    // A starter subscriber under a `starter` promo keeps starter; a team
    // subscriber is never dropped to the granted tier.
    expect(effectivePlan(promoEnv({ FREE_ACCESS_TIER: 'starter' }), 'team', DURING)).toBe('team')
    expect(effectivePlan(promoEnv({ FREE_ACCESS_TIER: 'starter' }), 'starter', DURING)).toBe('starter')
  })

  it('reverts each account to its own stored tier — not to free — after the window', () => {
    expect(effectivePlan(promoEnv(), 'starter', AFTER)).toBe('starter')
    expect(effectivePlan(promoEnv(), 'free', AFTER)).toBe('free')
    expect(effectivePlan(promoEnv(), 'team', AFTER)).toBe('team')
  })

  it('defaults the granted tier to team, and honours an explicit starter', () => {
    expect(grantedTier(promoEnv({ FREE_ACCESS_TIER: undefined }))).toBe('team')
    expect(grantedTier(promoEnv({ FREE_ACCESS_TIER: 'starter' }))).toBe('starter')
    // Anything unrecognised falls back to the documented default rather than throwing.
    expect(grantedTier(promoEnv({ FREE_ACCESS_TIER: 'enterprise' }))).toBe('team')
  })
})

describe('freeAccessStatus — API payload', () => {
  it('reports the close time and granted tier while open', () => {
    expect(freeAccessStatus(promoEnv(), DURING)).toEqual({
      active: true,
      until: new Date(Date.parse(OPEN)).toISOString(),
      granted_tier: 'team',
    })
  })

  it('reports nothing identifying once closed', () => {
    expect(freeAccessStatus(promoEnv(), AFTER)).toEqual({ active: false, until: null, granted_tier: null })
  })
})

// ── planMiddleware ───────────────────────────────────────────────────────────

type Vars = AuthVariables & PlanVariables

function probeApp() {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()
  app.use('*', async (c, next) => {
    c.set('trace_id', 'trace-test')
    c.set('user', { sub: 'user_1', email: 'user@example.com', iat: 1, exp: 2 })
    await next()
  })
  app.use('*', planMiddleware)
  app.get('/probe', (c) =>
    c.json({
      ok: true,
      data: {
        plan: c.get('plan'),
        plan_stored: c.get('plan_stored') ?? null,
        maxSessionsPerMonth: c.get('planQuotas').maxSessionsPerMonth,
      },
    }),
  )
  return app
}

function dbReturning(plan: PlanTier): D1Database {
  return {
    prepare: () => ({ bind: () => ({ first: async () => ({ plan }) }) }),
  } as unknown as D1Database
}

async function probe(env: Env) {
  const res = await probeApp().fetch(new Request('http://local/probe'), env)
  const body = (await res.json()) as { data: { plan: PlanTier; plan_stored: PlanTier | null; maxSessionsPerMonth: number } }
  return body.data
}

describe('planMiddleware with the promo', () => {
  it('serves a free account the granted tier and its quotas', async () => {
    const data = await probe(promoEnv({ DB: dbReturning('free') }))
    expect(data.plan).toBe('team')
    expect(data.maxSessionsPerMonth).toBe(PLAN_QUOTAS.team.maxSessionsPerMonth)
  })

  it('exposes the stored tier so billing surfaces can still report the truth', async () => {
    const data = await probe(promoEnv({ DB: dbReturning('starter') }))
    expect(data.plan).toBe('team')
    expect(data.plan_stored).toBe('starter')
  })

  it('leaves plan_stored unset when the promo changed nothing', async () => {
    const data = await probe(promoEnv({ DB: dbReturning('team') }))
    expect(data.plan).toBe('team')
    expect(data.plan_stored).toBeNull()
  })

  it('falls back to the stored tier with the flag off', async () => {
    const data = await probe(promoEnv({ FREE_ACCESS_ALL: 'false', DB: dbReturning('free') }))
    expect(data.plan).toBe('free')
    expect(data.maxSessionsPerMonth).toBe(PLAN_QUOTAS.free.maxSessionsPerMonth)
  })
})

// ── bypass: cached plan-usage payload ────────────────────────────────────────

describe('getPlanUsageWithCache (bypass #1)', () => {
  function usageEnv(plan: PlanTier, partial: Record<string, unknown> = {}) {
    return {
      env: promoEnv({
        DB: dbReturning(plan),
        USERS_KV: new KVMock() as unknown as KVNamespace,
        SESSIONS_KV: new KVMock() as unknown as KVNamespace,
        TEAMS_KV: new KVMock() as unknown as KVNamespace,
        ...partial,
      }),
    }
  }

  it('serves the effective tier and its session limit', async () => {
    const usage = await getPlanUsageWithCache(usageEnv('free') as never, 'host_1')
    expect(usage.plan).toBe('team')
    expect(usage.sessions.limit).toBe(PLAN_QUOTAS.team.maxSessionsPerMonth)
    expect(usage.plan_stored).toBe('free')
  })

  it('does not serve a stale tier from cache after the flag flips back', async () => {
    // The cache holds the STORED tier, so a rollback takes effect on the next
    // read instead of lingering for the 5-minute TTL.
    const usersKv = new KVMock()
    const c = usageEnv('free', { USERS_KV: usersKv as unknown as KVNamespace })
    await getPlanUsageWithCache(c as never, 'host_1')

    const rolledBack = {
      env: { ...c.env, FREE_ACCESS_ALL: 'false' } as Env,
    }
    const usage = await getPlanUsageWithCache(rolledBack as never, 'host_1')
    expect(usage.plan).toBe('free')
    expect(usage.sessions.limit).toBe(PLAN_QUOTAS.free.maxSessionsPerMonth)
  })
})

// ── promo AI ceiling ─────────────────────────────────────────────────────────

describe('promo AI monthly cap', () => {
  it('applies no cap outside the window', () => {
    expect(promoInsightsCap(promoEnv({ FREE_ACCESS_ALL: 'false' }), DURING)).toBeNull()
    expect(promoInsightsCap(promoEnv(), AFTER)).toBeNull()
  })

  it('defaults to the documented cap when unset, and honours an override', () => {
    expect(promoInsightsCap(promoEnv(), DURING)).toBe(DEFAULT_PROMO_AI_MONTHLY_CAP)
    expect(promoInsightsCap(promoEnv({ PROMO_AI_MONTHLY_CAP: '5' }), DURING)).toBe(5)
  })

  it('treats "0" as no cap, so the ceiling can be lifted without closing the promo', () => {
    expect(promoInsightsCap(promoEnv({ PROMO_AI_MONTHLY_CAP: '0' }), DURING)).toBeNull()
  })

  it('allows runs up to the cap and refuses the one past it', async () => {
    const kv = new KVMock() as unknown as KVNamespace
    const env = promoEnv({ PROMO_AI_MONTHLY_CAP: '3' })
    const now = new Date(DURING)

    for (let i = 1; i <= 3; i++) {
      const result = await consumePromoAiRun(env, kv, 'user_1', now)
      expect(result).toMatchObject({ allowed: true, used: i, limit: 3 })
    }

    const denied = await consumePromoAiRun(env, kv, 'user_1', now)
    expect(denied).toMatchObject({ allowed: false, used: 3, limit: 3 })
  })

  it('counts per user, not globally', async () => {
    const kv = new KVMock() as unknown as KVNamespace
    const env = promoEnv({ PROMO_AI_MONTHLY_CAP: '1' })
    const now = new Date(DURING)

    expect((await consumePromoAiRun(env, kv, 'user_1', now)).allowed).toBe(true)
    expect((await consumePromoAiRun(env, kv, 'user_2', now)).allowed).toBe(true)
    expect((await consumePromoAiRun(env, kv, 'user_1', now)).allowed).toBe(false)
  })

  it('consumes nothing when the promo is closed', async () => {
    const kv = new KVMock() as unknown as KVNamespace
    const env = promoEnv({ FREE_ACCESS_ALL: 'false' })
    const result = await consumePromoAiRun(env, kv, 'user_1', new Date(DURING))
    expect(result).toEqual({ allowed: true, used: 0, limit: null })
  })

  it('fails open when KV is unavailable — a cost ceiling must not take AI down', async () => {
    const brokenKv = {
      get: async () => { throw new Error('kv down') },
      put: async () => { throw new Error('kv down') },
    } as unknown as KVNamespace
    const result = await consumePromoAiRun(promoEnv(), brokenKv, 'user_1', new Date(DURING))
    expect(result.allowed).toBe(true)
  })
})

// ── signup hygiene ───────────────────────────────────────────────────────────

describe('disposable email blocking', () => {
  const on = { SIGNUP_BLOCK_DISPOSABLE_DOMAINS: 'true' } as Env

  it('is off unless the flag is on', () => {
    expect(isDisposableEmail({} as Env, 'someone@mailinator.com')).toBe(false)
  })

  it('rejects known throwaway inboxes', () => {
    expect(isDisposableEmail(on, 'someone@mailinator.com')).toBe(true)
    expect(isDisposableEmail(on, 'SOMEONE@YOPMAIL.COM')).toBe(true)
  })

  it('rejects subdomains, which is how these services hand out inboxes', () => {
    expect(isDisposableEmail(on, 'a@team.mailinator.com')).toBe(true)
  })

  it('allows free webmail — solo facilitators are a real segment', () => {
    for (const domain of ['gmail.com', 'outlook.com', 'proton.me', 'capgemini.com']) {
      expect(isDisposableEmail(on, `someone@${domain}`)).toBe(false)
    }
  })

  it('extends the list from env without a code change', () => {
    const env = { ...on, SIGNUP_BLOCKED_EMAIL_DOMAINS_EXTRA: 'newthrowaway.io, other.example' } as Env
    expect(isDisposableEmail(env, 'a@newthrowaway.io')).toBe(true)
    expect(isDisposableEmail(env, 'a@other.example')).toBe(true)
  })

  it('does not throw on malformed addresses', () => {
    expect(emailDomain('not-an-email')).toBeNull()
    expect(isDisposableEmail(on, 'not-an-email')).toBe(false)
    expect(isDisposableEmail(on, 'trailing@')).toBe(false)
  })
})
