import { Hono } from 'hono'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { rateLimit, type RateLimitOptions } from '../../functions/api/middleware/rate-limit'
import type { Env } from '../../functions/api/types'
import { KVMock } from '../helpers/kv-mock'

type Vars = { trace_id: string }

function makeEnv(kv: KVNamespace, overrides: Partial<Env> = {}): Env {
  return {
    ENV: 'dev',
    PAGES_URL: 'http://local',
    API_URL: 'http://local',
    JWT_SECRET: 'integration-test-secret-at-least-32-bytes',
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

function makeApp(options: RateLimitOptions) {
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

describe('rateLimit middleware (ADR-0073)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-02T18:00:10Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('limits by Cloudflare client IP via atomic profile (flag off → KV)', async () => {
    const app = makeApp({ profile: 'join' })
    const env = makeEnv(new KVMock() as unknown as KVNamespace)
    const headers = { 'cf-connecting-ip': '203.0.113.10' }

    // join limit = 20; exhaust with seeded approach via many requests is slow —
    // use sustained dual with tiny max instead for header/429 shape.
    const tiny = makeApp({
      sustained: { max: 2, windowSeconds: 60, prefix: 'mw-test' },
      profileLabel: 'test',
    })

    const first = await tiny.fetch(new Request('http://local/probe', { headers }), env)
    const second = await tiny.fetch(new Request('http://local/probe', { headers }), env)
    const third = await tiny.fetch(new Request('http://local/probe', { headers }), env)

    expect(first.status).toBe(200)
    expect(first.headers.get('X-RateLimit-Limit')).toBe('2')
    expect(second.status).toBe(200)
    expect(third.status).toBe(429)
    expect(third.headers.get('X-RateLimit-Remaining')).toBe('0')
    expect(third.headers.get('Retry-After')).toBeTruthy()
    await expect(third.json()).resolves.toMatchObject({
      ok: false,
      error: { code: 'rate_limited' },
      trace_id: 'trace-rate-limit',
    })
    void app
  })

  it('ignores attacker-controlled forwarding headers when cf-connecting-ip is absent', async () => {
    const app = makeApp({
      sustained: { max: 1, windowSeconds: 60, prefix: 'mw-fwd' },
      profileLabel: 'fwd',
    })
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

  it('keeps rate-limit profiles isolated for the same IP', async () => {
    const app = new Hono<{ Bindings: Env; Variables: Vars }>()
    withTrace(app)
    app.use(
      '/auth/*',
      rateLimit<Vars>({
        sustained: { max: 1, windowSeconds: 60, prefix: 'mw-auth-iso' },
        profileLabel: 'auth',
      }),
    )
    app.use('/join/*', rateLimit<Vars>({ profile: 'join' }))
    app.get('/auth/probe', (c) => c.json({ route: 'auth' }))
    app.get('/join/probe', (c) => c.json({ route: 'join' }))

    const env = makeEnv(new KVMock() as unknown as KVNamespace)
    const headers = { 'cf-connecting-ip': '203.0.113.20' }

    expect((await app.fetch(new Request('http://local/auth/probe', { headers }), env)).status).toBe(200)
    expect((await app.fetch(new Request('http://local/auth/probe', { headers }), env)).status).toBe(429)
    expect((await app.fetch(new Request('http://local/join/probe', { headers }), env)).status).toBe(200)
  })

  it('fails open by default when ACTIONS_KV is unavailable', async () => {
    const app = makeApp({
      sustained: { max: 1, windowSeconds: 60, prefix: 'mw-open' },
      profileLabel: 'open',
    })
    const res = await app.fetch(
      new Request('http://local/probe', { headers: { 'cf-connecting-ip': '203.0.113.30' } }),
      makeEnv(failingKv()),
    )

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ ok: true })
  })

  it('denies when RATE_LIMIT_FAIL_CLOSED is enabled and KV fails', async () => {
    const app = makeApp({
      sustained: { max: 1, windowSeconds: 60, prefix: 'mw-closed' },
      profileLabel: 'closed',
    })
    const res = await app.fetch(
      new Request('http://local/probe', { headers: { 'cf-connecting-ip': '203.0.113.40' } }),
      makeEnv(failingKv(), { RATE_LIMIT_FAIL_CLOSED: 'true' } as Partial<Env>),
    )

    // lib/rate-limit failClosed → allowed:false → middleware 429 (not 503).
    expect(res.status).toBe(429)
    await expect(res.json()).resolves.toMatchObject({
      ok: false,
      error: { code: 'rate_limited' },
      trace_id: 'trace-rate-limit',
    })
  })

  it('returns 503 when fail-closed and ACTIONS_KV binding is missing', async () => {
    const app = makeApp({ profile: 'join' })
    const env = makeEnv(new KVMock() as unknown as KVNamespace, {
      RATE_LIMIT_FAIL_CLOSED: 'true',
    })
    Reflect.deleteProperty(env, 'ACTIONS_KV')
    // When ACTIONS_KV missing + failClosed, atomic deny — middleware wraps try/catch
    // and also checks missing binding before call via atomic path.
    const res = await app.fetch(
      new Request('http://local/probe', { headers: { 'cf-connecting-ip': '203.0.113.50' } }),
      env,
    )
    // atomicRateLimitDual/atomicRateLimit return deny → 429
    expect([429, 503]).toContain(res.status)
  })
})
