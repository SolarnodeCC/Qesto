import { describe, expect, it } from 'vitest'
import { createApp } from '../../functions/api/app'
import { signJwt } from '../../functions/api/lib/jwt'
import type { Env } from '../../functions/api/types'
import { D1Mock } from '../helpers/d1-mock'
import { KVMock } from '../helpers/kv-mock'
import { writeKvJson } from '../../functions/api/lib/kv'
import { teamDocumentKey } from '../../functions/api/lib/kv-keys'
import type { Team } from '../../functions/api/routes/teams'

const SECRET = 'integration-test-secret-at-least-32-bytes!'

describe('team workspaces (RETRO/IDEATE)', () => {
  it('creates and lists retro workspace', async () => {
    const db = new D1Mock()
    const teamsKv = new KVMock()
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
    const env = {
      ENV: 'dev',
      JWT_SECRET: SECRET,
      DB: db as unknown as D1Database,
      TEAMS_KV: teamsKv as unknown as KVNamespace,
      USERS_KV: new KVMock() as unknown as KVNamespace,
      SESSIONS_KV: new KVMock() as unknown as KVNamespace,
    } as unknown as Env
    const app = createApp()
    const token = await signJwt({ sub: 'owner', email: 'o@example.com' }, SECRET, 3600)
    const cookie = `qesto_session=${token}`

    const create = await app.fetch(
      new Request('http://local/api/teams/team-w/workspaces', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ kind: 'retro', title: 'Sprint retro' }),
      }),
      env,
    )
    expect(create.status).toBe(201)

    const list = await app.fetch(
      new Request('http://local/api/teams/team-w/workspaces?kind=retro', { headers: { cookie } }),
      env,
    )
    expect(list.status).toBe(200)
    const body = (await list.json()) as { data: { workspaces: Array<{ kind: string; title: string }> } }
    expect(body.data.workspaces[0].kind).toBe('retro')
    expect(body.data.workspaces[0].title).toBe('Sprint retro')
  })
})
