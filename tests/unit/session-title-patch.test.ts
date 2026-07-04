import { describe, expect, it } from 'vitest'
import { createApp } from '../../functions/api/app'
import { signJwt } from '../../functions/api/lib/jwt'
import type { Env } from '../../functions/api/types'
import { D1Mock } from '../helpers/d1-mock'
import { KVMock } from '../helpers/kv-mock'

const TEST_JWT_SECRET = 'integration-test-secret-at-least-32-bytes!'
const USER_ID = 'user_host_1'

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

async function cookieFor(userId: string): Promise<string> {
  const token = await signJwt({ sub: userId, email: `${userId}@example.com` }, TEST_JWT_SECRET, 3600)
  return `qesto_session=${token}`
}

function seedUser(db: D1Mock) {
  db.users.set(USER_ID, {
    id: USER_ID,
    email: `${USER_ID}@example.com`,
    display_name: 'Host',
    created_at: Date.now(),
    last_login_at: null,
    plan: 'team',
  })
}

function seedSession(
  db: D1Mock,
  overrides: Partial<{
    id: string
    owner_id: string
    status: 'draft' | 'live' | 'closed' | 'archived'
    title: string
  }> = {},
) {
  const sess = {
    id: 'sess_1',
    owner_id: USER_ID,
    code: 'ABC123',
    title: 'Sprint Retro',
    status: 'closed' as const,
    anonymity: 'anonymous' as const,
    created_at: Date.now(),
    started_at: Date.now(),
    closed_at: Date.now(),
    archived_at: null,
    ...overrides,
  }
  db.sessions.set(sess.id, sess)
  return sess
}

describe('session title PATCH and duplicate', () => {
  it('PATCH title-only on closed session succeeds', async () => {
    const db = new D1Mock()
    seedSession(db, { status: 'closed' })
    const app = createApp()
    const env = makeEnv(db)
    const cookie = await cookieFor(USER_ID)

    const res = await app.fetch(
      new Request('http://local/api/sessions/sess_1', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ title: 'Renamed retro' }),
      }),
      env,
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { data: { session: { title: string } } }
    expect(body.data.session.title).toBe('Renamed retro')
  })

  it('PATCH non-title field on closed session returns 409', async () => {
    const db = new D1Mock()
    seedSession(db, { status: 'closed' })
    const app = createApp()
    const env = makeEnv(db)
    const cookie = await cookieFor(USER_ID)

    const res = await app.fetch(
      new Request('http://local/api/sessions/sess_1', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ anonymity: 'none' }),
      }),
      env,
    )
    expect(res.status).toBe(409)
  })

  it('PATCH title on live session returns 409', async () => {
    const db = new D1Mock()
    seedSession(db, { status: 'live' })
    const app = createApp()
    const env = makeEnv(db)
    const cookie = await cookieFor(USER_ID)

    const res = await app.fetch(
      new Request('http://local/api/sessions/sess_1', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ title: 'New name' }),
      }),
      env,
    )
    expect(res.status).toBe(409)
  })

  it('duplicate accepts custom title', async () => {
    const db = new D1Mock()
    seedUser(db)
    seedSession(db, { status: 'closed' })
    seedSession(db, { id: 'sess_2', title: 'Other', status: 'draft' })
    const app = createApp()
    const env = makeEnv(db)
    const cookie = await cookieFor(USER_ID)

    const res = await app.fetch(
      new Request('http://local/api/sessions/sess_1/duplicate', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ title: 'My custom copy' }),
      }),
      env,
    )
    expect(res.status).toBe(201)
    const body = (await res.json()) as { data: { session: { title: string; status: string } } }
    expect(body.data.session.title).toBe('My custom copy')
    expect(body.data.session.status).toBe('draft')
  })

  it('duplicate without body uses suffixed default when copy exists', async () => {
    const db = new D1Mock()
    seedUser(db)
    seedSession(db, { status: 'closed', title: 'Retro' })
    seedSession(db, { id: 'sess_2', title: 'Copy of Retro', status: 'draft' })
    const app = createApp()
    const env = makeEnv(db)
    const cookie = await cookieFor(USER_ID)

    const res = await app.fetch(
      new Request('http://local/api/sessions/sess_1/duplicate', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: '{}',
      }),
      env,
    )
    expect(res.status).toBe(201)
    const body = (await res.json()) as { data: { session: { title: string } } }
    expect(body.data.session.title).toBe('Copy of Retro (2)')
  })
})
