import { describe, expect, it } from 'vitest'
import { createApp } from '../../functions/api/app'
import { signJwt } from '../../functions/api/lib/jwt'
import type { Env } from '../../functions/api/types'
import { D1Mock } from '../helpers/d1-mock'
import { KVMock } from '../helpers/kv-mock'
import { writeKvJson } from '../../functions/api/lib/kv'
import { teamDocumentKey } from '../../functions/api/lib/kv-keys'
import type { Team } from '../../functions/api/routes/teams'
import { testJwtSecret } from '../helpers/test-credentials'

const jwtFixture = testJwtSecret()

function buildEnv(db: D1Mock, teamsKv: KVMock) {
  return {
    ENV: 'dev',
    JWT_SECRET: jwtFixture,
    DB: db as unknown as D1Database,
    TEAMS_KV: teamsKv as unknown as KVNamespace,
    USERS_KV: new KVMock() as unknown as KVNamespace,
    SESSIONS_KV: new KVMock() as unknown as KVNamespace,
  } as unknown as Env
}

async function seedTeam(db: D1Mock, teamsKv: KVMock) {
  db.users.set('owner', {
    id: 'owner',
    email: 'o@example.com',
    display_name: 'o',
    created_at: Date.now(),
    last_login_at: null,
    plan: 'team',
  })
  const team: Team = {
    id: 'team-w',
    name: 'Workspace Team',
    ownerId: 'owner',
    plan: 'team',
    samlConfig: null,
    members: [{ userId: 'owner', email: 'o@example.com', role: 'owner', joinedAt: 1 }],
    createdAt: 1,
  }
  await writeKvJson(teamsKv as unknown as KVNamespace, teamDocumentKey('team-w'), team)
}

async function cookie() {
  return `qesto_session=${await signJwt({ sub: 'owner', email: 'o@example.com' }, jwtFixture, 3600)}`
}

describe('event suite routes (STAGE-SUITE-01)', () => {
  it('starts event, posts feed, exposes public feed with track status', async () => {
    const db = new D1Mock()
    const teamsKv = new KVMock()
    await seedTeam(db, teamsKv)
    const env = buildEnv(db, teamsKv)
    const app = createApp()
    const auth = await cookie()

    const createWs = await app.fetch(
      new Request('http://local/api/teams/team-w/workspaces', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: auth },
        body: JSON.stringify({ kind: 'event', title: 'Summit 2026' }),
      }),
      env,
    )
    expect(createWs.status).toBe(201)
    const wsId = ((await createWs.json()) as { data: { workspace: { id: string } } }).data.workspace.id

    const agendaRes = await app.fetch(
      new Request(`http://local/api/teams/team-w/workspaces/${wsId}/agenda`, { headers: { cookie: auth } }),
      env,
    )
    const eventCode = ((await agendaRes.json()) as { data: { eventCode: string } }).data.eventCode

    const start = await app.fetch(
      new Request(`http://local/api/teams/team-w/workspaces/${wsId}/suite/start`, { method: 'POST', headers: { cookie: auth } }),
      env,
    )
    expect(start.status).toBe(200)
    const startBody = (await start.json()) as { data: { status: string; tracks: unknown[] } }
    expect(startBody.data.status).toBe('live')

    const feedPost = await app.fetch(
      new Request(`http://local/api/teams/team-w/workspaces/${wsId}/suite/feed`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: auth },
        body: JSON.stringify({ message: 'Welcome to the summit!' }),
      }),
      env,
    )
    expect(feedPost.status).toBe(200)

    const publicFeed = await app.fetch(new Request(`http://local/api/events/${eventCode}/feed`), env)
    expect(publicFeed.status).toBe(200)
    const pubBody = (await publicFeed.json()) as { data: { status: string; feed: Array<{ message: string }> } }
    expect(pubBody.data.status).toBe('live')
    expect(pubBody.data.feed.some((f) => f.message.includes('Welcome'))).toBe(true)

    const close = await app.fetch(
      new Request(`http://local/api/teams/team-w/workspaces/${wsId}/suite/close`, { method: 'POST', headers: { cookie: auth } }),
      env,
    )
    expect(close.status).toBe(200)
    const closeBody = (await close.json()) as { data: { status: string } }
    expect(closeBody.data.status).toBe('closed')
  })
})
