/**
 * Requirement: issue #882 (DD-09 follow-up) — "sign out of all other devices"
 * invalidates every outstanding session token for the user via the session
 * epoch, while the caller's own device receives a fresh, valid session.
 */
import { describe, expect, it, vi, afterEach } from 'vitest'
import { createApp } from '../../functions/api/app'
import { signJwt } from '../../functions/api/lib/jwt'
import type { Env } from '../../functions/api/types'
import { D1Mock } from '../helpers/d1-mock'
import { KVMock } from '../helpers/kv-mock'

// jankurai:allow HLT-010-SECRET-SPRAWL reason="local HMAC key for test-only JWTs, never used outside this suite" expires=2027-12-31
const SECRET = 'integration-test-secret-at-least-32-bytes!'

function makeEnv(): Env {
  const kv = () => new KVMock() as unknown as KVNamespace
  return {
    ENV: 'dev',
    PAGES_URL: 'http://local',
    API_URL: 'http://local',
    JWT_SECRET: SECRET,
    DB: new D1Mock() as unknown as D1Database,
    USERS_KV: kv(),
    SESSIONS_KV: kv(),
    TEAMS_KV: kv(),
    TEMPLATES_KV: kv(),
    DECISIONS_KV: kv(),
    AUDIT_KV: kv(),
    ACTIONS_KV: kv(),
  } as unknown as Env
}

function me(app: ReturnType<typeof createApp>, env: Env, token: string) {
  return app.fetch(new Request('http://local/api/auth/me', { headers: { authorization: `Bearer ${token}` } }), env)
}

describe('POST /api/auth/sessions/revoke-others', () => {
  afterEach(() => vi.useRealTimers())

  it('invalidates older tokens and returns a working one for this device', async () => {
    const app = createApp()
    const env = makeEnv()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-27T10:00:00Z'))
    const otherDevice = await signJwt({ sub: 'u1', email: 'u1@example.com' }, SECRET, 3600)
    const thisDevice = await signJwt({ sub: 'u1', email: 'u1@example.com' }, SECRET, 3600)
    expect((await me(app, env, otherDevice)).status).toBe(200)

    vi.setSystemTime(new Date('2026-10-27T10:05:00Z'))
    const res = await app.fetch(
      new Request('http://local/api/auth/sessions/revoke-others', {
        method: 'POST',
        headers: { authorization: `Bearer ${thisDevice}` },
      }),
      env,
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { data: { token: string } }
    expect(res.headers.get('set-cookie')).toContain('qesto_session=')

    expect((await me(app, env, otherDevice)).status).toBe(401)
    expect((await me(app, env, thisDevice)).status).toBe(401)
    expect((await me(app, env, body.data.token)).status).toBe(200)
  })

  it('requires authentication', async () => {
    const res = await createApp().fetch(
      new Request('http://local/api/auth/sessions/revoke-others', { method: 'POST' }),
      makeEnv(),
    )
    expect(res.status).toBe(401)
  })
})
