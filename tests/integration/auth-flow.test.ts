import { describe, expect, it, vi } from 'vitest'
import { createApp } from '../../functions/api/app'
import { verifyJwt } from '../../functions/api/lib/jwt'
import type { Env } from '../../functions/api/types'
import { D1Mock } from '../helpers/d1-mock'

function makeEnv(db: D1Mock): Env {
  return {
    ENV: 'dev',
    APP_URL: 'http://local',
    JWT_SECRET: 'integration-test-secret-at-least-32-bytes!',
    DB: db as unknown as D1Database,
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
    expect(cbRes.headers.get('location')).toBe('/')
    const setCookie = cbRes.headers.get('set-cookie')
    expect(setCookie).toBeTruthy()
    expect(setCookie).toContain('qesto_session=')
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie).toContain('SameSite=Lax')

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
    const meBody = (await meRes.json()) as { ok: boolean; data: { id: string; email: string } }
    expect(meBody.ok).toBe(true)
    expect(meBody.data.email).toBe('host@example.com')

    // 4. Replaying the same token is rejected (token was consumed).
    const replay = await app.fetch(
      new Request(`http://local/api/auth/callback?token=${raw}`, { redirect: 'manual' }),
      env,
    )
    expect(replay.status).toBe(302)
    expect(replay.headers.get('location')).toBe('/login?error=expired')
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
    expect(res.headers.get('location')).toBe('/login?error=invalid')
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
})

// Silence console noise from email fallback during tests.
vi.spyOn(console, 'log').mockImplementation(() => {})
