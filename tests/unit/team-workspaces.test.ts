import { describe, expect, it, vi } from 'vitest'
import { createApp } from '../../functions/api/app'
import { signJwt } from '../../functions/api/lib/jwt'
import type { Env } from '../../functions/api/types'
import { D1Mock } from '../helpers/d1-mock'
import { KVMock } from '../helpers/kv-mock'
import { writeKvJson } from '../../functions/api/lib/kv'
import { teamDocumentKey } from '../../functions/api/lib/kv-keys'
import type { Team } from '../../functions/api/routes/teams'
import { mergeRetroActionsOnClose, readWorkspaceActions } from '../../functions/api/lib/workspace-actions'

const TEST_JWT_SECRET = 'integration-test-secret-at-least-32-bytes!'

function buildEnv(db: D1Mock, teamsKv: KVMock, actionsKv?: KVMock) {
  return {
    ENV: 'dev',
    JWT_SECRET: TEST_JWT_SECRET,
    DB: db as unknown as D1Database,
    TEAMS_KV: teamsKv as unknown as KVNamespace,
    USERS_KV: new KVMock() as unknown as KVNamespace,
    SESSIONS_KV: new KVMock() as unknown as KVNamespace,
    ACTIONS_KV: (actionsKv ?? new KVMock()) as unknown as KVNamespace,
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
  return team
}

describe('team workspaces (ADR-0048)', () => {
  it('creates and lists retro workspace', async () => {
    const db = new D1Mock()
    const teamsKv = new KVMock()
    await seedTeam(db, teamsKv)
    const env = buildEnv(db, teamsKv)
    const app = createApp()
    const token = await signJwt({ sub: 'owner', email: 'o@example.com' }, TEST_JWT_SECRET, 3600)
    const cookie = `qesto_session=${token}`

    const create = await app.fetch(
      new Request('http://local/api/teams/team-w/workspaces', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ kind: 'retro', title: 'Sprint retro', cadence: 'sprint' }),
      }),
      env,
    )
    expect(create.status).toBe(201)

    const list = await app.fetch(
      new Request('http://local/api/teams/team-w/workspaces?kind=retro', { headers: { cookie } }),
      env,
    )
    expect(list.status).toBe(200)
    const body = (await list.json()) as { data: { workspaces: Array<{ kind: string; title: string; cadence: string }> } }
    expect(body.data.workspaces[0].kind).toBe('retro')
    expect(body.data.workspaces[0].title).toBe('Sprint retro')
    expect(body.data.workspaces[0].cadence).toBe('sprint')
  })

  it('creates workspace instance with seq and lists history', async () => {
    const db = new D1Mock()
    const teamsKv = new KVMock()
    const actionsKv = new KVMock()
    await seedTeam(db, teamsKv)
    const env = buildEnv(db, teamsKv, actionsKv)
    const app = createApp()
    const token = await signJwt({ sub: 'owner', email: 'o@example.com' }, TEST_JWT_SECRET, 3600)
    const cookie = `qesto_session=${token}`

    const createWs = await app.fetch(
      new Request('http://local/api/teams/team-w/workspaces', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ kind: 'retro', title: 'Team Alpha' }),
      }),
      env,
    )
    expect(createWs.status).toBe(201)
    const wsBody = (await createWs.json()) as { data: { workspace: { id: string } } }
    const wsId = wsBody.data.workspace.id

    const instance = await app.fetch(
      new Request(`http://local/api/teams/team-w/workspaces/${wsId}/instances`, {
        method: 'POST',
        headers: { cookie },
      }),
      env,
    )
    expect(instance.status).toBe(201)
    const instBody = (await instance.json()) as {
      data: { session: { workspaceSeq: number; title: string } }
    }
    expect(instBody.data.session.workspaceSeq).toBe(1)
    expect(instBody.data.session.title).toContain('Retro #1')

    const history = await app.fetch(
      new Request(`http://local/api/teams/team-w/workspaces/${wsId}/instances`, { headers: { cookie } }),
      env,
    )
    expect(history.status).toBe(200)
    const histBody = (await history.json()) as { data: { instances: Array<{ workspaceSeq: number }> } }
    expect(histBody.data.instances).toHaveLength(1)
    expect(histBody.data.instances[0].workspaceSeq).toBe(1)
  })

  it('stores and reads action items for retro workspace', async () => {
    const db = new D1Mock()
    const teamsKv = new KVMock()
    const actionsKv = new KVMock()
    await seedTeam(db, teamsKv)
    const env = buildEnv(db, teamsKv, actionsKv)
    const app = createApp()
    const token = await signJwt({ sub: 'owner', email: 'o@example.com' }, TEST_JWT_SECRET, 3600)
    const cookie = `qesto_session=${token}`

    const createWs = await app.fetch(
      new Request('http://local/api/teams/team-w/workspaces', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ kind: 'retro', title: 'Actions retro' }),
      }),
      env,
    )
    const wsId = ((await createWs.json()) as { data: { workspace: { id: string } } }).data.workspace.id

    const patch = await app.fetch(
      new Request(`http://local/api/teams/team-w/workspaces/${wsId}/actions`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({
          items: [
            { text: 'Improve CI speed', status: 'open' },
            { text: 'Done item', status: 'resolved' },
          ],
        }),
      }),
      env,
    )
    expect(patch.status).toBe(200)

    const get = await app.fetch(
      new Request(`http://local/api/teams/team-w/workspaces/${wsId}/actions`, { headers: { cookie } }),
      env,
    )
    expect(get.status).toBe(200)
    const body = (await get.json()) as { data: { openCount: number; items: Array<{ status: string }> } }
    expect(body.data.openCount).toBe(1)
    expect(body.data.items).toHaveLength(2)
  })

  it('preserves action lineage and sticky resolved timestamps when patching existing ids', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      const db = new D1Mock()
      const teamsKv = new KVMock()
      const actionsKv = new KVMock()
      await seedTeam(db, teamsKv)
      const env = buildEnv(db, teamsKv, actionsKv)
      const app = createApp()
      const token = await signJwt({ sub: 'owner', email: 'o@example.com' }, TEST_JWT_SECRET, 3600)
      const cookie = `qesto_session=${token}`

      vi.setSystemTime(new Date('2026-07-16T10:00:00Z'))
      const createWs = await app.fetch(
        new Request('http://local/api/teams/team-w/workspaces', {
          method: 'POST',
          headers: { 'content-type': 'application/json', cookie },
          body: JSON.stringify({ kind: 'retro', title: 'Lineage retro' }),
        }),
        env,
      )
      const wsId = ((await createWs.json()) as { data: { workspace: { id: string } } }).data.workspace.id

      await mergeRetroActionsOnClose(
        actionsKv as unknown as KVNamespace,
        'team-w',
        wsId,
        'session-origin',
        ['Carry forward follow-up'],
      )
      const carried = (await readWorkspaceActions(actionsKv as unknown as KVNamespace, 'team-w', wsId)).items[0]
      expect(carried).toMatchObject({
        text: 'Carry forward follow-up',
        status: 'open',
        sourceSessionId: 'session-origin',
        createdAt: Date.parse('2026-07-16T10:00:00Z'),
      })

      vi.setSystemTime(new Date('2026-07-16T11:00:00Z'))
      const resolved = await app.fetch(
        new Request(`http://local/api/teams/team-w/workspaces/${wsId}/actions`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json', cookie },
          body: JSON.stringify({
            items: [{ id: carried.id, text: 'Carry forward follow-up - done', status: 'resolved' }],
          }),
        }),
        env,
      )
      expect(resolved.status).toBe(200)
      const resolvedItem = ((await resolved.json()) as { data: { items: Array<typeof carried> } }).data.items[0]
      expect(resolvedItem).toMatchObject({
        id: carried.id,
        text: 'Carry forward follow-up - done',
        status: 'resolved',
        sourceSessionId: 'session-origin',
        createdAt: carried.createdAt,
        resolvedAt: Date.parse('2026-07-16T11:00:00Z'),
      })

      vi.setSystemTime(new Date('2026-07-16T12:00:00Z'))
      const stillResolved = await app.fetch(
        new Request(`http://local/api/teams/team-w/workspaces/${wsId}/actions`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json', cookie },
          body: JSON.stringify({
            items: [{ id: carried.id, text: 'Carry forward follow-up - still done', status: 'resolved' }],
          }),
        }),
        env,
      )
      const stillResolvedItem = ((await stillResolved.json()) as { data: { items: Array<typeof carried> } }).data.items[0]
      expect(stillResolvedItem).toMatchObject({
        text: 'Carry forward follow-up - still done',
        status: 'resolved',
        sourceSessionId: 'session-origin',
        createdAt: carried.createdAt,
        resolvedAt: Date.parse('2026-07-16T11:00:00Z'),
      })

      vi.setSystemTime(new Date('2026-07-16T13:00:00Z'))
      const reopenedWithNew = await app.fetch(
        new Request(`http://local/api/teams/team-w/workspaces/${wsId}/actions`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json', cookie },
          body: JSON.stringify({
            items: [
              { id: carried.id, text: 'Carry forward follow-up - reopened', status: 'open' },
              { text: 'Fresh manually added task', status: 'resolved' },
            ],
          }),
        }),
        env,
      )
      const finalItems = ((await reopenedWithNew.json()) as { data: { items: Array<typeof carried> } }).data.items
      expect(finalItems[0]).toMatchObject({
        id: carried.id,
        text: 'Carry forward follow-up - reopened',
        status: 'open',
        sourceSessionId: 'session-origin',
        createdAt: carried.createdAt,
        resolvedAt: null,
      })
      expect(finalItems[1]).toMatchObject({
        text: 'Fresh manually added task',
        status: 'resolved',
        sourceSessionId: null,
        createdAt: Date.parse('2026-07-16T13:00:00Z'),
        resolvedAt: Date.parse('2026-07-16T13:00:00Z'),
      })
      expect(finalItems[1].id).toEqual(expect.any(String))
    } finally {
      vi.useRealTimers()
    }
  })

  it('history returns linked instances with per-session insight summary', async () => {
    const db = new D1Mock()
    const teamsKv = new KVMock()
    const actionsKv = new KVMock()
    await seedTeam(db, teamsKv)
    const env = buildEnv(db, teamsKv, actionsKv)
    const app = createApp()
    const token = await signJwt({ sub: 'owner', email: 'o@example.com' }, TEST_JWT_SECRET, 3600)
    const cookie = `qesto_session=${token}`

    const createWs = await app.fetch(
      new Request('http://local/api/teams/team-w/workspaces', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ kind: 'retro', title: 'History retro' }),
      }),
      env,
    )
    const wsId = ((await createWs.json()) as { data: { workspace: { id: string } } }).data.workspace.id
    const inst = await app.fetch(
      new Request(`http://local/api/teams/team-w/workspaces/${wsId}/instances`, { method: 'POST', headers: { cookie } }),
      env,
    )
    const sessionId = ((await inst.json()) as { data: { session: { id: string } } }).data.session.id
    db.insightsDaily.set('ins-hist', {
      id: 'ins-hist',
      session_id: sessionId,
      team_id: 'team-w',
      day: '2026-01-01',
      themes_json: '[]',
      confidence: 0.9,
      n_votes: 7,
      embedding_ref: 0,
      computed_at: Date.now(),
    } as never)

    const hist = await app.fetch(
      new Request(`http://local/api/teams/team-w/workspaces/${wsId}/history`, { headers: { cookie } }),
      env,
    )
    expect(hist.status).toBe(200)
    const body = (await hist.json()) as {
      data: { history: Array<{ workspaceSeq: number; insight: { responseCount: number } | null }> }
    }
    expect(body.data.history).toHaveLength(1)
    expect(body.data.history[0].workspaceSeq).toBe(1)
    expect(body.data.history[0].insight?.responseCount).toBe(7)
  })

  it('refresh recomputes trends then debounces a rapid second call', async () => {
    const db = new D1Mock()
    const teamsKv = new KVMock()
    const actionsKv = new KVMock()
    await seedTeam(db, teamsKv)
    const env = buildEnv(db, teamsKv, actionsKv)
    const app = createApp()
    const token = await signJwt({ sub: 'owner', email: 'o@example.com' }, TEST_JWT_SECRET, 3600)
    const cookie = `qesto_session=${token}`

    const createWs = await app.fetch(
      new Request('http://local/api/teams/team-w/workspaces', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ kind: 'retro', title: 'Refresh retro' }),
      }),
      env,
    )
    const wsId = ((await createWs.json()) as { data: { workspace: { id: string } } }).data.workspace.id

    const first = await app.fetch(
      new Request(`http://local/api/teams/team-w/workspaces/${wsId}/refresh`, { method: 'POST', headers: { cookie } }),
      env,
    )
    expect(first.status).toBe(200)
    expect(((await first.json()) as { data: { debounced: boolean } }).data.debounced).toBe(false)

    const second = await app.fetch(
      new Request(`http://local/api/teams/team-w/workspaces/${wsId}/refresh`, { method: 'POST', headers: { cookie } }),
      env,
    )
    expect(((await second.json()) as { data: { debounced: boolean } }).data.debounced).toBe(true)
  })

  it('denies workspace create on free plan', async () => {
    const db = new D1Mock()
    const teamsKv = new KVMock()
    db.users.set('free-user', {
      id: 'free-user',
      email: 'f@example.com',
      display_name: 'f',
      created_at: Date.now(),
      last_login_at: null,
      plan: 'free',
    })
    const team: Team = {
      id: 'team-free',
      name: 'Free Team',
      ownerId: 'free-user',
      plan: 'free',
      samlConfig: null,
      members: [{ userId: 'free-user', email: 'f@example.com', role: 'owner', joinedAt: 1 }],
      createdAt: 1,
    }
    await writeKvJson(teamsKv as unknown as KVNamespace, teamDocumentKey('team-free'), team)
    const env = buildEnv(db, teamsKv)
    const app = createApp()
    const token = await signJwt({ sub: 'free-user', email: 'f@example.com' }, TEST_JWT_SECRET, 3600)
    const cookie = `qesto_session=${token}`

    const create = await app.fetch(
      new Request('http://local/api/teams/team-free/workspaces', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ kind: 'retro', title: 'Nope' }),
      }),
      env,
    )
    expect(create.status).toBe(403)
  })
})
