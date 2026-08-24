import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../../functions/api/app'
import { writeKvJson } from '../../functions/api/lib/kv'
import { teamDocumentKey } from '../../functions/api/lib/kv-keys'
import { signJwt } from '../../functions/api/lib/jwt'
import type { Team } from '../../functions/api/routes/teams'
import type { Env, PlanTier } from '../../functions/api/types'
import { D1Mock } from '../helpers/d1-mock'
import { KVMock } from '../helpers/kv-mock'

const TEST_JWT_SECRET = 'integration-test-secret-at-least-32-bytes!'
const TEAM_ID = 'team-insights-refresh'
const DEBOUNCE_MS = 60_000

function buildEnv(db: D1Mock, teamsKv: KVMock): Env {
  return {
    ENV: 'dev',
    JWT_SECRET: TEST_JWT_SECRET,
    DB: db as unknown as D1Database,
    TEAMS_KV: teamsKv as unknown as KVNamespace,
    USERS_KV: new KVMock() as unknown as KVNamespace,
    SESSIONS_KV: new KVMock() as unknown as KVNamespace,
    ACTIONS_KV: new KVMock() as unknown as KVNamespace,
    DECISIONS_KV: new KVMock() as unknown as KVNamespace,
    AI: { run: vi.fn() },
    DECISIONS_VECTORIZE: { query: vi.fn(), insert: vi.fn(), upsert: vi.fn() },
  } as unknown as Env
}

async function cookieFor(userId = 'owner', email = 'owner@example.com'): Promise<string> {
  const token = await signJwt({ sub: userId, email }, TEST_JWT_SECRET, 3600)
  return `qesto_session=${token}`
}

async function seedTeam(db: D1Mock, teamsKv: KVMock, plan: PlanTier = 'team'): Promise<Team> {
  db.users.set('owner', {
    id: 'owner',
    email: 'owner@example.com',
    display_name: 'owner',
    created_at: Date.now(),
    last_login_at: null,
    plan,
  })
  const team: Team = {
    id: TEAM_ID,
    name: 'Insights Refresh Team',
    ownerId: 'owner',
    plan,
    samlConfig: null,
    members: [{ userId: 'owner', email: 'owner@example.com', role: 'owner', joinedAt: 1 }],
    createdAt: 1,
  }
  await writeKvJson(teamsKv as unknown as KVNamespace, teamDocumentKey(TEAM_ID), team)
  return team
}

function seedRollup(db: D1Mock, computedAt: number): void {
  db.teamInsightRollups.set(`${TEAM_ID}:recurring_themes:30d`, {
    team_id: TEAM_ID,
    kind: 'recurring_themes',
    window: '30d',
    payload_json: '{}',
    computed_at: computedAt,
  })
}

async function refresh(env: Env, cookie?: string): Promise<Response> {
  const init: RequestInit = { method: 'POST' }
  if (cookie) init.headers = { cookie }
  return createApp().fetch(
    new Request(`http://local/api/teams/${TEAM_ID}/insights/refresh`, init),
    env,
  )
}

describe('team insights refresh route', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-07-18T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('refreshes all insight windows when no prior rollup exists', async () => {
    const db = new D1Mock()
    const teamsKv = new KVMock()
    await seedTeam(db, teamsKv)
    const res = await refresh(buildEnv(db, teamsKv), await cookieFor())

    expect(res.status).toBe(200)
    const body = (await res.json()) as { data: { refreshed: boolean; windows: string[]; debounced?: boolean } }
    expect(body.data).toMatchObject({
      refreshed: true,
      windows: ['30d', '90d', '180d'],
    })
    expect(body.data.debounced).toBeUndefined()
    expect(db.teamInsightRollups.size).toBe(9)
  })

  it('debounces repeated refreshes when a recent rollup already exists', async () => {
    const db = new D1Mock()
    const teamsKv = new KVMock()
    await seedTeam(db, teamsKv)
    seedRollup(db, Date.now() - 30_000)
    const res = await refresh(buildEnv(db, teamsKv), await cookieFor())

    expect(res.status).toBe(200)
    const body = (await res.json()) as { data: { refreshed: boolean; debounced: boolean; windows?: string[] } }
    expect(body.data.refreshed).toBe(false)
    expect(body.data.debounced).toBe(true)
    expect(body.data.windows).toBeUndefined()
    expect(db.teamInsightRollups.size).toBe(1)
  })

  it('allows refresh when the newest rollup is outside the debounce window', async () => {
    const db = new D1Mock()
    const teamsKv = new KVMock()
    await seedTeam(db, teamsKv)
    seedRollup(db, Date.now() - DEBOUNCE_MS - 1)
    const res = await refresh(buildEnv(db, teamsKv), await cookieFor())

    expect(res.status).toBe(200)
    const body = (await res.json()) as { data: { refreshed: boolean; debounced?: boolean; windows: string[] } }
    expect(body.data.refreshed).toBe(true)
    expect(body.data.debounced).toBeUndefined()
    expect(body.data.windows).toEqual(['30d', '90d', '180d'])
    expect(db.teamInsightRollups.size).toBe(9)
  })

  it('requires the caller to be a team member', async () => {
    const db = new D1Mock()
    const teamsKv = new KVMock()
    await seedTeam(db, teamsKv)
    db.users.set('outsider', {
      id: 'outsider',
      email: 'outsider@example.com',
      display_name: 'outsider',
      created_at: Date.now(),
      last_login_at: null,
      plan: 'team',
    })
    const res = await refresh(buildEnv(db, teamsKv), await cookieFor('outsider', 'outsider@example.com'))

    expect(res.status).toBe(403)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('forbidden')
  })

  it('requires the cross-session insights feature entitlement', async () => {
    const db = new D1Mock()
    const teamsKv = new KVMock()
    await seedTeam(db, teamsKv, 'starter')
    const res = await refresh(buildEnv(db, teamsKv), await cookieFor())

    expect(res.status).toBe(403)
    const body = (await res.json()) as { error: { code: string; details: { feature: string } } }
    expect(body.error.code).toBe('feature_not_available')
    expect(body.error.details.feature).toBe('crossSessionInsights')
  })
})
