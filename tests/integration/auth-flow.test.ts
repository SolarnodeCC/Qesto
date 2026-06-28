import { describe, expect, it, vi } from 'vitest'
import { createApp } from '../../functions/api/app'
import { signJwt, verifyJwt } from '../../functions/api/lib/jwt'
import type { Env } from '../../functions/api/types'
import { D1Mock } from '../helpers/d1-mock'
import { KVMock } from '../helpers/kv-mock'

function makeEnv(db: D1Mock, kv?: { users?: KVMock; actions?: KVMock }): Env {
  return {
    ENV: 'dev',
    PAGES_URL: 'http://local',
    API_URL: 'http://local',
    JWT_SECRET: 'integration-test-secret-at-least-32-bytes!',
    DB: db as unknown as D1Database,
    USERS_KV: (kv?.users ?? new KVMock()) as unknown as KVNamespace,
    ACTIONS_KV: (kv?.actions ?? new KVMock()) as unknown as KVNamespace,
  } as unknown as Env
}

describe('auth round-trip (request → callback → /api/auth/me)', () => {
  it('issues a cookie on valid callback and authenticates subsequent requests', async () => {
    const db = new D1Mock()
    const app = createApp()
    const env = makeEnv(db)

    // 1. Request magic link.
    const reqRes = await app.fetch(
      new Request('http://local/api/auth/request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'host@example.com' }),
      }),
      env,
    )
    expect(reqRes.status).toBe(202)
    const reqBody = (await reqRes.json()) as { ok: boolean }
    expect(reqBody.ok).toBe(true)
    expect(db.magicLinks.size).toBe(1)

    // Reconstruct the raw token — we can't read it from the DB (only the hash
    // is persisted). For the integration test we spy on console.log since
    // sendEmail falls back to logging in dev (no RESEND_API_KEY). Easier:
    // bypass the callback by computing a new raw token and calling the
    // internals directly — BUT that doesn't test the full flow. Instead we
    // generate the raw token deterministically by seeding it via a monkey patch.
    // Simpler path: call generateMagicLinkToken ourselves and inject its hash
    // into the DB to simulate what /request did.
    //
    // So we replace the above with a direct injection below to preserve the
    // "callback + cookie + /me" contract.
    db.magicLinks.clear()

    const { generateMagicLinkToken, hashMagicLinkToken } = await import('../../functions/api/lib/tokens')
    const raw = generateMagicLinkToken()
    const hash = await hashMagicLinkToken(raw)
    const now = Date.now()
    db.magicLinks.set(hash, {
      token_hash: hash,
      email: 'host@example.com',
      created_at: now,
      expires_at: now + 15 * 60 * 1000,
      consumed_at: null,
      requester_ip: null,
    })

    // 2. Hit the callback with the raw token.
    const cbRes = await app.fetch(
      new Request(`http://local/api/auth/callback?token=${raw}`, { redirect: 'manual' }),
      env,
    )
    expect(cbRes.status).toBe(302)
    expect(cbRes.headers.get('location')).toBe('http://local/')
    const setCookie = cbRes.headers.get('set-cookie')
    expect(setCookie).toBeTruthy()
    expect(setCookie).toContain('qesto_session=')
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie).toContain('SameSite=None')

    // Token is now consumed.
    expect(db.magicLinks.get(hash)?.consumed_at).not.toBeNull()
    // User was upserted.
    expect(db.users.size).toBe(1)

    // 3. Extract the cookie and call /api/auth/me.
    const jwt = (setCookie ?? '').match(/qesto_session=([^;]+)/)?.[1]
    expect(jwt).toBeTruthy()
    const claims = await verifyJwt(jwt!, env.JWT_SECRET)
    expect(claims?.email).toBe('host@example.com')

    const meRes = await app.fetch(
      new Request('http://local/api/auth/me', { headers: { cookie: `qesto_session=${jwt}` } }),
      env,
    )
    expect(meRes.status).toBe(200)
    const meBody = (await meRes.json()) as {
      ok: boolean
      data: { id: string; email: string; plan: string; isAdmin: boolean; townhallEnabled: boolean }
    }
    expect(meBody.ok).toBe(true)
    expect(meBody.data.email).toBe('host@example.com')
    // New users default to the free tier.
    expect(meBody.data.plan).toBe('free')
    // #586: a plain user has no platform-admin authority. The SPA gates /admin on this.
    expect(meBody.data.isAdmin).toBe(false)
    // /me surfaces the town hall feature flag so the dashboard can gate its entry point.
    expect(meBody.data.townhallEnabled).toBe(env.REALTIME_TOWNHALL_ENABLED === 'true')

    // 4. Replaying the same token is rejected (token was consumed).
    const replay = await app.fetch(
      new Request(`http://local/api/auth/callback?token=${raw}`, { redirect: 'manual' }),
      env,
    )
    expect(replay.status).toBe(302)
    expect(replay.headers.get('location')).toBe('http://local/login?error=expired')
  })

  it('rejects invalid emails with 400', async () => {
    const db = new D1Mock()
    const app = createApp()
    const env = makeEnv(db)
    const res = await app.fetch(
      new Request('http://local/api/auth/request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'nope' }),
      }),
      env,
    )
    expect(res.status).toBe(400)
    const body = (await res.json()) as { ok: boolean; error: { code: string } }
    expect(body.ok).toBe(false)
    expect(body.error.code).toBe('validation')
    expect(db.magicLinks.size).toBe(0)
  })

  it('returns 401 from /api/auth/me without a cookie', async () => {
    const db = new D1Mock()
    const app = createApp()
    const res = await app.fetch(new Request('http://local/api/auth/me'), makeEnv(db))
    expect(res.status).toBe(401)
    const body = (await res.json()) as { ok: boolean; error: { code: string } }
    expect(body.error.code).toBe('unauthenticated')
  })

  it('/api/auth/me reports isAdmin:true for an env-allowlisted superuser (#586)', async () => {
    const db = new D1Mock()
    const app = createApp()
    const env = makeEnv(db)
    env.SUPERUSER_EMAIL = 'root@example.com'
    const jwt = await signJwt(
      { sub: 'root-id', email: 'root@example.com', jti: 'j1' },
      env.JWT_SECRET,
      3600,
    )
    const res = await app.fetch(
      new Request('http://local/api/auth/me', { headers: { cookie: `qesto_session=${jwt}` } }),
      env,
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean; data: { isAdmin: boolean } }
    expect(body.data.isAdmin).toBe(true)
  })

  it('returns 401 from /api/auth/me with an invalid cookie', async () => {
    const db = new D1Mock()
    const app = createApp()
    const res = await app.fetch(
      new Request('http://local/api/auth/me', { headers: { cookie: 'qesto_session=not.a.valid.jwt' } }),
      makeEnv(db),
    )
    expect(res.status).toBe(401)
  })

  it('redirects to /login?error=invalid for malformed callback tokens', async () => {
    const db = new D1Mock()
    const app = createApp()
    const res = await app.fetch(
      new Request('http://local/api/auth/callback?token=short', { redirect: 'manual' }),
      makeEnv(db),
    )
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('http://local/login?error=invalid')
  })

  it('logout clears the cookie', async () => {
    const db = new D1Mock()
    const app = createApp()
    const res = await app.fetch(
      new Request('http://local/api/auth/logout', { method: 'POST' }),
      makeEnv(db),
    )
    expect(res.status).toBe(200)
    const setCookie = res.headers.get('set-cookie') ?? ''
    expect(setCookie).toContain('qesto_session=')
    expect(setCookie).toMatch(/Max-Age=0|expires=Thu, 01 Jan 1970/i)
  })

  it('refresh issues a new cookie and revokes the previous session token', async () => {
    const db = new D1Mock()
    const app = createApp()
    const env = makeEnv(db)

    const reqRes = await app.fetch(
      new Request('http://local/api/auth/request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'refresh@example.com' }),
      }),
      env,
    )
    expect(reqRes.status).toBe(202)

    db.magicLinks.clear()
    const { generateMagicLinkToken, hashMagicLinkToken } = await import('../../functions/api/lib/tokens')
    const raw = generateMagicLinkToken()
    const hash = await hashMagicLinkToken(raw)
    const now = Date.now()
    db.magicLinks.set(hash, {
      token_hash: hash,
      email: 'refresh@example.com',
      created_at: now,
      expires_at: now + 15 * 60 * 1000,
      consumed_at: null,
      requester_ip: null,
    })

    const cbRes = await app.fetch(
      new Request(`http://local/api/auth/callback?token=${raw}`, { redirect: 'manual' }),
      env,
    )
    const oldSetCookie = cbRes.headers.get('set-cookie') ?? ''
    const oldJwt = oldSetCookie.match(/qesto_session=([^;]+)/)?.[1]
    expect(oldJwt).toBeTruthy()

    const refreshRes = await app.fetch(
      new Request('http://local/api/auth/refresh', {
        method: 'POST',
        headers: { cookie: `qesto_session=${oldJwt}` },
      }),
      env,
    )
    expect(refreshRes.status).toBe(200)
    const newSetCookie = refreshRes.headers.get('set-cookie') ?? ''
    const newJwt = newSetCookie.match(/qesto_session=([^;]+)/)?.[1]
    expect(newJwt).toBeTruthy()

    const oldMe = await app.fetch(
      new Request('http://local/api/auth/me', { headers: { cookie: `qesto_session=${oldJwt}` } }),
      env,
    )
    expect(oldMe.status).toBe(401)

    const newMe = await app.fetch(
      new Request('http://local/api/auth/me', { headers: { cookie: `qesto_session=${newJwt}` } }),
      env,
    )
    expect(newMe.status).toBe(200)
  })
})

describe('password signup + login', () => {
  it('signs up a new user and returns 201 with a session cookie', async () => {
    const db = new D1Mock()
    const usersKv = new KVMock()
    const app = createApp()
    const env = makeEnv(db, { users: usersKv })

    const res = await app.fetch(
      new Request('http://local/api/auth/password/signup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'alice@example.com', password: 'hunter12345', name: 'Alice' }),
      }),
      env,
    )
    expect(res.status).toBe(201)
    const body = (await res.json()) as { ok: boolean }
    expect(body.ok).toBe(true)
    expect(db.users.size).toBe(1)
    const [user] = [...db.users.values()]
    expect(user.email).toBe('alice@example.com')
    expect(user.display_name).toBe('Alice')
    expect(usersKv.has(`pwd:${user.id}`)).toBe(true)
    const cookie = res.headers.get('set-cookie') ?? ''
    expect(cookie).toContain('qesto_session=')
  })

  it('rejects duplicate email with 409', async () => {
    const db = new D1Mock()
    const usersKv = new KVMock()
    const app = createApp()
    const env = makeEnv(db, { users: usersKv })

    const body = JSON.stringify({ email: 'bob@example.com', password: 'hunter12345' })
    const headers = { 'content-type': 'application/json' }
    await app.fetch(new Request('http://local/api/auth/password/signup', { method: 'POST', headers, body }), env)
    const res2 = await app.fetch(new Request('http://local/api/auth/password/signup', { method: 'POST', headers, body }), env)
    expect(res2.status).toBe(409)
    const resp = (await res2.json()) as { ok: boolean; error: { code: string } }
    expect(resp.ok).toBe(false)
    expect(resp.error.code).toBe('email_taken')
  })

  it('rejects passwords shorter than 8 chars with 400', async () => {
    const db = new D1Mock()
    const app = createApp()
    const res = await app.fetch(
      new Request('http://local/api/auth/password/signup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'carol@example.com', password: 'short' }),
      }),
      makeEnv(db),
    )
    expect(res.status).toBe(400)
    const body = (await res.json()) as { ok: boolean; error: { code: string } }
    expect(body.error.code).toBe('validation')
  })

  it('logs in with correct password and returns 200 with cookie', async () => {
    const db = new D1Mock()
    const usersKv = new KVMock()
    const app = createApp()
    const env = makeEnv(db, { users: usersKv })

    // Sign up first.
    await app.fetch(
      new Request('http://local/api/auth/password/signup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'dave@example.com', password: 'correcthorse' }),
      }),
      env,
    )

    const res = await app.fetch(
      new Request('http://local/api/auth/password/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'dave@example.com', password: 'correcthorse' }),
      }),
      env,
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean }
    expect(body.ok).toBe(true)
    expect(res.headers.get('set-cookie')).toContain('qesto_session=')
  })

  it('rejects wrong password with 401', async () => {
    const db = new D1Mock()
    const usersKv = new KVMock()
    const app = createApp()
    const env = makeEnv(db, { users: usersKv })

    await app.fetch(
      new Request('http://local/api/auth/password/signup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'eve@example.com', password: 'rightpassword' }),
      }),
      env,
    )

    const res = await app.fetch(
      new Request('http://local/api/auth/password/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'eve@example.com', password: 'wrongpassword' }),
      }),
      env,
    )
    expect(res.status).toBe(401)
    const body = (await res.json()) as { ok: boolean; error: { code: string } }
    expect(body.error.code).toBe('invalid_credentials')
  })

  it('returns 401 for unknown email on login', async () => {
    const db = new D1Mock()
    const app = createApp()
    const res = await app.fetch(
      new Request('http://local/api/auth/password/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'ghost@example.com', password: 'doesnotmatter' }),
      }),
      makeEnv(db),
    )
    expect(res.status).toBe(401)
  })
})

describe('password reset flow', () => {
  it('accepts reset-request and writes a reset token for existing users', async () => {
    const db = new D1Mock()
    const usersKv = new KVMock()
    const actionsKv = new KVMock()
    const app = createApp()
    const env = makeEnv(db, { users: usersKv, actions: actionsKv })

    await app.fetch(
      new Request('http://local/api/auth/password/signup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'resetme@example.com', password: 'hunter12345' }),
      }),
      env,
    )

    const res = await app.fetch(
      new Request('http://local/api/auth/password/reset-request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'resetme@example.com' }),
      }),
      env,
    )
    expect(res.status).toBe(202)
    expect(actionsKv.keys().some((k) => k.startsWith('pwd-reset:'))).toBe(true)
  })

  it('resets password with a valid token and consumes the reset token', async () => {
    const db = new D1Mock()
    const usersKv = new KVMock()
    const actionsKv = new KVMock()
    const app = createApp()
    const env = makeEnv(db, { users: usersKv, actions: actionsKv })

    const signupRes = await app.fetch(
      new Request('http://local/api/auth/password/signup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'reset2@example.com', password: 'oldpassword123' }),
      }),
      env,
    )
    const signupBody = (await signupRes.json()) as { ok: boolean; data: { id: string } }
    const userId = signupBody.data.id

    const { hashMagicLinkToken } = await import('../../functions/api/lib/tokens')
    const raw = 'a'.repeat(64)
    const tokenHash = await hashMagicLinkToken(raw)
    await actionsKv.put(`pwd-reset:${tokenHash}`, JSON.stringify({ userId, email: 'reset2@example.com' }))

    const resetRes = await app.fetch(
      new Request('http://local/api/auth/password/reset-confirm', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: raw, password: 'newpassword123' }),
      }),
      env,
    )
    expect(resetRes.status).toBe(200)
    expect(actionsKv.has(`pwd-reset:${tokenHash}`)).toBe(false)

    const loginRes = await app.fetch(
      new Request('http://local/api/auth/password/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'reset2@example.com', password: 'newpassword123' }),
      }),
      env,
    )
    expect(loginRes.status).toBe(200)
  })
})

// Silence console noise from email fallback during tests.
vi.spyOn(console, 'log').mockImplementation(() => {})
