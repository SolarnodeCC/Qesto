/**
 * Requirement: ADR-0074 (temporary free-access promo) — plan reads outside planMiddleware go through effectivePlan.
 */
import { describe, expect, it } from 'vitest'
import { resolveEffectivePlan } from '../../functions/api/middleware/plan'
import type { Env } from '../../functions/api/types'

function db(plan: string | null, fail = false): D1Database {
  return {
    prepare: () => ({
      bind: () => ({
        first: async () => {
          if (fail) throw new Error('d1 down')
          return plan === null ? null : { plan }
        },
      }),
    }),
  } as unknown as D1Database
}

function kv(value: string | null): KVNamespace {
  return { get: async () => value } as unknown as KVNamespace
}

describe('resolveEffectivePlan', () => {
  it('prefers the KV plan cache', async () => {
    const env = { DB: db('free'), ACTIONS_KV: kv('team') } as unknown as Env
    expect(await resolveEffectivePlan(env, 'u1')).toBe('team')
  })

  it('falls back to D1 on a cache miss', async () => {
    const env = { DB: db('starter'), ACTIONS_KV: kv(null) } as unknown as Env
    expect(await resolveEffectivePlan(env, 'u1')).toBe('starter')
  })

  it('fails safe to free when D1 errors', async () => {
    const env = { DB: db(null, true) } as unknown as Env
    expect(await resolveEffectivePlan(env, 'u1')).toBe('free')
  })

  it('applies the free-access window (ADR-0074)', async () => {
    const env = {
      DB: db('free'),
      FREE_ACCESS_ALL: 'true',
      FREE_ACCESS_UNTIL: new Date(Date.now() + 86_400_000).toISOString(),
      FREE_ACCESS_TIER: 'team',
    } as unknown as Env
    expect(await resolveEffectivePlan(env, 'u1')).toBe('team')
  })
})
