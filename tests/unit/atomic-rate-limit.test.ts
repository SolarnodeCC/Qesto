import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ATOMIC_RATE_LIMIT_PROFILES,
  atomicRateLimit,
  atomicRateLimitDual,
  fakeRateLimitBinding,
  type AtomicRateLimitProfile,
} from '../../functions/api/lib/atomic-rate-limit'
import type { Env } from '../../functions/api/types'

class KVMock {
  private store = new Map<string, { value: string; expiresAt: number }>()

  async get(key: string, _type?: string): Promise<unknown> {
    const entry = this.store.get(key)
    if (!entry) return null
    if (entry.expiresAt < Date.now()) {
      this.store.delete(key)
      return null
    }
    return JSON.parse(entry.value)
  }

  async put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void> {
    const ttl = opts?.expirationTtl ?? 60
    this.store.set(key, { value, expiresAt: Date.now() + ttl * 1000 })
  }
}

function baseEnv(overrides: Partial<Env> = {}): Env {
  return {
    ENV: 'dev',
    PAGES_URL: 'http://localhost:5173',
    API_URL: 'http://localhost:8787',
    JWT_SECRET: 'test',
    DB: {} as D1Database,
    USERS_KV: {} as KVNamespace,
    SESSIONS_KV: {} as KVNamespace,
    TEAMS_KV: {} as KVNamespace,
    TEMPLATES_KV: {} as KVNamespace,
    DECISIONS_KV: {} as KVNamespace,
    AUDIT_KV: {} as KVNamespace,
    ACTIONS_KV: new KVMock() as unknown as KVNamespace,
    SESSION_ROOM: {} as DurableObjectNamespace,
    AI: {} as Ai,
    DECISIONS_VECTORIZE: {} as VectorizeIndex,
    HELP_VECTORIZE: {} as VectorizeIndex,
    KB_VECTORIZE: {} as VectorizeIndex,
    ...overrides,
  }
}

describe('atomicRateLimit (ADR-0073 WS-1)', () => {
  let env: Env

  beforeEach(() => {
    env = baseEnv()
  })

  it('keeps profile budgets aligned with wrangler registry (static contract)', () => {
    const expected: Record<AtomicRateLimitProfile, number> = {
      api_key: 120,
      embed_read: 120,
      embed_handshake: 30,
      join: 20,
      public_event: 60,
      webhook: 100,
      auth_burst: 5,
      report_burst: 5,
      kb_search: 60,
      admin_audit_query: 120,
      ai_burst: 10,
    }
    expect(ATOMIC_RATE_LIMIT_PROFILES.embed_read.kvFallback.prefix).toBe('embed-read')
    expect(ATOMIC_RATE_LIMIT_PROFILES.embed_handshake.kvFallback.prefix).toBe('embed-hs')
    for (const [name, limit] of Object.entries(expected) as [AtomicRateLimitProfile, number][]) {
      expect(ATOMIC_RATE_LIMIT_PROFILES[name].limit).toBe(limit)
      expect(ATOMIC_RATE_LIMIT_PROFILES[name].periodSec).toBe(60)
    }
  })

  it('flag off uses KV fallback (no Workers RL call)', async () => {
    const rl = fakeRateLimitBinding([false])
    env = baseEnv({
      ATOMIC_RATE_LIMIT_ENABLED: 'false',
      RL_API_KEY: rl,
    })
    const r = await atomicRateLimit(env, 'api_key', 'key-1')
    expect(r.allowed).toBe(true)
    expect(r.backend).toBe('kv')
    // Fake binding would deny — proving we did not call it.
  })

  it('flag on + binding deny returns workers_rl', async () => {
    env = baseEnv({
      ATOMIC_RATE_LIMIT_ENABLED: 'true',
      RL_API_KEY: fakeRateLimitBinding([false]),
    })
    const r = await atomicRateLimit(env, 'api_key', 'key-1')
    expect(r).toMatchObject({
      allowed: false,
      backend: 'workers_rl',
      remaining: 0,
      limit: 120,
      periodSec: 60,
    })
    expect(r.retryAfterSec).toBe(60)
  })

  it('flag on + binding allow returns workers_rl with non-authoritative remaining', async () => {
    env = baseEnv({
      ATOMIC_RATE_LIMIT_ENABLED: 'true',
      RL_API_KEY: fakeRateLimitBinding([true, true]),
    })
    const r = await atomicRateLimit(env, 'api_key', 'key-1')
    expect(r.allowed).toBe(true)
    expect(r.backend).toBe('workers_rl')
    expect(r.remaining).toBe(120)
  })

  it('flag on + missing binding falls back to KV and emits AE backend_fallback', async () => {
    const ae = { writeDataPoint: vi.fn() }
    env = baseEnv({
      ATOMIC_RATE_LIMIT_ENABLED: 'true',
      METRICS_AE: ae as unknown as AnalyticsEngineDataset,
      // no RL_API_KEY
    })
    const r = await atomicRateLimit(env, 'api_key', 'key-1')
    expect(r.allowed).toBe(true)
    expect(r.backend).toBe('kv')
    expect(ae.writeDataPoint).toHaveBeenCalled()
    const dp = ae.writeDataPoint.mock.calls[0][0] as { blobs: string[] }
    expect(dp.blobs[0]).toBe('rate_limit.backend_fallback')
    expect(dp.blobs[5]).toContain('profile=api_key')
    expect(dp.blobs[5]).toContain('reason=binding_missing')
  })

  it('Workers RL throw falls back to KV (availability)', async () => {
    const throwing: RateLimit = {
      async limit() {
        throw new Error('binding exploded')
      },
    }
    env = baseEnv({
      ATOMIC_RATE_LIMIT_ENABLED: 'true',
      RL_API_KEY: throwing,
    })
    const r = await atomicRateLimit(env, 'api_key', 'key-1')
    expect(r.allowed).toBe(true)
    expect(r.backend).toBe('kv')
  })

  it('denies empty keys (shared empty-key bucket is an abuse hole)', async () => {
    env = baseEnv({
      ATOMIC_RATE_LIMIT_ENABLED: 'true',
      RL_API_KEY: fakeRateLimitBinding([true]),
    })
    const r = await atomicRateLimit(env, 'api_key', '   ')
    expect(r.allowed).toBe(false)
    expect(r.backend).toBe('deny')
  })

  it('RATE_LIMIT_FAIL_CLOSED + no KV denies when Workers path unavailable', async () => {
    const envNoKv = baseEnv({
      ATOMIC_RATE_LIMIT_ENABLED: 'true',
      RATE_LIMIT_FAIL_CLOSED: 'true',
    })
    Reflect.deleteProperty(envNoKv, 'ACTIONS_KV')
    const r = await atomicRateLimit(envNoKv, 'api_key', 'key-1')
    expect(r.allowed).toBe(false)
    expect(r.backend).toBe('deny')
  })

  it('KV fallback enforces max under flag off', async () => {
    env = baseEnv({ ATOMIC_RATE_LIMIT_ENABLED: 'false' })
    for (let i = 0; i < 120; i++) {
      const r = await atomicRateLimit(env, 'api_key', 'burst-key')
      expect(r.allowed).toBe(true)
    }
    const blocked = await atomicRateLimit(env, 'api_key', 'burst-key')
    expect(blocked.allowed).toBe(false)
    expect(blocked.backend).toBe('kv')
  })

  it('dual-layer: Workers burst deny short-circuits before sustained KV', async () => {
    env = baseEnv({
      ATOMIC_RATE_LIMIT_ENABLED: 'true',
      RL_AUTH_BURST: fakeRateLimitBinding([false]),
    })
    const r = await atomicRateLimitDual(env, {
      key: 'user-1',
      burst: 'auth_burst',
      sustained: { max: 100, windowSeconds: 600, prefix: 'sustained-test' },
      profileLabel: 'auth_dual',
    })
    expect(r.allowed).toBe(false)
    expect(r.backend).toBe('workers_rl')
  })

  it('dual-layer: sustained KV still enforced after burst allow', async () => {
    env = baseEnv({
      ATOMIC_RATE_LIMIT_ENABLED: 'true',
      RL_AUTH_BURST: fakeRateLimitBinding([true, true, true]),
    })
    const sustained = { max: 2, windowSeconds: 600, prefix: 'sustained-cap' }
    expect((await atomicRateLimitDual(env, { key: 'u', burst: 'auth_burst', sustained })).allowed).toBe(true)
    expect((await atomicRateLimitDual(env, { key: 'u', burst: 'auth_burst', sustained })).allowed).toBe(true)
    const third = await atomicRateLimitDual(env, { key: 'u', burst: 'auth_burst', sustained })
    expect(third.allowed).toBe(false)
    expect(third.backend).toBe('kv')
  })
})
