// Admin routes — Platform management (Phase 8)
//
// Routes:
//   GET  /api/admin/metrics/live         — KV snapshot for last 5 min
//   GET  /api/admin/metrics/historical   — D1 metrics_summary (5-min buckets)
//   POST /api/admin/metrics/export       — stream D1 metrics_summary as CSV
//   GET  /api/admin/audit                — query audit events
//   GET  /api/admin/kpis                 — platform-wide KPI totals
//   GET  /api/admin/users                — list all users (search, paginate)
//   POST /api/admin/users                — create user account
//   PATCH /api/admin/users/:id           — update user (plan, name, role)
//   POST /api/admin/users/:id/suspend    — suspend user account
//   POST /api/admin/users/:id/restore    — restore suspended account
//   GET  /api/admin/ops/summary          — service health + reliability + issue pulse
//   GET  /api/admin/analytics            — time-series, breakdowns, cost
//   GET  /api/admin/sprint19-baseline    — AI wizard + Launchpad KPI baseline
//   POST /api/admin/kb-sync              — Phase 1 bulk vector sync to Vectorize (ADR-040)
//   POST /api/admin/kb-sync-delete       — Phase 5 vector deletion for deleted KB files
//
// Auth: authMiddleware + adminMiddleware (owner | admin role), except /kb-sync* (uses x-admin-key header).

import { Hono } from 'hono'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import { adminMiddleware, type AdminVariables } from '../middleware/admin'
import { queryAuditEvents, recordAuditEvent } from '../lib/audit'
import { ulid } from '../lib/ulid'
import type { Env } from '../types'
import { readKvJson } from '../lib/kv'
import { registerHelpAdminRoutes } from './admin/help'
import { validateBody } from '../lib/validate'
import { AdminMetricsExportSchema, AdminCreateUserSchema, AdminPatchUserSchema } from '../lib/validation'

// ─── Types ────────────────────────────────────────────────────────────────────

let _sprint19SchemaPatchDone = false
async function patchSprint19SchemaIfNeeded(db: D1Database): Promise<void> {
  if (_sprint19SchemaPatchDone) return
  _sprint19SchemaPatchDone = true
  await db.prepare(`ALTER TABLE sessions ADD COLUMN ai_accepted_count INTEGER NOT NULL DEFAULT 0`).run().catch(() => {})
  await db.prepare(`ALTER TABLE sessions ADD COLUMN ai_dismissed_count INTEGER NOT NULL DEFAULT 0`).run().catch(() => {})
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS sprint19_events (
      id TEXT PRIMARY KEY,
      event_name TEXT NOT NULL,
      user_id TEXT NOT NULL,
      session_id TEXT,
      team_id TEXT,
      plan TEXT,
      count INTEGER NOT NULL DEFAULT 0,
      value REAL NOT NULL DEFAULT 0,
      duration_ms INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      trace_id TEXT NOT NULL
    )`,
  ).run().catch(() => {})
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_sprint19_events_name_created ON sprint19_events(event_name, created_at)`).run().catch(() => {})
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_sprint19_events_session ON sprint19_events(session_id)`).run().catch(() => {})
}

export type AdminUser = {
  id: string
  email: string
  display_name: string | null
  plan: 'free' | 'starter' | 'team'
  created_at: number
  last_login_at: number | null
  suspended_at: number | null
  admin_role: 'owner' | 'admin' | null
}

export type PlatformKpis = {
  live_sessions: number
  total_users: number
  sessions_today: number
  sessions_this_month: number
  total_sessions: number
  ai_cost_estimate_cents: number
}

export type ServiceStatus = 'healthy' | 'degraded' | 'down'

export type OpsSummary = {
  status: ServiceStatus
  sev1: number
  sev2: number
  sev3: number
  impact_sessions: number
  impact_users: number
  services: {
    d1: ServiceStatus
    sessions_kv: ServiceStatus
    workers_ai: ServiceStatus
    session_rooms: ServiceStatus
  }
  realtime: {
    ws_error_rate: number
    reconnect_rate: number
    vote_p95_ms: number | null
  }
  issues: Array<{ action: string; count: number }>
  updated_at: number
}

export type DailyBucket = {
  day: string
  count: number
}

export type AnalyticsData = {
  sessions_today: number
  sessions_this_month: number
  decisions_today: number
  decisions_this_month: number
  sessions_per_day: DailyBucket[]
  decisions_per_day: DailyBucket[]
  session_status: { draft: number; live: number; closed: number; archived: number }
  consent_rate: number
  avg_participants: number
  ai_cost_estimate_cents: number
  total_sessions_created: number
  total_decisions_processed: number
  engagement: {
    energizer_activations: number
    energizer_participants: number
    energizer_completions: number
    energizer_dropouts: number
    leaderboard_participants: number
    badges_awarded: number
    ws_error_rate: number
    reconnect_rate: number
  }
  badge_breakdown: Array<{ kind: string; count: number }>
}

export type Sprint19Baseline = {
  generated_at: number
  window: { start: number | null; end: number }
  ai_usage_rate: number | null
  wizard_completion_rate: number | null
  launchpad_success_rate: number | null
  inline_suggestion_acceptance_rate: number | null
  invalid_live_attempts: number | null
  preflight_failure_rate: number | null
  counts: {
    total_sessions: number
    ai_generated_sessions: number
    ai_consent_sessions: number
    ai_grounding_sessions: number
    started_or_closed_sessions: number
    draft_sessions: number
    wizard_opened: number
    wizard_completed: number
    ai_suggestions_accepted: number
    ai_suggestions_dismissed: number
    launchpad_opened: number
    launch_attempts: number
    launch_successes: number
    launch_failures: number
    preflight_checks: number
    preflight_failures: number
  }
  measurement_gaps: string[]
}

export type LiveMetrics = {
  active_sessions: number
  total_participants: number
  revenue_24h_cents: number
  p95_latency_ms: number
  error_rate: number
  reconnect_rate: number
  energizer_activations: number
  energizer_participants: number
  energizer_completions: number
  leaderboard_participants: number
  badges_awarded: number
  refresh_ts: number
  stub?: boolean
}

export type HistoricalBucket = {
  bucket_ts: number  // Unix ms, start of 5-min window
  route: string | null
  request_count: number
  error_count: number
  p50_ms: number
  p95_ms: number
  p99_ms: number
}

type MetricsSummaryRow = {
  bucket_ts: number
  route: string | null
  request_count: number
  error_count: number
  p50_ms: number
  p95_ms: number
  p99_ms: number
}

// ─── KV key helpers (matches Step 1 observability schema) ─────────────────────

/**
 * Aggregate KV snapshot buckets for the last `windowMinutes` minutes.
 * Key pattern: `metrics:live:<YYYYMMDDTHHMM>` (1-min buckets).
 */
async function aggregateLiveMetrics(
  kv: KVNamespace,
  windowMinutes = 5,
): Promise<Omit<LiveMetrics, 'refresh_ts' | 'stub'>> {
  const now = Date.now()
  const samples: Array<{
    active_sessions?: number
    total_participants?: number
    revenue_24h_cents?: number
    p95_latency_ms?: number
    error_count?: number
    request_count?: number
    reconnect_count?: number
    connection_count?: number
    energizer_activations?: number
    energizer_participants?: number
    energizer_completions?: number
    leaderboard_participants?: number
    badges_awarded?: number
  }> = []

  for (let i = 0; i < windowMinutes; i++) {
    const bucketMs = now - i * 60_000
    const d = new Date(bucketMs)
    const key = `metrics:live:${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}T${String(d.getUTCHours()).padStart(2, '0')}${String(d.getUTCMinutes()).padStart(2, '0')}`
    const bucket = await readKvJson<{
      active_sessions?: number
      total_participants?: number
      revenue_24h_cents?: number
      p95_latency_ms?: number
      error_count?: number
      request_count?: number
      reconnect_count?: number
      connection_count?: number
      energizer_activations?: number
      energizer_participants?: number
      energizer_completions?: number
      leaderboard_participants?: number
      badges_awarded?: number
    }>(kv, key)
    if (bucket) samples.push(bucket)
  }

  if (samples.length === 0) {
    return {
      active_sessions: 0,
      total_participants: 0,
      revenue_24h_cents: 0,
      p95_latency_ms: 0,
      error_rate: 0,
      reconnect_rate: 0,
      energizer_activations: 0,
      energizer_participants: 0,
      energizer_completions: 0,
      leaderboard_participants: 0,
      badges_awarded: 0,
    }
  }

  // Most-recent wins for point-in-time fields; sum for counts.
  const latest = samples[0]
  const totalRequests = samples.reduce((s, b) => s + (b.request_count ?? 0), 0)
  const totalErrors = samples.reduce((s, b) => s + (b.error_count ?? 0), 0)
  const totalConnections = samples.reduce((s, b) => s + (b.connection_count ?? 0), 0)
  const totalReconnects = samples.reduce((s, b) => s + (b.reconnect_count ?? 0), 0)

  return {
    active_sessions: latest.active_sessions ?? 0,
    total_participants: latest.total_participants ?? 0,
    revenue_24h_cents: latest.revenue_24h_cents ?? 0,
    p95_latency_ms: latest.p95_latency_ms ?? 0,
    error_rate: totalRequests > 0 ? totalErrors / totalRequests : 0,
    reconnect_rate: totalConnections > 0 ? totalReconnects / totalConnections : 0,
    energizer_activations: samples.reduce((s, b) => s + (b.energizer_activations ?? 0), 0),
    energizer_participants: samples.reduce((s, b) => s + (b.energizer_participants ?? 0), 0),
    energizer_completions: samples.reduce((s, b) => s + (b.energizer_completions ?? 0), 0),
    leaderboard_participants: samples.reduce((s, b) => s + (b.leaderboard_participants ?? 0), 0),
    badges_awarded: samples.reduce((s, b) => s + (b.badges_awarded ?? 0), 0),
  }
}

// ─── CSV serialisation ────────────────────────────────────────────────────────

const CSV_HEADERS = ['bucket_ts', 'route', 'request_count', 'error_count', 'p50_ms', 'p95_ms', 'p99_ms'] as const

function rowToCsv(row: MetricsSummaryRow): string {
  const escape = (v: string | number | null): string => {
    if (v === null || v === undefined) return ''
    const s = String(v)
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`
    }
    return s
  }
  return CSV_HEADERS.map((h) => escape(row[h] as string | number | null)).join(',')
}

// ─── Route mount ──────────────────────────────────────────────────────────────

export function mountAdminRoutes(parent: any) {
  const app = new Hono<{ Bindings: Env; Variables: AuthVariables & AdminVariables }>()

  // Register help admin routes (review queue, prompt versions)
  registerHelpAdminRoutes(app)

  // ── GET /api/admin/metrics/live ──────────────────────────────────────────────
  // Returns a KV snapshot for the last 5 minutes.
  // p95 target: < 200 ms (KV reads are ~1-5 ms at edge).
  app.get('/metrics/live', authMiddleware, adminMiddleware, async (c) => {
    const trace_id = c.get('trace_id')

    // METRICS_KV may not exist until Step 1 ships.  Degrade gracefully.
    const kv = (c.env as unknown as Record<string, KVNamespace | undefined>)['METRICS_KV']
    if (!kv) {
      const stub: LiveMetrics = {
        active_sessions: 0,
        total_participants: 0,
        revenue_24h_cents: 0,
        p95_latency_ms: 0,
        error_rate: 0,
        reconnect_rate: 0,
        energizer_activations: 0,
        energizer_participants: 0,
        energizer_completions: 0,
        leaderboard_participants: 0,
        badges_awarded: 0,
        refresh_ts: Date.now(),
        stub: true,
      }
      return c.json({ ok: true, data: stub, trace_id }, 200)
    }

    const aggregated = await aggregateLiveMetrics(kv)
    const live: LiveMetrics = {
      ...aggregated,
      refresh_ts: Date.now(),
    }

    return c.json({ ok: true, data: live, trace_id }, 200)
  })

  // ── GET /api/admin/metrics/historical ─────────────────────────────────────
  // Query D1 metrics_summary with 5-min granularity.
  // Uses indexes: idx_metrics_ts, idx_metrics_route.
  // p95 target: < 1 s.
  app.get('/metrics/historical', authMiddleware, adminMiddleware, async (c) => {
    const trace_id = c.get('trace_id')
    const startParam = c.req.query('start')
    const endParam = c.req.query('end')
    const routeParam = c.req.query('route') ?? null

    if (!startParam || !endParam) {
      return c.json(
        {
          ok: false,
          error: { code: 'validation', message: 'start and end query params are required (ISO 8601)' },
          trace_id,
        },
        400,
      )
    }

    const startMs = Date.parse(startParam)
    const endMs = Date.parse(endParam)
    if (isNaN(startMs) || isNaN(endMs) || startMs >= endMs) {
      return c.json(
        {
          ok: false,
          error: { code: 'validation', message: 'Invalid date range — start must be before end' },
          trace_id,
        },
        400,
      )
    }

    // Cap range to 30 days to keep query bounded.
    const MAX_RANGE_MS = 30 * 24 * 60 * 60 * 1000
    if (endMs - startMs > MAX_RANGE_MS) {
      return c.json(
        {
          ok: false,
          error: { code: 'validation', message: 'Date range must not exceed 30 days' },
          trace_id,
        },
        400,
      )
    }

    // Attempt D1 query; degrade to stub if table doesn't exist yet.
    try {
      let stmt: D1PreparedStatement
      if (routeParam) {
        // idx_metrics_route covers (route, bucket_ts)
        stmt = c.env.DB.prepare(
          `SELECT bucket_ts, route, request_count, error_count, p50_ms, p95_ms, p99_ms
           FROM metrics_summary
           WHERE bucket_ts >= ?1 AND bucket_ts <= ?2 AND route = ?3
           ORDER BY bucket_ts ASC
           LIMIT 8641`,
        ).bind(startMs, endMs, routeParam)
      } else {
        // idx_metrics_ts covers (bucket_ts)
        stmt = c.env.DB.prepare(
          `SELECT bucket_ts, route, request_count, error_count, p50_ms, p95_ms, p99_ms
           FROM metrics_summary
           WHERE bucket_ts >= ?1 AND bucket_ts <= ?2
           ORDER BY bucket_ts ASC
           LIMIT 8641`,
        ).bind(startMs, endMs)
      }

      const { results } = await stmt.all<MetricsSummaryRow>()
      return c.json({ ok: true, data: results, trace_id }, 200)
    } catch (err) {
      // Degrade gracefully if table or column doesn't exist yet (Step 1 not shipped).
      const msg = (err as Error).message ?? ''
      if (msg.includes('no such table') || msg.includes('no such column')) {
        return c.json({ ok: true, data: [], stub: true, trace_id }, 200)
      }
      throw err
    }
  })

  // ── POST /api/admin/metrics/export ──────────────────────────────────────────
  // Streams D1 metrics_summary as CSV.  Max 10 000 rows, <5 MB.
  app.post('/metrics/export', authMiddleware, adminMiddleware, async (c) => {
    const trace_id = c.get('trace_id')

    const validated = await validateBody(c, AdminMetricsExportSchema)
    if ('error' in validated) return validated.error
    const { start: startParam, end: endParam } = validated.data

    const startMs = Date.parse(startParam)
    const endMs = Date.parse(endParam)
    if (startMs >= endMs) {
      return c.json(
        { ok: false, error: { code: 'validation', message: 'start must be before end' }, trace_id },
        400,
      )
    }

    const MAX_ROWS = 10_000

    try {
      const { results } = await c.env.DB.prepare(
        `SELECT bucket_ts, route, request_count, error_count, p50_ms, p95_ms, p99_ms
         FROM metrics_summary
         WHERE bucket_ts >= ?1 AND bucket_ts <= ?2
         ORDER BY bucket_ts ASC
         LIMIT ?3`,
      )
        .bind(startMs, endMs, MAX_ROWS)
        .all<MetricsSummaryRow>()

      const lines = [CSV_HEADERS.join(','), ...results.map(rowToCsv)]
      const csv = lines.join('\r\n')

      const filename = `qesto-metrics-${new Date(startMs).toISOString().slice(0, 10)}-to-${new Date(endMs).toISOString().slice(0, 10)}.csv`

      return new Response(csv, {
        status: 200,
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': `attachment; filename="${filename}"`,
          'x-trace-id': trace_id,
          'x-row-count': String(results.length),
        },
      })
    } catch (err) {
      const msg = (err as Error).message ?? ''
      if (msg.includes('no such table') || msg.includes('no such column')) {
        // Return empty CSV stub until Step 1 ships.
        const csv = CSV_HEADERS.join(',') + '\r\n'
        return new Response(csv, {
          status: 200,
          headers: {
            'content-type': 'text/csv; charset=utf-8',
            'content-disposition': 'attachment; filename="qesto-metrics-stub.csv"',
            'x-trace-id': trace_id,
            'x-row-count': '0',
            'x-stub': 'true',
          },
        })
      }
      throw err
    }
  })

  // ── GET /api/admin/audit ────────────────────────────────────────────────────
  // Query audit events with filtering by actor, action, date range.
  // p95 target: < 1 s.
  app.get('/audit', authMiddleware, adminMiddleware, async (c) => {
    const trace_id = c.get('trace_id')
    const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!) : 100
    const offset = c.req.query('offset') ? parseInt(c.req.query('offset')!) : 0

    const opts: any = { limit, offset }
    if (c.req.query('actor_id')) opts.actor_id = c.req.query('actor_id')
    if (c.req.query('action')) opts.action = c.req.query('action')
    if (c.req.query('subject_type')) opts.subject_type = c.req.query('subject_type')
    if (c.req.query('since_ts')) opts.since_ts = parseInt(c.req.query('since_ts')!)
    if (c.req.query('until_ts')) opts.until_ts = parseInt(c.req.query('until_ts')!)

    const result = await queryAuditEvents(c, opts)

    return c.json({ ok: true, data: result, trace_id }, 200)
  })

  // ── GET /api/admin/kpis ─────────────────────────────────────────────────────
  // Platform-wide KPI totals — user count, session counts, cost estimate.
  app.get('/kpis', authMiddleware, adminMiddleware, async (c) => {
    const trace_id = c.get('trace_id')
    const todayStart = new Date()
    todayStart.setUTCHours(0, 0, 0, 0)
    const monthStart = new Date()
    monthStart.setUTCDate(1)
    monthStart.setUTCHours(0, 0, 0, 0)

    // Live sessions from KV (best-effort)
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
      // Degrade gracefully if DB not ready
      const stub: PlatformKpis = {
        live_sessions: liveSessions,
        total_users: 0,
        sessions_today: 0,
        sessions_this_month: 0,
        total_sessions: 0,
        ai_cost_estimate_cents: 0,
      }
      return c.json({ ok: true, data: stub, trace_id }, 200)
    }
  })

  // ── GET /api/admin/users ─────────────────────────────────────────────────────
  // List all users with optional search + pagination. Joins user_roles for admin_role.
  app.get('/users', authMiddleware, adminMiddleware, async (c) => {
    const trace_id = c.get('trace_id')
    const search = c.req.query('search') ?? ''
    const limit = Math.min(parseInt(c.req.query('limit') ?? '50'), 100)
    const offset = parseInt(c.req.query('offset') ?? '0')

    try {
      const searchLike = search ? `%${search}%` : null
      const baseWhere = searchLike
        ? 'WHERE (u.email LIKE ?3 OR u.display_name LIKE ?3)'
        : ''

      const sql = `
        SELECT u.id, u.email, u.display_name, u.plan, u.created_at, u.last_login_at, u.suspended_at,
               ur.role as admin_role
        FROM users u
        LEFT JOIN user_roles ur ON ur.user_id = u.id AND ur.role IN ('owner', 'admin')
        ${baseWhere}
        ORDER BY u.created_at DESC
        LIMIT ?1 OFFSET ?2
      `
      const countSql = `
        SELECT COUNT(*) as n FROM users u ${baseWhere}
      `

      let stmt: D1PreparedStatement
      let countStmt: D1PreparedStatement
      if (searchLike) {
        stmt = c.env.DB.prepare(sql).bind(limit, offset, searchLike)
        countStmt = c.env.DB.prepare(countSql).bind(searchLike)
      } else {
        stmt = c.env.DB.prepare(sql).bind(limit, offset)
        countStmt = c.env.DB.prepare(countSql)
      }

      const [{ results }, countRow] = await Promise.all([
        stmt.all<AdminUser>(),
        countStmt.first<{ n: number }>(),
      ])

      return c.json({ ok: true, data: { users: results, total: countRow?.n ?? 0 }, trace_id }, 200)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch users'
      return c.json({ ok: false, error: { code: 'internal', message }, trace_id }, 500)
    }
  })

  // ── POST /api/admin/users ────────────────────────────────────────────────────
  // Create a new user account.
  app.post('/users', authMiddleware, adminMiddleware, async (c) => {
    const trace_id = c.get('trace_id')

    const validated = await validateBody(c, AdminCreateUserSchema)
    if ('error' in validated) return validated.error
    const { email: rawEmail, display_name, plan = 'free' } = validated.data

    const id = ulid()
    const now = Date.now()

    try {
      await c.env.DB.prepare(
        'INSERT INTO users (id, email, display_name, created_at, plan) VALUES (?1, ?2, ?3, ?4, ?5)',
      ).bind(id, rawEmail.toLowerCase().trim(), display_name ?? null, now, plan).run()

      const user: AdminUser = {
        id,
        email: rawEmail.toLowerCase().trim(),
        display_name: display_name ?? null,
        plan: plan as AdminUser['plan'],
        created_at: now,
        last_login_at: null,
        suspended_at: null,
        admin_role: null,
      }

      await recordAuditEvent(c, {
        action: 'user.create',
        subject_type: 'user',
        subject_id: id,
        after_snapshot: user,
        trace_id,
      })

      return c.json({ ok: true, data: user, trace_id }, 201)
    } catch (err) {
      const msg = (err as Error).message ?? ''
      if (msg.includes('UNIQUE constraint')) {
        return c.json({ ok: false, error: { code: 'conflict', message: 'Email already exists' }, trace_id }, 409)
      }
      throw err
    }
  })

  // ── PATCH /api/admin/users/:id ───────────────────────────────────────────────
  // Update user plan, display_name, or admin_role.
  app.patch('/users/:id', authMiddleware, adminMiddleware, async (c) => {
    const trace_id = c.get('trace_id')
    const userId = c.req.param('id')

    const validated = await validateBody(c, AdminPatchUserSchema)
    if ('error' in validated) return validated.error
    const body = validated.data

    const existing = await c.env.DB.prepare(
      'SELECT id, email, display_name, plan, created_at, last_login_at, suspended_at FROM users WHERE id = ?1',
    ).bind(userId).first<Omit<AdminUser, 'admin_role'>>()

    if (!existing) {
      return c.json({ ok: false, error: { code: 'not_found', message: 'User not found' }, trace_id }, 404)
    }

    const updates: string[] = []
    const values: (string | number | null)[] = []
    let paramIdx = 1

    if (body.display_name !== undefined) {
      updates.push(`display_name = ?${paramIdx++}`)
      values.push(body.display_name ?? null)
    }
    if (body.plan !== undefined && ['free', 'starter', 'team'].includes(body.plan)) {
      updates.push(`plan = ?${paramIdx++}`)
      values.push(body.plan)
    }

    if (updates.length > 0) {
      values.push(userId)
      await c.env.DB.prepare(
        `UPDATE users SET ${updates.join(', ')} WHERE id = ?${paramIdx}`,
      ).bind(...values).run()
    }

    // Handle admin_role change
    if ('admin_role' in body) {
      if (body.admin_role === null) {
        await c.env.DB.prepare(
          "DELETE FROM user_roles WHERE user_id = ?1 AND role IN ('owner', 'admin')",
        ).bind(userId).run()
      } else if (body.admin_role === 'admin' || body.admin_role === 'owner') {
        await c.env.DB.prepare(
          "INSERT INTO user_roles (id, user_id, role, created_at) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(user_id, role) DO NOTHING",
        ).bind(ulid(), userId, body.admin_role, Date.now()).run()
      }

      await recordAuditEvent(c, {
        action: 'user.role_change',
        subject_type: 'user',
        subject_id: userId,
        before_snapshot: { admin_role: null },
        after_snapshot: { admin_role: body.admin_role },
        trace_id,
      })
    } else if (updates.length > 0) {
      await recordAuditEvent(c, {
        action: 'user.update',
        subject_type: 'user',
        subject_id: userId,
        before_snapshot: existing,
        after_snapshot: { ...existing, ...body },
        trace_id,
      })
    }

    const updated = await c.env.DB.prepare(
      `SELECT u.id, u.email, u.display_name, u.plan, u.created_at, u.last_login_at, u.suspended_at,
              ur.role as admin_role
       FROM users u
       LEFT JOIN user_roles ur ON ur.user_id = u.id AND ur.role IN ('owner', 'admin')
       WHERE u.id = ?1`,
    ).bind(userId).first<AdminUser>()

    return c.json({ ok: true, data: updated, trace_id }, 200)
  })

  // ── POST /api/admin/users/:id/suspend ────────────────────────────────────────
  app.post('/users/:id/suspend', authMiddleware, adminMiddleware, async (c) => {
    const trace_id = c.get('trace_id')
    const userId = c.req.param('id')
    const now = Date.now()

    const existing = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?1').bind(userId).first()
    if (!existing) {
      return c.json({ ok: false, error: { code: 'not_found', message: 'User not found' }, trace_id }, 404)
    }

    await c.env.DB.prepare('UPDATE users SET suspended_at = ?1 WHERE id = ?2').bind(now, userId).run()
    await recordAuditEvent(c, {
      action: 'user.suspend',
      subject_type: 'user',
      subject_id: userId,
      after_snapshot: { suspended_at: now },
      trace_id,
    })

    return c.json({ ok: true, data: { suspended_at: now }, trace_id }, 200)
  })

  // ── POST /api/admin/users/:id/restore ────────────────────────────────────────
  app.post('/users/:id/restore', authMiddleware, adminMiddleware, async (c) => {
    const trace_id = c.get('trace_id')
    const userId = c.req.param('id')

    const existing = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?1').bind(userId).first()
    if (!existing) {
      return c.json({ ok: false, error: { code: 'not_found', message: 'User not found' }, trace_id }, 404)
    }

    await c.env.DB.prepare('UPDATE users SET suspended_at = NULL WHERE id = ?1').bind(userId).run()
    await recordAuditEvent(c, {
      action: 'user.restore',
      subject_type: 'user',
      subject_id: userId,
      after_snapshot: { suspended_at: null },
      trace_id,
    })

    return c.json({ ok: true, data: { suspended_at: null }, trace_id }, 200)
  })

  // ── GET /api/admin/ops/summary ───────────────────────────────────────────────
  // Service health probes + realtime reliability + issue pulse.
  app.get('/ops/summary', authMiddleware, adminMiddleware, async (c) => {
    const trace_id = c.get('trace_id')
    const now = Date.now()
    const since24h = now - 24 * 60 * 60 * 1000
    const since1h = now - 60 * 60 * 1000

    // Parallel service health probes
    const [d1Health, kvHealth, aiHealth] = await Promise.all([
      c.env.DB.prepare('SELECT 1').first().then(() => 'healthy' as ServiceStatus).catch(() => 'down' as ServiceStatus),
      c.env.SESSIONS_KV.get('__health_probe__').then(() => 'healthy' as ServiceStatus).catch(() => 'degraded' as ServiceStatus),
      Promise.resolve<ServiceStatus>('healthy'), // Workers AI binding always present if configured
    ])

    // Realtime metrics from KV
    let wsErrorRate = 0
    let reconnectRate = 0
    let voteP95: number | null = null
    let activeSessions = 0
    const metricsKv = (c.env as unknown as Record<string, KVNamespace | undefined>)['METRICS_KV']
    if (metricsKv) {
      const agg = await aggregateLiveMetrics(metricsKv, 5)
      wsErrorRate = agg.error_rate
      reconnectRate = agg.reconnect_rate
      activeSessions = agg.active_sessions
      voteP95 = agg.p95_latency_ms || null
    }

    // SEV counts from recent metrics_summary — error rate thresholds
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

    // Issue pulse — recent audit event action counts (last 24h)
    let issues: Array<{ action: string; count: number }> = []
    try {
      const { results: issueRows } = await c.env.DB.prepare(
        `SELECT action, COUNT(*) as count FROM audit_events WHERE ts >= ?1 GROUP BY action ORDER BY count DESC LIMIT 10`,
      ).bind(since24h).all<{ action: string; count: number }>()
      issues = issueRows
    } catch { /* audit_events may not exist yet */ }

    // Overall status
    const worstService = [d1Health, kvHealth, aiHealth]
    const overallStatus: ServiceStatus =
      worstService.includes('down') ? 'down' :
      worstService.includes('degraded') || sev1 > 0 ? 'degraded' :
      'healthy'

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
      updated_at: now,
    }

    return c.json({ ok: true, data: summary, trace_id }, 200)
  })

  // ── GET /api/admin/analytics ─────────────────────────────────────────────────
  // Comprehensive analytics: time-series, breakdowns, cost/usage.
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

      // Decisions per day derived from audit_events
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

  // ── GET /api/admin/sprint19-baseline ─────────────────────────────────────
  // Sprint 20 measurement endpoint for the Sprint 19 AI wizard + Launchpad work.
  // D1 provides durable baseline proxies; Analytics Engine/log-derived fields
  // are returned as null with explicit gaps until the S20 evidence query is wired.
  app.get('/sprint19-baseline', authMiddleware, adminMiddleware, async (c) => {
    const trace_id = c.get('trace_id')
    await patchSprint19SchemaIfNeeded(c.env.DB)
    const startParam = c.req.query('start')
    const endParam = c.req.query('end')
    const startMs = startParam ? Date.parse(startParam) : null
    const endMs = endParam ? Date.parse(endParam) : Date.now()

    if ((startMs !== null && Number.isNaN(startMs)) || Number.isNaN(endMs) || (startMs !== null && startMs >= endMs)) {
      return c.json(
        { ok: false, error: { code: 'validation', message: 'Invalid baseline date range' }, trace_id },
        400,
      )
    }

    const where = startMs === null ? '' : 'WHERE created_at >= ?1 AND created_at <= ?2'
    const journeyWhere = startMs === null ? '' : 'WHERE created_at >= ?1 AND created_at <= ?2'
    const bindRange = (stmt: D1PreparedStatement) => startMs === null ? stmt : stmt.bind(startMs, endMs)

    try {
      const [
        totalRes,
        aiGeneratedRes,
        aiConsentRes,
        aiGroundingRes,
        startedRes,
        draftRes,
        aiSuggestionRes,
        journeyRes,
      ] = await Promise.all([
        bindRange(c.env.DB.prepare(`SELECT COUNT(*) as n FROM sessions ${where}`)).first<{ n: number }>(),
        bindRange(c.env.DB.prepare(`SELECT COUNT(*) as n FROM sessions ${where}${where ? ' AND' : ' WHERE'} ai_generated = 1`)).first<{ n: number }>(),
        bindRange(c.env.DB.prepare(`SELECT COUNT(*) as n FROM sessions ${where}${where ? ' AND' : ' WHERE'} ai_consent_at IS NOT NULL`)).first<{ n: number }>(),
        bindRange(c.env.DB.prepare(`SELECT COUNT(*) as n FROM sessions ${where}${where ? ' AND' : ' WHERE'} ai_grounding_hash IS NOT NULL`)).first<{ n: number }>(),
        bindRange(c.env.DB.prepare(`SELECT COUNT(*) as n FROM sessions ${where}${where ? ' AND' : ' WHERE'} status IN ('live','closed','archived')`)).first<{ n: number }>(),
        bindRange(c.env.DB.prepare(`SELECT COUNT(*) as n FROM sessions ${where}${where ? ' AND' : ' WHERE'} status = 'draft'`)).first<{ n: number }>(),
        bindRange(c.env.DB.prepare(`SELECT COALESCE(SUM(ai_accepted_count), 0) as accepted, COALESCE(SUM(ai_dismissed_count), 0) as dismissed FROM sessions ${where}${where ? ' AND' : ' WHERE'} ai_generated = 1`)).first<{ accepted: number; dismissed: number }>(),
        bindRange(c.env.DB.prepare(`SELECT event_name, COUNT(*) as n FROM sprint19_events ${journeyWhere} GROUP BY event_name`)).all<{ event_name: string; n: number }>(),
      ])

      const total = totalRes?.n ?? 0
      const started = startedRes?.n ?? 0
      const journeyCounts = new Map((journeyRes.results ?? []).map((row) => [row.event_name, row.n]))
      const wizardOpened = journeyCounts.get('wizard.opened') ?? 0
      const wizardCompleted = journeyCounts.get('wizard.completed') ?? 0
      const launchAttempts = journeyCounts.get('launchpad.launch_attempt') ?? 0
      const launchSuccesses = journeyCounts.get('launchpad.launch_success') ?? 0
      const launchFailures = journeyCounts.get('launchpad.launch_failed') ?? 0
      const preflightChecks = journeyCounts.get('preflight.checked') ?? 0
      const preflightFailures = journeyCounts.get('preflight.failed') ?? 0
      const accepted = aiSuggestionRes?.accepted ?? 0
      const dismissed = aiSuggestionRes?.dismissed ?? 0
      const totalSuggestions = accepted + dismissed
      const baseline: Sprint19Baseline = {
        generated_at: Date.now(),
        window: { start: startMs, end: endMs },
        ai_usage_rate: total > 0 ? (aiGeneratedRes?.n ?? 0) / total : null,
        wizard_completion_rate: wizardOpened > 0 ? wizardCompleted / wizardOpened : (total > 0 ? started / total : null),
        launchpad_success_rate: launchAttempts > 0 ? launchSuccesses / launchAttempts : (total > 0 ? started / total : null),
        inline_suggestion_acceptance_rate: totalSuggestions > 0 ? accepted / totalSuggestions : null,
        invalid_live_attempts: launchFailures,
        preflight_failure_rate: preflightChecks > 0 ? preflightFailures / preflightChecks : null,
        counts: {
          total_sessions: total,
          ai_generated_sessions: aiGeneratedRes?.n ?? 0,
          ai_consent_sessions: aiConsentRes?.n ?? 0,
          ai_grounding_sessions: aiGroundingRes?.n ?? 0,
          started_or_closed_sessions: started,
          draft_sessions: draftRes?.n ?? 0,
          wizard_opened: wizardOpened,
          wizard_completed: wizardCompleted,
          ai_suggestions_accepted: accepted,
          ai_suggestions_dismissed: dismissed,
          launchpad_opened: journeyCounts.get('launchpad.opened') ?? 0,
          launch_attempts: launchAttempts,
          launch_successes: launchSuccesses,
          launch_failures: launchFailures,
          preflight_checks: preflightChecks,
          preflight_failures: preflightFailures,
        },
        measurement_gaps: [
          ...(wizardOpened > 0 ? [] : ['Wizard completion rate falls back to D1 created-session proxy until wizard.opened events are present.']),
          ...(launchAttempts > 0 ? [] : ['Launchpad success rate falls back to D1 started-session proxy until launch_attempt events are present.']),
          ...(preflightChecks > 0 ? [] : ['Preflight failure rate requires preflight.checked journey events in the selected window.']),
          ...(totalSuggestions > 0 ? [] : ['Inline AI suggestion acceptance requires at least one completed AI-generated wizard session in the selected window.']),
        ],
      }
      return c.json({ ok: true, data: baseline, trace_id }, 200)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to compute Sprint 19 baseline'
      return c.json({ ok: false, error: { code: 'internal', message }, trace_id }, 500)
    }
  })

  // POST /kb-sync — Phase 1 bulk vector sync to Vectorize.
  // Admin-only endpoint (requires x-admin-key header matching KB_ADMIN_KEY secret).
  // Accepts JSON array of { id, values: number[], metadata } vectors from embed-kb.ts.
  // Uses Worker Vectorize binding (more reliable than REST API).
  app.post('/kb-sync', async (c) => {
    const traceId = c.get('trace_id')!
    const adminKey = c.req.header('x-admin-key')
    const expectedKey = c.env.KB_ADMIN_KEY

    // Verify admin key
    if (!adminKey || !expectedKey || adminKey !== expectedKey) {
      return c.json(
        {
          ok: false,
          error: { code: 'unauthorized', message: 'x-admin-key header required and must match KB_ADMIN_KEY' },
          trace_id: traceId,
        },
        401,
      )
    }

    // Parse body
    let vectors: unknown
    try {
      vectors = await c.req.json()
    } catch {
      return c.json(
        {
          ok: false,
          error: { code: 'invalid_body', message: 'Body must be valid JSON array' },
          trace_id: traceId,
        },
        400,
      )
    }

    if (!Array.isArray(vectors)) {
      return c.json(
        {
          ok: false,
          error: { code: 'invalid_body', message: 'Body must be an array of vectors' },
          trace_id: traceId,
        },
        400,
      )
    }

    // Filter and validate vector objects
    const validVectors = vectors.filter(
      (v): v is { id: string; values: number[]; metadata: Record<string, unknown> } =>
        v && typeof v.id === 'string' && Array.isArray(v.values) && typeof v.metadata === 'object',
    )

    if (validVectors.length === 0) {
      return c.json(
        {
          ok: false,
          error: { code: 'invalid_body', message: 'No valid vectors in payload' },
          trace_id: traceId,
        },
        400,
      )
    }

    try {
      // Upsert to Vectorize using Worker binding
      const batchSize = 100
      let totalUpserted = 0

      for (let i = 0; i < validVectors.length; i += batchSize) {
        const batch = validVectors.slice(i, i + batchSize)
        await c.env.KB_VECTORIZE.upsert(batch as VectorizeVector[])
        totalUpserted += batch.length
      }

      return c.json(
        {
          ok: true,
          data: {
            message: 'Vectorize upsert complete',
            vectors_upserted: totalUpserted,
            batches: Math.ceil(totalUpserted / batchSize),
          },
          trace_id: traceId,
        },
        200,
      )
    } catch (err) {
      console.error('[kb-sync] Vectorize upsert failed:', err)
      return c.json(
        {
          ok: false,
          error: {
            code: 'vectorize_error',
            message: `Vectorize upsert failed: ${err instanceof Error ? err.message : 'unknown error'}`,
          },
          trace_id: traceId,
        },
        500,
      )
    }
  })

  // POST /kb-sync-delete — Phase 5 vector deletion for deleted KB files.
  // Admin-only endpoint (requires x-admin-key header matching KB_ADMIN_KEY secret).
  // Accepts JSON body with { vector_ids: string[] } array of vector IDs to delete.
  app.post('/kb-sync-delete', async (c) => {
    const traceId = c.get('trace_id')!
    const adminKey = c.req.header('x-admin-key')
    const expectedKey = c.env.KB_ADMIN_KEY

    // Verify admin key
    if (!adminKey || !expectedKey || adminKey !== expectedKey) {
      return c.json(
        {
          ok: false,
          error: { code: 'unauthorized', message: 'x-admin-key header required and must match KB_ADMIN_KEY' },
          trace_id: traceId,
        },
        401,
      )
    }

    // Parse body
    let payload: unknown
    try {
      payload = await c.req.json()
    } catch {
      return c.json(
        {
          ok: false,
          error: { code: 'invalid_body', message: 'Body must be valid JSON' },
          trace_id: traceId,
        },
        400,
      )
    }

    if (!payload || typeof payload !== 'object' || !('vector_ids' in payload)) {
      return c.json(
        {
          ok: false,
          error: { code: 'invalid_body', message: 'Body must contain vector_ids array' },
          trace_id: traceId,
        },
        400,
      )
    }

    const vectorIds = (payload as Record<string, unknown>).vector_ids
    if (!Array.isArray(vectorIds) || !vectorIds.every((id): id is string => typeof id === 'string')) {
      return c.json(
        {
          ok: false,
          error: { code: 'invalid_body', message: 'vector_ids must be an array of strings' },
          trace_id: traceId,
        },
        400,
      )
    }

    if (vectorIds.length === 0) {
      return c.json(
        {
          ok: true,
          data: {
            message: 'No vectors to delete',
            vectors_deleted: 0,
            batches: 0,
          },
          trace_id: traceId,
        },
        200,
      )
    }

    try {
      // Delete from Vectorize using Worker binding
      const batchSize = 100
      let totalDeleted = 0

      for (let i = 0; i < vectorIds.length; i += batchSize) {
        const batch = vectorIds.slice(i, i + batchSize)
        await c.env.KB_VECTORIZE.deleteByIds(batch)
        totalDeleted += batch.length
      }

      return c.json(
        {
          ok: true,
          data: {
            message: 'Vectorize delete complete',
            vectors_deleted: totalDeleted,
            batches: Math.ceil(totalDeleted / batchSize),
          },
          trace_id: traceId,
        },
        200,
      )
    } catch (err) {
      console.error('[kb-sync-delete] Vectorize delete failed:', err)
      return c.json(
        {
          ok: false,
          error: {
            code: 'vectorize_error',
            message: `Vectorize delete failed: ${err instanceof Error ? err.message : 'unknown error'}`,
          },
          trace_id: traceId,
        },
        500,
      )
    }
  })

  parent.route('/api/admin', app)
}
