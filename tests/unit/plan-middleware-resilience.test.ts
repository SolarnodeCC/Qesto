import { Hono } from 'hono'
import { testJwtSecret } from '../helpers/test-credentials'
import { describe, expect, it } from 'vitest'
import { planMiddleware } from '../../functions/api/middleware/plan'
import type { AuthVariables } from '../../functions/api/middleware/auth'
import type { PlanVariables } from '../../functions/api/middleware/plan'
import type { Env } from '../../functions/api/types'
import { PLAN_QUOTAS } from '../../functions/api/types'
import { D1Mock } from '../helpers/d1-mock'

type Vars = AuthVariables & PlanVariables

function makeApp() {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()
  app.use('*', async (c, next) => {
    c.set('trace_id', 'trace-test')
    c.set('user', { sub: 'user_1', email: 'user@example.com', iat: 1, exp: 2 })
    await next()
  })
  app.use('*', planMiddleware)
  app.get('/probe', (c) => c.json({
    ok: true,
    data: {
      plan: c.get('plan'),
      maxSessionsPerMonth: c.get('planQuotas').maxSessionsPerMonth,
    },
  }))
  return app
}

function makeEnv(db: D1Database): Env {
  return {
    ENV: 'dev',
    PAGES_URL: 'http://local',
    API_URL: 'http://local',
    JWT_SECRET: testJwtSecret(),
    DB: db,
  } as unknown as Env
}

describe('planMiddleware resilience', () => {
  it('sets the user plan from D1 when lookup succeeds', async () => {
    const db = new D1Mock()
    db.users.set('user_1', {
      id: 'user_1',
      email: 'user@example.com',
      display_name: null,
      created_at: Date.now(),
      last_login_at: null,
      plan: 'team',
    })

    const res = await makeApp().fetch(new Request('http://local/probe'), makeEnv(db as unknown as D1Database))
    expect(res.status).toBe(200)
    const body = await res.json() as { data: { plan: string; maxSessionsPerMonth: number } }
    expect(body.data.plan).toBe('team')
    expect(body.data.maxSessionsPerMonth).toBe(PLAN_QUOTAS.team.maxSessionsPerMonth)
  })

  it('falls back to the free plan when D1 lookup fails', async () => {
    const failingDb = {
      prepare: () => ({
        bind: () => ({
          first: async () => {
            throw new Error('D1 unavailable')
          },
        }),
      }),
    } as unknown as D1Database

    const res = await makeApp().fetch(new Request('http://local/probe'), makeEnv(failingDb))
    expect(res.status).toBe(200)
    const body = await res.json() as { data: { plan: string; maxSessionsPerMonth: number } }
    expect(body.data.plan).toBe('free')
    expect(body.data.maxSessionsPerMonth).toBe(PLAN_QUOTAS.free.maxSessionsPerMonth)
  })
})
