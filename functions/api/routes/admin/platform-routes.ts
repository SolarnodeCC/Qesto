/** Platform KPIs and operational analytics routes. */
import type { Hono } from 'hono'
import { authMiddleware, type AuthVariables } from '../../middleware/auth'
import { adminMiddleware, type AdminVariables } from '../../middleware/admin'
import type { Env } from '../../types'
import { aggregateLiveMetrics } from './metrics'
import { metricsKv } from './schema-patch'
import type { HourlyCorrelation, OpsSummary, PlatformKpis, ServiceStatus } from './types'
import { mountAnalyticsAdminRoutes } from './platform/analytics'
import { mountPerfAdminRoutes } from './platform/perf'
import { mountSprint19AdminRoutes } from './platform/sprint19'

type AdminApp = Hono<{ Bindings: Env; Variables: AuthVariables & AdminVariables }>

export function mountPlatformAdminRoutes(app: AdminApp): void {
  // ── GET /api/admin/kpis ─────────────────────────────────────────────────────
  app.get('/kpis', authMiddleware, adminMiddleware, async (c) => {
    const trace_id = c.get('trace_id')
    const todayStart = new Date()
    todayStart.setUTCHours(0, 0, 0, 0)
    const monthStart = new Date()
    monthStart.setUTCDate(1)
    monthStart.setUTCHours(0, 0, 0, 0)

    let liveSessions = 0
    const kv = metricsKv(c.env)
    if (kv) {
      const agg = await aggregateLiveMetrics(kv, 5)
      liveSessions = agg.active_sessions
    }

    try {
      const [usersRes, todayRes, monthRes, totalRes] = await Promise.all([
        c.env.DB.prepare('SELECT COUNT(*) as n FROM users').first<{ n: number }>(),
        c.env.DB.prepare('SELECT COUNT(*) as n FROM sessions WHERE created_at >= ?1').bind(todayStart.getTime()).first<{ n: number }>(),
        c.env.DB.prepare('SELECT COUNT(*) as n FROM sessions WHERE created_at >= ?1').bind(monthStart.getTime()).first<{ n: number }>(),
        c.env.DB.prepare('SELECT COUNT(*) as n FROM sessions').first<{ n: number }>(),
      ])

      const totalSessions = totalRes?.n ?? 0
      const kpis: PlatformKpis = {
        live_sessions: liveSessions,
        total_users: usersRes?.n ?? 0,
        sessions_today: todayRes?.n ?? 0,
        sessions_this_month: monthRes?.n ?? 0,
        total_sessions: totalSessions,
        ai_cost_estimate_cents: Math.round(totalSessions * 0.01),
      }
      return c.json({ ok: true, data: kpis, trace_id }, 200)
    } catch {
      const degradedKpis: PlatformKpis = {
        live_sessions: liveSessions,
        total_users: 0,
        sessions_today: 0,
        sessions_this_month: 0,
        total_sessions: 0,
        ai_cost_estimate_cents: 0,
      }
      return c.json({ ok: true, data: degradedKpis, trace_id }, 200)
    }
  })

  // ── GET /api/admin/ops/summary ───────────────────────────────────────────────
  app.get('/ops/summary', authMiddleware, adminMiddleware, async (c) => {
    const trace_id = c.get('trace_id')
    const now = Date.now()
    const since24h = now - 24 * 60 * 60 * 1000
    const since1h = now - 60 * 60 * 1000

    const [d1Health, kvHealth, aiHealth] = await Promise.all([
      c.env.DB.prepare('SELECT 1').first().then(() => 'healthy' as ServiceStatus).catch(() => 'down' as ServiceStatus),
      c.env.SESSIONS_KV.get('__health_probe__').then(() => 'healthy' as ServiceStatus).catch(() => 'degraded' as ServiceStatus),
      Promise.resolve<ServiceStatus>('healthy'),
    ])

    let wsErrorRate = 0
    let reconnectRate = 0
    let voteP95: number | null = null
    let activeSessions = 0
    const kvStore = metricsKv(c.env)
    if (kvStore) {
      const agg = await aggregateLiveMetrics(kvStore, 5)
      wsErrorRate = agg.error_rate
      reconnectRate = agg.reconnect_rate
      activeSessions = agg.active_sessions
      voteP95 = agg.p95_latency_ms || null
    }

    let sev1 = 0; let sev2 = 0; let sev3 = 0
    try {
      const { results: sevRows } = await c.env.DB.prepare(
        `SELECT error_count, request_count FROM metrics_summary WHERE bucket_ts >= ?1`,
      ).bind(since1h).all<{ error_count: number; request_count: number }>()

      for (const row of sevRows) {
        const rate = row.request_count > 0 ? row.error_count / row.request_count : 0
        if (rate >= 0.10) sev1++
        else if (rate >= 0.05) sev2++
        else if (rate >= 0.01) sev3++
      }
    } catch { /* metrics_summary may not exist yet */ }

    let issues: Array<{ action: string; count: number }> = []
    try {
      const { results: issueRows } = await c.env.DB.prepare(
        `SELECT action, COUNT(*) as count FROM audit_events WHERE ts >= ?1 GROUP BY action ORDER BY count DESC LIMIT 10`,
      ).bind(since24h).all<{ action: string; count: number }>()
      issues = issueRows
    } catch { /* audit_events may not exist yet */ }

    const worstService = [d1Health, kvHealth, aiHealth]
    const overallStatus: ServiceStatus =
      worstService.includes('down') ? 'down' :
      worstService.includes('degraded') || sev1 > 0 ? 'degraded' :
      'healthy'

    let correlation: HourlyCorrelation[] | undefined
    if (c.req.query('timeseries') === '1') {
      try {
        type HourRow = {
          hour: string
          energizer_activations: number
          energizer_answers: number
        }
        const { results: hourRows } = await c.env.DB.prepare(
          `SELECT
             strftime('%Y-%m-%dT%H:00:00Z', ts / 1000, 'unixepoch') as hour,
             SUM(CASE WHEN action IN ('ws.energizer_activated', 'energizer.activate') THEN 1 ELSE 0 END) as energizer_activations,
             SUM(CASE WHEN action = 'ws.energizer_answered' THEN 1 ELSE 0 END) as energizer_answers
           FROM audit_events
           WHERE ts >= ?1
           GROUP BY hour
           ORDER BY hour ASC`,
        ).bind(since24h).all<HourRow>()

        correlation = hourRows
          .filter(r => r.energizer_activations > 0 || r.energizer_answers > 0)
          .map(r => ({
            hour: r.hour,
            energizer_activations: r.energizer_activations,
            energizer_answers: r.energizer_answers,
            ws_reconnects: 0,
            ws_errors: 0,
            ws_capacity_exceeded: 0,
          }))
      } catch { /* audit_events may not exist in all environments */ }
    }

    const summary: OpsSummary = {
      status: overallStatus,
      sev1,
      sev2,
      sev3,
      impact_sessions: activeSessions,
      impact_users: 0,
      services: {
        d1: d1Health,
        sessions_kv: kvHealth,
        workers_ai: aiHealth,
        session_rooms: 'healthy',
      },
      realtime: {
        ws_error_rate: wsErrorRate,
        reconnect_rate: reconnectRate,
        vote_p95_ms: voteP95,
      },
      issues,
      ...(correlation !== undefined ? { correlation } : {}),
      updated_at: now,
    }

    return c.json({ ok: true, data: summary, trace_id }, 200)
  })


  mountAnalyticsAdminRoutes(app)
  mountPerfAdminRoutes(app)
  mountSprint19AdminRoutes(app)
}
