import { describe, expect, it } from 'vitest'
import { createApp } from '../../functions/api/app'
import { signJwt } from '../../functions/api/lib/jwt'
import type { Env } from '../../functions/api/types'
import { D1Mock } from '../helpers/d1-mock'
import { KVMock } from '../helpers/kv-mock'

const TEST_JWT_SECRET = 'integration-test-secret-at-least-32-bytes!'

function kv(): KVNamespace {
  return new KVMock() as unknown as KVNamespace
}

function makeEnv(db: D1Mock): Env {
  return {
    ENV: 'dev',
    PAGES_URL: 'http://local',
    API_URL: 'http://local',
    JWT_SECRET: TEST_JWT_SECRET,
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
    const jwt = await signJwt({ sub: 'u1', email: 'u1@example.com' }, TEST_JWT_SECRET, 3600)

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
    const jwt = await signJwt({ sub: 'u1', email: 'u1@example.com' }, TEST_JWT_SECRET, 3600)

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
    const jwt = await signJwt({ sub: 'u1', email: 'u1@example.com' }, TEST_JWT_SECRET, 3600)

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
    const jwt = await signJwt({ sub: 'u1', email: 'u1@example.com' }, TEST_JWT_SECRET, 3600)
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

  it('falls back to API_URL when PAGES_URL is missing', async () => {
    const db = new D1Mock()
    const app = createApp()
    const env = makeEnv(db)
    ;(env as unknown as { PAGES_URL?: string }).PAGES_URL = ''
    const jwt = await signJwt({ sub: 'u1', email: 'u1@example.com' }, TEST_JWT_SECRET, 3600)

    const res = await app.fetch(
      new Request('http://local/api/sessions', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: `qesto_session=${jwt}`,
          origin: 'http://local',
        },
        body: JSON.stringify({ title: 'fallback' }),
      }),
      env,
    )
    expect(res.status).toBe(201)
  })

  // Split-stack local dev (Vite on :5173 → `wrangler dev` API on :8787) is
  // allowed because the API itself answers on loopback. wrangler.toml ships
  // ENV="production", so this cannot key off ENV alone.
  it('allows localhost origin when the API is itself served from loopback', async () => {
    const db = new D1Mock()
    const app = createApp()
    const env = makeEnv(db)
    ;(env as unknown as { PAGES_URL: string; ENV: string }).PAGES_URL = 'https://qesto.cc'
    ;(env as unknown as { ENV: string }).ENV = 'production'
    const jwt = await signJwt({ sub: 'u1', email: 'u1@example.com' }, TEST_JWT_SECRET, 3600)

    const res = await app.fetch(
      new Request('http://localhost:8787/api/sessions', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: `qesto_session=${jwt}`,
          origin: 'http://localhost:5173',
        },
        body: JSON.stringify({ title: 'local-split' }),
      }),
      env,
    )
    expect(res.status).toBe(201)
  })

  // The same request against a DEPLOYED API is CSRF: a page on the victim's
  // localhost driving credentialed writes at production.
  it('rejects a localhost origin when the API is deployed', async () => {
    const db = new D1Mock()
    const app = createApp()
    const env = makeEnv(db)
    ;(env as unknown as { PAGES_URL: string; ENV: string }).PAGES_URL = 'https://qesto.cc'
    ;(env as unknown as { ENV: string }).ENV = 'production'
    const jwt = await signJwt({ sub: 'u1', email: 'u1@example.com' }, TEST_JWT_SECRET, 3600)

    const res = await app.fetch(
      new Request('https://qesto.cc/api/sessions', {
        method: 'POST',
        headers: {
          // text/plain keeps this a CORS "simple request" — no preflight fires,
          // so the CSRF middleware is the only control in the path.
          'content-type': 'text/plain',
          cookie: `qesto_session=${jwt}`,
          origin: 'http://localhost:5173',
        },
        body: JSON.stringify({ title: 'csrf' }),
      }),
      env,
    )
    expect(res.status).toBe(403)
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('forbidden_origin')
  })
})
