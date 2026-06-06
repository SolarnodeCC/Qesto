import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { testJwtSecret } from '../helpers/test-credentials'
import { createApp } from '../../functions/api/app'
import * as oauth from '../../functions/api/lib/oauth'
import * as saml from '../../functions/api/lib/saml'
import * as authHelpers from '../../functions/api/routes/auth/helpers'
import type { Env } from '../../functions/api/types'
import { D1Mock } from '../helpers/d1-mock'
import { KVMock } from '../helpers/kv-mock'
import { testUserPassword } from '../helpers/test-credentials'

function makeAuthEnv(db: D1Mock, overrides: Partial<Env> = {}): Env {
  return {
    ENV: 'dev',
    PAGES_URL: 'http://local',
    API_URL: 'http://local',
    JWT_SECRET: testJwtSecret(),
    DB: db as unknown as D1Database,
    USERS_KV: new KVMock() as unknown as KVNamespace,
    SESSIONS_KV: new KVMock() as unknown as KVNamespace,
    TEAMS_KV: new KVMock() as unknown as KVNamespace,
    TEMPLATES_KV: new KVMock() as unknown as KVNamespace,
    DECISIONS_KV: new KVMock() as unknown as KVNamespace,
    AUDIT_KV: new KVMock() as unknown as KVNamespace,
    ACTIONS_KV: new KVMock() as unknown as KVNamespace,
    ...overrides,
  } as unknown as Env
}

describe('auth JSON error sanitization', () => {
  it('does not leak DB exception text on magic-link request in production', async () => {
    const db = new D1Mock()
    const origPrepare = db.prepare.bind(db)
    db.prepare = ((sql: string) => {
      if (sql.trim().startsWith('INSERT INTO magic_links')) {
        return {
          bind: () => ({
            run: async () => {
              throw new Error('INTERNAL_DB_SECRET_XYZZY')
            },
            first: async () => null,
            all: async () => ({ results: [] }),
          }),
        } as unknown as ReturnType<D1Mock['prepare']>
      }
      return origPrepare(sql)
    }) as D1Mock['prepare']

    const app = createApp()
    const res = await app.fetch(
      new Request('http://local/api/auth/request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'sanitized-prod@example.com' }),
      }),
      makeAuthEnv(db, { ENV: 'production' }),
    )
    expect(res.status).toBe(500)
    const body = (await res.json()) as { ok: boolean; error: { code: string; message: string } }
    expect(body.ok).toBe(false)
    expect(body.error.code).toBe('internal')
    expect(body.error.message).not.toContain('INTERNAL_DB_SECRET')
    expect(body.error.message).toMatch(/unexpected error occurred/i)
  })

  it('includes exception message on magic-link request in development', async () => {
    const db = new D1Mock()
    const origPrepare = db.prepare.bind(db)
    db.prepare = ((sql: string) => {
      if (sql.trim().startsWith('INSERT INTO magic_links')) {
        return {
          bind: () => ({
            run: async () => {
              throw new Error('DEV_VISIBLE_DB_ERROR')
            },
            first: async () => null,
            all: async () => ({ results: [] }),
          }),
        } as unknown as ReturnType<D1Mock['prepare']>
      }
      return origPrepare(sql)
    }) as D1Mock['prepare']

    const app = createApp()
    const res = await app.fetch(
      new Request('http://local/api/auth/request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'sanitized-dev@example.com' }),
      }),
      makeAuthEnv(db, { ENV: 'dev' }),
    )
    expect(res.status).toBe(500)
    const body = (await res.json()) as { error: { message: string } }
    expect(body.error.message).toContain('DEV_VISIBLE_DB_ERROR')
  })

  it('password reset-confirm with corrupt KV value returns sanitized message in production', async () => {
    const db = new D1Mock()
    const usersKv = new KVMock()
    const actionsKv = new KVMock()
    const app = createApp()

    await app.fetch(
      new Request('http://local/api/auth/password/signup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'corrupt-kv@example.com', password: testUserPassword() }),
      }),
      makeAuthEnv(db, { USERS_KV: usersKv as unknown as KVNamespace, ACTIONS_KV: actionsKv as unknown as KVNamespace }),
    )

    const { hashMagicLinkToken } = await import('../../functions/api/lib/tokens')
    const raw = 'b'.repeat(64)
    const tokenHash = await hashMagicLinkToken(raw)
    await actionsKv.put(`pwd-reset:${tokenHash}`, '{{{not-json')

    const res = await app.fetch(
      new Request('http://local/api/auth/password/reset-confirm', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: raw, password: testUserPassword() }),
      }),
      makeAuthEnv(db, {
        ENV: 'production',
        USERS_KV: usersKv as unknown as KVNamespace,
        ACTIONS_KV: actionsKv as unknown as KVNamespace,
      }),
    )
    expect(res.status).toBe(500)
    const body = (await res.json()) as { error: { message: string } }
    expect(body.error.message).not.toContain('JSON')
    expect(body.error.message).toMatch(/unexpected error occurred/i)
  })
})

describe('OAuth characterization + hardening', () => {
  beforeEach(() => {
    vi.spyOn(oauth, 'consumeOAuthState').mockResolvedValue(true)
    vi.spyOn(oauth, 'exchangeGoogleCode').mockResolvedValue({ email: 'oauth-user@example.com', sub: 'google-sub-1' })
  })
  afterEach(() => vi.restoreAllMocks())

  it('google callback sets session cookie and redirects home on happy path', async () => {
    const app = createApp()
    const res = await app.fetch(
      new Request('http://local/api/auth/google/callback?code=c1&state=s1', { redirect: 'manual' }),
      makeAuthEnv(new D1Mock(), { GOOGLE_CLIENT_ID: 'gid', GOOGLE_CLIENT_SECRET: 'gsec' }),
    )
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('http://local/')
    expect(res.headers.get('set-cookie')).toContain('qesto_session=')
  })

  it('google callback redirects sso_failed when post-exchange steps throw', async () => {
    vi.spyOn(authHelpers, 'upsertOAuthUser').mockRejectedValueOnce(new Error('SECRET_UPSERT_FAILURE'))
    const app = createApp()
    const res = await app.fetch(
      new Request('http://local/api/auth/google/callback?code=c2&state=s2', { redirect: 'manual' }),
      makeAuthEnv(new D1Mock(), { GOOGLE_CLIENT_ID: 'gid', GOOGLE_CLIENT_SECRET: 'gsec' }),
    )
    expect(res.status).toBe(302)
    const loc = res.headers.get('location') ?? ''
    expect(loc).toContain('error=sso_failed')
    expect(loc).not.toContain('jwtFixture')
  })

  it('google start redirects provider_not_configured when client id missing', async () => {
    const app = createApp()
    const res = await app.fetch(
      new Request('http://local/api/auth/google', { redirect: 'manual' }),
      makeAuthEnv(new D1Mock()),
    )
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toContain('provider_not_configured')
  })

  it('google callback redirects provider_not_configured when client secret missing', async () => {
    const app = createApp()
    const res = await app.fetch(
      new Request('http://local/api/auth/google/callback?code=c3&state=s3', { redirect: 'manual' }),
      makeAuthEnv(new D1Mock(), { GOOGLE_CLIENT_ID: 'gid' }),
    )
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toContain('provider_not_configured')
  })
})

describe('SAML characterization + hardening', () => {
  afterEach(() => vi.restoreAllMocks())

  it('metadata returns SAML XML', async () => {
    const app = createApp()
    const res = await app.fetch(new Request('http://local/api/auth/saml/metadata'), makeAuthEnv(new D1Mock()))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('samlmetadata')
    const xml = await res.text()
    expect(xml).toContain('EntityDescriptor')
  })

  it('metadata returns 503 plain text when metadata generation throws', async () => {
    vi.spyOn(saml, 'buildSpMetadata').mockImplementationOnce(() => {
      throw new Error('INTERNAL_METADATA_EXPLODE')
    })
    const app = createApp()
    const res = await app.fetch(new Request('http://local/api/auth/saml/metadata'), makeAuthEnv(new D1Mock()))
    expect(res.status).toBe(503)
    expect(await res.text()).toBe('Service unavailable')
  })

  it('init redirects when team_id missing', async () => {
    const app = createApp()
    const res = await app.fetch(
      new Request('http://local/api/auth/saml/init', { redirect: 'manual' }),
      makeAuthEnv(new D1Mock()),
    )
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toContain('saml_team_required')
  })
})

vi.spyOn(console, 'log').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})
