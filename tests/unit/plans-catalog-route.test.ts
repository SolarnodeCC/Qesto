import { describe, expect, it } from 'vitest'
import { createApp } from '../../functions/api/app'
import { PLAN_QUOTAS } from '../../functions/api/types'
import type { Env } from '../../functions/api/types'
import { D1Mock } from '../helpers/d1-mock'
import { KVMock } from '../helpers/kv-mock'

function kv(): KVNamespace {
  return new KVMock() as unknown as KVNamespace
}

function makeEnv(): Env {
  return {
    ENV: 'dev',
    PAGES_URL: 'http://local',
    API_URL: 'http://local',
    JWT_SECRET: 'integration-test-secret-at-least-32-bytes!',
    DB: new D1Mock() as unknown as D1Database,
    USERS_KV: kv(),
    SESSIONS_KV: kv(),
    TEAMS_KV: kv(),
    TEMPLATES_KV: kv(),
    DECISIONS_KV: kv(),
    AUDIT_KV: kv(),
    ACTIONS_KV: kv(),
    COMMIT_SHA: 'test',
  } as unknown as Env
}

describe('GET /api/plans/catalog (WS6)', () => {
  it('returns authoritative PLAN_QUOTAS rows without auth', async () => {
    const app = createApp()
    const res = await app.fetch(new Request('http://local/api/plans/catalog'), makeEnv())
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      ok: boolean
      data: {
        free: { max_sessions_per_month: number; max_participants_per_session: number }
      }
    }
    expect(body.ok).toBe(true)
    expect(body.data.free.max_sessions_per_month).toBe(PLAN_QUOTAS.free.maxSessionsPerMonth)
    expect(body.data.free.max_participants_per_session).toBe(PLAN_QUOTAS.free.maxParticipantsPerSession)
  })
})
