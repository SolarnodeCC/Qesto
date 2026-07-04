import { describe, expect, it } from 'vitest'
import { createApp } from '../../functions/api/app'
import { signJwt } from '../../functions/api/lib/jwt'
import type { Env } from '../../functions/api/types'
import { D1Mock } from '../helpers/d1-mock'
import { KVMock } from '../helpers/kv-mock'

const TEST_JWT_SECRET = 'integration-test-secret-at-least-32-bytes!'
const USER_ID = 'user_host_1'

const kv = () => new KVMock() as unknown as KVNamespace

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

async function cookie(userId = USER_ID): Promise<string> {
  return `qesto_session=${await signJwt({ sub: userId, email: `${userId}@example.com` }, TEST_JWT_SECRET, 3600)}`
}

function seed(db: D1Mock, status: 'draft' | 'live' = 'draft', sessionMode: 'reflection' | 'ideate' = 'reflection') {
  db.users.set(USER_ID, {
    id: USER_ID,
    email: `${USER_ID}@example.com`,
    display_name: 'Host',
    plan: 'team',
    created_at: Date.now(),
    last_login_at: null,
  } as never)
  db.sessions.set('sess_ideate', {
    id: 'sess_ideate',
    owner_id: USER_ID,
    code: 'IDE123',
    title: 'Sprint Ideation',
    status,
    anonymity: 'full',
    vote_policy: 'once',
    session_mode: sessionMode,
    created_at: Date.now(),
    started_at: status === 'live' ? Date.now() : null,
    closed_at: null,
    archived_at: null,
  } as never)
}

const post = (env: Env, c: string, body: unknown) =>
  createApp().fetch(
    new Request('http://local/api/sessions/sess_ideate/ideate/config', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: c },
      body: JSON.stringify(body),
    }),
    env,
  )

describe('POST /api/sessions/:id/ideate/config', () => {
  it('configures an ideate session with dot vote limit', async () => {
    const db = new D1Mock()
    seed(db)
    const res = await post(makeEnv(db), await cookie(), { dotVoteLimit: 5 })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean; data: { sessionMode: string; dotVoteLimit: number } }
    expect(body.ok).toBe(true)
    expect(body.data).toMatchObject({ sessionMode: 'ideate', dotVoteLimit: 5 })
    expect(db.sessions.get('sess_ideate')?.session_mode).toBe('ideate')
  })

  it('rejects configuring a non-draft session', async () => {
    const db = new D1Mock()
    seed(db, 'live')
    const res = await post(makeEnv(db), await cookie(), { dotVoteLimit: 3 })
    expect(res.status).toBe(409)
  })

  it('validates dot vote limit bounds', async () => {
    const db = new D1Mock()
    seed(db)
    const res = await post(makeEnv(db), await cookie(), { dotVoteLimit: 99 })
    expect(res.status).toBe(400)
  })

  it('reads back config via GET', async () => {
    const db = new D1Mock()
    seed(db, 'draft', 'ideate')
    const env = makeEnv(db)
    await post(env, await cookie(), { dotVoteLimit: 4, clusterDebounceMs: 2000 })
    const res = await createApp().fetch(
      new Request('http://local/api/sessions/sess_ideate/ideate/config', {
        headers: { cookie: await cookie() },
      }),
      env,
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      ok: boolean
      data: { ideateReady: boolean; dotVoteLimit: number; clusterDebounceMs: number }
    }
    expect(body.data.ideateReady).toBe(true)
    expect(body.data.dotVoteLimit).toBe(4)
    expect(body.data.clusterDebounceMs).toBe(2000)
  })
})
