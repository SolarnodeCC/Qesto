/**
 * Requirement: issue #882/#895 follow-up - logout must revoke cookie-backed
 * sessions, every token presented on the request, and any active impersonation
 * token, not only the Authorization bearer.
 */
import { describe, expect, it } from 'vitest'
import { createApp } from '../../functions/api/app'
import {
  activeImpersonationKey,
  mintImpersonationToken,
  resolveImpersonation,
} from '../../functions/api/lib/impersonation'
import { signJwt } from '../../functions/api/lib/jwt'
import { hashSessionToken, revokedSessionTokenKey } from '../../functions/api/lib/session-token'
import type { Env } from '../../functions/api/types'
import { D1Mock } from '../helpers/d1-mock'
import { KVMock } from '../helpers/kv-mock'

// jankurai:allow HLT-010-SECRET-SPRAWL reason="local HMAC key for test-only JWTs, never used outside this suite" expires=2027-12-31
const SECRET = 'integration-test-secret-at-least-32-bytes!'
const MARKER_HEADERS = { 'x-qesto-client': 'web' }

function makeEnv(actionsKv = new KVMock()): Env {
  const db = new D1Mock()
  db.users.set('u1', {
    id: 'u1',
    email: 'u1@example.com',
    display_name: null,
    created_at: 1,
    last_login_at: null,
    plan: 'free',
    email_verified_at: 1,
  })
  return {
    ENV: 'dev',
    PAGES_URL: 'http://local',
    API_URL: 'http://local',
    JWT_SECRET: SECRET,
    SEED_ADMIN_EMAIL: 'admin@example.com',
    DB: db as unknown as D1Database,
    USERS_KV: new KVMock() as unknown as KVNamespace,
    SESSIONS_KV: new KVMock() as unknown as KVNamespace,
    TEAMS_KV: new KVMock() as unknown as KVNamespace,
    TEMPLATES_KV: new KVMock() as unknown as KVNamespace,
    DECISIONS_KV: new KVMock() as unknown as KVNamespace,
    AUDIT_KV: new KVMock() as unknown as KVNamespace,
    ACTIONS_KV: actionsKv as unknown as KVNamespace,
  } as unknown as Env
}

function me(app: ReturnType<typeof createApp>, env: Env, token: string) {
  return app.fetch(new Request('http://local/api/auth/me', { headers: { cookie: `qesto_session=${token}` } }), env)
}

function logout(app: ReturnType<typeof createApp>, env: Env, cookie: string, authorization?: string) {
  return app.fetch(
    new Request('http://local/api/auth/logout', {
      method: 'POST',
      headers: {
        ...MARKER_HEADERS,
        cookie,
        ...(authorization ? { authorization } : {}),
      },
    }),
    env,
  )
}

describe('POST /api/auth/logout', () => {
  it('revokes a cookie-only session and clears it with cross-site cookie attributes', async () => {
    const app = createApp()
    const actionsKv = new KVMock()
    const env = makeEnv(actionsKv)
    const token = await signJwt({ sub: 'u1', email: 'u1@example.com', jti: 'cookie-only' }, SECRET, 3600)

    expect((await me(app, env, token)).status).toBe(200)
    const res = await logout(app, env, `qesto_session=${token}`)

    expect(res.status).toBe(200)
    const setCookie = res.headers.get('set-cookie') ?? ''
    expect(setCookie).toContain('qesto_session=')
    expect(setCookie).toContain('Max-Age=0')
    expect(setCookie).toContain('SameSite=None')
    expect(setCookie).toContain('Secure')
    expect(actionsKv.has(revokedSessionTokenKey(await hashSessionToken(token)))).toBe(true)
    expect((await me(app, env, token)).status).toBe(401)
  })

  it('revokes both cookie and Authorization tokens from the same logout request', async () => {
    const app = createApp()
    const env = makeEnv()
    const cookieToken = await signJwt({ sub: 'u1', email: 'u1@example.com', jti: 'cookie' }, SECRET, 3600)
    const bearerToken = await signJwt({ sub: 'u1', email: 'u1@example.com', jti: 'bearer' }, SECRET, 3600)

    expect((await me(app, env, cookieToken)).status).toBe(200)
    expect((await me(app, env, bearerToken)).status).toBe(200)

    const res = await logout(app, env, `qesto_session=${cookieToken}`, `Bearer ${bearerToken}`)

    expect(res.status).toBe(200)
    expect((await me(app, env, cookieToken)).status).toBe(401)
    expect((await me(app, env, bearerToken)).status).toBe(401)
  })

  it('clears the impersonation cookie and unregisters the active impersonation', async () => {
    const app = createApp()
    const actionsKv = new KVMock()
    const env = makeEnv(actionsKv)
    const { token, jti } = await mintImpersonationToken(env, {
      adminId: 'admin-1',
      adminEmail: 'admin@example.com',
      target: { id: 'u1', email: 'u1@example.com' },
    })

    expect(await resolveImpersonation(env, token)).not.toBeNull()
    expect(actionsKv.has(activeImpersonationKey(jti))).toBe(true)

    const res = await logout(app, env, `qesto_impersonation=${token}`)

    expect(res.status).toBe(200)
    const setCookie = res.headers.get('set-cookie') ?? ''
    expect(setCookie).toContain('qesto_impersonation=')
    expect(setCookie).toContain('SameSite=None')
    expect(actionsKv.has(activeImpersonationKey(jti))).toBe(false)
    expect(await resolveImpersonation(env, token)).toBeNull()
  })
})
