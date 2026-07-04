import { describe, expect, it } from 'vitest'
import { createApp } from '../../functions/api/app'
import { signJwt } from '../../functions/api/lib/jwt'
import type { Env } from '../../functions/api/types'
import { D1Mock } from '../helpers/d1-mock'
import { KVMock } from '../helpers/kv-mock'

// Route-level tests for the Platformbeheer modules: auth-gating, CSV export
// branches, confirm-flag validation, and the threshold merge. These exercise
// the real Hono stack (auth → admin → csrf → rate-limit → handler), which the
// pure-unit tests don't cover.

const TEST_JWT_SECRET = 'integration-test-secret-at-least-32-bytes!'
const ADMIN_EMAIL = 'admin@example.com'
const ADMIN_ID = 'admin-user-1'

function kv(): KVNamespace {
  return new KVMock() as unknown as KVNamespace
}

function makeEnv(db: D1Mock): Env {
  return {
    ENV: 'dev',
    PAGES_URL: 'http://local',
    API_URL: 'http://local',
    JWT_SECRET: TEST_JWT_SECRET,
    SEED_ADMIN_EMAIL: ADMIN_EMAIL,
    DB: db as unknown as D1Database,
    USERS_KV: kv(),
    SESSIONS_KV: kv(),
    TEAMS_KV: kv(),
    TEMPLATES_KV: kv(),
    DECISIONS_KV: kv(),
    AUDIT_KV: kv(),
    ACTIONS_KV: kv(),
    METRICS_KV: kv(),
  } as unknown as Env
}

async function cookie(userId: string, email: string): Promise<string> {
  return `qesto_session=${await signJwt({ sub: userId, email }, TEST_JWT_SECRET, 3600)}`
}

function adminReq(path: string, init: RequestInit & { cookie: string }): Request {
  const { cookie: ck, ...rest } = init
  return new Request(`http://local${path}`, {
    ...rest,
    headers: { 'cf-connecting-ip': '127.0.0.1', cookie: ck, ...(rest.headers ?? {}) },
  })
}

describe('Platformbeheer — auth gating', () => {
  it('rejects an unauthenticated request with 401', async () => {
    const env = makeEnv(new D1Mock())
    const res = await createApp().fetch(new Request('http://local/api/admin/analytics/funnel', { headers: { 'cf-connecting-ip': '127.0.0.1' } }), env)
    expect(res.status).toBe(401)
  })

  it('rejects a non-admin user with 403', async () => {
    const env = makeEnv(new D1Mock())
    const res = await createApp().fetch(
      adminReq('/api/admin/analytics/funnel', { cookie: await cookie('plain-user', 'user@example.com') }),
      env,
    )
    expect(res.status).toBe(403)
  })

  it('allows a platform admin with 200', async () => {
    const env = makeEnv(new D1Mock())
    const res = await createApp().fetch(adminReq('/api/admin/analytics/funnel', { cookie: await cookie(ADMIN_ID, ADMIN_EMAIL) }), env)
    expect(res.status).toBe(200)
    const body = (await res.json()) as any
    expect(body.ok).toBe(true)
    expect(Array.isArray(body.data.funnel)).toBe(true)
    expect(body.data.funnel[0].key).toBe('signup')
  })
})

describe('Platformbeheer — Analytics CSV export', () => {
  it('returns CSV with attachment headers when format=csv', async () => {
    const env = makeEnv(new D1Mock())
    const res = await createApp().fetch(adminReq('/api/admin/analytics/funnel?format=csv', { cookie: await cookie(ADMIN_ID, ADMIN_EMAIL) }), env)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/csv')
    expect(res.headers.get('content-disposition')).toContain('attachment')
    const text = await res.text()
    expect(text.split('\r\n')[0]).toBe('key,label,count,conversion_from_prev_pct,drop_off_pct,conversion_from_top_pct')
  })

  it('exports retention and costs as CSV too', async () => {
    const env = makeEnv(new D1Mock())
    const app = createApp()
    for (const ds of ['retention', 'costs']) {
      const res = await app.fetch(adminReq(`/api/admin/analytics/${ds}?format=csv`, { cookie: await cookie(ADMIN_ID, ADMIN_EMAIL) }), env)
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toContain('text/csv')
    }
  })
})

describe('Platformbeheer — destructive confirm-flag validation', () => {
  it('rejects gdpr-delete without confirm:true (400)', async () => {
    const env = makeEnv(new D1Mock())
    const res = await createApp().fetch(
      adminReq('/api/admin/users/some-user/gdpr-delete', {
        method: 'POST',
        cookie: await cookie(ADMIN_ID, ADMIN_EMAIL),
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      }),
      env,
    )
    expect(res.status).toBe(400)
  })

  it('refuses self gdpr-delete even with confirm (400)', async () => {
    const env = makeEnv(new D1Mock())
    const res = await createApp().fetch(
      adminReq(`/api/admin/users/${ADMIN_ID}/gdpr-delete`, {
        method: 'POST',
        cookie: await cookie(ADMIN_ID, ADMIN_EMAIL),
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ confirm: true }),
      }),
      env,
    )
    expect(res.status).toBe(400)
  })
})

describe('Platformbeheer — impersonation', () => {
  it('refuses to impersonate yourself (400)', async () => {
    const env = makeEnv(new D1Mock())
    const res = await createApp().fetch(
      adminReq(`/api/admin/users/${ADMIN_ID}/impersonate`, {
        method: 'POST',
        cookie: await cookie(ADMIN_ID, ADMIN_EMAIL),
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      }),
      env,
    )
    expect(res.status).toBe(400)
  })

  it('an impersonation cookie wins over the session and surfaces on /me', async () => {
    const env = makeEnv(new D1Mock())
    // Admin's real session cookie + an impersonation cookie for a target user.
    const sessionCk = await cookie(ADMIN_ID, ADMIN_EMAIL)
    const impToken = await signJwt({ sub: 'target-7', email: 'target@example.com', jti: `imp:${ADMIN_ID}:abc` }, TEST_JWT_SECRET, 900)
    const res = await createApp().fetch(
      new Request('http://local/api/auth/me', {
        headers: { 'cf-connecting-ip': '127.0.0.1', cookie: `${sessionCk}; qesto_impersonation=${impToken}` },
      }),
      env,
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as any
    // Resolved as the target, not the admin — and flagged as impersonation.
    expect(body.data.email).toBe('target@example.com')
    expect(body.data.impersonating?.impersonator_id).toBe(ADMIN_ID)
  })

  it('ignores a non-impersonation token in the impersonation cookie (falls back to session)', async () => {
    const env = makeEnv(new D1Mock())
    const sessionCk = await cookie(ADMIN_ID, ADMIN_EMAIL)
    // A normal token (no imp: jti) in the impersonation cookie must be ignored.
    const bogus = await signJwt({ sub: 'attacker', email: 'attacker@example.com' }, TEST_JWT_SECRET, 900)
    const res = await createApp().fetch(
      new Request('http://local/api/auth/me', {
        headers: { 'cf-connecting-ip': '127.0.0.1', cookie: `${sessionCk}; qesto_impersonation=${bogus}` },
      }),
      env,
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as any
    expect(body.data.email).toBe(ADMIN_EMAIL)
    expect(body.data.impersonating).toBeUndefined()
  })

  it('stop is auth-only and idempotent when not impersonating (200)', async () => {
    const env = makeEnv(new D1Mock())
    const res = await createApp().fetch(
      adminReq('/api/admin/impersonation/stop', {
        method: 'POST',
        cookie: await cookie(ADMIN_ID, ADMIN_EMAIL),
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      }),
      env,
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as any
    expect(body.data.stopped).toBe(true)
  })
})

describe('Platformbeheer — observability thresholds', () => {
  it('GET returns defaults for an admin (200)', async () => {
    const env = makeEnv(new D1Mock())
    const res = await createApp().fetch(adminReq('/api/admin/observability/thresholds', { cookie: await cookie(ADMIN_ID, ADMIN_EMAIL) }), env)
    expect(res.status).toBe(200)
    const body = (await res.json()) as any
    expect(body.data.error_rate.crit).toBe(0.05)
  })

  it('PUT merges a partial override without dropping other metrics (200)', async () => {
    const env = makeEnv(new D1Mock())
    const res = await createApp().fetch(
      adminReq('/api/admin/observability/thresholds', {
        method: 'PUT',
        cookie: await cookie(ADMIN_ID, ADMIN_EMAIL),
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ error_rate: { warn: 0.1 } }),
      }),
      env,
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as any
    expect(body.data.error_rate.warn).toBe(0.1)
    expect(body.data.p95_ms.crit).toBe(500) // untouched default preserved
  })
})

describe('Platformbeheer — observability snapshot', () => {
  it('returns a structured snapshot for an admin (200)', async () => {
    const env = makeEnv(new D1Mock())
    const res = await createApp().fetch(adminReq('/api/admin/observability/snapshot?window=24h', { cookie: await cookie(ADMIN_ID, ADMIN_EMAIL) }), env)
    expect(res.status).toBe(200)
    const body = (await res.json()) as any
    expect(body.data.components.workers).toBeDefined()
    expect(body.data.window).toBe('24h')
  })
})
