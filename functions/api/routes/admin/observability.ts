// Platformbeheer — Module 2: Realtime platform observability.
//
// Diagnostic, near-realtime read APIs over Cloudflare-native data only
// (metrics_summary in D1 + the live metrics KV + Vectorize describe()). No
// external APM. Everything is grouped/aggregated server-side so a dashboard
// load never fans out N+1 queries.
//
// Where first-party data genuinely doesn't exist yet (4xx/5xx split, KV hot
// keys, DO throughput/hibernation, AI rate-limit headroom), the field is
// returned with `synthetic: true` rather than fabricated — the UI flags it.

import { Hono } from 'hono'
import { errorResponse } from '../../lib/error-handler'
import { z } from 'zod'
import { authMiddleware, type AuthVariables } from '../../middleware/auth'
import { adminMiddleware, type AdminVariables } from '../../middleware/admin'
import { readKvJson, writeKvJson } from '../../lib/kv'
import { validateBody } from '../../lib/request-validation'
import type { Env } from '../../types'
import { aggregateLiveMetrics } from './metrics'
import {
  DEFAULT_THRESHOLDS,
  evaluateState,
  mergeThresholds,
  worstState,
  classifyCrawler,
  isLegitCrawlerBlock,
  windowToMs,
  type MetricState,
  type ObservabilityThresholds,
} from '../../lib/observability-thresholds'

const THRESHOLDS_KEY = 'admin:observability:thresholds:v1'

type RouteAgg = {
  route: string
  request_count: number
  error_count: number
  p50_ms: number
  p95_ms: number
  p99_ms: number
}

export type RouteMetric = RouteAgg & {
  error_rate: number
  requests_per_min: number
  state: MetricState
}

export type ObservabilitySnapshot = {
  generated_at: number
  /** True when served from the KV cache rather than freshly built. */
  cached: boolean
  window: string
  thresholds: ObservabilityThresholds
  components: {
    workers: { routes: RouteMetric[]; overall_error_rate: number; state: MetricState; note: string }
    d1: { spans: RouteMetric[]; slow_count: number; state: MetricState; synthetic: boolean }
    workers_ai: { spans: RouteMetric[]; state: MetricState; rate_limit_used: null; synthetic: boolean }
    durable_objects: { active_instances: number; state: MetricState; synthetic: boolean }
    vectorize: { indexes: Array<{ name: string; dimensions: number | null; count: number | null }>; query_latency_ms: number | null; state: MetricState; synthetic: boolean }
    kv: { synthetic: boolean; note: string }
  }
  degraded_sources: string[]
}

async function loadThresholds(env: Env): Promise<ObservabilityThresholds> {
  const kv = env.METRICS_KV
  if (!kv) return DEFAULT_THRESHOLDS
  const stored = await readKvJson<unknown>(kv, THRESHOLDS_KEY).catch(() => null)
  return mergeThresholds(stored)
}

function toRouteMetric(agg: RouteAgg, windowMinutes: number, t: ObservabilityThresholds): RouteMetric {
  const error_rate = agg.request_count > 0 ? agg.error_count / agg.request_count : 0
  const state = worstState([evaluateState(error_rate, t.error_rate), evaluateState(agg.p95_ms, t.p95_ms)])
  return {
    ...agg,
    error_rate,
    requests_per_min: windowMinutes > 0 ? agg.request_count / windowMinutes : 0,
    state,
  }
}

const ThresholdsSchema = z.object({
  error_rate: z.object({ warn: z.number(), crit: z.number() }).partial().optional(),
  p95_ms: z.object({ warn: z.number(), crit: z.number() }).partial().optional(),
  d1_slow_ms: z.object({ warn: z.number(), crit: z.number() }).partial().optional(),
  reconnect_rate: z.object({ warn: z.number(), crit: z.number() }).partial().optional(),
  ai_rate_limit_used: z.object({ warn: z.number(), crit: z.number() }).partial().optional(),
})

const SNAPSHOT_CACHE_PREFIX = 'admin:observability:snapshot:v1:'
const SNAPSHOT_CACHE_TTL_SECONDS = 20

/**
 * Build the observability snapshot for a window. Extracted from the route so it
 * is cacheable and unit-testable. Pure w.r.t. request context — only env.
 */
export async function buildSnapshot(env: Env, window: string): Promise<ObservabilitySnapshot> {
  const windowMs = windowToMs(window)
  const windowMinutes = windowMs / 60_000
  const since = Date.now() - windowMs
  const thresholds = await loadThresholds(env)
  const degraded: string[] = []

  // Single grouped scan of metrics_summary; partitioned in JS into HTTP routes,
  // D1 spans (route LIKE 'd1.%'), and AI spans (route LIKE 'ai.%').
  let rows: RouteAgg[] = []
  try {
    const { results } = await env.DB.prepare(
      `SELECT route,
              SUM(request_count) AS request_count,
              SUM(error_count)   AS error_count,
              MAX(p50_ms)        AS p50_ms,
              MAX(p95_ms)        AS p95_ms,
              MAX(p99_ms)        AS p99_ms
       FROM metrics_summary
       WHERE bucket_ts >= ?1
       GROUP BY route
       ORDER BY request_count DESC
       LIMIT 200`,
    )
      .bind(since)
      .all<RouteAgg>()
    rows = results ?? []
  } catch {
    degraded.push('metrics_summary')
  }

  const httpRows = rows.filter((r) => !r.route.startsWith('d1.') && !r.route.startsWith('ai.'))
  const d1Rows = rows.filter((r) => r.route.startsWith('d1.'))
  const aiRows = rows.filter((r) => r.route.startsWith('ai.'))

  const workerRoutes = httpRows.map((r) => toRouteMetric(r, windowMinutes, thresholds)).slice(0, 50)
  const totReq = httpRows.reduce((s, r) => s + r.request_count, 0)
  const totErr = httpRows.reduce((s, r) => s + r.error_count, 0)
  const overallErrorRate = totReq > 0 ? totErr / totReq : 0

  const d1Spans = d1Rows.map((r) => toRouteMetric(r, windowMinutes, thresholds))
  const slowCount = d1Rows.filter((r) => r.p95_ms >= thresholds.d1_slow_ms.warn).length

  const aiSpans = aiRows.map((r) => toRouteMetric(r, windowMinutes, thresholds))

  // DO active instances ≈ active LIVE sessions, from live metrics KV.
  let activeInstances = 0
  let doSynthetic = true
  if (env.METRICS_KV) {
    try {
      const agg = await aggregateLiveMetrics(env.METRICS_KV, 5)
      activeInstances = agg.active_sessions
      doSynthetic = false
    } catch {
      degraded.push('metrics_kv')
    }
  } else {
    degraded.push('metrics_kv')
  }

  // Vectorize: per-index describe() + a single latency measurement.
  const vIndexes: Array<{ name: string; dimensions: number | null; count: number | null }> = []
  let vLatency: number | null = null
  let vSynthetic = true
  const named: Array<{ name: string; idx: { describe?: () => Promise<unknown> } | undefined }> = [
    { name: 'DECISIONS_VECTORIZE', idx: env.DECISIONS_VECTORIZE as never },
    { name: 'HELP_VECTORIZE', idx: env.HELP_VECTORIZE as never },
  ]
  const vStart = Date.now()
  for (const { name, idx } of named) {
    if (idx && typeof idx.describe === 'function') {
      try {
        const info = (await idx.describe()) as { dimensions?: number; vectorsCount?: number; vectorCount?: number }
        vIndexes.push({
          name,
          dimensions: typeof info?.dimensions === 'number' ? info.dimensions : null,
          count: typeof info?.vectorsCount === 'number' ? info.vectorsCount : (typeof info?.vectorCount === 'number' ? info.vectorCount : null),
        })
        vSynthetic = false
      } catch {
        vIndexes.push({ name, dimensions: null, count: null })
      }
    } else {
      vIndexes.push({ name, dimensions: null, count: null })
    }
  }
  if (!vSynthetic) vLatency = Date.now() - vStart

  return {
    generated_at: Date.now(),
    cached: false,
    window,
    thresholds,
    components: {
      workers: {
        routes: workerRoutes,
        overall_error_rate: overallErrorRate,
        state: worstState(workerRoutes.map((r) => r.state)),
        // p95/p99 here are MAX across buckets (worst bucket), not a true window
        // percentile — percentiles can't be recombined from bucket summaries.
        note: '4xx/5xx split not instrumented; p95/p99 are worst-bucket (MAX), not a recomputed window percentile',
      },
      d1: {
        spans: d1Spans,
        slow_count: slowCount,
        state: worstState(d1Spans.map((r) => r.state)),
        synthetic: d1Spans.length === 0,
      },
      workers_ai: {
        spans: aiSpans,
        state: worstState(aiSpans.map((r) => r.state)),
        rate_limit_used: null,
        synthetic: aiSpans.length === 0,
      },
      durable_objects: {
        active_instances: activeInstances,
        state: 'ok',
        synthetic: doSynthetic,
      },
      vectorize: {
        indexes: vIndexes,
        query_latency_ms: vLatency,
        state: 'ok',
        synthetic: vSynthetic,
      },
      kv: {
        synthetic: true,
        note: 'KV read/write volume and hot keys require Analytics Engine ingestion — not yet wired',
      },
    },
    degraded_sources: degraded,
  }
}

export function mountObservabilityRoutes(
  app: Hono<{ Bindings: Env; Variables: AuthVariables & AdminVariables }>,
) {
  // ── GET /observability/thresholds ──────────────────────────────────────────
  app.get('/observability/thresholds', authMiddleware, adminMiddleware, async (c) => {
    const trace_id = c.get('trace_id')
    return c.json({ ok: true, data: await loadThresholds(c.env), trace_id }, 200)
  })

  // ── PUT /observability/thresholds ──────────────────────────────────────────
  app.put('/observability/thresholds', authMiddleware, adminMiddleware, async (c) => {
    const trace_id = c.get('trace_id')
    const validated = await validateBody(c, ThresholdsSchema)
    if ('error' in validated) return validated.error
    // mergeThresholds sanitises the partial onto defaults, so a partial PUT is a
    // safe merge, never a destructive overwrite of unspecified metrics.
    const merged = mergeThresholds(validated.data)
    const kv = c.env.METRICS_KV
    if (!kv) {
      return errorResponse(c, 503, 'unavailable', 'Metrics KV not configured')
    }
    await writeKvJson(kv, THRESHOLDS_KEY, merged)
    return c.json({ ok: true, data: merged, trace_id }, 200)
  })

  // ── GET /observability/snapshot?window=1h|24h|7d ───────────────────────────
  // Cached per-window in METRICS_KV (TTL ~20s). This dashboard is polled, and
  // the underlying build does a D1 GROUP-BY scan + two Vectorize describe()
  // calls — caching keeps the observability tool from becoming a load source on
  // the very systems it watches (the NFR). `?fresh=1` bypasses.
  app.get('/observability/snapshot', authMiddleware, adminMiddleware, async (c) => {
    const trace_id = c.get('trace_id')
    const window = c.req.query('window') ?? '24h'
    const fresh = c.req.query('fresh') === '1'
    const kv = c.env.METRICS_KV
    const cacheKey = `${SNAPSHOT_CACHE_PREFIX}${window}`

    if (!fresh && kv) {
      const cached = await readKvJson<{ data: ObservabilitySnapshot; expires_at: number }>(kv, cacheKey).catch(() => null)
      if (cached && cached.expires_at > Date.now()) {
        return c.json({ ok: true, data: { ...cached.data, cached: true }, trace_id }, 200)
      }
    }

    const snapshot = await buildSnapshot(c.env, window)

    if (kv) {
      await writeKvJson(
        kv,
        cacheKey,
        { data: snapshot, expires_at: Date.now() + SNAPSHOT_CACHE_TTL_SECONDS * 1000 },
        { expirationTtl: SNAPSHOT_CACHE_TTL_SECONDS + 30 },
      ).catch(() => {})
    }

    return c.json({ ok: true, data: snapshot, trace_id }, 200)
  })

  // ── GET /observability/errors?route=&status=&window= — error stream/tail ───
  app.get('/observability/errors', authMiddleware, adminMiddleware, async (c) => {
    const trace_id = c.get('trace_id')
    const window = c.req.query('window') ?? '24h'
    const routeFilter = c.req.query('route')
    const since = Date.now() - windowToMs(window)

    type ErrorEvent = { ts: number; action: string; subject_type: string | null; subject_id: string | null; trace_id: string | null }
    let events: ErrorEvent[] = []
    try {
      const clauses = ['ts >= ?1', "action LIKE 'error.%'"]
      const binds: Array<string | number> = [since]
      if (routeFilter) {
        binds.push(`%${routeFilter}%`)
        clauses.push(`(subject_id LIKE ?${binds.length} OR action LIKE ?${binds.length})`)
      }
      const { results } = await c.env.DB.prepare(
        `SELECT ts, action, subject_type, subject_id, trace_id
         FROM audit_events
         WHERE ${clauses.join(' AND ')}
         ORDER BY ts DESC
         LIMIT 200`,
      )
        .bind(...binds)
        .all<ErrorEvent>()
      events = results ?? []
    } catch {
      /* audit_events optional in some environments */
    }

    return c.json({ ok: true, data: { window, events, filtered_by_route: routeFilter ?? null }, trace_id }, 200)
  })

  // ── GET /observability/waf?window= — bot-protection / crawler-block monitor ─
  app.get('/observability/waf', authMiddleware, adminMiddleware, async (c) => {
    const trace_id = c.get('trace_id')
    const window = c.req.query('window') ?? '24h'
    const since = Date.now() - windowToMs(window)

    type WafRow = { id: string; ts: number; rule_id: string | null; action: string; user_agent: string | null; crawler_class: string; path: string | null; country: string | null }
    let rows: WafRow[] = []
    let tablePresent = true
    try {
      const { results } = await c.env.DB.prepare(
        `SELECT id, ts, rule_id, action, user_agent, crawler_class, path, country
         FROM waf_block_events
         WHERE ts >= ?1
         ORDER BY ts DESC
         LIMIT 200`,
      )
        .bind(since)
        .all<WafRow>()
      rows = results ?? []
    } catch {
      tablePresent = false
    }

    // Re-derive class from UA as a safety net in case ingest stored 'unknown'
    // for a row whose UA actually matches a known crawler.
    const blocks = rows.map((r) => {
      const cls = r.crawler_class && r.crawler_class !== 'unknown' ? (r.crawler_class as never) : classifyCrawler(r.user_agent)
      return { ...r, crawler_class: cls, legit_crawler_block: isLegitCrawlerBlock(cls) }
    })
    const legitCrawlerBlocks = blocks.filter((b) => b.legit_crawler_block)

    return c.json(
      {
        ok: true,
        data: {
          window,
          total_blocks: blocks.length,
          legit_crawler_block_count: legitCrawlerBlocks.length,
          // The headline alert: a non-empty list here means search engines are
          // being blocked and SEO is at risk.
          legit_crawler_blocks: legitCrawlerBlocks.slice(0, 50),
          recent_blocks: blocks.slice(0, 50),
          synthetic: !tablePresent,
        },
        trace_id,
      },
      200,
    )
  })
}
