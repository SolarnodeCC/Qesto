import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import {
  apiKeyHashIndexKey,
  apiKeyKvKey,
  apiKeyRateLimitKey,
  generateApiKey,
  hashApiKey,
  type ApiKeyRecord,
} from '../../functions/api/lib/api-keys'
import { fakeRateLimitBinding } from '../../functions/api/lib/atomic-rate-limit'
import { publicApiKeyMiddleware, type ApiKeyVars } from '../../functions/api/middleware/public-api-auth'
import type { Env } from '../../functions/api/types'

class MemoryKv {
  store = new Map<string, string>()
  async get(key: string, type?: string): Promise<unknown> {
    const v = this.store.get(key)
    if (v === undefined) return null
    if (type === 'json') return JSON.parse(v)
    return v
  }
  async put(key: string, value: string): Promise<void> {
    this.store.set(key, value)
  }
}

describe('publicApiKeyMiddleware rate limit (ADR-0073 WS-2)', () => {
  let integrations: MemoryKv
  let actions: MemoryKv
  let ae: { writeDataPoint: ReturnType<typeof vi.fn> }
  let rawKey: string
  let record: ApiKeyRecord

  beforeEach(async () => {
    integrations = new MemoryKv()
    actions = new MemoryKv()
    ae = { writeDataPoint: vi.fn() }
    const gen = generateApiKey()
    rawKey = gen.raw
    record = {
      id: 'key_canary_1',
      teamId: 'team_canary',
      name: 'canary',
      scopes: ['read'],
      createdAt: Date.now(),
      createdBy: 'u1',
      prefix: gen.prefix,
    }
    const hash = await hashApiKey(rawKey)
    await integrations.put(apiKeyHashIndexKey(hash), record.id)
    await integrations.put(apiKeyKvKey(record.id), JSON.stringify(record))
  })

  function makeEnv(overrides: Partial<Env> = {}): Env {
    return {
      ENV: 'dev',
      PAGES_URL: 'http://localhost',
      API_URL: 'http://localhost',
      JWT_SECRET: 'test',
      DB: {} as D1Database,
      USERS_KV: {} as KVNamespace,
      SESSIONS_KV: {} as KVNamespace,
      TEAMS_KV: {} as KVNamespace,
      TEMPLATES_KV: {} as KVNamespace,
      DECISIONS_KV: {} as KVNamespace,
      AUDIT_KV: {} as KVNamespace,
      ACTIONS_KV: actions as unknown as KVNamespace,
      INTEGRATIONS_KV: integrations as unknown as KVNamespace,
      SESSION_ROOM: {} as DurableObjectNamespace,
      AI: {} as Ai,
      DECISIONS_VECTORIZE: {} as VectorizeIndex,
      HELP_VECTORIZE: {} as VectorizeIndex,
      KB_VECTORIZE: {} as VectorizeIndex,
      METRICS_AE: ae as unknown as AnalyticsEngineDataset,
      ...overrides,
    }
  }

  async function probe(env: Env) {
    const hono = new Hono<{ Bindings: Env; Variables: ApiKeyVars }>()
    hono.use('*', publicApiKeyMiddleware)
    hono.get('/probe', (c) => c.json({ ok: true, keyId: c.get('apiKey').id }))
    return hono.request('/probe', {
      headers: { authorization: `Bearer ${rawKey}` },
    }, env)
  }

  it('flag off: legacy KV enforces 120/min and emits backend=kv on 429', async () => {
    const env = makeEnv({ ATOMIC_RATE_LIMIT_ENABLED: 'false' })
    const windowStart = Math.floor(Date.now() / 1000 / 60) * 60
    await actions.put(apiKeyRateLimitKey(record.id, windowStart), '120')

    const res = await probe(env)
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('60')
    const body = await res.json() as { error: { code: string } }
    expect(body.error.code).toBe('rate_limited')

    const dp = ae.writeDataPoint.mock.calls[0][0] as { blobs: string[] }
    expect(dp.blobs[0]).toBe('rate_limit.hit')
    expect(dp.blobs[5]).toContain('profile=api_key')
    expect(dp.blobs[5]).toContain('backend=kv')
    expect(dp.blobs[5]).toContain(`actor=key:${record.id}`)
    expect(dp.blobs[5]).not.toContain(rawKey)
  })

  it('flag on: Workers RL deny returns 429 with backend=workers_rl', async () => {
    const env = makeEnv({
      ATOMIC_RATE_LIMIT_ENABLED: 'true',
      RL_API_KEY: fakeRateLimitBinding([false]),
    })
    const res = await probe(env)
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('60')
    const dp = ae.writeDataPoint.mock.calls[0][0] as { blobs: string[] }
    expect(dp.blobs[0]).toBe('rate_limit.hit')
    expect(dp.blobs[5]).toContain('backend=workers_rl')
    expect(dp.blobs[5]).toContain('profile=api_key')
  })

  it('flag on: Workers RL allow dual-writes legacy KV counter', async () => {
    const env = makeEnv({
      ATOMIC_RATE_LIMIT_ENABLED: 'true',
      RL_API_KEY: fakeRateLimitBinding([true]),
    })
    const res = await probe(env)
    expect(res.status).toBe(200)
    const windowStart = Math.floor(Date.now() / 1000 / 60) * 60
    const legacy = await actions.get(apiKeyRateLimitKey(record.id, windowStart))
    expect(legacy).toBe('1')
  })

  it('flag on + missing binding falls back without 500', async () => {
    const env = makeEnv({
      ATOMIC_RATE_LIMIT_ENABLED: 'true',
      // no RL_API_KEY
    })
    const res = await probe(env)
    expect(res.status).toBe(200)
    const fallback = ae.writeDataPoint.mock.calls.find(
      (c) => (c[0] as { blobs: string[] }).blobs[0] === 'rate_limit.backend_fallback',
    )
    expect(fallback).toBeTruthy()
    const blobs = (fallback![0] as { blobs: string[] }).blobs
    expect(blobs[5]).toContain('reason=binding_missing')
    expect(blobs[5]).toContain('profile=api_key')
  })
})
