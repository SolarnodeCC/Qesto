// TOWNHALL-06 (ADR-0044): REST config endpoint — draft-only, Team-tier only.

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

function seed(db: D1Mock, plan: 'free' | 'starter' | 'team', status: 'draft' | 'live' = 'draft') {
  db.users.set(USER_ID, {
    id: USER_ID,
    email: `${USER_ID}@example.com`,
    display_name: 'Host',
    plan,
    created_at: Date.now(),
    last_login_at: null,
  } as never)
  db.sessions.set('sess_1', {
    id: 'sess_1',
    owner_id: USER_ID,
    code: 'ABC123',
    title: 'All-Hands',
    status,
    anonymity: 'full',
    vote_policy: 'once',
    session_mode: 'reflection',
    created_at: Date.now(),
    started_at: status === 'live' ? Date.now() : null,
    closed_at: null,
    archived_at: null,
  } as never)
}

const post = (env: Env, c: string, body: unknown) =>
  createApp().fetch(
    new Request('http://local/api/sessions/sess_1/townhall/config', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: c },
      body: JSON.stringify(body),
    }),
    env,
  )

describe('POST /api/sessions/:id/townhall/config', () => {
  it('configures a townhall session on the Team plan', async () => {
    const db = new D1Mock()
    seed(db, 'team')
    const res = await post(makeEnv(db), await cookie(), { moderation: 'pre', anonymity: 'zero_knowledge' })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean; data: { sessionMode: string; moderation: string } }
    expect(body.ok).toBe(true)
    expect(body.data).toMatchObject({ sessionMode: 'townhall', moderation: 'pre', anonymity: 'zero_knowledge' })
    expect(db.sessions.get('sess_1')?.session_mode).toBe('townhall')
    expect(db.sessions.get('sess_1')?.townhall_moderation).toBe('pre')
  })

  it('blocks non-Team plans with feature_not_available', async () => {
    const db = new D1Mock()
    seed(db, 'starter')
    const res = await post(makeEnv(db), await cookie(), { moderation: 'post' })
    expect(res.status).toBe(403)
    const body = (await res.json()) as { error: { code: string; details: { feature: string } } }
    expect(body.error.code).toBe('feature_not_available')
    expect(body.error.details.feature).toBe('townhallQA')
  })

  it('rejects configuring a non-draft session', async () => {
    const db = new D1Mock()
    seed(db, 'team', 'live')
    const res = await post(makeEnv(db), await cookie(), { moderation: 'pre' })
    expect(res.status).toBe(409)
  })

  it('validates the moderation value', async () => {
    const db = new D1Mock()
    seed(db, 'team')
    const res = await post(makeEnv(db), await cookie(), { moderation: 'sometimes' })
    expect(res.status).toBe(400)
  })

  it('requires authentication', async () => {
    const db = new D1Mock()
    seed(db, 'team')
    const res = await createApp().fetch(
      new Request('http://local/api/sessions/sess_1/townhall/config', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ moderation: 'pre' }),
      }),
      makeEnv(db),
    )
    expect(res.status).toBe(401)
  })

  it('reads back the config via GET', async () => {
    const db = new D1Mock()
    seed(db, 'team')
    await post(makeEnv(db), await cookie(), { moderation: 'post' })
    const res = await createApp().fetch(
      new Request('http://local/api/sessions/sess_1/townhall/config', { headers: { cookie: await cookie() } }),
      makeEnv(db),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      data: { sessionMode: string; moderation: string | null; code: string; status: string; title: string }
    }
    // The presenter console needs code/status/title to gate the WebSocket on
    // lifecycle state and render the join link (see TownhallPresent).
    expect(body.data).toMatchObject({
      sessionMode: 'townhall',
      moderation: 'post',
      code: 'ABC123',
      status: 'draft',
      title: 'All-Hands',
    })
  })
})

function seedQuestion(db: D1Mock, over: Partial<import('../helpers/d1-mock').TownhallQuestionRow> = {}) {
  const row = {
    id: 'q1',
    session_id: 'sess_1',
    body: 'How is Q3 tracking?',
    display_name: null,
    author_hash: 'voterhash',
    status: 'answered',
    upvotes: 5,
    group_parent: null,
    was_spotlit: 1,
    created_at: 1000,
    resolved_at: 2000,
    ...over,
  }
  db.townhallQuestions.set(row.id, row)
  return row
}

describe('GET /api/sessions/:id/townhall/export', () => {
  it('returns JSON without author_hash', async () => {
    const db = new D1Mock()
    seed(db, 'team', 'live')
    seedQuestion(db)
    const res = await createApp().fetch(
      new Request('http://local/api/sessions/sess_1/townhall/export?format=json', { headers: { cookie: await cookie() } }),
      makeEnv(db),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { data: { questions: Array<Record<string, unknown>> } }
    expect(body.data.questions).toHaveLength(1)
    expect(body.data.questions[0]).toMatchObject({ id: 'q1', upvotes: 5, wasSpotlit: true })
    expect(body.data.questions[0]).not.toHaveProperty('author_hash')
    expect(body.data.questions[0]).not.toHaveProperty('authorHash')
  })

  it('returns CSV with a header row', async () => {
    const db = new D1Mock()
    seed(db, 'team', 'live')
    seedQuestion(db, { body: 'Has, a comma' })
    const res = await createApp().fetch(
      new Request('http://local/api/sessions/sess_1/townhall/export?format=csv', { headers: { cookie: await cookie() } }),
      makeEnv(db),
    )
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/csv')
    const text = await res.text()
    expect(text.split('\n')[0]).toContain('question_id')
    expect(text).toContain('"Has, a comma"') // comma escaped
  })

  it('blocks non-Team plans', async () => {
    const db = new D1Mock()
    seed(db, 'starter', 'live')
    const res = await createApp().fetch(
      new Request('http://local/api/sessions/sess_1/townhall/export', { headers: { cookie: await cookie() } }),
      makeEnv(db),
    )
    expect(res.status).toBe(403)
  })
})

describe('DELETE /api/sessions/:id/townhall/questions/:itemId', () => {
  it('purges a persisted question (GDPR)', async () => {
    const db = new D1Mock()
    seed(db, 'team', 'live')
    seedQuestion(db)
    const res = await createApp().fetch(
      new Request('http://local/api/sessions/sess_1/townhall/questions/q1', {
        method: 'DELETE',
        headers: { cookie: await cookie() },
      }),
      makeEnv(db),
    )
    expect(res.status).toBe(200)
    expect(db.townhallQuestions.has('q1')).toBe(false)
  })

  it('404s for an unknown question', async () => {
    const db = new D1Mock()
    seed(db, 'team', 'live')
    const res = await createApp().fetch(
      new Request('http://local/api/sessions/sess_1/townhall/questions/nope', {
        method: 'DELETE',
        headers: { cookie: await cookie() },
      }),
      makeEnv(db),
    )
    expect(res.status).toBe(404)
  })
})
