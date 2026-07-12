import { beforeEach, describe, expect, it, vi } from 'vitest'
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

async function cookieFor(userId: string, email: string): Promise<string> {
  const token = await signJwt({ sub: userId, email }, TEST_JWT_SECRET, 3600)
  return `qesto_session=${token}`
}

describe('Teams response contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('POST /api/teams — response contract', async () => {
    const db = new D1Mock()
    const app = createApp()
    const env = makeEnv(db)
    const cookie = await cookieFor('team_user_1', 'team_user_1@example.com')

    const res = await app.fetch(
      new Request('http://local/api/teams', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie, 'cf-connecting-ip': '127.0.0.1' },
        body: JSON.stringify({ name: 'Contract Team' }),
      }),
      env,
    )

    expect(res.status).toBe(201)
    const body = (await res.json()) as any
    expect(body.ok).toBe(true)

    // Assert required contract fields
    expect(body.data.team).toMatchObject({
      id: expect.any(String),
      name: 'Contract Team',
      ownerId: 'team_user_1',
    })

    // Assert no PRICE_ID or Stripe keys leak into response
    expect(JSON.stringify(body)).not.toMatch(/PRICE_ID|stripe_secret|STRIPE_KEY/i)
    expect(JSON.stringify(body)).not.toMatch(/"[^"]*(password|jwt|secret)[^"]*"\s*:/i)
  })

  it('400: malformed JSON body', async () => {
    const db = new D1Mock()
    const app = createApp()
    const env = makeEnv(db)
    const cookie = await cookieFor('team_bad', 'team_bad@example.com')

    const res = await app.fetch(
      new Request('http://local/api/teams', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie, 'cf-connecting-ip': '127.0.0.1' },
        body: '{bad-json',
      }),
      env,
    )

    expect(res.status).toBe(400)
    const body = (await res.json()) as any
    expect(body.error.code).toBe('validation')
  })
})

describe('Teams CRUD', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  it('creates a new team', async () => {
    const db = new D1Mock()
    const app = createApp()
    const env = makeEnv(db)
    const cookie = await cookieFor('user_1', 'user1@example.com')

    const res = await app.fetch(
      new Request('http://local/api/teams', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie, 'cf-connecting-ip': '127.0.0.1' },
        body: JSON.stringify({ name: 'Engineering Team' }),
      }),
      env,
    )

    expect(res.status).toBe(201)
    const body = (await res.json()) as any
    expect(body.ok).toBe(true)
    expect(body.data.team.name).toBe('Engineering Team')
    expect(body.data.team.ownerId).toBe('user_1')
    expect(body.data.team.members).toHaveLength(1)
    expect(body.data.team.members[0].userId).toBe('user_1')
    expect(body.data.team.members[0].role).toBe('owner')
  })

  it('lists teams for authenticated user', async () => {
    const db = new D1Mock()
    const app = createApp()
    const env = makeEnv(db)
    const cookie1 = await cookieFor('user_1', 'user1@example.com')
    const cookie2 = await cookieFor('user_2', 'user2@example.com')

    // Create team as user_1
    const createRes = await app.fetch(
      new Request('http://local/api/teams', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: cookie1, 'cf-connecting-ip': '127.0.0.1' },
        body: JSON.stringify({ name: 'Team A' }),
      }),
      env,
    )
    expect(createRes.status).toBe(201)

    // user_1 should see the team
    const listRes1 = await app.fetch(
      new Request('http://local/api/teams', {
        headers: { cookie: cookie1, 'cf-connecting-ip': '127.0.0.1' },
      }),
      env,
    )
    expect(listRes1.status).toBe(200)
    const body1 = (await listRes1.json()) as any
    expect(body1.ok).toBe(true)
    expect(body1.data.teams).toHaveLength(1)
    expect(body1.data.teams[0].name).toBe('Team A')

    // user_2 should see empty list
    const listRes2 = await app.fetch(
      new Request('http://local/api/teams', {
        headers: { cookie: cookie2, 'cf-connecting-ip': '127.0.0.1' },
      }),
      env,
    )
    expect(listRes2.status).toBe(200)
    const body2 = (await listRes2.json()) as any
    expect(body2.ok).toBe(true)
    expect(body2.data.teams).toHaveLength(0)
  })

  it('fetches single team by id', async () => {
    const db = new D1Mock()
    const app = createApp()
    const env = makeEnv(db)
    const cookie = await cookieFor('user_1', 'user1@example.com')

    // Create team
    const createRes = await app.fetch(
      new Request('http://local/api/teams', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie, 'cf-connecting-ip': '127.0.0.1' },
        body: JSON.stringify({ name: 'Engineering' }),
      }),
      env,
    )
    const created = (await createRes.json()) as any
    const teamId = created.data.team.id

    // Fetch team
    const getRes = await app.fetch(
      new Request(`http://local/api/teams/${teamId}`, {
        headers: { cookie, 'cf-connecting-ip': '127.0.0.1' },
      }),
      env,
    )

    expect(getRes.status).toBe(200)
    const body = (await getRes.json()) as any
    expect(body.ok).toBe(true)
    expect(body.data.team.id).toBe(teamId)
    expect(body.data.team.name).toBe('Engineering')
  })

  it('patches team name', async () => {
    const db = new D1Mock()
    const app = createApp()
    const env = makeEnv(db)
    const cookie = await cookieFor('user_1', 'user1@example.com')

    // Create team
    const createRes = await app.fetch(
      new Request('http://local/api/teams', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie, 'cf-connecting-ip': '127.0.0.1' },
        body: JSON.stringify({ name: 'Old Name' }),
      }),
      env,
    )
    const created = (await createRes.json()) as any
    const teamId = created.data.team.id

    // Update team
    const patchRes = await app.fetch(
      new Request(`http://local/api/teams/${teamId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', cookie, 'cf-connecting-ip': '127.0.0.1' },
        body: JSON.stringify({ name: 'New Name' }),
      }),
      env,
    )

    expect(patchRes.status).toBe(200)
    const body = (await patchRes.json()) as any
    expect(body.ok).toBe(true)
    expect(body.data.team.name).toBe('New Name')
  })

  it('rejects invalid team names', async () => {
    const db = new D1Mock()
    const app = createApp()
    const env = makeEnv(db)
    const cookie = await cookieFor('user_1', 'user1@example.com')

    const res = await app.fetch(
      new Request('http://local/api/teams', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie, 'cf-connecting-ip': '127.0.0.1' },
        body: JSON.stringify({ name: '' }),
      }),
      env,
    )

    expect(res.status).toBe(400)
    const body = (await res.json()) as any
    expect(body.error.code).toBe('validation')
  })

  it('rejects unauthenticated team creation', async () => {
    const db = new D1Mock()
    const app = createApp()
    const env = makeEnv(db)

    const res = await app.fetch(
      new Request('http://local/api/teams', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'cf-connecting-ip': '127.0.0.1' },
        body: JSON.stringify({ name: 'Test' }),
      }),
      env,
    )

    expect(res.status).toBe(401)
  })

  it('denies non-owner from updating team', async () => {
    const db = new D1Mock()
    const app = createApp()
    const env = makeEnv(db)
    const cookie1 = await cookieFor('user_1', 'user1@example.com')
    const cookie2 = await cookieFor('user_2', 'user2@example.com')

    // Create team as user_1
    const createRes = await app.fetch(
      new Request('http://local/api/teams', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: cookie1, 'cf-connecting-ip': '127.0.0.1' },
        body: JSON.stringify({ name: 'Team' }),
      }),
      env,
    )
    const created = (await createRes.json()) as any
    const teamId = created.data.team.id

    // user_2 tries to update
    const patchRes = await app.fetch(
      new Request(`http://local/api/teams/${teamId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', cookie: cookie2, 'cf-connecting-ip': '127.0.0.1' },
        body: JSON.stringify({ name: 'Hacked' }),
      }),
      env,
    )

    expect(patchRes.status).toBe(403)
  })
})
