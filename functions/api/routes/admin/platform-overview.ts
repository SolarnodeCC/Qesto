// Platformbeheer — Module 1: Dashboard overview.
//
// One endpoint, one job: answer "is alles oké?" in under a second. Everything a
// platform admin needs for the 5-second glance — component health cards, the
// "live nu" widget, a business snapshot, and open alerts — is assembled here and
// cached in KV (TTL ~45s). The expensive build only runs on a cache miss, so a
// dashboard refresh on a warm cache costs a single KV read, never an N+1 fan-out
// against D1.
//
// Failure is loud, not silent: every probe is isolated, and any source that
// can't be read is named in `degraded_sources` so the UI can render a clear
// "degraded" state instead of pretending all is well.

import { Hono } from 'hono'
import { authMiddleware, type AuthVariables } from '../../middleware/auth'
import { adminMiddleware, type AdminVariables } from '../../middleware/admin'
import { readKvJson, writeKvJson } from '../../lib/kv'
import type { Env } from '../../types'
import type { ComponentHealth, PlatformAlert, PlatformOverview } from './types'
import { aggregateLiveMetrics } from './metrics'

const CACHE_KEY = 'admin:platform:overview:v1'
const CACHE_TTL_SECONDS = 45

type LiveBucket = {
  active_sessions?: number
  total_participants?: number
  revenue_24h_cents?: number
  connection_count?: number
}

/** Minute-bucket key, mirroring the format written by the metrics collector. */
function liveBucketKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `metrics:live:${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}`
}

/** Read the most recent live bucket (current or previous minute), if any. */
async function readLatestLiveBucket(kv: KVNamespace): Promise<LiveBucket | null> {
  const now = Date.now()
  for (let i = 0; i < 2; i++) {
    const bucket = await readKvJson<LiveBucket>(kv, liveBucketKey(new Date(now - i * 60_000)))
    if (bucket) return bucket
  }
  return null
}

function healthy(detail: string | null, metric: number | null, unit: string | null): ComponentHealth {
  return { status: 'healthy', detail, metric, unit }
}

/**
 * Build the full overview. Pure-ish: only touches env bindings, no request
 * context, so it is unit-testable and reusable by a cron warmer.
 */
export async function buildPlatformOverview(env: Env): Promise<PlatformOverview> {
  const now = Date.now()
  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)
  const degraded: string[] = []
  const metricsKv = env.METRICS_KV

  // ── D1: health + latency, measured around a trivial probe ──────────────────
  let d1: ComponentHealth
  const d1Start = Date.now()
  try {
    await env.DB.prepare('SELECT 1').first()
    const latency = Date.now() - d1Start
    d1 = {
      status: latency > 250 ? 'degraded' : 'healthy',
      detail: `${latency}ms probe`,
      metric: latency,
      unit: 'ms',
    }
  } catch {
    degraded.push('d1')
    d1 = { status: 'down', detail: 'probe failed', metric: null, unit: 'ms' }
  }

  // ── Business snapshot: a single conditional-aggregation query (no N+1) ──────
  let signupsToday = 0
  let activeSubs = 0
  let totalUsers = 0
  let starterCount = 0
  let teamCount = 0
  try {
    const row = await env.DB.prepare(
      `SELECT
         COUNT(*) AS total_users,
         COALESCE(SUM(CASE WHEN created_at >= ?1 THEN 1 ELSE 0 END), 0) AS signups_today,
         COALESCE(SUM(CASE WHEN plan != 'free' AND suspended_at IS NULL THEN 1 ELSE 0 END), 0) AS active_subs,
         COALESCE(SUM(CASE WHEN plan = 'starter' AND suspended_at IS NULL THEN 1 ELSE 0 END), 0) AS starter_count,
         COALESCE(SUM(CASE WHEN plan = 'team' AND suspended_at IS NULL THEN 1 ELSE 0 END), 0) AS team_count
       FROM users`,
    )
      .bind(todayStart.getTime())
      .first<{ total_users: number; signups_today: number; active_subs: number; starter_count: number; team_count: number }>()
    if (row) {
      totalUsers = row.total_users
      signupsToday = row.signups_today
      activeSubs = row.active_subs
      starterCount = row.starter_count
      teamCount = row.team_count
    }
  } catch {
    degraded.push('users')
  }

  // ── Revenue: 24h is real (from KV live metric); 7d/30d are run-rate estimates.
  // We deliberately do NOT call Stripe here — it would be a blocking external
  // hit on a hot admin path. Settled-revenue aggregation is a future job.
  const starterMonthlyCents = Number.parseInt(env.STARTER_MONTHLY_EUR_CENTS ?? '0', 10) || 0
  const teamMonthlyCents = Math.round((Number.parseInt(env.TEAM_ANNUAL_EUR_CENTS ?? '0', 10) || 0) / 12)
  const monthlyRunRateCents = starterCount * starterMonthlyCents + teamCount * teamMonthlyCents

  // ── Live "nu" widget + DO instances, from the metrics KV ───────────────────
  let activeSessions = 0
  let totalParticipants = 0
  let wsConnections = 0
  let revenue24hCents = 0
  let liveSynthetic = true
  if (metricsKv) {
    try {
      const agg = await aggregateLiveMetrics(metricsKv, 5)
      activeSessions = agg.active_sessions
      totalParticipants = agg.total_participants
      revenue24hCents = agg.revenue_24h_cents
      const latest = await readLatestLiveBucket(metricsKv)
      wsConnections = latest?.connection_count ?? 0
      liveSynthetic = false
    } catch {
      degraded.push('metrics_kv')
    }
  } else {
    degraded.push('metrics_kv')
  }

  // ── Workers: the fact this code is executing means the edge is serving. ─────
  const workers = healthy(`env ${env.ENV}`, null, null)

  // ── Durable Objects: active LIVE sessions ≈ active SessionRoom instances. ───
  const durableObjects: ComponentHealth = {
    status: 'healthy',
    detail: `${activeSessions} active`,
    metric: activeSessions,
    unit: 'instances',
    ...(liveSynthetic ? { synthetic: true } : {}),
  }

  // ── Workers AI: no first-party rate-limit feed yet; report headroom unknown
  // rather than fabricate a number. Marked synthetic so the UI can flag it. ───
  const workersAi: ComponentHealth = {
    status: 'healthy',
    detail: 'rate-limit headroom not instrumented',
    metric: null,
    unit: '%',
    synthetic: true,
  }

  // ── Vectorize: probe both indexes via describe(), measure latency. ─────────
  let vectorize: ComponentHealth
  const vStart = Date.now()
  try {
    const indexes = [env.DECISIONS_VECTORIZE, env.HELP_VECTORIZE].filter(Boolean) as Array<{
      describe?: () => Promise<unknown>
    }>
    const describable = indexes.filter((i) => typeof i.describe === 'function')
    if (describable.length === 0) {
      vectorize = { status: 'healthy', detail: 'describe() unavailable', metric: null, unit: 'ms', synthetic: true }
    } else {
      await Promise.all(describable.map((i) => i.describe!()))
      const latency = Date.now() - vStart
      vectorize = {
        status: latency > 500 ? 'degraded' : 'healthy',
        detail: `${describable.length} indexes, ${latency}ms`,
        metric: latency,
        unit: 'ms',
      }
    }
  } catch {
    degraded.push('vectorize')
    vectorize = { status: 'degraded', detail: 'index probe failed', metric: null, unit: 'ms' }
  }

  // ── Alerts: open incidents (optional table) + synthesised health alerts. ───
  const alerts: PlatformAlert[] = []
  try {
    const { results } = await env.DB.prepare(
      `SELECT id, severity, title, created_at
       FROM incidents
       WHERE closed_at IS NULL
       ORDER BY severity ASC, created_at DESC
       LIMIT 25`,
    ).all<{ id: string; severity: number; title: string; created_at: number }>()
    for (const r of results ?? []) {
      const sev = (r.severity >= 1 && r.severity <= 3 ? r.severity : 3) as 1 | 2 | 3
      alerts.push({ id: r.id, severity: sev, title: r.title, source: 'incident', created_at: r.created_at })
    }
  } catch {
    /* incidents table is optional in some environments — not a degraded source */
  }

  // Synthesise alerts for any component that is down/degraded so the dashboard
  // never shows a green board while a probe is failing.
  const componentEntries: Array<[string, ComponentHealth]> = [
    ['Workers', workers],
    ['D1', d1],
    ['Durable Objects', durableObjects],
    ['Workers AI', workersAi],
    ['Vectorize', vectorize],
  ]
  for (const [name, comp] of componentEntries) {
    if (comp.status === 'down') {
      alerts.push({ id: `health:${name}`, severity: 1, title: `${name} is down`, source: 'health', created_at: now })
    } else if (comp.status === 'degraded') {
      alerts.push({ id: `health:${name}`, severity: 2, title: `${name} is degraded`, source: 'health', created_at: now })
    }
  }
  alerts.sort((a, b) => a.severity - b.severity || b.created_at - a.created_at)

  return {
    generated_at: now,
    cached: false,
    components: { workers, d1, durable_objects: durableObjects, workers_ai: workersAi, vectorize },
    live_now: {
      active_sessions: activeSessions,
      total_participants: totalParticipants,
      ws_connections: wsConnections,
      synthetic: liveSynthetic,
    },
    business: {
      signups_today: signupsToday,
      active_subscriptions: activeSubs,
      total_users: totalUsers,
      revenue: {
        window_24h_cents: revenue24hCents,
        window_7d_cents: Math.round((monthlyRunRateCents * 7) / 30),
        window_30d_cents: monthlyRunRateCents,
      },
      is_estimate: true,
    },
    alerts,
    degraded_sources: degraded,
  }
}

export function mountPlatformOverviewRoutes(
  app: Hono<{ Bindings: Env; Variables: AuthVariables & AdminVariables }>,
) {
  app.get('/platform/overview', authMiddleware, adminMiddleware, async (c) => {
    const trace_id = c.get('trace_id')
    const fresh = c.req.query('fresh') === '1'
    const metricsKv = c.env.METRICS_KV

    if (!fresh && metricsKv) {
      const cached = await readKvJson<{ data: PlatformOverview; expires_at: number }>(metricsKv, CACHE_KEY).catch(
        () => null,
      )
      if (cached && cached.expires_at > Date.now()) {
        return c.json({ ok: true, data: { ...cached.data, cached: true }, trace_id }, 200)
      }
    }

    const data = await buildPlatformOverview(c.env)

    if (metricsKv) {
      // expirationTtl gives KV a hard ceiling; expires_at is our soft TTL so a
      // stale-but-present entry is never served past its window.
      await writeKvJson(
        metricsKv,
        CACHE_KEY,
        { data, expires_at: Date.now() + CACHE_TTL_SECONDS * 1000 },
        { expirationTtl: CACHE_TTL_SECONDS + 60 },
      ).catch(() => {})
    }

    return c.json({ ok: true, data, trace_id }, 200)
  })
}
