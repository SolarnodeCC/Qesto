/**
 * Requirement: knowledge-base/specifications/domain/SPEC_BACKEND.md §1 Auth + §9 Billing — route contracts (S5 regression guard).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../../functions/api/app'
import { signJwt } from '../../functions/api/lib/jwt'
import { STRIPE_DISABLED_CODE } from '../../functions/api/lib/integrations-policy'
import type { Env } from '../../functions/api/types'
import { D1Mock } from '../helpers/d1-mock'
import { KVMock } from '../helpers/kv-mock'

const TEST_JWT_SECRET = 'integration-test-secret-at-least-32-bytes!'

function makeEnv(db: D1Mock): Env {
  return {
    ENV: 'dev',
    PAGES_URL: 'http://local',
    API_URL: 'http://local',
    JWT_SECRET: TEST_JWT_SECRET,
    DB: db as unknown as D1Database,
    USERS_KV: new KVMock() as unknown as KVNamespace,
    SESSIONS_KV: new KVMock() as unknown as KVNamespace,
    TEAMS_KV: new KVMock() as unknown as KVNamespace,
    TEMPLATES_KV: new KVMock() as unknown as KVNamespace,
    DECISIONS_KV: new KVMock() as unknown as KVNamespace,
    AUDIT_KV: new KVMock() as unknown as KVNamespace,
    ACTIONS_KV: new KVMock() as unknown as KVNamespace,
  } as unknown as Env
}

async function cookieFor(userId: string, email: string): Promise<string> {
  const token = await signJwt({ sub: userId, email }, TEST_JWT_SECRET, 3600)
  return `qesto_session=${token}`
}

describe('Sprint 5 auth/billing routes', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('keeps Stripe payment routes disabled by default before any Stripe call', async () => {
    const db = new D1Mock()
    const app = createApp()
    const env = {
      ...makeEnv(db),
      STRIPE_SECRET_KEY: 'sk_test_should_not_be_used',
    } as Env
    db.users.set('u0', {
      id: 'u0',
      email: 'u0@example.com',
      display_name: 'U0',
      created_at: Date.now(),
      last_login_at: null,
      plan: 'starter',
    })
    const cookie = await cookieFor('u0', 'u0@example.com')
    const fetchSpy = vi.fn(() => {
      throw new Error('Stripe fetch must not be called when payments are disabled')
    })
    vi.stubGlobal('fetch', fetchSpy)

    const routes = [
      { method: 'POST', path: '/api/billing/portal' },
      { method: 'GET', path: '/api/billing/invoices' },
      {
        method: 'POST',
        path: '/api/billing/subscription',
        body: { action: 'cancel' },
      },
      {
        method: 'POST',
        path: '/api/billing/checkout',
        body: { plan: 'starter', interval: 'monthly' },
      },
    ] as const

    for (const route of routes) {
      const headers: Record<string, string> = { cookie }
      const init: RequestInit = { method: route.method, headers }
      if ('body' in route) {
        headers['content-type'] = 'application/json'
        init.body = JSON.stringify(route.body)
      }

      const res = await app.fetch(new Request(`http://local${route.path}`, init), env)
      const json = await res.json() as { error?: { code?: string; message?: string } }

      expect(res.status, route.path).toBe(503)
      expect(json.error?.code, route.path).toBe(STRIPE_DISABLED_CODE)
      expect(json.error?.message, route.path).toContain('Stripe payments are disabled')
    }
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('rejects billing invoices when Stripe is not configured', async () => {
    const db = new D1Mock()
    const app = createApp()
    const env = makeEnv(db)
    db.users.set('u1', {
      id: 'u1',
      email: 'u1@example.com',
      display_name: 'U1',
      created_at: Date.now(),
      last_login_at: null,
      plan: 'starter',
    })
    const cookie = await cookieFor('u1', 'u1@example.com')
    const res = await app.fetch(new Request('http://local/api/billing/invoices', { headers: { cookie } }), env)
    expect(res.status).toBe(503)
  })

  it('rejects subscription change without a known Stripe subscription', async () => {
    const db = new D1Mock()
    const app = createApp()
    const env = makeEnv(db)
    db.users.set('u2', {
      id: 'u2',
      email: 'u2@example.com',
      display_name: 'U2',
      created_at: Date.now(),
      last_login_at: null,
      plan: 'starter',
    })
    const cookie = await cookieFor('u2', 'u2@example.com')
    const res = await app.fetch(
      new Request('http://local/api/billing/subscription', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ action: 'cancel' }),
      }),
      { ...env, STRIPE_SECRET_KEY: 'sk_test', STRIPE_PAYMENTS_ENABLED: 'true' } as Env,
    )
    expect(res.status).toBe(400)
  })
})
