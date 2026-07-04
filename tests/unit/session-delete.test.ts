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

describe('DELETE /api/sessions/:id', () => {
  it('hard-deletes session and child rows', async () => {
    const db = new D1Mock()
    db.users.set(USER_ID, {
      id: USER_ID,
      email: `${USER_ID}@example.com`,
      display_name: 'Host',
      created_at: Date.now(),
      last_login_at: null,
      plan: 'team',
    })
    db.userRoles.set('role_1', { user_id: USER_ID, role: 'owner' })
    db.sessions.set('sess_del', {
      id: 'sess_del',
      owner_id: USER_ID,
      code: 'DEL123',
      title: 'To delete',
      status: 'closed',
      anonymity: 'full',
      created_at: Date.now(),
      started_at: Date.now(),
      closed_at: Date.now(),
      archived_at: null,
    })
    db.questions.set('q1', {
      id: 'q1',
      session_id: 'sess_del',
      position: 0,
      kind: 'poll',
      prompt: 'Q?',
      options_json: '[]',
      created_at: Date.now(),
    })
    db.votes.set('v1', {
      id: 'v1',
      session_id: 'sess_del',
      question_id: 'q1',
      voter_id: 'voter1',
      option_id: 'a',
      submitted_at: Date.now(),
    })
    db.insightsDaily.set('ins1', {
      id: 'ins1',
      session_id: 'sess_del',
      day: '2026-05-01',
      themes_json: '[]',
      confidence: 0.9,
      n_votes: 1,
      computed_at: Date.now(),
    })

    const app = createApp()
    const cookie = await cookieFor(USER_ID)
    const res = await app.fetch(
      new Request('http://local/api/sessions/sess_del', {
        method: 'DELETE',
        headers: { cookie },
      }),
      makeEnv(db),
    )

    expect(res.status).toBe(200)
    expect(db.sessions.has('sess_del')).toBe(false)
    expect(db.questions.has('q1')).toBe(false)
    expect(db.votes.has('v1')).toBe(false)
    expect(db.insightsDaily.has('ins1')).toBe(false)
  })
})
