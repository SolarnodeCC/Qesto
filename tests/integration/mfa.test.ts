/**
 * Requirement: issue #877 (DD-04) — TOTP MFA: enrolment returns single-use
 * recovery codes; with MFA on, every first factor yields only a pending token
 * (never a session); /mfa/verify issues the session with `mfa_at`; codes
 * cannot be replayed; admin step-up is enforced behind ADMIN_MFA_REQUIRED.
 */
import { describe, expect, it } from 'vitest'
import { createApp } from '../../functions/api/app'
import { signJwt, verifyJwt } from '../../functions/api/lib/jwt'
import { hashPassword } from '../../functions/api/lib/password'
import { base32Decode, hotp, totpStep } from '../../functions/api/lib/totp'
import { pwdKey } from '../../functions/api/routes/auth'
import { generateMagicLinkToken, hashMagicLinkToken } from '../../functions/api/lib/tokens'
import type { Env } from '../../functions/api/types'
import { D1Mock } from '../helpers/d1-mock'
import { KVMock } from '../helpers/kv-mock'

const SECRET = 'integration-test-secret-at-least-32-bytes!'
const EMAIL = 'mfa@acme.test'
const json = { 'content-type': 'application/json', 'x-qesto-client': 'web' }

function makeEnv(db: D1Mock, overrides: Partial<Env> = {}): Env {
  const kv = () => new KVMock() as unknown as KVNamespace
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
    METRICS_KV: kv(),
    ...overrides,
  } as unknown as Env
}

async function codeFor(secret: string, offsetSteps = 0) {
  return hotp(base32Decode(secret), totpStep(Date.now()) + offsetSteps)
}

async function enrol(app: ReturnType<typeof createApp>, env: Env, auth: Record<string, string>) {
  const setup = await app.fetch(new Request('http://local/api/auth/mfa/setup', { method: 'POST', headers: { ...json, ...auth } }), env)
  expect(setup.status).toBe(200)
  const { secret, otpauthUri } = ((await setup.json()) as { data: { secret: string; otpauthUri: string } }).data
  expect(otpauthUri).toContain(secret)
  const enable = await app.fetch(
    new Request('http://local/api/auth/mfa/enable', {
      method: 'POST',
      headers: { ...json, ...auth },
      body: JSON.stringify({ code: await codeFor(secret, -1) }),
    }),
    env,
  )
  expect(enable.status).toBe(200)
  const { recoveryCodes } = ((await enable.json()) as { data: { recoveryCodes: string[] } }).data
  return { secret, recoveryCodes }
}

async function setup() {
  const db = new D1Mock()
  const env = makeEnv(db)
  const app = createApp()
  db.users.set('u1', { id: 'u1', email: EMAIL, display_name: null, created_at: 1, last_login_at: null, plan: 'free' })
  await env.USERS_KV.put(pwdKey('u1'), JSON.stringify({ hash: await hashPassword('correct horse battery') }))
  const auth = { authorization: `Bearer ${await signJwt({ sub: 'u1', email: EMAIL }, SECRET, 3600)}` }
  return { db, env, app, auth }
}

function login(app: ReturnType<typeof createApp>, env: Env) {
  return app.fetch(
    new Request('http://localhost:8788/api/auth/password/login', {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ email: EMAIL, password: 'correct horse battery' }),
    }),
    env,
  )
}

function verify(app: ReturnType<typeof createApp>, env: Env, body: object) {
  return app.fetch(new Request('http://local/api/auth/mfa/verify', { method: 'POST', headers: json, body: JSON.stringify(body) }), env)
}

describe('MFA (DD-04)', () => {
  it('password login with MFA on returns a pending token, not a session; verify issues mfa_at', async () => {
    const { env, app, auth } = await setup()
    const { secret } = await enrol(app, env, auth)

    const res = await login(app, env)
    expect(res.status).toBe(200)
    expect(res.headers.get('set-cookie')).toBeNull()
    const { mfa_required, mfa_token } = ((await res.json()) as { data: { mfa_required: boolean; mfa_token: string } }).data
    expect(mfa_required).toBe(true)

    // The pending token is not a session.
    const asSession = await app.fetch(new Request('http://local/api/auth/me', { headers: { authorization: `Bearer ${mfa_token}` } }), env)
    expect(asSession.status).toBe(401)

    const ok = await verify(app, env, { mfa_token, code: await codeFor(secret) })
    expect(ok.status).toBe(200)
    const { token } = ((await ok.json()) as { data: { token: string } }).data
    const claims = await verifyJwt(token, SECRET)
    expect(claims?.mfa_at).toBeTypeOf('number')
  }, 30_000)

  it('rejects a replayed TOTP code', async () => {
    const { env, app, auth } = await setup()
    const { secret } = await enrol(app, env, auth)
    const code = await codeFor(secret)
    const t1 = ((await (await login(app, env)).json()) as { data: { mfa_token: string } }).data.mfa_token
    expect((await verify(app, env, { mfa_token: t1, code })).status).toBe(200)
    const t2 = ((await (await login(app, env)).json()) as { data: { mfa_token: string } }).data.mfa_token
    expect((await verify(app, env, { mfa_token: t2, code })).status).toBe(401)
  }, 30_000)

  it('recovery codes work exactly once', async () => {
    const { env, app, auth } = await setup()
    const { recoveryCodes } = await enrol(app, env, auth)
    expect(recoveryCodes).toHaveLength(10)
    const t1 = ((await (await login(app, env)).json()) as { data: { mfa_token: string } }).data.mfa_token
    expect((await verify(app, env, { mfa_token: t1, recovery_code: recoveryCodes[0]!.toLowerCase() })).status).toBe(200)
    const t2 = ((await (await login(app, env)).json()) as { data: { mfa_token: string } }).data.mfa_token
    expect((await verify(app, env, { mfa_token: t2, recovery_code: recoveryCodes[0] })).status).toBe(401)
  }, 30_000)

  it('magic-link login with MFA on redirects to the second-factor step', async () => {
    const { db, env, app, auth } = await setup()
    await enrol(app, env, auth)
    const raw = generateMagicLinkToken()
    const token_hash = await hashMagicLinkToken(raw)
    db.magicLinks.set(token_hash, { token_hash, email: EMAIL, created_at: Date.now(), expires_at: Date.now() + 60_000, consumed_at: null, requester_ip: null })
    const res = await app.fetch(new Request(`http://local/api/auth/callback?token=${raw}`), env)
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toMatch(/^http:\/\/local\/login\?mfa=/)
    expect(res.headers.get('set-cookie') ?? '').not.toContain('qesto_session=')
  })

  it('disabling MFA requires a valid second factor', async () => {
    const { env, app, auth } = await setup()
    const { secret } = await enrol(app, env, auth)
    const bad = await app.fetch(new Request('http://local/api/auth/mfa/disable', { method: 'POST', headers: { ...json, ...auth }, body: JSON.stringify({ code: '000000' }) }), env)
    expect(bad.status).toBe(400)
    const good = await app.fetch(new Request('http://local/api/auth/mfa/disable', { method: 'POST', headers: { ...json, ...auth }, body: JSON.stringify({ code: await codeFor(secret) }) }), env)
    expect(good.status).toBe(200)
    const res = await login(app, env)
    expect(((await res.json()) as { data: { mfa_required?: boolean } }).data.mfa_required).toBeUndefined()
  }, 30_000)

  it('ADMIN_MFA_REQUIRED demands a recent second factor on /api/admin/*', async () => {
    const db = new D1Mock()
    const app = createApp()
    const env = makeEnv(db, { SEED_ADMIN_EMAIL: 'admin@acme.test', ADMIN_MFA_REQUIRED: 'true' } as Partial<Env>)
    const now = Math.floor(Date.now() / 1000)
    const stale = await signJwt({ sub: 'a1', email: 'admin@acme.test' }, SECRET, 3600)
    const fresh = await signJwt({ sub: 'a1', email: 'admin@acme.test', mfa_at: now }, SECRET, 3600)
    const get = (t: string) => app.fetch(new Request('http://local/api/admin/users', { headers: { authorization: `Bearer ${t}` } }), env)
    const denied = await get(stale)
    expect(denied.status).toBe(403)
    expect(((await denied.json()) as { error: { code: string } }).error.code).toBe('mfa_step_up_required')
    expect((await get(fresh)).status).not.toBe(403)
  })
})
