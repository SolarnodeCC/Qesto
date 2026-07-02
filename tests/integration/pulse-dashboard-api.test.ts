import { describe, expect, it } from 'vitest'
import { createApp } from '../../functions/api/app'
import { signJwt } from '../../functions/api/lib/jwt'
import { teamDocumentKey } from '../../functions/api/lib/kv-keys'
import { writeKvJson } from '../../functions/api/lib/kv'
import type { Team } from '../../functions/api/routes/teams'
import { D1Mock } from '../helpers/d1-mock'
import { KVMock } from '../helpers/kv-mock'
import { PULSE_K_ANON_MIN_COHORT } from '../../functions/api/lib/pulse-aggregation'

const SECRET = 'integration-test-secret-at-least-32-bytes!'

async function cookieFor(userId: string, email: string): Promise<string> {
  return `qesto_session=${await signJwt({ sub: userId, email }, SECRET, 3600)}`
}

describe('PULSE dashboard API (FE-PULSE-DASHBOARD-01 backend)', () => {
  it('team member can read pulse summary with k-anon masking', async () => {
    const db = new D1Mock()
    const teamsKv = new KVMock()
    const userId = 'pulse_user_1'
    const teamId = 'team_pulse_1'
    const now = Date.now()

    db.users.set(userId, {
      id: userId,
      email: 'pulse@example.com',
      display_name: 'Pulse User',
      created_at: now,
      last_login_at: now,
      plan: 'team',
    })

    const team: Team = {
      id: teamId,
      name: 'Pulse Team',
      ownerId: userId,
      members: [],
      plan: 'team',
      samlConfig: null,
      createdAt: now,
    }
    await writeKvJson(teamsKv as unknown as KVNamespace, teamDocumentKey(teamId), team)

    // Use dates within the 30-day window (today is 2026-07-02, window starts 2026-06-02)
    db.pulseTeamDaily.set(`${teamId}:2026-06-02`, {
      team_id: teamId,
      day: '2026-06-02',
      participation_avg: 0.75,
      sentiment_avg: 0.5,
      session_count: PULSE_K_ANON_MIN_COHORT,
      response_total: 120,
      computed_at: now,
    })
    db.pulseTeamDaily.set(`${teamId}:2026-07-01`, {
      team_id: teamId,
      day: '2026-07-01',
      participation_avg: 0.4,
      sentiment_avg: 0.2,
      session_count: PULSE_K_ANON_MIN_COHORT - 1,
      response_total: 8,
      computed_at: now,
    })

    const env = {
      ENV: 'dev',
      PAGES_URL: 'http://local',
      API_URL: 'http://local',
      JWT_SECRET: SECRET,
      DB: db as unknown as D1Database,
      TEAMS_KV: teamsKv as unknown as KVNamespace,
      USERS_KV: new KVMock() as unknown as KVNamespace,
      SESSIONS_KV: new KVMock() as unknown as KVNamespace,
      TEMPLATES_KV: new KVMock() as unknown as KVNamespace,
      DECISIONS_KV: new KVMock() as unknown as KVNamespace,
      AUDIT_KV: new KVMock() as unknown as KVNamespace,
      ACTIONS_KV: new KVMock() as unknown as KVNamespace,
      METRICS_AE: { writeDataPoint: () => {} } as unknown as AnalyticsEngineDataset,
    } as unknown as import('../../functions/api/types').Env

    const app = createApp()
    const res = await app.fetch(
      new Request(`http://local/api/teams/${teamId}/pulse/summary?window=30d`, {
        headers: { cookie: await cookieFor(userId, 'pulse@example.com') },
      }),
      env,
    )

    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      ok: boolean
      data: { teamId: string; window: string; series: Array<{ masked: boolean }> }
    }
    expect(body.ok).toBe(true)
    expect(body.data.teamId).toBe(teamId)
    expect(body.data.series.some((row) => row.masked === false)).toBe(true)
    expect(body.data.series.some((row) => row.masked === true)).toBe(true)
  })

  it('free plan user receives feature gate on pulse summary', async () => {
    const db = new D1Mock()
    const teamsKv = new KVMock()
    const userId = 'pulse_free_1'
    const teamId = 'team_pulse_free'
    const now = Date.now()

    db.users.set(userId, {
      id: userId,
      email: 'free@example.com',
      display_name: 'Free',
      created_at: now,
      last_login_at: now,
      plan: 'free',
    })

    await writeKvJson(
      teamsKv as unknown as KVNamespace,
      teamDocumentKey(teamId),
      {
        id: teamId,
        name: 'Free Team',
        ownerId: userId,
        members: [],
        plan: 'free',
        samlConfig: null,
        createdAt: now,
      } satisfies Team,
    )

    const env = {
      ENV: 'dev',
      PAGES_URL: 'http://local',
      API_URL: 'http://local',
      JWT_SECRET: SECRET,
      DB: db as unknown as D1Database,
      TEAMS_KV: teamsKv as unknown as KVNamespace,
      USERS_KV: new KVMock() as unknown as KVNamespace,
      SESSIONS_KV: new KVMock() as unknown as KVNamespace,
      TEMPLATES_KV: new KVMock() as unknown as KVNamespace,
      DECISIONS_KV: new KVMock() as unknown as KVNamespace,
      AUDIT_KV: new KVMock() as unknown as KVNamespace,
      ACTIONS_KV: new KVMock() as unknown as KVNamespace,
      METRICS_AE: { writeDataPoint: () => {} } as unknown as AnalyticsEngineDataset,
    } as unknown as import('../../functions/api/types').Env

    const app = createApp()
    const res = await app.fetch(
      new Request(`http://local/api/teams/${teamId}/pulse/summary?window=30d`, {
        headers: { cookie: await cookieFor(userId, 'free@example.com') },
      }),
      env,
    )

    expect(res.status).toBe(403)
    const body = (await res.json()) as { error: { details: { feature: string } } }
    expect(body.error.details.feature).toBe('pulseAnalytics')
  })
})
