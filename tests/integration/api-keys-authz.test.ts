/**
 * Requirement: issue #877 (DD-04) — sensitive team actions demand a recent
 * second factor from MFA-enrolled users (step-up); plus the tenant boundary on
 * /api/api-keys: a key is a credential for one team's data, so minting,
 * listing, revoking and rotating require `team:manage_auth` on THAT team.
 */
import { describe, expect, it } from 'vitest'
import { createApp } from '../../functions/api/app'
import { signJwt } from '../../functions/api/lib/jwt'
import { mfaKvKey } from '../../functions/api/lib/mfa'
import { teamApiKeyIndexKey } from '../../functions/api/lib/api-keys'
import { saveTeam, type Team } from '../../functions/api/routes/teams/shared'
import type { Env } from '../../functions/api/types'
import { D1Mock } from '../helpers/d1-mock'
import { KVMock } from '../helpers/kv-mock'

// jankurai:allow HLT-010-SECRET-SPRAWL reason="local HMAC key for test-only JWTs, never used outside this suite" expires=2027-12-31
const SECRET = 'integration-test-secret-at-least-32-bytes!'
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
    INTEGRATIONS_KV: kv(),
    ...overrides,
  } as unknown as Env
}

const USERS = {
  owner: 'owner@acme.test',
  member: 'member@acme.test',
  outsider: 'outsider@evil.test',
} as const
type Who = keyof typeof USERS

async function setup(overrides: Partial<Env> = {}) {
  const db = new D1Mock()
  for (const [id, email] of Object.entries(USERS)) {
    db.users.set(id, { id, email, display_name: null, created_at: 1, last_login_at: null, plan: 'team', email_verified_at: 1 })
  }
  const env = makeEnv(db, overrides)
  const team: Team = {
    id: 'team-acme',
    name: 'Acme',
    ownerId: 'owner',
    members: [
      { userId: 'owner', email: USERS.owner, role: 'owner', joinedAt: 1 },
      { userId: 'member', email: USERS.member, role: 'member', joinedAt: 1 },
    ],
    plan: 'team',
    samlConfig: null,
    createdAt: 1,
  } as Team
  await saveTeam(env.TEAMS_KV, team)
  const app = createApp()
  const as = async (who: Who, extra: Record<string, unknown> = {}) => ({
    ...json,
    authorization: `Bearer ${await signJwt({ sub: who, email: USERS[who], ...extra }, SECRET, 3600)}`,
  })
  const call = async (who: Who, method: string, path: string, body?: unknown, extra: Record<string, unknown> = {}) =>
    app.fetch(
      new Request(`http://local${path}`, {
        method,
        headers: await as(who, extra),
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      }),
      env,
    )
  return { db, env, app, call }
}

async function code(res: Response): Promise<string | undefined> {
  return ((await res.json()) as { error?: { code: string } }).error?.code
}

async function enrolMfa(env: Env, userId: string) {
  // Only `enabledAt` matters for the step-up gate; the secret is never read here.
  await env.USERS_KV.put(
    mfaKvKey(userId),
    JSON.stringify({ secret: { iv: '', ct: '' }, enabledAt: 1, lastStep: 0, recoveryCodeHashes: [] }),
  )
}

describe('API keys — tenant boundary', () => {
  it('an outsider cannot mint a key for another team', async () => {
    const { call, env } = await setup()
    const res = await call('outsider', 'POST', '/api/api-keys', { teamId: 'team-acme', name: 'exfil' })
    expect(res.status).toBe(404)
    expect(await env.INTEGRATIONS_KV!.get(teamApiKeyIndexKey('team-acme'))).toBeNull()
  })

  it('an outsider cannot list, revoke or rotate another team’s keys', async () => {
    const { call } = await setup()
    const created = await call('owner', 'POST', '/api/api-keys', { teamId: 'team-acme', name: 'ci' })
    expect(created.status).toBe(201)
    const keyId = ((await created.json()) as { data: { record: { id: string } } }).data.record.id

    expect((await call('outsider', 'GET', '/api/api-keys?teamId=team-acme')).status).toBe(404)
    expect((await call('outsider', 'DELETE', `/api/api-keys/${keyId}`)).status).toBe(404)
    const rotate = await call('outsider', 'POST', `/api/api-keys/${keyId}/rotate`)
    expect(rotate.status).toBe(404)
    expect(JSON.stringify(await rotate.json())).not.toContain('qesto_')
  })

  it('a plain member lacks team:manage_auth', async () => {
    const { call } = await setup()
    const res = await call('member', 'POST', '/api/api-keys', { teamId: 'team-acme', name: 'k' })
    expect(res.status).toBe(403)
    expect(await code(res)).toBe('forbidden')
  })

  it('the owner can mint, list and revoke', async () => {
    const { call } = await setup()
    const created = await call('owner', 'POST', '/api/api-keys', { teamId: 'team-acme', name: 'ci' })
    expect(created.status).toBe(201)
    const keyId = ((await created.json()) as { data: { record: { id: string } } }).data.record.id
    const list = await call('owner', 'GET', '/api/api-keys?teamId=team-acme')
    expect(((await list.json()) as { data: { keys: unknown[] } }).data.keys).toHaveLength(1)
    expect((await call('owner', 'DELETE', `/api/api-keys/${keyId}`)).status).toBe(200)
  })
})

describe('MFA step-up on sensitive actions (DD-04)', () => {
  it('users without MFA are not prompted', async () => {
    const { call } = await setup()
    expect((await call('owner', 'POST', '/api/api-keys', { teamId: 'team-acme', name: 'k' })).status).toBe(201)
  })

  it('an MFA-enrolled owner needs a second factor from the last 15 minutes', async () => {
    const { call, env } = await setup()
    await enrolMfa(env, 'owner')
    const stale = await call('owner', 'POST', '/api/api-keys', { teamId: 'team-acme', name: 'k' })
    expect(stale.status).toBe(403)
    expect(await code(stale)).toBe('mfa_step_up_required')

    const old = Math.floor(Date.now() / 1000) - 16 * 60
    const expired = await call('owner', 'POST', '/api/api-keys', { teamId: 'team-acme', name: 'k' }, { mfa_at: old })
    expect(await code(expired)).toBe('mfa_step_up_required')

    const fresh = await call('owner', 'POST', '/api/api-keys', { teamId: 'team-acme', name: 'k' }, { mfa_at: Math.floor(Date.now() / 1000) })
    expect(fresh.status).toBe(201)
  })

  it('authorization runs first: a non-permitted caller is never prompted', async () => {
    const { call, env } = await setup()
    await enrolMfa(env, 'member')
    const res = await call('member', 'POST', '/api/api-keys', { teamId: 'team-acme', name: 'k' })
    expect(await code(res)).toBe('forbidden')
  })

  it('gates team deletion and member management', async () => {
    const { call, env } = await setup()
    await enrolMfa(env, 'owner')
    const del = await call('owner', 'DELETE', '/api/teams/team-acme')
    expect(await code(del)).toBe('mfa_step_up_required')
    const remove = await call('owner', 'DELETE', '/api/teams/team-acme/members/member')
    expect(await code(remove)).toBe('mfa_step_up_required')
    const now = Math.floor(Date.now() / 1000)
    expect((await call('owner', 'DELETE', '/api/teams/team-acme/members/member', undefined, { mfa_at: now })).status).toBe(200)
  })

  it('MFA_STEP_UP_ENFORCED="false" is a kill-switch', async () => {
    const { call, env } = await setup({ MFA_STEP_UP_ENFORCED: 'false' } as Partial<Env>)
    await enrolMfa(env, 'owner')
    expect((await call('owner', 'POST', '/api/api-keys', { teamId: 'team-acme', name: 'k' })).status).toBe(201)
  })
})
