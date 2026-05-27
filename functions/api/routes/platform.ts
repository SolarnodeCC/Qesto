/**
 * Platform release, DR, scale proof, audits, migration (S69–S70).
 */
import { Hono } from 'hono'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import { adminMiddleware, type AdminVariables } from '../middleware/admin'
import { computeSloBudgets } from '../lib/slo'
import { readKvJson } from '../lib/kv'
import { sloCountersKvKey } from '../lib/slo'
import type { Env } from '../types'

const RELEASES = [
  { version: '3.2.0', codename: 'v3.2', status: 'ga', sprint: 66 },
  { version: '4.0.0-rc.1', codename: 'v4.0-rc', status: 'rc', sprint: 69 },
  { version: '4.0.0', codename: 'v4.0', status: 'ga', sprint: 70 },
  { version: '4.1.0-rc.1', codename: 'v4.1-rc', status: 'rc', sprint: 73 },
] as const

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mountPlatformRoutes(parent: any) {
  const pub = new Hono<{ Bindings: Env; Variables: { trace_id: string } }>()

  pub.get('/version', (c) =>
    c.json({
      ok: true,
      data: {
        api: '4.1.0-rc.1',
        realtimeDefault: c.env.REALTIME_V2_DEFAULT === 'true' ? 2 : 1,
        realtimeV2Enabled: c.env.REALTIME_V2_ENABLED === 'true',
        publicApi: { v1: 'deprecated', v2: 'maintained', v3: 'ga' },
        commit: c.env.COMMIT_SHA ?? 'unknown',
      },
      trace_id: c.get('trace_id'),
    }),
  )

  pub.get('/releases', (c) => c.json({ ok: true, data: { releases: RELEASES }, trace_id: c.get('trace_id') }))

  pub.get('/migration/v3', (c) =>
    c.json({
      ok: true,
      data: {
        from: ['v1', 'v2'],
        to: 'v3',
        breakingChanges: [],
        steps: [
          'Issue new API keys with read/write scopes',
          'Add Idempotency-Key on POST /api/v3/sessions',
          'Use GET /api/v3/residency for EU proof',
          'Migrate WebSocket clients to protocol v2 when REALTIME_V2_ENABLED',
        ],
        sunset: { v1: '2027-12-31', note: 'Sunset-Date header on /api/v1 responses' },
      },
      trace_id: c.get('trace_id'),
    }),
  )

  pub.get('/scale-proof', (c) =>
    c.json({
      ok: true,
      data: {
        targetVoters: 100_000,
        evidenceStatus: 'synthetic_baseline',
        nextGate: { sprint: 75, voters: 100_000, story: 'SCALE-PROOF-100K-01' },
        milestones: [
          { sprint: 60, voters: 10_000, status: 'recorded' },
          { sprint: 64, voters: 25_000, status: 'recorded' },
          { sprint: 68, voters: 50_000, status: 'recorded' },
          { sprint: 71, voters: 50_000, status: 'in_progress', harness: 'tests/load/k6-smoke.js' },
          { sprint: 75, voters: 100_000, status: 'planned' },
        ],
        sessionRoom: { voteEngineExtracted: true, coordinatorPattern: 'adr-0025' },
      },
      trace_id: c.get('trace_id'),
    }),
  )

  pub.get('/dr-readiness', (c) =>
    c.json({
      ok: true,
      data: {
        rtoTargetSeconds: 60,
        lastDrillAt: null,
        multiRegionFailover: c.env.MULTI_REGION_FAILOVER_ENABLED === 'true',
        stateKvBound: !!c.env.MULTI_REGION_STATE_KV,
        checklistPath: 'knowledge-base/operations/MULTI_REGION_DRILL_CHECKLIST.md',
      },
      trace_id: c.get('trace_id'),
    }),
  )

  parent.route('/api/platform', pub)

  const admin = new Hono<{ Bindings: Env; Variables: AuthVariables & AdminVariables }>()
  admin.use('*', authMiddleware)
  admin.use('*', adminMiddleware)

  admin.get('/audits', async (c) =>
    c.json({
      ok: true,
      data: {
        audits: [
          { id: 'SEC-PEN3-01', status: 'in_progress', scope: 'Pentest #3 (S71–S72)', sprint: 71 },
          { id: 'API-PLAT-AUDIT-01', status: 'scheduled', scope: 'Public API v3' },
          { id: 'WEBHOOK-AUDIT-01', status: 'scheduled', scope: 'Webhook signing + DLQ' },
          { id: 'LDAP-AUDIT-EXTERNAL-01', status: 'scheduled', scope: 'LDAP bridge' },
        ],
        pentest: {
          engagement: 3,
          status: 'execution',
          checklistPath: 'knowledge-base/quality/security/PENTEST_3_PREP.md',
          findings: [
            { id: 'PEN3-F01', severity: 'medium', status: 'open', title: 'Review push subscription TTL' },
            { id: 'PEN3-F02', severity: 'low', status: 'remediated', title: 'Mount platform routes in app.ts' },
          ],
        },
      },
      trace_id: c.get('trace_id'),
    }),
  )

  admin.get('/slo', async (c) => {
    const counters =
      c.env.METRICS_KV ? await readKvJson<Record<string, { ok: number; total: number }>>(c.env.METRICS_KV, sloCountersKvKey()) : null
    const budgets = computeSloBudgets(counters ?? {})
    return c.json({ ok: true, data: { budgets }, trace_id: c.get('trace_id') })
  })

  parent.route('/api/admin/platform', admin)
}
