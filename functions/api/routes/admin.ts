// Admin routes — Platform management (Phase 8)
//
// Routes organized by module:
//   Metrics: GET /api/admin/metrics/* — KV/D1 metrics + export
//   Users: GET/POST/PATCH /api/admin/users/* — user management
//   Audit: GET /api/admin/audit* — audit queries + forensic CSV
//   KV Sync: POST /api/admin/kb-sync* — knowledge base vectorization
//   Analytics: GET /api/admin/analytics, /kpis, /ops/summary — platform metrics
//   Performance: GET /api/admin/perf/*, /engagement/* — performance + engagement analytics
//   Sprint 19: GET /api/admin/sprint19-baseline — AI wizard baseline metrics
//
// Auth: authMiddleware + adminMiddleware (owner | admin role), except /kb-sync* (uses x-admin-key header).

import { Hono } from 'hono'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import { adminMiddleware, type AdminVariables } from '../middleware/admin'
import type { Env } from '../types'
import { registerHelpAdminRoutes } from './admin/help'
import { buildEngagementCsv } from '../lib/admin-engagement-csv'
import { buildEngagementSummary, type EnergizerKindMetric } from '../lib/admin-engagement-summary'
import { mountMetricsRoutes, aggregateLiveMetrics } from './admin/metrics'
import { mountUserRoutes } from './admin/users'
import { mountAuditRoutes } from './admin/audit'
import { mountKbSyncRoutes } from './admin/kb-sync'
import { mountKpisRoutes } from './admin/kpis'
import { mountOpsRoutes } from './admin/ops'
import { mountPlatformOverviewRoutes } from './admin/platform-overview'
import { mountObservabilityRoutes } from './admin/observability'
import { mountJourneyEventRoutes } from './admin/journey-events'
import { mountGrowthRoutes } from './admin/growth'
import type { AnalyticsData, DailyBucket } from './admin/types'
import type { ParentApp } from './parent-app'

// ─── Route mount ──────────────────────────────────────────────────────────────

export function mountAdminRoutes(parent: ParentApp) {
  const app = new Hono<{ Bindings: Env; Variables: AuthVariables & AdminVariables }>()

  registerHelpAdminRoutes(app)
  mountMetricsRoutes(app)
  mountUserRoutes(app)
  mountAuditRoutes(app)
  mountKbSyncRoutes(app)
  mountKpisRoutes(app)
  mountOpsRoutes(app)
  mountPlatformOverviewRoutes(app)
  mountObservabilityRoutes(app)
  mountJourneyEventRoutes(app)
  mountGrowthRoutes(app)

  // ── GET /api/admin/analytics ─────────────────────────────────────────────────
  app.get('/analytics', authMiddleware, adminMiddleware, async (c) => {
    const trace_id = c.get('trace_id')
    const now = Date.now()
    const todayStart = new Date()
    todayStart.setUTCHours(0, 0, 0, 0)
    const monthStart = new Date()
    monthStart.setUTCDate(1)
    monthStart.setUTCHours(0, 0, 0, 0)
    const fourteenDaysAgo = now - 14 * 24 * 60 * 60 * 1000

    try {
      const [
        todayRes,
        monthRes,
        decisionsTodayRes,
        decisionsMonthRes,
        perDayRes,
        statusRes,
        totalRes,
        consentRes,
      ] = await Promise.all([
        c.env.DB.prepare('SELECT COUNT(*) as n FROM sessions WHERE created_at >= ?1').bind(todayStart.getTime()).first<{ n: number }>(),
        c.env.DB.prepare('SELECT COUNT(*) as n FROM sessions WHERE created_at >= ?1').bind(monthStart.getTime()).first<{ n: number }>(),
        c.env.DB.prepare("SELECT COUNT(*) as n FROM audit_events WHERE action = 'insights.generate' AND ts >= ?1").bind(todayStart.getTime()).first<{ n: number }>(),
        c.env.DB.prepare("SELECT COUNT(*) as n FROM audit_events WHERE action = 'insights.generate' AND ts >= ?1").bind(monthStart.getTime()).first<{ n: number }>(),
        c.env.DB.prepare(
          `SELECT DATE(created_at / 1000, 'unixepoch') as day, COUNT(*) as count
           FROM sessions WHERE created_at >= ?1
           GROUP BY day ORDER BY day ASC`,
        ).bind(fourteenDaysAgo).all<{ day: string; count: number }>(),
        c.env.DB.prepare('SELECT status, COUNT(*) as count FROM sessions GROUP BY status').all<{ status: string; count: number }>(),
        c.env.DB.prepare('SELECT COUNT(*) as n FROM sessions').first<{ n: number }>(),
        c.env.DB.prepare(
          "SELECT AVG(CASE WHEN anonymity != 'none' THEN 1.0 ELSE 0.0 END) as rate FROM sessions WHERE created_at >= ?1",
        ).bind(monthStart.getTime()).first<{ rate: number | null }>(),
      ])

      const statusMap: Record<string, number> = {}
      for (const row of statusRes.results) statusMap[row.status] = row.count

      const totalSessions = totalRes?.n ?? 0
      let engagement = {
        energizer_activations: 0,
        energizer_participants: 0,
        energizer_completions: 0,
        energizer_dropouts: 0,
        leaderboard_participants: 0,
        badges_awarded: 0,
        ws_error_rate: 0,
        reconnect_rate: 0,
      }
      let badgeBreakdown: Array<{ kind: string; count: number }> = []

      let decisionsPerDay: DailyBucket[] = []
      try {
        const { results: dpd } = await c.env.DB.prepare(
          `SELECT DATE(ts / 1000, 'unixepoch') as day, COUNT(*) as count
           FROM audit_events WHERE action = 'insights.generate' AND ts >= ?1
           GROUP BY day ORDER BY day ASC`,
        ).bind(fourteenDaysAgo).all<{ day: string; count: number }>()
        decisionsPerDay = dpd
      } catch { /* audit_events may not exist */ }

      try {
        const { results: actionRows } = await c.env.DB.prepare(
          `SELECT action, COUNT(*) as count FROM audit_events
           WHERE action IN (
             'energizer.activate',
             'energizer.advance',
             'energizer.complete',
             'energizer.activation_denied',
             'ws.energizer_activated',
             'ws.energizer_activation_denied',
             'ws.energizer_answered',
             'ws.energizer_advanced',
             'ws.energizer_completed'
           )
           GROUP BY action`,
        ).all<{ action: string; count: number }>()
        const actionCounts = new Map(actionRows.map((row) => [row.action, row.count]))
        engagement.energizer_activations =
          (actionCounts.get('energizer.activate') ?? 0) + (actionCounts.get('ws.energizer_activated') ?? 0)
        engagement.energizer_completions =
          (actionCounts.get('energizer.complete') ?? 0) + (actionCounts.get('ws.energizer_completed') ?? 0)
        engagement.energizer_participants = Math.max(
          engagement.energizer_participants,
          actionCounts.get('ws.energizer_answered') ?? 0,
        )
      } catch { /* audit_events may not exist */ }

      try {
        const [participantRes, leaderboardRes, badgeRes, activeRes] = await Promise.all([
          c.env.DB.prepare('SELECT COUNT(DISTINCT voter_id) as n FROM energizer_votes').first<{ n: number }>(),
          c.env.DB.prepare('SELECT COUNT(DISTINCT user_id) as n FROM leaderboard_entries').first<{ n: number }>(),
          c.env.DB.prepare('SELECT badge_type as kind, COUNT(*) as count FROM badges GROUP BY badge_type ORDER BY count DESC').all<{ kind: string; count: number }>(),
          c.env.DB.prepare("SELECT COUNT(*) as n FROM energizers WHERE state = 'active'").first<{ n: number }>(),
        ])
        engagement.energizer_participants = Math.max(engagement.energizer_participants, participantRes?.n ?? 0)
        engagement.leaderboard_participants = leaderboardRes?.n ?? 0
        badgeBreakdown = badgeRes.results ?? []
        engagement.badges_awarded = badgeBreakdown.reduce((sum, row) => sum + row.count, 0)
        engagement.energizer_dropouts = Math.max(
          0,
          (activeRes?.n ?? 0) + engagement.energizer_activations - engagement.energizer_completions,
        )
      } catch { /* gamification tables may not exist yet */ }

      const metricsKv = (c.env as unknown as Record<string, KVNamespace | undefined>)['METRICS_KV']
      if (metricsKv) {
        const live = await aggregateLiveMetrics(metricsKv, 5)
        engagement = {
          ...engagement,
          energizer_activations: engagement.energizer_activations + live.energizer_activations,
          energizer_participants: Math.max(engagement.energizer_participants, live.energizer_participants),
          energizer_completions: engagement.energizer_completions + live.energizer_completions,
          leaderboard_participants: Math.max(engagement.leaderboard_participants, live.leaderboard_participants),
          badges_awarded: engagement.badges_awarded + live.badges_awarded,
          ws_error_rate: live.error_rate,
          reconnect_rate: live.reconnect_rate,
        }
      }

      const analytics: AnalyticsData = {
        sessions_today: todayRes?.n ?? 0,
        sessions_this_month: monthRes?.n ?? 0,
        decisions_today: decisionsTodayRes?.n ?? 0,
        decisions_this_month: decisionsMonthRes?.n ?? 0,
        sessions_per_day: perDayRes.results,
        decisions_per_day: decisionsPerDay,
        session_status: {
          draft: statusMap['draft'] ?? 0,
          live: statusMap['live'] ?? 0,
          closed: statusMap['closed'] ?? 0,
          archived: statusMap['archived'] ?? 0,
        },
        consent_rate: consentRes?.rate ?? 0,
        avg_participants: 0,
        ai_cost_estimate_cents: Math.round(totalSessions * 0.01),
        total_sessions_created: totalSessions,
        total_decisions_processed: (decisionsTodayRes?.n ?? 0) + (decisionsMonthRes?.n ?? 0),
        engagement,
        badge_breakdown: badgeBreakdown,
      }

      return c.json({ ok: true, data: analytics, trace_id }, 200)
    } catch {
      const empty: AnalyticsData = {
        sessions_today: 0, sessions_this_month: 0, decisions_today: 0, decisions_this_month: 0,
        sessions_per_day: [], decisions_per_day: [], session_status: { draft: 0, live: 0, closed: 0, archived: 0 },
        consent_rate: 0, avg_participants: 0, ai_cost_estimate_cents: 0,
        total_sessions_created: 0, total_decisions_processed: 0,
        engagement: {
          energizer_activations: 0,
          energizer_participants: 0,
          energizer_completions: 0,
          energizer_dropouts: 0,
          leaderboard_participants: 0,
          badges_awarded: 0,
          ws_error_rate: 0,
          reconnect_rate: 0,
        },
        badge_breakdown: [],
      }
      return c.json({ ok: true, data: empty, trace_id }, 200)
    }
  })

  // ── GET /api/admin/perf/reporting ────────────────────────────────────────────
  app.get('/perf/reporting', authMiddleware, adminMiddleware, async (c) => {
    const trace_id = c.get('trace_id')
    const teamId = c.req.query('teamId')
    let sessionCount = 0
    let liveCount = 0
    try {
      if (teamId) {
        const row = await c.env.DB.prepare(
          `SELECT COUNT(*) as total, SUM(CASE WHEN status = 'live' THEN 1 ELSE 0 END) as live FROM sessions WHERE team_id = ?1`,
        )
          .bind(teamId)
          .first<{ total: number; live: number }>()
        sessionCount = row?.total ?? 0
        liveCount = row?.live ?? 0
      }
    } catch {
      /* optional */
    }
    return c.json({
      ok: true,
      data: {
        teamId: teamId ?? null,
        sessions: sessionCount,
        liveSessions: liveCount,
        targets: { voteP99Ms: 200, sub100msP95: 100 },
      },
      trace_id,
    })
  })

  // ── GET /api/admin/perf/sub100ms-proof ────────────────────────────────────
  app.get('/perf/sub100ms-proof', authMiddleware, adminMiddleware, async (c) => {
    const trace_id = c.get('trace_id')
    const since = Date.now() - 7 * 24 * 60 * 60 * 1000
    let voteSamples: number[] = []
    try {
      const res = await c.env.DB.prepare(
        `SELECT duration_ms FROM sprint19_events
         WHERE event_name = 'ws.vote_submitted' AND duration_ms > 0 AND created_at >= ?1
         ORDER BY duration_ms ASC LIMIT 5000`,
      )
        .bind(since)
        .all<{ duration_ms: number }>()
      voteSamples = (res.results ?? []).map((r) => r.duration_ms)
    } catch {
      /* optional */
    }
    const sorted = [...voteSamples].sort((a, b) => a - b)
    const p95 = sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.95)] ?? sorted[sorted.length - 1]! : null
    const p99 = sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.99)] ?? sorted[sorted.length - 1]! : null
    const targetP95Ms = 100
    return c.json({
      ok: true,
      data: {
        targetP95Ms,
        sampleCount: sorted.length,
        p95Ms: p95,
        p99Ms: p99,
        meetsTarget: p95 !== null ? p95 <= targetP95Ms : null,
        methodology: 'knowledge-base/operations/SUB100MS_PROOF.md',
        aeQueryHint: "blob1 = 'ws.vote_submitted' — quantileWeighted(0.95)(double1)",
      },
      trace_id,
    })
  })

  // ── GET /api/admin/analytics/activation-funnel ────────────────────────────
  app.get('/analytics/activation-funnel', authMiddleware, adminMiddleware, async (c) => {
    const trace_id = c.get('trace_id')
    const since = Date.now() - 30 * 24 * 60 * 60 * 1000
    let signups = 0
    let teams = 0
    let firstSessions = 0
    let paid = 0
    try {
      const [usersRes, eventsRes] = await Promise.all([
        c.env.DB.prepare(`SELECT COUNT(*) as n FROM users WHERE created_at >= ?1`).bind(since).first<{ n: number }>(),
        c.env.DB.prepare(
          `SELECT event_name, COUNT(*) as n FROM sprint19_events
           WHERE created_at >= ?1 AND event_name IN ('signup','team_created','first_session_started','first_paid')
           GROUP BY event_name`,
        )
          .bind(since)
          .all<{ event_name: string; n: number }>(),
      ])
      signups = usersRes?.n ?? 0
      const counts = new Map((eventsRes.results ?? []).map((r) => [r.event_name, r.n]))
      teams = counts.get('team_created') ?? 0
      firstSessions = counts.get('first_session_started') ?? 0
      paid = counts.get('first_paid') ?? 0
    } catch {
      /* partial data ok */
    }
    const funnel = [
      { stage: 'signup', count: signups },
      { stage: 'team_created', count: teams },
      { stage: 'first_session_started', count: firstSessions },
      { stage: 'first_paid', count: paid },
    ]
    return c.json({
      ok: true,
      data: {
        windowDays: 30,
        funnel,
        conversionRates: {
          signupToTeam: signups > 0 ? teams / signups : null,
          teamToFirstSession: teams > 0 ? firstSessions / teams : null,
          sessionToPaid: firstSessions > 0 ? paid / firstSessions : null,
        },
      },
      trace_id,
    })
  })

  // ── GET /api/admin/perf/latency-dashboard ───────────────────────────────
  app.get('/perf/latency-dashboard', authMiddleware, adminMiddleware, async (c) => {
    const trace_id = c.get('trace_id')
    const since = Date.now() - 24 * 60 * 60 * 1000
    let buckets: Array<{ bucket_ts: number; request_count: number; error_count: number }> = []
    try {
      const res = await c.env.DB.prepare(
        `SELECT bucket_ts, request_count, error_count FROM metrics_summary WHERE bucket_ts >= ?1 ORDER BY bucket_ts ASC LIMIT 288`,
      )
        .bind(since)
        .all<{ bucket_ts: number; request_count: number; error_count: number }>()
      buckets = res.results ?? []
    } catch {
      /* metrics_summary optional */
    }
    const totalReq = buckets.reduce((s, b) => s + b.request_count, 0)
    const totalErr = buckets.reduce((s, b) => s + b.error_count, 0)
    return c.json({
      ok: true,
      data: {
        windowHours: 24,
        buckets,
        errorRate: totalReq > 0 ? totalErr / totalReq : 0,
        targetP99Ms: 200,
      },
      trace_id,
    })
  })

  // ── GET /api/admin/engagement/summary ─────────────────────────────────────
  app.get('/engagement/summary', authMiddleware, adminMiddleware, async (c) => {
    const trace_id = c.get('trace_id')
    let rows: EnergizerKindMetric[] = []
    try {
      const res = await c.env.DB.prepare(
        `SELECT e.kind,
                COUNT(*) as total,
                SUM(CASE WHEN e.state = 'active' THEN 1 ELSE 0 END) as active,
                SUM(CASE WHEN e.state = 'completed' THEN 1 ELSE 0 END) as completed,
                COUNT(DISTINCT ev.voter_id) as participants
         FROM energizers e
         LEFT JOIN energizer_votes ev ON ev.energizer_id = e.id
         GROUP BY e.kind
         ORDER BY total DESC`,
      ).all<{
        kind: string
        total: number
        active: number
        completed: number
        participants: number
      }>()
      rows = (res.results ?? []).map((r) => ({
        kind: r.kind,
        total: r.total,
        active: r.active,
        completed: r.completed,
        participants: r.participants,
      }))
    } catch {
      /* optional tables in local dev */
    }
    return c.json({ ok: true, data: buildEngagementSummary(rows), trace_id })
  })

  // ── GET /api/admin/engagement/export.csv ──────────────────────────────────
  app.get('/engagement/export.csv', authMiddleware, adminMiddleware, async (c) => {
    const trace_id = c.get('trace_id')
    let engagement = {
      energizer_activations: 0,
      energizer_participants: 0,
      energizer_completions: 0,
      energizer_dropouts: 0,
      leaderboard_participants: 0,
      badges_awarded: 0,
      ws_error_rate: 0,
      reconnect_rate: 0,
    }
    let badgeBreakdown: Array<{ kind: string; count: number }> = []
    try {
      const badgeRes = await c.env.DB.prepare(
        'SELECT badge_type as kind, COUNT(*) as count FROM badges GROUP BY badge_type ORDER BY count DESC',
      ).all<{ kind: string; count: number }>()
      badgeBreakdown = badgeRes.results ?? []
      engagement.badges_awarded = badgeBreakdown.reduce((sum, row) => sum + row.count, 0)
      const participantRes = await c.env.DB.prepare('SELECT COUNT(DISTINCT voter_id) as n FROM energizer_votes').first<{ n: number }>()
      engagement.energizer_participants = participantRes?.n ?? 0
      const leaderboardRes = await c.env.DB.prepare('SELECT COUNT(DISTINCT user_id) as n FROM leaderboard_entries').first<{ n: number }>()
      engagement.leaderboard_participants = leaderboardRes?.n ?? 0
    } catch {
      /* gamification tables optional in local dev */
    }
    const fromMs = Number(c.req.query('from') ?? 0)
    const toMs = Number(c.req.query('to') ?? Date.now())
    const csv = buildEngagementCsv({ engagement, badge_breakdown: badgeBreakdown })
    const rangeNote = `# export_range_ms,${fromMs},${toMs}\n`
    return new Response(rangeNote + csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="qesto-engagement-${fromMs}-${toMs}.csv"`,
        'X-Trace-Id': trace_id,
      },
    })
  })

  parent.route('/api/admin', app)
}
