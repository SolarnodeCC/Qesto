import { describe, expect, it } from 'vitest'
import { createApp } from '../../functions/api/app'
import { signJwt } from '../../functions/api/lib/jwt'
import type { Env } from '../../functions/api/types'
import { D1Mock } from '../helpers/d1-mock'
import { KVMock } from '../helpers/kv-mock'

const SECRET = 'integration-test-secret-at-least-32-bytes!'

function kv(): KVNamespace {
  return new KVMock() as unknown as KVNamespace
}

function makeEnv(db: D1Mock): Env {
  return {
    ENV: 'dev',
    PAGES_URL: 'http://local',
    API_URL: 'http://local',
    JWT_SECRET: SECRET,
    DB: db as unknown as D1Database,
    USERS_KV: kv(),
    SESSIONS_KV: kv(),
    TEAMS_KV: kv(),
    TEMPLATES_KV: kv(),
    DECISIONS_KV: kv(),
    AUDIT_KV: kv(),
    ACTIONS_KV: kv(),
  } as unknown as Env
}

describe('CSRF / Origin validation', () => {
  it('rejects POST with a mismatched Origin header', async () => {
    const db = new D1Mock()
    const app = createApp()
    const env = makeEnv(db)
    const jwt = await signJwt({ sub: 'u1', email: 'u1@example.com' }, SECRET, 3600)

    const res = await app.fetch(
      new Request('http://local/api/sessions', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: `qesto_session=${jwt}`,
          origin: 'https://evil.example',
        },
        body: JSON.stringify({ title: 'attack' }),
      }),
      env,
    )
    expect(res.status).toBe(403)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('forbidden_origin')
  })

  it('rejects PATCH with a mismatched Referer when no Origin is sent', async () => {
    const db = new D1Mock()
    const app = createApp()
    const env = makeEnv(db)
    const jwt = await signJwt({ sub: 'u1', email: 'u1@example.com' }, SECRET, 3600)

    const res = await app.fetch(
      new Request('http://local/api/sessions/abc', {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          cookie: `qesto_session=${jwt}`,
          referer: 'https://evil.example/page',
        },
        body: JSON.stringify({ title: 'x' }),
      }),
      env,
    )
    expect(res.status).toBe(403)
  })

  it('allows POST with a matching Origin', async () => {
    const db = new D1Mock()
    const app = createApp()
    const env = makeEnv(db)
    const jwt = await signJwt({ sub: 'u1', email: 'u1@example.com' }, SECRET, 3600)

    const res = await app.fetch(
      new Request('http://local/api/sessions', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: `qesto_session=${jwt}`,
          origin: 'http://local',
        },
        body: JSON.stringify({ title: 'good' }),
      }),
      env,
    )
    expect(res.status).toBe(201)
  })

  it('allows GET cross-origin (safe method)', async () => {
    const db = new D1Mock()
    const app = createApp()
    const env = makeEnv(db)
    const res = await app.fetch(
      new Request('http://local/api/admin/health', {
        headers: { origin: 'https://anywhere.example' },
      }),
      env,
    )
    expect(res.status).toBe(200)
  })

  it('allows POST with no Origin / Referer (non-browser client)', async () => {
    const db = new D1Mock()
    const app = createApp()
    const env = makeEnv(db)
    const jwt = await signJwt({ sub: 'u1', email: 'u1@example.com' }, SECRET, 3600)
    const res = await app.fetch(
      new Request('http://local/api/sessions', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: `qesto_session=${jwt}`,
        },
        body: JSON.stringify({ title: 'cli' }),
      }),
      env,
    )
    expect(res.status).toBe(201)
  })
})
