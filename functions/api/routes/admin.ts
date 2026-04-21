// Admin metrics routes — Phase 8 Step 2
//
// Routes:
//   GET  /api/admin/metrics/live         — KV snapshot for last 5 min
//   GET  /api/admin/metrics/historical   — D1 metrics_summary (5-min buckets)
//   POST /api/admin/metrics/export       — stream D1 metrics_summary as CSV
//
// Auth: authMiddleware + adminMiddleware (owner | admin role).
//
// Step 1 note: If the metrics_summary table or METRICS_KV binding has not yet
// been provisioned, these routes return stub data with a `stub: true` flag so
// the UI can render immediately without crashing.

import { Hono } from 'hono'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import { adminMiddleware, type AdminVariables } from '../middleware/admin'
import type { Env } from '../types'

type Vars = AuthVariables & AdminVariables

// ─── Types ────────────────────────────────────────────────────────────────────

export type LiveMetrics = {
  active_sessions: number
  total_participants: number
  revenue_24h_cents: number
  p95_latency_ms: number
  error_rate: number
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
 * Read a single KV bucket key and parse JSON.  Fail-safe: returns null on
 * missing key or parse error rather than crashing.
 */
async function readKvJson<T>(kv: KVNamespace, key: string): Promise<T | null> {
  try {
    const raw = await kv.get(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

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
    }
  }

  // Most-recent wins for point-in-time fields; sum for counts.
  const latest = samples[0]
  const totalRequests = samples.reduce((s, b) => s + (b.request_count ?? 0), 0)
  const totalErrors = samples.reduce((s, b) => s + (b.error_count ?? 0), 0)

  return {
    active_sessions: latest.active_sessions ?? 0,
    total_participants: latest.total_participants ?? 0,
    revenue_24h_cents: latest.revenue_24h_cents ?? 0,
    p95_latency_ms: latest.p95_latency_ms ?? 0,
    error_rate: totalRequests > 0 ? totalErrors / totalRequests : 0,
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

export function mountAdminRoutes(parent: Hono<{ Bindings: Env; Variables: Vars }>) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()

  // All admin routes require auth + admin role.
  app.use('*', authMiddleware)
  app.use('*', adminMiddleware)

  // ── GET /api/admin/metrics/live ──────────────────────────────────────────────
  // Returns a KV snapshot for the last 5 minutes.
  // p95 target: < 200 ms (KV reads are ~1-5 ms at edge).
  app.get('/metrics/live', async (c) => {
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
  app.get('/metrics/historical', async (c) => {
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
      return c.json({ ok: true, data: { buckets: results }, trace_id }, 200)
    } catch (err) {
      // Table doesn't exist yet (Step 1 not shipped).
      const msg = (err as Error).message ?? ''
      if (msg.includes('no such table')) {
        return c.json({ ok: true, data: { buckets: [], stub: true }, trace_id }, 200)
      }
      throw err
    }
  })

  // ── POST /api/admin/metrics/export ──────────────────────────────────────────
  // Streams D1 metrics_summary as CSV.  Max 10 000 rows, <5 MB.
  app.post('/metrics/export', async (c) => {
    const trace_id = c.get('trace_id')
    const startParam = c.req.query('start')
    const endParam = c.req.query('end')

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
          error: { code: 'validation', message: 'Invalid date range' },
          trace_id,
        },
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
      if (msg.includes('no such table')) {
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

  parent.route('/api/admin', app)
}
