/**
 * INSIGHTS-09 / INSIGHTS-10 — ZK exclusion + crossSessionInsights entitlement contracts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../../functions/api/app'
import { signJwt } from '../../functions/api/lib/jwt'
import type { Env } from '../../functions/api/types'
import { D1Mock } from '../helpers/d1-mock'
import { KVMock } from '../helpers/kv-mock'
import { upsertInsightsDaily } from '../../functions/api/lib/team-insights'
import { writeKvJson } from '../../functions/api/lib/kv'
import { teamDocumentKey } from '../../functions/api/lib/kv-keys'
import type { Team } from '../../functions/api/routes/teams'

const TEST_JWT_SECRET = 'integration-test-secret-at-least-32-bytes!'

// The scorecard reads a rolling window relative to the real clock, so seeded
// days must be computed, not hardcoded — fixed dates fall out of range over time.
const isoDaysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)

function makeEnv(db: D1Mock, teamsKv: KVMock): Env {
  return {
    ENV: 'dev',
    PAGES_URL: 'http://local',
    API_URL: 'http://local',
    JWT_SECRET: TEST_JWT_SECRET,
    DB: db as unknown as D1Database,
    SESSIONS_KV: new KVMock() as unknown as KVNamespace,
    USERS_KV: new KVMock() as unknown as KVNamespace,
    TEAMS_KV: teamsKv as unknown as KVNamespace,
    TEMPLATES_KV: new KVMock() as unknown as KVNamespace,
    DECISIONS_KV: new KVMock() as unknown as KVNamespace,
    AUDIT_KV: new KVMock() as unknown as KVNamespace,
    ACTIONS_KV: new KVMock() as unknown as KVNamespace,
  } as unknown as Env
}

async function cookieFor(userId: string, email: string): Promise<string> {
  const token = await signJwt({ sub: userId, email }, TEST_JWT_SECRET, 3600)
  return `qesto_session=${token}`
}

describe('insights entitlement contracts (INSIGHTS-09/10)', () => {
  let db: D1Mock
  let teamsKv: KVMock
  let app: ReturnType<typeof createApp>
  let env: Env

  beforeEach(() => {
    // Freeze the clock: fixtures use fixed 2026-06-02 dates and the scorecard/export
    // filter by a relative 30-day window, so a real clock makes these fail once
    // wall-time drifts past the window.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-06-15T12:00:00Z'))
    db = new D1Mock()
    teamsKv = new KVMock()
    app = createApp()
    env = makeEnv(db, teamsKv)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('denies cross-session trends on starter plan', async () => {
    db.users.set('starter_u', {
      id: 'starter_u',
      email: 's@example.com',
      display_name: 's',
      created_at: Date.now(),
      last_login_at: null,
      plan: 'starter',
    })
    const team: Team = {
      id: 'team-s',
      name: 'S Team',
      ownerId: 'starter_u',
      plan: 'starter',
      samlConfig: null,
      members: [{ userId: 'starter_u', email: 's@example.com', role: 'owner', joinedAt: 1 }],
      createdAt: 1,
    }
    await writeKvJson(teamsKv as unknown as KVNamespace, teamDocumentKey('team-s'), team)
    const cookie = await cookieFor('starter_u', 's@example.com')

    const res = await app.fetch(
      new Request('http://local/api/teams/team-s/insights/trends', { headers: { cookie } }),
      env,
    )
    expect(res.status).toBe(403)
    const body = (await res.json()) as { error: { code: string; details: { feature: string } } }
    expect(body.error.code).toBe('feature_not_available')
    expect(body.error.details.feature).toBe('crossSessionInsights')
  })

  it('export JSON excludes ZK sessions from scorecard source (INSIGHTS-09)', async () => {
    db.users.set('team_u', {
      id: 'team_u',
      email: 't@example.com',
      display_name: 't',
      created_at: Date.now(),
      last_login_at: null,
      plan: 'team',
    })
    const team: Team = {
      id: 'team-zk',
      name: 'ZK Team',
      ownerId: 'team_u',
      plan: 'team',
      samlConfig: null,
      members: [{ userId: 'team_u', email: 't@example.com', role: 'owner', joinedAt: 1 }],
      createdAt: 1,
    }
    await writeKvJson(teamsKv as unknown as KVNamespace, teamDocumentKey('team-zk'), team)
    db.sessions.set('sess-zk', {
      id: 'sess-zk',
      owner_id: 'team_u',
      code: 'ZK0001',
      title: 'ZK Session',
      status: 'closed',
      anonymity: 'zero_knowledge',
      vote_policy: 'once',
      session_mode: 'reflection',
      created_at: 1000,
      started_at: 1000,
      closed_at: 2000,
      archived_at: null,
      team_id: 'team-zk',
    })
    await upsertInsightsDaily(db as unknown as D1Database, {
      id: 'rz',
      session_id: 'sess-zk',
      team_id: 'team-zk',
      day: isoDaysAgo(2),
      themes_json: '[]',
      confidence: 0.9,
      n_votes: 50,
      embedding_ref: false,
      computed_at: 1000,
    })
    db.sessions.set('sess-ok', {
      id: 'sess-ok',
      owner_id: 'team_u',
      code: 'OK0001',
      title: 'OK',
      status: 'closed',
      anonymity: 'full',
      vote_policy: 'once',
      session_mode: 'reflection',
      created_at: 1000,
      started_at: 1000,
      closed_at: 2000,
      archived_at: null,
      team_id: 'team-zk',
    })
    await upsertInsightsDaily(db as unknown as D1Database, {
      id: 'ro',
      session_id: 'sess-ok',
      team_id: 'team-zk',
      day: isoDaysAgo(2),
      themes_json: JSON.stringify([{ theme: 'Safety', count: 1, examples: [] }]),
      confidence: 0.6,
      n_votes: 10,
      embedding_ref: true,
      computed_at: 1000,
    })

    const cookie = await cookieFor('team_u', 't@example.com')
    const res = await app.fetch(
      new Request('http://local/api/teams/team-zk/insights/export?format=json', { headers: { cookie } }),
      env,
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      data: { scorecard: { teamSummary: { sessionsRun: number } } }
    }
    expect(body.data.scorecard.teamSummary.sessionsRun).toBe(1)
  })
})
