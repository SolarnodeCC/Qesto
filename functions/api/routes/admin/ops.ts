import { Hono } from 'hono'
import { authMiddleware, type AuthVariables } from '../../middleware/auth'
import { adminMiddleware, type AdminVariables } from '../../middleware/admin'
import type { Env } from '../../types'
import type { OpsSummary, ServiceStatus } from './types'

export function mountOpsRoutes(app: Hono<{ Bindings: Env; Variables: AuthVariables & AdminVariables }>) {
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
    try {
      const { results } = await c.env.DB.prepare(
        `SELECT
           COALESCE(SUM(ws_error_count), 0) AS ws_errors,
           COALESCE(SUM(ws_message_count), 0) AS ws_msgs,
           COALESCE(SUM(ws_reconnect_count), 0) AS ws_reconnects,
           COALESCE(SUM(ws_connection_count), 0) AS ws_conns,
           COALESCE(MAX(vote_p95_ms), NULL) AS vote_p95_ms
         FROM metrics_summary
         WHERE bucket_ts >= ?1`,
      )
        .bind(since1h)
        .all<{ ws_errors: number; ws_msgs: number; ws_reconnects: number; ws_conns: number; vote_p95_ms: number | null }>()
      const row = results?.[0]
      if (row) {
        wsErrorRate = row.ws_msgs > 0 ? row.ws_errors / row.ws_msgs : 0
        reconnectRate = row.ws_conns > 0 ? row.ws_reconnects / row.ws_conns : 0
        voteP95 = typeof row.vote_p95_ms === 'number' ? row.vote_p95_ms : null
      }
    } catch {
      /* metrics_summary optional in local dev */
    }

    let sev1 = 0
    let sev2 = 0
    let sev3 = 0
    let impactSessions = 0
    let impactUsers = 0
    try {
      const [sev, impact] = await Promise.all([
        c.env.DB.prepare(
          `SELECT
             SUM(CASE WHEN severity = 1 THEN 1 ELSE 0 END) AS sev1,
             SUM(CASE WHEN severity = 2 THEN 1 ELSE 0 END) AS sev2,
             SUM(CASE WHEN severity = 3 THEN 1 ELSE 0 END) AS sev3
           FROM incidents
           WHERE created_at >= ?1`,
        )
          .bind(since24h)
          .first<{ sev1: number; sev2: number; sev3: number }>()
          .catch(() => null),
        c.env.DB.prepare(
          `SELECT
             COUNT(DISTINCT session_id) AS impact_sessions,
             COUNT(DISTINCT user_id) AS impact_users
           FROM incident_impacts
           WHERE created_at >= ?1`,
        )
          .bind(since24h)
          .first<{ impact_sessions: number; impact_users: number }>()
          .catch(() => null),
      ])
      sev1 = sev?.sev1 ?? 0
      sev2 = sev?.sev2 ?? 0
      sev3 = sev?.sev3 ?? 0
      impactSessions = impact?.impact_sessions ?? 0
      impactUsers = impact?.impact_users ?? 0
    } catch {
      /* incidents tables optional */
    }

    const issues: Array<{ action: string; count: number }> = []
    try {
      const { results } = await c.env.DB.prepare(
        `SELECT action, COUNT(*) AS count
         FROM audit_events
         WHERE ts >= ?1 AND action LIKE 'error.%'
         GROUP BY action
         ORDER BY count DESC
         LIMIT 25`,
      )
        .bind(since24h)
        .all<{ action: string; count: number }>()
      for (const row of results ?? []) {
        issues.push({ action: row.action, count: row.count })
      }
    } catch {
      /* audit_events optional */
    }

    const status: ServiceStatus =
      d1Health === 'down' || kvHealth === 'down' ? 'down' : d1Health === 'degraded' || kvHealth === 'degraded' ? 'degraded' : 'healthy'

    const data: OpsSummary = {
      status,
      sev1,
      sev2,
      sev3,
      impact_sessions: impactSessions,
      impact_users: impactUsers,
      services: { d1: d1Health, sessions_kv: kvHealth, workers_ai: aiHealth, session_rooms: 'healthy' },
      realtime: { ws_error_rate: wsErrorRate, reconnect_rate: reconnectRate, vote_p95_ms: voteP95 },
      issues,
      updated_at: now,
    }

    return c.json({ ok: true, data, trace_id }, 200)
  })
}

