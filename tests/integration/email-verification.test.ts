/**
 * Requirement: issue #883 (DD-10) — password signup gets only a personal
 * sandbox until the mailbox is proven. Consuming a magic link proves it;
 * team-invite acceptance (which previously had no backend route at all),
 * billing checkout and API-key creation require a verified address, and an
 * invite can only be redeemed by the address it was sent to.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../../functions/api/app'
import { signJwt } from '../../functions/api/lib/jwt'
import { generateMagicLinkToken, hashMagicLinkToken } from '../../functions/api/lib/tokens'
import { teamInviteKey } from '../../functions/api/lib/kv-keys'
import { saveTeam, type Team } from '../../functions/api/routes/teams/shared'
import { __resetEmailVerificationColumnMemo } from '../../functions/api/lib/email-verification'
import type { Env } from '../../functions/api/types'
import { D1Mock } from '../helpers/d1-mock'
import { KVMock } from '../helpers/kv-mock'

const SECRET = 'integration-test-secret-at-least-32-bytes!'

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
    INTEGRATIONS_KV: kv(),
    ...overrides,
  } as unknown as Env
}

const json = { 'content-type': 'application/json', 'x-qesto-client': 'web' }

async function bearer(sub: string, email: string) {
  return { authorization: `Bearer ${await signJwt({ sub, email }, SECRET, 3600)}` }
}

async function me(app: ReturnType<typeof createApp>, env: Env, headers: Record<string, string>) {
  const res = await app.fetch(new Request('http://local/api/auth/me', { headers }), env)
  return ((await res.json()) as { data: { email_verified: boolean } }).data
}

function seedUser(db: D1Mock, id: string, email: string) {
  db.users.set(id, { id, email, display_name: null, created_at: 1, last_login_at: null, plan: 'free' })
}

async function seedInvite(env: Env, email: string) {
  const team: Team = {
    id: 'team-1',
    name: 'Acme',
    ownerId: 'owner',
    members: [{ userId: 'owner', email: 'owner@acme.test', role: 'owner', joinedAt: 1 }],
    plan: 'team',
    samlConfig: null,
    createdAt: 1,
  } as Team
  await saveTeam(env.TEAMS_KV, team)
  const raw = generateMagicLinkToken()
  await env.TEAMS_KV.put(
    teamInviteKey(await hashMagicLinkToken(raw)),
    JSON.stringify({ teamId: 'team-1', email, role: 'member' }),
  )
  return raw
}

function acceptInvite(app: ReturnType<typeof createApp>, env: Env, headers: Record<string, string>, token: string) {
  return app.fetch(
    new Request('http://local/api/teams/accept-invite', {
      method: 'POST',
      headers: { ...json, ...headers },
      body: JSON.stringify({ token }),
    }),
    env,
  )
}

describe('email verification (DD-10)', () => {
  beforeEach(() => __resetEmailVerificationColumnMemo())

  it('password signup is unverified and queues a verification magic link', async () => {
    const db = new D1Mock()
    const app = createApp()
    const env = makeEnv(db)
    const res = await app.fetch(
      new Request('http://localhost:8788/api/auth/password/signup', {
        method: 'POST',
        headers: json,
        body: JSON.stringify({ email: 'new@acme.test', password: 'a-long-unique-passphrase' }),
      }),
      env,
    )
    expect(res.status).toBe(201)
    const body = (await res.json()) as { data: { id: string; token: string; email_verified: boolean } }
    expect(body.data.email_verified).toBe(false)
    expect([...db.magicLinks.values()].some((m) => m.email === 'new@acme.test')).toBe(true)
    expect((await me(app, env, { authorization: `Bearer ${body.data.token}` })).email_verified).toBe(false)
  })

  it('consuming a magic link marks the address verified', async () => {
    const db = new D1Mock()
    const app = createApp()
    const env = makeEnv(db)
    seedUser(db, 'u1', 'u1@acme.test')
    const raw = generateMagicLinkToken()
    db.magicLinks.set(await hashMagicLinkToken(raw), {
      token_hash: await hashMagicLinkToken(raw),
      email: 'u1@acme.test',
      created_at: Date.now(),
      expires_at: Date.now() + 60_000,
      consumed_at: null,
      requester_ip: null,
    })
    const cb = await app.fetch(new Request(`http://local/api/auth/callback?token=${raw}`), env)
    expect(cb.status).toBe(302)
    expect(db.users.get('u1')?.email_verified_at).toBeTypeOf('number')
    expect((await me(app, env, await bearer('u1', 'u1@acme.test'))).email_verified).toBe(true)
  })

  it('blocks invite acceptance until verified, then joins the team', async () => {
    const db = new D1Mock()
    const app = createApp()
    const env = makeEnv(db)
    seedUser(db, 'u2', 'invitee@acme.test')
    const token = await seedInvite(env, 'invitee@acme.test')
    const headers = await bearer('u2', 'invitee@acme.test')

    const blocked = await acceptInvite(app, env, headers, token)
    expect(blocked.status).toBe(403)
    expect(((await blocked.json()) as { error: { code: string } }).error.code).toBe('email_unverified')

    db.users.get('u2')!.email_verified_at = Date.now()
    const ok = await acceptInvite(app, env, headers, token)
    expect(ok.status).toBe(200)
    expect(((await ok.json()) as { data: { teamName: string } }).data.teamName).toBe('Acme')

    const replay = await acceptInvite(app, env, headers, token)
    expect(replay.status).toBe(404)
  })

  it('refuses an invite addressed to someone else and leaves it redeemable', async () => {
    const db = new D1Mock()
    const app = createApp()
    const env = makeEnv(db)
    seedUser(db, 'u3', 'attacker@evil.test')
    db.users.get('u3')!.email_verified_at = Date.now()
    const token = await seedInvite(env, 'invitee@acme.test')
    const res = await acceptInvite(app, env, await bearer('u3', 'attacker@evil.test'), token)
    expect(res.status).toBe(403)
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('invite_email_mismatch')
    expect(await env.TEAMS_KV.get(teamInviteKey(await hashMagicLinkToken(token)))).not.toBeNull()
  })

  it('gates API-key creation, and the kill-switch lifts the gate', async () => {
    const db = new D1Mock()
    const app = createApp()
    seedUser(db, 'u4', 'u4@acme.test')
    const req = async (env: Env) =>
      app.fetch(
        new Request('http://local/api/api-keys', {
          method: 'POST',
          headers: { ...json, ...(await bearer('u4', 'u4@acme.test')) },
          body: JSON.stringify({ teamId: 't', name: 'k' }),
        }),
        env,
      )
    const enforced = await req(makeEnv(db))
    expect(enforced.status).toBe(403)
    expect(((await enforced.json()) as { error: { code: string } }).error.code).toBe('email_unverified')
    const lifted = await req(makeEnv(db, { EMAIL_VERIFICATION_ENFORCED: 'false' }))
    expect(((await lifted.json()) as { error?: { code: string } }).error?.code).not.toBe('email_unverified')
  })
})
