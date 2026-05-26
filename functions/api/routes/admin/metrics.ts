import { Hono } from 'hono'
import { authMiddleware, type AuthVariables } from '../../middleware/auth'
import { adminMiddleware, type AdminVariables } from '../../middleware/admin'
import { readKvJson } from '../../lib/kv'
import { validateBody } from '../../lib/validate'
import { AdminMetricsExportSchema } from '../../lib/validation'
import type { Env } from '../../types'

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
  is_sample?: boolean
}

export type HistoricalBucket = {
  bucket_ts: number
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

const CSV_HEADERS = ['bucket_ts', 'route', 'request_count', 'error_count', 'p50_ms', 'p95_ms', 'p99_ms'] as const

async function aggregateLiveMetrics(
  kv: KVNamespace,
  windowMinutes = 5,
): Promise<Omit<LiveMetrics, 'refresh_ts' | 'is_sample'>> {
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

export function mountMetricsRoutes(app: Hono<{ Bindings: Env; Variables: AuthVariables & AdminVariables }>) {
  app.get('/metrics/live', authMiddleware, adminMiddleware, async (c) => {
    const trace_id = c.get('trace_id')
    const kv = (c.env as unknown as Record<string, KVNamespace | undefined>)['METRICS_KV']
    if (!kv) {
      const sample: LiveMetrics = {
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
        is_sample: true,
      }
      return c.json({ ok: true, data: sample, trace_id }, 200)
    }

    const aggregated = await aggregateLiveMetrics(kv)
    const live: LiveMetrics = {
      ...aggregated,
      refresh_ts: Date.now(),
    }

    return c.json({ ok: true, data: live, trace_id }, 200)
  })

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

    try {
      let stmt: D1PreparedStatement
      if (routeParam) {
        stmt = c.env.DB.prepare(
          `SELECT bucket_ts, route, request_count, error_count, p50_ms, p95_ms, p99_ms
           FROM metrics_summary
           WHERE bucket_ts >= ?1 AND bucket_ts <= ?2 AND route = ?3
           ORDER BY bucket_ts ASC
           LIMIT 8641`,
        ).bind(startMs, endMs, routeParam)
      } else {
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
      const msg = (err as Error).message ?? ''
      if (msg.includes('no such table') || msg.includes('no such column')) {
        return c.json({ ok: true, data: [], is_sample: true, trace_id }, 200)
      }
      throw err
    }
  })

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
        const csv = CSV_HEADERS.join(',') + '\r\n'
        return new Response(csv, {
          status: 200,
          headers: {
            'content-type': 'text/csv; charset=utf-8',
            'content-disposition': 'attachment; filename="qesto-metrics-sample.csv"',
            'x-trace-id': trace_id,
            'x-row-count': '0',
            'x-sample': 'true',
          },
        })
      }
      throw err
    }
  })
}

export { aggregateLiveMetrics }
