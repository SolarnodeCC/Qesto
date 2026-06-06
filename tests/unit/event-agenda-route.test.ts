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

describe('event agenda routes (STAGE-AGENDA-01)', () => {
  it('serves public agenda and switches tracks without auth', async () => {
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
        body: JSON.stringify({ kind: 'event', title: 'Hybrid Summit' }),
      }),
      env,
    )
    expect(createWs.status).toBe(201)
    const wsBody = (await createWs.json()) as { data: { workspace: { id: string } } }
    const wsId = wsBody.data.workspace.id

    const agendaSeed = await app.fetch(
      new Request(`http://local/api/teams/team-w/workspaces/${wsId}/agenda`, { headers: { cookie: auth } }),
      env,
    )
    expect(agendaSeed.status).toBe(200)
    const seedBody = (await agendaSeed.json()) as { data: { eventCode: string } }
    const eventCode = seedBody.data.eventCode

    const instance = await app.fetch(
      new Request(`http://local/api/teams/team-w/workspaces/${wsId}/instances`, {
        method: 'POST',
        headers: { cookie: auth },
      }),
      env,
    )
    expect(instance.status).toBe(201)
    const instBody = (await instance.json()) as { data: { session: { id: string } } }
    const sessionId = instBody.data.session.id

    const put = await app.fetch(
      new Request(`http://local/api/teams/team-w/workspaces/${wsId}/agenda`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', cookie: auth },
        body: JSON.stringify({
          tracks: [
            {
              label: 'Main Stage',
              day: 'Day 1',
              order: 0,
              slots: [{ title: 'Opening', order: 0, sessionId }],
            },
            {
              label: 'Workshop',
              day: 'Day 1',
              order: 1,
              slots: [{ title: 'Deep dive', order: 0 }],
            },
          ],
        }),
      }),
      env,
    )
    expect(put.status).toBe(200)

    const organizerGet = await app.fetch(
      new Request(`http://local/api/teams/team-w/workspaces/${wsId}/agenda`, { headers: { cookie: auth } }),
      env,
    )
    expect(organizerGet.status).toBe(200)
    const orgBody = (await organizerGet.json()) as { data: { eventCode: string; tracks: Array<{ label: string }> } }
    expect(orgBody.data.tracks).toHaveLength(2)

    const publicMain = await app.fetch(new Request(`http://local/api/events/${eventCode}/agenda`), env)
    expect(publicMain.status).toBe(200)
    const mainBody = (await publicMain.json()) as {
      data: { activeTrackId: string; slots: Array<{ session: { id: string } | null }> }
    }
    expect(mainBody.data.slots[0]?.session?.id).toBe(sessionId)

    const track2 = (orgBody.data.tracks as Array<{ id: string; label: string }>).find((t) => t.label === 'Workshop')!

    const publicWorkshop = await app.fetch(
      new Request(`http://local/api/events/${eventCode}/agenda?track=${track2.id}`),
      env,
    )
    expect(publicWorkshop.status).toBe(200)
    const wsBody2 = (await publicWorkshop.json()) as { data: { slots: Array<{ title: string }> } }
    expect(wsBody2.data.slots[0]?.title).toBe('Deep dive')
  })
})
