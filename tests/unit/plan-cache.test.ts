/**
 * Requirement: issue #889 (DD-16) — planMiddleware must not hit D1 on every
 * authenticated request. The stored tier is cached briefly in ACTIONS_KV,
 * invalidated on plan writes, and ADR-0074's effectivePlan is still applied
 * on top of the cached value.
 */
import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { planMiddleware } from '../../functions/api/middleware/plan'
import {
  invalidatePlanCache,
  planCacheKey,
  PLAN_CACHE_TTL_SECONDS,
} from '../../functions/api/lib/plan-cache'
import type { Env } from '../../functions/api/types'
import { KVMock } from '../helpers/kv-mock'

function countingDb(plan: string) {
  let calls = 0
  const db = {
    prepare() {
      return {
        bind() {
          return {
            async first() {
              calls++
              return { plan }
            },
          }
        },
      }
    },
  }
  return { db: db as unknown as D1Database, calls: () => calls }
}

function app() {
  const a = new Hono<{ Bindings: Env; Variables: any }>()
  a.use('*', async (c, next) => {
    c.set('user', { sub: 'u1', email: 'u1@example.com', iat: 1, exp: 2 })
    await next()
  })
  a.use('*', planMiddleware)
  a.get('/p', (c) => c.json({ plan: c.get('plan') }))
  return a
}

describe('plan cache (DD-16)', () => {
  it('serves repeat requests from KV without a second D1 read', async () => {
    const { db, calls } = countingDb('starter')
    const actions = new KVMock()
    const env = { DB: db, ACTIONS_KV: actions } as unknown as Env
    const a = app()
    for (let i = 0; i < 3; i++) {
      const res = await a.fetch(new Request('http://x/p'), env)
      expect(((await res.json()) as { plan: string }).plan).toBe('starter')
    }
    expect(calls()).toBe(1)
    expect(await actions.get(planCacheKey('u1'))).toBe('starter')
  })

  it('re-reads D1 after invalidation', async () => {
    const { db, calls } = countingDb('team')
    const actions = new KVMock()
    const env = { DB: db, ACTIONS_KV: actions } as unknown as Env
    await actions.put(planCacheKey('u1'), 'free')
    const a = app()
    expect(((await (await a.fetch(new Request('http://x/p'), env)).json()) as { plan: string }).plan).toBe('free')
    await invalidatePlanCache(env, 'u1')
    expect(((await (await a.fetch(new Request('http://x/p'), env)).json()) as { plan: string }).plan).toBe('team')
    expect(calls()).toBe(1)
  })

  it('ignores a corrupt cache value and falls back to D1', async () => {
    const { db, calls } = countingDb('starter')
    const actions = new KVMock()
    await actions.put(planCacheKey('u1'), 'platinum')
    const env = { DB: db, ACTIONS_KV: actions } as unknown as Env
    const res = await app().fetch(new Request('http://x/p'), env)
    expect(((await res.json()) as { plan: string }).plan).toBe('starter')
    expect(calls()).toBe(1)
  })

  it('keeps the TTL short', () => {
    expect(PLAN_CACHE_TTL_SECONDS).toBeLessThanOrEqual(60)
  })

  it('ignores a stale KV tier when ENVIRONMENT is development', async () => {
    const { db, calls } = countingDb('starter')
    const actions = new KVMock()
    await actions.put(planCacheKey('u1'), 'free')
    const env = {
      DB: db,
      ACTIONS_KV: actions,
      ENVIRONMENT: 'development',
    } as unknown as Env
    const a = app()
    for (let i = 0; i < 2; i++) {
      const res = await a.fetch(new Request('http://x/p'), env)
      expect(((await res.json()) as { plan: string }).plan).toBe('starter')
    }
    expect(calls()).toBe(2)
  })
})
