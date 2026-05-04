import { describe, expect, it, beforeEach } from 'vitest'
import { createApp } from '../../functions/api/app'
import { signJwt } from '../../functions/api/lib/jwt'
import type { Env } from '../../functions/api/types'
import { D1Mock } from '../helpers/d1-mock'
import { KVMock } from '../helpers/kv-mock'

const SECRET = 'integration-test-secret-at-least-32-bytes!'

function makeEnv(db: D1Mock, kv: KVMock): Env {
  return {
    ENV: 'dev',
    PAGES_URL: 'http://local',
    API_URL: 'http://local',
    JWT_SECRET: SECRET,
    DB: db as unknown as D1Database,
    SESSIONS_KV: kv as unknown as KVNamespace,
    USERS_KV: new KVMock() as unknown as KVNamespace,
    TEAMS_KV: new KVMock() as unknown as KVNamespace,
    TEMPLATES_KV: new KVMock() as unknown as KVNamespace,
    DECISIONS_KV: new KVMock() as unknown as KVNamespace,
    AUDIT_KV: new KVMock() as unknown as KVNamespace,
    ACTIONS_KV: new KVMock() as unknown as KVNamespace,
  } as unknown as Env
}

async function cookieFor(userId: string, email: string): Promise<string> {
  const token = await signJwt({ sub: userId, email }, SECRET, 3600)
  return `qesto_session=${token}`
}

describe('Plan Enforcement (BILL-04)', () => {
  let db: D1Mock
  let kv: KVMock
  let app: ReturnType<typeof createApp>
  let env: Env

  beforeEach(() => {
    db = new D1Mock()
    kv = new KVMock()
    app = createApp()
    env = makeEnv(db, kv)
  })

  it('free user can create 5 sessions per month', async () => {
    const userId = 'user_free_1'
    const email = 'free@example.com'
    const cookie = await cookieFor(userId, email)

    // Register user with free plan
    db.users.set(userId, {
      id: userId,
      email,
      display_name: 'Free User',
      created_at: Date.now(),
      last_login_at: null,
      plan: 'free',
    })

    // Create 5 sessions — all should succeed
    for (let i = 0; i < 5; i++) {
      const res = await app.fetch(
        new Request('http://local/api/sessions', {
          method: 'POST',
          headers: { 'content-type': 'application/json', cookie, 'idempotency-key': `free-${i}` },
          body: JSON.stringify({ title: `Session ${i + 1}` }),
        }),
        env,
      )
      expect(res.status).toBe(201)
      const body = (await res.json()) as { ok: boolean }
      expect(body.ok).toBe(true)
    }

    // 6th session should fail with 429
    const failRes = await app.fetch(
      new Request('http://local/api/sessions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie, 'idempotency-key': 'free-6' },
        body: JSON.stringify({ title: 'Session 6' }),
      }),
      env,
    )
    expect(failRes.status).toBe(429)
    const failBody = (await failRes.json()) as { ok: boolean; error: { code: string } }
    expect(failBody.ok).toBe(false)
    expect(failBody.error.code).toBe('quota_exceeded')
  })

  it('starter user can create 50 sessions per month', async () => {
    const userId = 'user_starter_1'
    const email = 'starter@example.com'
    const cookie = await cookieFor(userId, email)

    // Register user with starter plan
    db.users.set(userId, {
      id: userId,
      email,
      display_name: 'Starter User',
      created_at: Date.now(),
      last_login_at: null,
      plan: 'starter',
    })

    // Create 50 sessions — all should succeed.
    // Use a unique cf-connecting-ip per request so each gets its own rate-limit
    // bucket (rate limit is 30/hr per IP; quota is 50/month per user).
    for (let i = 0; i < 50; i++) {
      const res = await app.fetch(
        new Request('http://local/api/sessions', {
          method: 'POST',
          headers: { 'content-type': 'application/json', cookie, 'idempotency-key': `starter-${i}`, 'cf-connecting-ip': `10.${i}.0.1` },
          body: JSON.stringify({ title: `Session ${i + 1}` }),
        }),
        env,
      )
      expect(res.status).toBe(201)
    }

    // 51st session should fail with 429 (quota exceeded)
    const failRes = await app.fetch(
      new Request('http://local/api/sessions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie, 'idempotency-key': 'starter-51', 'cf-connecting-ip': '10.51.0.1' },
        body: JSON.stringify({ title: 'Session 51' }),
      }),
      env,
    )
    expect(failRes.status).toBe(429)
  })

  it('team user can create 500 sessions per month (effectively unlimited)', async () => {
    const userId = 'user_team_1'
    const email = 'team@example.com'
    const cookie = await cookieFor(userId, email)

    // Register user with team plan
    db.users.set(userId, {
      id: userId,
      email,
      display_name: 'Team User',
      created_at: Date.now(),
      last_login_at: null,
      plan: 'team',
    })

    // Create 500 sessions — all should succeed.
    // Unique IPs prevent hitting the 30/hr per-IP rate limit.
    for (let i = 0; i < 500; i++) {
      const res = await app.fetch(
        new Request('http://local/api/sessions', {
          method: 'POST',
          headers: { 'content-type': 'application/json', cookie, 'idempotency-key': `team-${i}`, 'cf-connecting-ip': `10.${Math.floor(i / 255)}.${i % 255}.1` },
          body: JSON.stringify({ title: `Session ${i + 1}` }),
        }),
        env,
      )
      expect(res.status).toBe(201)
    }

    // 501st session should fail with 429 (quota exceeded)
    const failRes = await app.fetch(
      new Request('http://local/api/sessions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie, 'idempotency-key': 'team-501', 'cf-connecting-ip': '10.1.255.1' },
        body: JSON.stringify({ title: 'Session 501' }),
      }),
      env,
    )
    expect(failRes.status).toBe(429)
  }, 15000)

  it('GET /api/plans/:userId/usage returns accurate quota usage', async () => {
    const userId = 'user_quota_test'
    const email = 'quota@example.com'
    const cookie = await cookieFor(userId, email)

    // Register user with starter plan
    db.users.set(userId, {
      id: userId,
      email,
      display_name: 'Quota Test',
      created_at: Date.now(),
      last_login_at: null,
      plan: 'starter',
    })

    // Create 3 sessions
    for (let i = 0; i < 3; i++) {
      await app.fetch(
        new Request('http://local/api/sessions', {
          method: 'POST',
          headers: { 'content-type': 'application/json', cookie, 'idempotency-key': `quota-${i}` },
          body: JSON.stringify({ title: `Session ${i + 1}` }),
        }),
        env,
      )
    }

    // Check quota usage
    const usageRes = await app.fetch(
      new Request(`http://local/api/plans/${userId}/usage`, { headers: { cookie } }),
      env,
    )
    expect(usageRes.status).toBe(200)
    const usageBody = (await usageRes.json()) as {
      ok: boolean
      data: {
        usage: { sessions_created: number; remaining: number }
        quotas: { max_sessions_per_month: number }
      }
    }
    expect(usageBody.ok).toBe(true)
    expect(usageBody.data.usage.sessions_created).toBe(3)
    expect(usageBody.data.usage.remaining).toBe(47) // 50 - 3
    expect(usageBody.data.quotas.max_sessions_per_month).toBe(50)
  })

  it('quota usage endpoint rejects cross-user access', async () => {
    const userId1 = 'user_a'
    const userId2 = 'user_b'
    const email = 'test@example.com'
    const cookie = await cookieFor(userId1, email)

    // Register user
    db.users.set(userId1, {
      id: userId1,
      email,
      display_name: 'User A',
      created_at: Date.now(),
      last_login_at: null,
      plan: 'free',
    })

    // Try to access another user's quota
    const failRes = await app.fetch(
      new Request(`http://local/api/plans/${userId2}/usage`, { headers: { cookie } }),
      env,
    )
    expect(failRes.status).toBe(403)
    const failBody = (await failRes.json()) as { ok: boolean; error: { code: string } }
    expect(failBody.error.code).toBe('forbidden')
  })
})
