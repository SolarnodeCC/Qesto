import type { Hono } from 'hono'
import { authMiddleware, type AuthVariables } from '../../../middleware/auth'
import { adminMiddleware, type AdminVariables } from '../../../middleware/admin'
import type { Env } from '../../../types'
import { patchSprint19SchemaIfNeeded } from '../schema-patch'

type AdminApp = Hono<{ Bindings: Env; Variables: AuthVariables & AdminVariables }>

export function mountPerfAdminRoutes(app: AdminApp): void {
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
      await patchSprint19SchemaIfNeeded(c.env.DB)
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
}
