// TOWNHALL-06 (ADR-0044): REST config endpoint — draft-only, Team-tier only.

import { describe, expect, it } from 'vitest'
import { createApp } from '../../functions/api/app'
import { signJwt } from '../../functions/api/lib/jwt'
import type { Env } from '../../functions/api/types'
import { D1Mock } from '../helpers/d1-mock'
import { KVMock } from '../helpers/kv-mock'

const SECRET = 'integration-test-secret-at-least-32-bytes!'
const USER_ID = 'user_host_1'

const kv = () => new KVMock() as unknown as KVNamespace

function makeEnv(db: D1Mock): Env {
  return {
    ENV: 'dev',
    PAGES_URL: 'http://local',
    API_URL: 'http://local',
    JWT_SECRET: SECRET,
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
  return `qesto_session=${await signJwt({ sub: userId, email: `${userId}@example.com` }, SECRET, 3600)}`
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
    const body = (await res.json()) as { data: { sessionMode: string; moderation: string | null } }
    expect(body.data).toMatchObject({ sessionMode: 'townhall', moderation: 'post' })
  })
})
