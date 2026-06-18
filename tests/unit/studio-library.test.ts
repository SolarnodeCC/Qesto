// STUDIO-LIBRARY-01 (ADR-0060, S97) — content library: save / list / fork / delete.
// Covers tenant isolation (team A cannot see/fork/delete team B's items), fork
// independence + use_count increment on the original, and auth/validation failures.

import { describe, expect, it } from 'vitest'
import { createApp } from '../../functions/api/app'
import { signJwt } from '../../functions/api/lib/jwt'
import type { Env } from '../../functions/api/types'
import { D1Mock } from '../helpers/d1-mock'
import { KVMock } from '../helpers/kv-mock'

const SECRET = 'integration-test-secret-at-least-32-bytes!'

const USER_A = 'user_a'
const USER_B = 'user_b'
const TEAM_A = 'team_a'
const TEAM_B = 'team_b'

const QUESTION = {
  kind: 'poll' as const,
  prompt: 'Which roadmap theme matters most next quarter?',
  options: [{ label: 'Reliability' }, { label: 'Speed' }, { label: 'Cost' }],
}

function kv() {
  return new KVMock()
}

function makeEnv(db: D1Mock, teamsKv: KVMock): Env {
  return {
    ENV: 'dev',
    PAGES_URL: 'http://local',
    API_URL: 'http://local',
    JWT_SECRET: SECRET,
    DB: db as unknown as D1Database,
    USERS_KV: kv() as unknown as KVNamespace,
    SESSIONS_KV: kv() as unknown as KVNamespace,
    TEAMS_KV: teamsKv as unknown as KVNamespace,
    TEMPLATES_KV: kv() as unknown as KVNamespace,
    DECISIONS_KV: kv() as unknown as KVNamespace,
    AUDIT_KV: kv() as unknown as KVNamespace,
    ACTIONS_KV: kv() as unknown as KVNamespace,
  } as unknown as Env
}

function seedUser(db: D1Mock, userId: string) {
  db.users.set(userId, {
    id: userId,
    email: `${userId}@example.com`,
    display_name: 'User',
    plan: 'team',
    created_at: Date.now(),
    last_login_at: null,
  } as never)
}

function seedTeam(teamsKv: KVMock, teamId: string, ownerId: string) {
  void teamsKv.put(
    `team:${teamId}`,
    JSON.stringify({
      id: teamId,
      name: teamId,
      ownerId,
      members: [{ userId: ownerId, email: `${ownerId}@example.com`, role: 'owner', joinedAt: 1 }],
      plan: 'team',
      samlConfig: null,
      createdAt: 1,
    }),
  )
}

async function cookie(userId: string): Promise<string> {
  return `qesto_session=${await signJwt({ sub: userId, email: `${userId}@example.com` }, SECRET, 3600)}`
}

function setup() {
  const db = new D1Mock()
  const teamsKv = new KVMock()
  seedUser(db, USER_A)
  seedUser(db, USER_B)
  seedTeam(teamsKv, TEAM_A, USER_A)
  seedTeam(teamsKv, TEAM_B, USER_B)
  return { env: makeEnv(db, teamsKv), db }
}

function req(env: Env, path: string, method: string, c: string | null, body?: unknown) {
  return createApp().fetch(
    new Request(`http://local/api/studio/${path}`, {
      method,
      headers: { 'content-type': 'application/json', ...(c ? { cookie: c } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    }),
    env,
  )
}

async function saveItem(env: Env, userId: string, teamId: string, title = 'Roadmap poll') {
  const res = await req(env, 'library', 'POST', await cookie(userId), {
    teamId,
    questionJson: QUESTION,
    title,
  })
  return res
}

describe('STUDIO-LIBRARY-01 — save', () => {
  it('saves an authored question for the caller team', async () => {
    const { env, db } = setup()
    const res = await saveItem(env, USER_A, TEAM_A)
    expect(res.status).toBe(201)
    const body = (await res.json()) as { data: { item: { id: string; source: string; team_id: string } } }
    expect(body.data.item.source).toBe('authored')
    expect(body.data.item.team_id).toBe(TEAM_A)
    expect(db.studioLibraryItems.size).toBe(1)
  })

  it('rejects an unauthenticated save', async () => {
    const { env } = setup()
    const res = await req(env, 'library', 'POST', null, { teamId: TEAM_A, questionJson: QUESTION, title: 'x' })
    expect(res.status).toBe(401)
  })

  it('rejects a malformed body with 400', async () => {
    const { env } = setup()
    const res = await req(env, 'library', 'POST', await cookie(USER_A), {
      teamId: TEAM_A,
      questionJson: { kind: 'poll', prompt: 'p', options: [] }, // poll needs >= 2 options
      title: 'x',
    })
    expect(res.status).toBe(400)
  })

  it('forbids saving into a team the caller does not belong to', async () => {
    const { env } = setup()
    const res = await saveItem(env, USER_A, TEAM_B)
    expect(res.status).toBe(403)
  })
})

describe('STUDIO-LIBRARY-01 — list (tenant isolation)', () => {
  it("team A cannot see team B's items", async () => {
    const { env } = setup()
    await saveItem(env, USER_A, TEAM_A, 'A item')
    await saveItem(env, USER_B, TEAM_B, 'B item')

    const resA = await req(env, `library?teamId=${TEAM_A}`, 'GET', await cookie(USER_A))
    const bodyA = (await resA.json()) as { data: { items: Array<{ title: string; team_id: string }> } }
    expect(bodyA.data.items).toHaveLength(1)
    expect(bodyA.data.items[0]!.team_id).toBe(TEAM_A)
    expect(bodyA.data.items[0]!.title).toBe('A item')

    const resB = await req(env, `library?teamId=${TEAM_B}`, 'GET', await cookie(USER_B))
    const bodyB = (await resB.json()) as { data: { items: Array<{ team_id: string }> } }
    expect(bodyB.data.items).toHaveLength(1)
    expect(bodyB.data.items[0]!.team_id).toBe(TEAM_B)
  })

  it('forbids listing another team', async () => {
    const { env } = setup()
    const res = await req(env, `library?teamId=${TEAM_B}`, 'GET', await cookie(USER_A))
    expect(res.status).toBe(403)
  })

  it('requires teamId', async () => {
    const { env } = setup()
    const res = await req(env, 'library', 'GET', await cookie(USER_A))
    expect(res.status).toBe(400)
  })
})

describe('STUDIO-LIBRARY-01 — fork', () => {
  it('creates an independent copy with forked_from_id set and increments the original use_count', async () => {
    const { env, db } = setup()
    const saveRes = await saveItem(env, USER_A, TEAM_A)
    const original = (await saveRes.json()) as { data: { item: { id: string } } }
    const originalId = original.data.item.id

    const forkRes = await req(env, `library/${originalId}/fork?teamId=${TEAM_A}`, 'POST', await cookie(USER_A))
    expect(forkRes.status).toBe(201)
    const forkBody = (await forkRes.json()) as {
      data: { item: { id: string; source: string; forked_from_id: string }; forkedFrom: string }
    }
    expect(forkBody.data.item.source).toBe('fork')
    expect(forkBody.data.item.forked_from_id).toBe(originalId)
    expect(forkBody.data.item.id).not.toBe(originalId)
    expect(forkBody.data.forkedFrom).toBe(originalId)

    // Original use_count incremented; two distinct rows now exist.
    expect(db.studioLibraryItems.get(originalId)?.use_count).toBe(1)
    expect(db.studioLibraryItems.size).toBe(2)
  })

  it("returns 404 when forking another team's item (no cross-tenant leak)", async () => {
    const { env } = setup()
    const saveRes = await saveItem(env, USER_B, TEAM_B)
    const item = (await saveRes.json()) as { data: { item: { id: string } } }

    // USER_A is a member of TEAM_A but tries to fork TEAM_B's item via their own team scope.
    const res = await req(env, `library/${item.data.item.id}/fork?teamId=${TEAM_A}`, 'POST', await cookie(USER_A))
    expect(res.status).toBe(404)
  })

  it('forbids forking under a team the caller does not belong to', async () => {
    const { env } = setup()
    const saveRes = await saveItem(env, USER_B, TEAM_B)
    const item = (await saveRes.json()) as { data: { item: { id: string } } }
    const res = await req(env, `library/${item.data.item.id}/fork?teamId=${TEAM_B}`, 'POST', await cookie(USER_A))
    expect(res.status).toBe(403)
  })
})

describe('STUDIO-LIBRARY-01 — delete', () => {
  it('deletes the caller team item', async () => {
    const { env, db } = setup()
    const saveRes = await saveItem(env, USER_A, TEAM_A)
    const item = (await saveRes.json()) as { data: { item: { id: string } } }

    const res = await req(env, `library/${item.data.item.id}?teamId=${TEAM_A}`, 'DELETE', await cookie(USER_A))
    expect(res.status).toBe(200)
    expect(db.studioLibraryItems.size).toBe(0)
  })

  it("returns 404 when deleting another team's item (tenant-scoped)", async () => {
    const { env, db } = setup()
    const saveRes = await saveItem(env, USER_B, TEAM_B)
    const item = (await saveRes.json()) as { data: { item: { id: string } } }

    const res = await req(env, `library/${item.data.item.id}?teamId=${TEAM_A}`, 'DELETE', await cookie(USER_A))
    expect(res.status).toBe(404)
    expect(db.studioLibraryItems.size).toBe(1) // B's item untouched
  })

  it('forbids deleting under a team the caller does not belong to', async () => {
    const { env } = setup()
    const saveRes = await saveItem(env, USER_B, TEAM_B)
    const item = (await saveRes.json()) as { data: { item: { id: string } } }
    const res = await req(env, `library/${item.data.item.id}?teamId=${TEAM_B}`, 'DELETE', await cookie(USER_A))
    expect(res.status).toBe(403)
  })
})
