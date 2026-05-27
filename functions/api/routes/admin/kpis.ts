import { Hono } from 'hono'
import { authMiddleware, type AuthVariables } from '../../middleware/auth'
import { adminMiddleware, type AdminVariables } from '../../middleware/admin'
import type { Env } from '../../types'
import type { PlatformKpis } from './types'
import { aggregateLiveMetrics } from './metrics'

export function mountKpisRoutes(app: Hono<{ Bindings: Env; Variables: AuthVariables & AdminVariables }>) {
  app.get('/kpis', authMiddleware, adminMiddleware, async (c) => {
    const trace_id = c.get('trace_id')
    const todayStart = new Date()
    todayStart.setUTCHours(0, 0, 0, 0)
    const monthStart = new Date()
    monthStart.setUTCDate(1)
    monthStart.setUTCHours(0, 0, 0, 0)

    let liveSessions = 0
    const kv = (c.env as unknown as Record<string, KVNamespace | undefined>)['METRICS_KV']
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
      const safeDefaults: PlatformKpis = {
        live_sessions: liveSessions,
        total_users: 0,
        sessions_today: 0,
        sessions_this_month: 0,
        total_sessions: 0,
        ai_cost_estimate_cents: 0,
      }
      return c.json({ ok: true, data: safeDefaults, trace_id }, 200)
    }
  })
}

