import { describe, expect, it } from 'vitest'
import { createApp } from '../../functions/api/app'
import { signJwt } from '../../functions/api/lib/jwt'
import type { Env } from '../../functions/api/types'
import { D1Mock } from '../helpers/d1-mock'
import { KVMock } from '../helpers/kv-mock'

const TEST_JWT_SECRET = 'integration-test-secret-at-least-32-bytes!'

function makeEnv(db: D1Mock, teamsKv = new KVMock()): Env {
  return {
    ENV: 'dev',
    PAGES_URL: 'http://local',
    API_URL: 'http://local',
    JWT_SECRET: TEST_JWT_SECRET,
    DB: db as unknown as D1Database,
    USERS_KV: new KVMock() as unknown as KVNamespace,
    SESSIONS_KV: new KVMock() as unknown as KVNamespace,
    TEAMS_KV: teamsKv as unknown as KVNamespace,
    TEMPLATES_KV: new KVMock() as unknown as KVNamespace,
    DECISIONS_KV: new KVMock() as unknown as KVNamespace,
    AUDIT_KV: new KVMock() as unknown as KVNamespace,
    ACTIONS_KV: new KVMock() as unknown as KVNamespace,
  } as unknown as Env
}

async function cookieFor(userId: string, email: string): Promise<string> {
  const token = await signJwt({ sub: userId, email }, TEST_JWT_SECRET, 3600)
  return `qesto_session=${token}`
}

function addUser(db: D1Mock, id: string, email: string, plan: 'free' | 'starter' | 'team' = 'team') {
  db.users.set(id, {
    id,
    email,
    display_name: id,
    created_at: Date.now(),
    last_login_at: null,
    plan,
  })
}

async function createTeam(app: ReturnType<typeof createApp>, env: Env, cookie: string): Promise<string> {
  const res = await app.fetch(
    new Request('http://local/api/teams', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ name: 'Sprint 21 Team' }),
    }),
    env,
  )
  expect(res.status).toBe(201)
  const body = (await res.json()) as { data: { team: { id: string } } }
  return body.data.team.id
}

async function addMember(teamsKv: KVMock, teamId: string, userId: string, email: string, role: 'member' | 'viewer' = 'member') {
  const raw = teamsKv.getRaw(`team:${teamId}`)
  expect(raw).toBeTruthy()
  const team = JSON.parse(raw as string)
  team.members.push({ userId, email, role, joinedAt: Date.now() })
  await teamsKv.put(`team:${teamId}`, JSON.stringify(team))
  await teamsKv.put(`user-teams:${userId}`, JSON.stringify([teamId]))
}

describe('Sprint 21 custom RBAC', () => {
  it('lets a custom role grant team member management without changing built-in role', async () => {
    const db = new D1Mock()
    const teamsKv = new KVMock()
    const app = createApp()
    const env = makeEnv(db, teamsKv)
    addUser(db, 'owner_1', 'owner@example.com')
    addUser(db, 'facilitator_1', 'facilitator@example.com')
    const ownerCookie = await cookieFor('owner_1', 'owner@example.com')
    const facilitatorCookie = await cookieFor('facilitator_1', 'facilitator@example.com')
    const teamId = await createTeam(app, env, ownerCookie)
    await addMember(teamsKv, teamId, 'facilitator_1', 'facilitator@example.com', 'viewer')

    const deniedInvite = await app.fetch(
      new Request(`http://local/api/teams/${teamId}/members`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: facilitatorCookie },
        body: JSON.stringify({ email: 'before@example.com', role: 'member' }),
      }),
      env,
    )
    expect(deniedInvite.status).toBe(403)

    const roleRes = await app.fetch(
      new Request(`http://local/api/teams/${teamId}/roles`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: ownerCookie },
        body: JSON.stringify({ name: 'People coordinator', permissions: ['team:manage_members'] }),
      }),
      env,
    )
    expect(roleRes.status).toBe(201)
    const roleBody = (await roleRes.json()) as { data: { role: { id: string; permissions: string[] } } }
    expect(roleBody.data.role.permissions).toEqual(['team:manage_members'])

    const assignRes = await app.fetch(
      new Request(`http://local/api/teams/${teamId}/roles/${roleBody.data.role.id}/assignments`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: ownerCookie },
        body: JSON.stringify({ userId: 'facilitator_1' }),
      }),
      env,
    )
    expect(assignRes.status).toBe(201)

    const allowedInvite = await app.fetch(
      new Request(`http://local/api/teams/${teamId}/members`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: facilitatorCookie },
        body: JSON.stringify({ email: 'after@example.com', role: 'member' }),
      }),
      env,
    )
    expect(allowedInvite.status).toBe(202)
    expect([...db.auditEvents.values()].some((event) => event.action === 'team.role.create')).toBe(true)
    expect([...db.auditEvents.values()].some((event) => event.action === 'team.role.assign')).toBe(true)
    expect([...db.auditEvents.values()].some((event) => event.action === 'team.permission_denied')).toBe(true)
  })

  it('keeps plan entitlements above custom-role permissions for SAML', async () => {
    const db = new D1Mock()
    const teamsKv = new KVMock()
    const app = createApp()
    const env = makeEnv(db, teamsKv)
    addUser(db, 'owner_starter', 'starter-owner@example.com', 'starter')
    const ownerCookie = await cookieFor('owner_starter', 'starter-owner@example.com')
    const teamId = await createTeam(app, env, ownerCookie)

    const roleRes = await app.fetch(
      new Request(`http://local/api/teams/${teamId}/roles`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: ownerCookie },
        body: JSON.stringify({ name: 'Auth manager', permissions: ['team:manage_auth'] }),
      }),
      env,
    )
    expect(roleRes.status).toBe(201)

    const samlRes = await app.fetch(
      new Request(`http://local/api/teams/${teamId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', cookie: ownerCookie },
        body: JSON.stringify({
          samlConfig: {
            idpEntityId: 'urn:test:idp',
            idpSsoUrl: 'https://idp.example.com/sso',
            idpCertificate: '-----BEGIN CERTIFICATE-----test-----END CERTIFICATE-----',
          },
        }),
      }),
      env,
    )
    expect(samlRes.status).toBe(403)
    const body = (await samlRes.json()) as { error: { code: string; details: { feature: string } } }
    expect(body.error.code).toBe('feature_not_available')
    expect(body.error.details.feature).toBe('samlSso')
  })
})
