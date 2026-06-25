import { describe, expect, it } from 'vitest'
import { createApp } from '../../functions/api/app'
import { signJwt } from '../../functions/api/lib/jwt'
import { D1Mock } from '../helpers/d1-mock'
import { KVMock } from '../helpers/kv-mock'

const SECRET = 'integration-test-secret-at-least-32-bytes!'

async function cookieFor(userId: string, email: string): Promise<string> {
  return `qesto_session=${await signJwt({ sub: userId, email }, SECRET, 3600)}`
}

describe('LEARN instructor analytics API (FE-LEARN-INSTRUCTOR-01)', () => {
  it('returns cohort summary JSON for authenticated instructor', async () => {
    const db = new D1Mock()
    const userId = 'learn_instr_1'
    const now = Date.now()
    db.users.set(userId, {
      id: userId,
      email: 'instructor@example.com',
      display_name: 'Instructor',
      created_at: now,
      last_login_at: now,
      plan: 'starter',
    })

    const env = {
      ENV: 'dev',
      PAGES_URL: 'http://local',
      API_URL: 'http://local',
      JWT_SECRET: SECRET,
      DB: db as unknown as D1Database,
      USERS_KV: new KVMock() as unknown as KVNamespace,
      SESSIONS_KV: new KVMock() as unknown as KVNamespace,
      TEAMS_KV: new KVMock() as unknown as KVNamespace,
      TEMPLATES_KV: new KVMock() as unknown as KVNamespace,
      DECISIONS_KV: new KVMock() as unknown as KVNamespace,
      AUDIT_KV: new KVMock() as unknown as KVNamespace,
      ACTIONS_KV: new KVMock() as unknown as KVNamespace,
      METRICS_AE: { writeDataPoint: () => {} } as unknown as AnalyticsEngineDataset,
    } as unknown as import('../../functions/api/types').Env

    const app = createApp()
    const res = await app.fetch(
      new Request('http://local/api/learn/instructor/analytics', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: await cookieFor(userId, 'instructor@example.com'),
        },
        body: JSON.stringify({
          configs: [{ questionId: 'q1', weight: 1, partialCredit: 'all_or_nothing' }],
          cohort: [
            { participantId: 'p1', responses: [{ questionId: 'q1', correct: 1, incorrect: 0, required: 1 }] },
            { participantId: 'p2', responses: [{ questionId: 'q1', correct: 1, incorrect: 0, required: 1 }] },
            { participantId: 'p3', responses: [{ questionId: 'q1', correct: 0, incorrect: 1, required: 1 }] },
          ],
          passThreshold: 60,
        }),
      }),
      env,
    )

    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      ok: boolean
      data: { analytics: { summary: { participants: number; passRate: number } } }
    }
    expect(body.ok).toBe(true)
    expect(body.data.analytics.summary.participants).toBe(3)
    expect(body.data.analytics.summary.passRate).toBeCloseTo(0.67, 2)
  })

  it('exports CSV when format=csv', async () => {
    const db = new D1Mock()
    const userId = 'learn_csv_1'
    const now = Date.now()
    db.users.set(userId, {
      id: userId,
      email: 'csv@example.com',
      display_name: 'CSV',
      created_at: now,
      last_login_at: now,
      plan: 'starter',
    })

    const env = {
      ENV: 'dev',
      PAGES_URL: 'http://local',
      API_URL: 'http://local',
      JWT_SECRET: SECRET,
      DB: db as unknown as D1Database,
      USERS_KV: new KVMock() as unknown as KVNamespace,
      SESSIONS_KV: new KVMock() as unknown as KVNamespace,
      TEAMS_KV: new KVMock() as unknown as KVNamespace,
      TEMPLATES_KV: new KVMock() as unknown as KVNamespace,
      DECISIONS_KV: new KVMock() as unknown as KVNamespace,
      AUDIT_KV: new KVMock() as unknown as KVNamespace,
      ACTIONS_KV: new KVMock() as unknown as KVNamespace,
      METRICS_AE: { writeDataPoint: () => {} } as unknown as AnalyticsEngineDataset,
    } as unknown as import('../../functions/api/types').Env

    const app = createApp()
    const res = await app.fetch(
      new Request('http://local/api/learn/instructor/analytics', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: await cookieFor(userId, 'csv@example.com'),
        },
        body: JSON.stringify({
          configs: [{ questionId: 'q1', weight: 1, partialCredit: 'all_or_nothing' }],
          cohort: [
            { participantId: 'p1', responses: [{ questionId: 'q1', correct: 1, incorrect: 0, required: 1 }] },
          ],
          format: 'csv',
        }),
      }),
      env,
    )

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toMatch(/text\/csv/)
    const csv = await res.text()
    expect(csv).toContain('participant_id')
  })
})
