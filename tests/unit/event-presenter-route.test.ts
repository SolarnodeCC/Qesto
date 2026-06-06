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

describe('event presenter routes (FE-STAGE-PRES-01)', () => {
  it('returns presenter shell and persists slide deck + active talk', async () => {
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
    const wsId = ((await createWs.json()) as { data: { workspace: { id: string } } }).data.workspace.id

    const getRes = await app.fetch(
      new Request(`http://local/api/teams/team-w/workspaces/${wsId}/present`, { headers: { cookie: auth } }),
      env,
    )
    expect(getRes.status).toBe(200)
    const getBody = (await getRes.json()) as { data: { presenter: { slideDeckUrl: string | null } } }
    expect(getBody.data.presenter.slideDeckUrl).toBeNull()

    const putRes = await app.fetch(
      new Request(`http://local/api/teams/team-w/workspaces/${wsId}/present`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', cookie: auth },
        body: JSON.stringify({
          slideDeckUrl: 'https://docs.google.com/presentation/d/abc/edit',
          activeSlotId: null,
        }),
      }),
      env,
    )
    expect(putRes.status).toBe(200)
    const putBody = (await putRes.json()) as { data: { presenter: { slideDeckUrl: string } } }
    expect(putBody.data.presenter.slideDeckUrl).toContain('/embed')
  })
})
