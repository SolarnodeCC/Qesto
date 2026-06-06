import { Hono } from 'hono'
import { testJwtSecret } from '../helpers/test-credentials'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { rateLimit, type RateLimitNamespace } from '../../functions/api/middleware/rate-limit'
import type { Env } from '../../functions/api/types'
import { KVMock } from '../helpers/kv-mock'

type Vars = { trace_id: string }

function makeEnv(kv: KVNamespace, overrides: Partial<Env> = {}): Env {
  return {
    ENV: 'dev',
    PAGES_URL: 'http://local',
    API_URL: 'http://local',
    JWT_SECRET: testJwtSecret(),
    ACTIONS_KV: kv,
    ...overrides,
  } as unknown as Env
}

function withTrace(app: Hono<{ Bindings: Env; Variables: Vars }>) {
  app.use('*', async (c, next) => {
    c.set('trace_id', 'trace-rate-limit')
    await next()
  })
}

function makeApp(options: { namespace: RateLimitNamespace; limit: number; windowSec: number }) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()
  withTrace(app)
  app.use('*', rateLimit<Vars>(options))
  app.get('/probe', (c) => c.json({ ok: true }))
  return app
}

function failingKv(): KVNamespace {
  return {
    get: async () => {
      throw new Error('ACTIONS_KV unavailable')
    },
    put: async () => {
      throw new Error('ACTIONS_KV unavailable')
    },
  } as unknown as KVNamespace
}

describe('rateLimit middleware', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-02T18:00:10Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('limits requests by Cloudflare client IP and returns retry headers on 429', async () => {
    const app = makeApp({ namespace: 'auth', limit: 2, windowSec: 60 })
    const env = makeEnv(new KVMock() as unknown as KVNamespace)
    const headers = { 'cf-connecting-ip': '203.0.113.10' }

    const first = await app.fetch(new Request('http://local/probe', { headers }), env)
    const second = await app.fetch(new Request('http://local/probe', { headers }), env)
    const third = await app.fetch(new Request('http://local/probe', { headers }), env)

    expect(first.status).toBe(200)
    expect(first.headers.get('X-RateLimit-Limit')).toBe('2')
    expect(first.headers.get('X-RateLimit-Reset')).toBe('1780423260')
    expect(second.status).toBe(200)
    expect(third.status).toBe(429)
    expect(third.headers.get('X-RateLimit-Remaining')).toBe('0')
    expect(third.headers.get('Retry-After')).toBe('50')
    await expect(third.json()).resolves.toMatchObject({
      ok: false,
      error: { code: 'rate_limited', retryAfter: 50 },
      trace_id: 'trace-rate-limit',
    })
  })

  it('ignores attacker-controlled forwarding headers when cf-connecting-ip is absent', async () => {
    const app = makeApp({ namespace: 'auth', limit: 1, windowSec: 60 })
    const env = makeEnv(new KVMock() as unknown as KVNamespace)

    const first = await app.fetch(
      new Request('http://local/probe', { headers: { 'x-forwarded-for': '198.51.100.10' } }),
      env,
    )
    const second = await app.fetch(
      new Request('http://local/probe', { headers: { 'x-forwarded-for': '198.51.100.99' } }),
      env,
    )

    expect(first.status).toBe(200)
    expect(second.status).toBe(429)
  })

  it('keeps rate-limit namespaces isolated for the same IP', async () => {
    const app = new Hono<{ Bindings: Env; Variables: Vars }>()
    withTrace(app)
    app.use('/auth/*', rateLimit<Vars>({ namespace: 'auth', limit: 1, windowSec: 60 }))
    app.use('/join/*', rateLimit<Vars>({ namespace: 'join', limit: 1, windowSec: 60 }))
    app.get('/auth/probe', (c) => c.json({ route: 'auth' }))
    app.get('/join/probe', (c) => c.json({ route: 'join' }))

    const env = makeEnv(new KVMock() as unknown as KVNamespace)
    const headers = { 'cf-connecting-ip': '203.0.113.20' }

    expect((await app.fetch(new Request('http://local/auth/probe', { headers }), env)).status).toBe(200)
    expect((await app.fetch(new Request('http://local/auth/probe', { headers }), env)).status).toBe(429)
    expect((await app.fetch(new Request('http://local/join/probe', { headers }), env)).status).toBe(200)
  })

  it('fails open by default when ACTIONS_KV is unavailable', async () => {
    const app = makeApp({ namespace: 'auth', limit: 1, windowSec: 60 })
    const res = await app.fetch(
      new Request('http://local/probe', { headers: { 'cf-connecting-ip': '203.0.113.30' } }),
      makeEnv(failingKv()),
    )

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ ok: true })
  })

  it('fails closed with 503 when RATE_LIMIT_FAIL_CLOSED is enabled and KV fails', async () => {
    const app = makeApp({ namespace: 'auth', limit: 1, windowSec: 60 })
    const res = await app.fetch(
      new Request('http://local/probe', { headers: { 'cf-connecting-ip': '203.0.113.40' } }),
      makeEnv(failingKv(), { RATE_LIMIT_FAIL_CLOSED: 'true' } as Partial<Env>),
    )

    expect(res.status).toBe(503)
    await expect(res.json()).resolves.toMatchObject({
      ok: false,
      error: { code: 'rate_limit_unavailable' },
      trace_id: 'trace-rate-limit',
    })
  })
})
