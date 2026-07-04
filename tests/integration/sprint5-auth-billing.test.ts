import { describe, expect, it } from 'vitest'
import { createApp } from '../../functions/api/app'
import { signJwt } from '../../functions/api/lib/jwt'
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
      { ...env, STRIPE_SECRET_KEY: 'sk_test' } as Env,
    )
    expect(res.status).toBe(400)
  })
})
