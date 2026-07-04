// INCIDENT-2026-07-03 regression guard: planMiddleware/authMiddleware are
// registered app.use('*') on ~12 sub-apps that all mount at the /api root
// (ARCH-HONO-01/02), so requests routed through sub-apps mounted LATE in
// functions/api/app.ts inherit every earlier wildcard registration. The
// production tail during the incident showed this precisely:
//   GET /api/sessions                    -> 1 plan_middleware.db_failure  (mounted early, line ~280)
//   GET /api/teams/:id/workspaces        -> 9 plan_middleware.db_failure  (mounted late, line ~339)
//   GET /api/teams/:id/insights/scorecard -> 7 plan_middleware.db_failure (mounted late, line ~296)
// Each failure was its own `SELECT plan FROM users` D1 read, stacking 1500ms
// timeouts during the D1 storage-reset fault. The unit-level fix
// (tests/unit/plan-middleware-resilience.test.ts) proves the middleware
// itself is idempotent; this test proves it holds through the REAL
// createApp() mount stack, on the exact late-mounted route the incident hit.
import { describe, expect, it } from 'vitest'
import { createApp } from '../../functions/api/app'
import { signJwt } from '../../functions/api/lib/jwt'
import { teamDocumentKey } from '../../functions/api/lib/kv-keys'
import type { Env } from '../../functions/api/types'
import { D1Mock } from '../helpers/d1-mock'
import { KVMock } from '../helpers/kv-mock'

const TEST_JWT_SECRET = 'integration-test-secret-at-least-32-bytes!'

function kv(): KVNamespace {
  return new KVMock() as unknown as KVNamespace
}

/** Wraps D1Mock so prepare() calls matching a plan lookup are counted. */
function countingDb(db: D1Mock): { db: D1Database; planLookups: () => number } {
  let planLookups = 0
  const wrapped = {
    prepare: (sql: string) => {
      if (sql.includes('SELECT plan FROM users')) planLookups++
      return db.prepare(sql)
    },
    batch: db.batch.bind(db),
  } as unknown as D1Database
  return { db: wrapped, planLookups: () => planLookups }
}

function makeEnv(db: D1Database, teamsKv: KVNamespace): Env {
  return {
    ENV: 'dev',
    PAGES_URL: 'http://local',
    API_URL: 'http://local',
    JWT_SECRET: TEST_JWT_SECRET,
    DB: db,
    USERS_KV: kv(),
    SESSIONS_KV: kv(),
    TEAMS_KV: teamsKv,
    TEMPLATES_KV: kv(),
    DECISIONS_KV: kv(),
    AUDIT_KV: kv(),
    ACTIONS_KV: kv(),
  } as unknown as Env
}

async function cookieFor(userId: string, email: string): Promise<string> {
  const token = await signJwt({ sub: userId, email }, TEST_JWT_SECRET, 3600)
  return `qesto_session=${token}`
}

describe('duplicate /api-root mounts do not amplify D1 plan/auth load', () => {
  it('GET /api/teams/:id/workspaces (a late-mounted route) issues exactly one plan lookup', async () => {
    const rawDb = new D1Mock()
    rawDb.users.set('u1', {
      id: 'u1',
      email: 'u1@example.com',
      display_name: null,
      created_at: Date.now(),
      last_login_at: null,
      plan: 'team',
    })
    const { db, planLookups } = countingDb(rawDb)
    const teamsKv = kv()
    await teamsKv.put(
      teamDocumentKey('team_1'),
      JSON.stringify({
        id: 'team_1',
        name: 'Team',
        ownerId: 'u1',
        members: [{ userId: 'u1', email: 'u1@example.com', role: 'owner', joinedAt: Date.now() }],
        plan: 'team',
        samlConfig: null,
        createdAt: Date.now(),
      }),
    )
    const app = createApp()
    const cookie = await cookieFor('u1', 'u1@example.com')

    const res = await app.fetch(
      new Request('http://local/api/teams/team_1/workspaces', { headers: { cookie } }),
      makeEnv(db, teamsKv),
    )

    expect(res.status).toBe(200)
    // The load-bearing assertion: this route is mounted after ~30 sub-apps
    // that each register app.use('*', planMiddleware) at the /api root.
    // Before the fix, this route (or its sibling /insights/scorecard) is
    // exactly what produced 7-9 plan_middleware.db_failure log lines per
    // request in production. It must be 1.
    expect(planLookups()).toBe(1)
  })
})
