import { describe, it, expect, vi } from 'vitest'
import { buildPlatformOverview } from '../../functions/api/routes/admin/platform-overview'
import type { Env } from '../../functions/api/types'

// Minimal D1 mock: prepare(sql) returns a chainable stub whose first()/all()
// resolve based on which query is running. bind() is a no-op passthrough.
function makeDb(opts: {
  d1Throws?: boolean
  usersThrows?: boolean
  userRow?: Record<string, number>
  incidents?: Array<{ id: string; severity: number; title: string; created_at: number }>
}) {
  const prepare = (sql: string) => {
    const exec = {
      async first<T>(): Promise<T | null> {
        if (sql.includes('SELECT 1')) {
          if (opts.d1Throws) throw new Error('d1 down')
          return { 1: 1 } as unknown as T
        }
        if (sql.includes('FROM users')) {
          if (opts.usersThrows) throw new Error('users query failed')
          return (opts.userRow ?? {
            total_users: 0,
            signups_today: 0,
            active_subs: 0,
            starter_count: 0,
            team_count: 0,
          }) as unknown as T
        }
        return null
      },
      async all<T>(): Promise<{ results: T[] }> {
        if (sql.includes('FROM incidents')) {
          return { results: (opts.incidents ?? []) as unknown as T[] }
        }
        return { results: [] }
      },
      bind() {
        return exec
      },
    }
    return exec
  }
  return { prepare } as unknown as Env['DB']
}

function makeEnv(over: Partial<Env> & { DB: Env['DB'] }): Env {
  return {
    ENV: 'dev',
    STARTER_MONTHLY_EUR_CENTS: '900',
    TEAM_ANNUAL_EUR_CENTS: '12000',
    ...over,
  } as unknown as Env
}

describe('buildPlatformOverview', () => {
  it('reports healthy D1 with measured latency on a successful probe', async () => {
    const env = makeEnv({ DB: makeDb({}) })
    const o = await buildPlatformOverview(env)
    expect(o.components.d1.status).toBe('healthy')
    expect(o.components.d1.metric).toBeGreaterThanOrEqual(0)
    expect(o.cached).toBe(false)
  })

  it('marks D1 down and synthesises a SEV1 alert when the probe throws', async () => {
    const env = makeEnv({ DB: makeDb({ d1Throws: true }) })
    const o = await buildPlatformOverview(env)
    expect(o.components.d1.status).toBe('down')
    expect(o.degraded_sources).toContain('d1')
    expect(o.alerts.some((a) => a.source === 'health' && a.severity === 1 && a.title.includes('D1'))).toBe(true)
  })

  it('computes the business snapshot from a single users aggregation', async () => {
    const env = makeEnv({
      DB: makeDb({
        userRow: { total_users: 100, signups_today: 5, active_subs: 12, starter_count: 8, team_count: 4 },
      }),
    })
    const o = await buildPlatformOverview(env)
    expect(o.business.total_users).toBe(100)
    expect(o.business.signups_today).toBe(5)
    expect(o.business.active_subscriptions).toBe(12)
    // 8 starters * 900 + 4 team * (12000/12=1000) = 7200 + 4000 = 11200 cents (30d)
    expect(o.business.revenue.window_30d_cents).toBe(11200)
    expect(o.business.revenue.window_7d_cents).toBe(Math.round((11200 * 7) / 30))
    expect(o.business.is_estimate).toBe(true)
  })

  it('flags metrics_kv degraded and live data synthetic when METRICS_KV is absent', async () => {
    const env = makeEnv({ DB: makeDb({}) })
    const o = await buildPlatformOverview(env)
    expect(o.degraded_sources).toContain('metrics_kv')
    expect(o.live_now.synthetic).toBe(true)
    expect(o.live_now.active_sessions).toBe(0)
  })

  it('surfaces open incidents sorted by severity (highest first)', async () => {
    const env = makeEnv({
      DB: makeDb({
        incidents: [
          { id: 'i3', severity: 3, title: 'minor', created_at: 1 },
          { id: 'i1', severity: 1, title: 'major', created_at: 2 },
        ],
      }),
    })
    const o = await buildPlatformOverview(env)
    const incidentAlerts = o.alerts.filter((a) => a.source === 'incident')
    expect(incidentAlerts[0]?.severity).toBe(1)
    expect(incidentAlerts.map((a) => a.id)).toEqual(['i1', 'i3'])
  })

  it('treats Workers AI as healthy-but-synthetic (no first-party feed)', async () => {
    const env = makeEnv({ DB: makeDb({}) })
    const o = await buildPlatformOverview(env)
    expect(o.components.workers_ai.status).toBe('healthy')
    expect(o.components.workers_ai.synthetic).toBe(true)
  })

  it('probes Vectorize via describe() and measures latency', async () => {
    const describe = vi.fn().mockResolvedValue({ dimensions: 768 })
    const env = makeEnv({
      DB: makeDb({}),
      DECISIONS_VECTORIZE: { describe } as unknown as Env['DECISIONS_VECTORIZE'],
      HELP_VECTORIZE: { describe } as unknown as Env['HELP_VECTORIZE'],
    })
    const o = await buildPlatformOverview(env)
    expect(describe).toHaveBeenCalled()
    expect(o.components.vectorize.status).toBe('healthy')
  })
})
