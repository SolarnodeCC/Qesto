/**
 * Per-isolate request-metrics accumulator (replaces per-request KV writes).
 *
 * Before: every API request did a KV read-modify-write on ONE shared key per
 * minute (`metrics:live:<minute>`), and every traced DO call did 3 more KV
 * reads + 3 writes. Above ~1 req/s that hits KV's 1-write/s/key limit (429s),
 * concurrent writers overwrote each other (badly undercounted), and it cost a
 * KV write per request. Meanwhile `metrics_summary` — the table the hourly SLO
 * paging sweep and the admin views read — was never written by anything, so
 * paging could never fire.
 *
 * Now: samples accumulate in isolate memory and are flushed at most once per
 * FLUSH_INTERVAL_MS (via waitUntil, off the response path):
 *   • metrics_summary: one row per (5-min bucket, route, isolate), upserted
 *     additively — the SLO sweep aggregates rows by route.
 *   • METRICS_KV live bucket: a single merged write per flush, so the admin
 *     live dashboard keeps working at 1 write/min/isolate instead of 1/request.
 *
 * Samples are lost if an isolate is evicted between flushes; that is accepted
 * for operational metrics (Analytics Engine still records every request).
 */
import type { Env } from '../types'
import { logBestEffort } from './log'
import { mergeLiveMetricBucket } from './metrics-kv'

export const METRICS_BUCKET_MS = 5 * 60 * 1000
export const METRICS_FLUSH_INTERVAL_MS = 60 * 1000
/** Cap per (bucket, route) sample array and distinct routes per flush. */
const MAX_SAMPLES = 500
const MAX_ROUTES_PER_FLUSH = 60

type Acc = { count: number; errors: number; samples: number[] }

const ISOLATE_ID = (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Math.random())).slice(0, 8)

let byBucketRoute = new Map<string, Acc>()
let live: Acc = { count: 0, errors: 0, samples: [] }
let lastFlushAt = Date.now()

function add(acc: Acc, latencyMs: number, isError: boolean): void {
  acc.count++
  if (isError) acc.errors++
  if (acc.samples.length < MAX_SAMPLES) acc.samples.push(latencyMs)
}

/** Record one request/span sample. Synchronous and allocation-light. */
export function recordRequestMetric(route: string, latencyMs: number, isError: boolean, now = Date.now()): void {
  const bucketTs = Math.floor(now / METRICS_BUCKET_MS) * METRICS_BUCKET_MS
  const key = `${bucketTs}|${route}`
  let acc = byBucketRoute.get(key)
  if (!acc) {
    acc = { count: 0, errors: 0, samples: [] }
    byBucketRoute.set(key, acc)
  }
  add(acc, latencyMs, isError)
  add(live, latencyMs, isError)
}

export type MetricsSnapshot = { rows: Array<{ bucketTs: number; route: string } & Acc>; live: Acc }

/** Detach accumulated samples when a flush is due (or forced). */
export function takeMetricsSnapshot(now = Date.now(), force = false): MetricsSnapshot | null {
  if (!force && now - lastFlushAt < METRICS_FLUSH_INTERVAL_MS) return null
  if (byBucketRoute.size === 0 && live.count === 0) return null
  const rows = [...byBucketRoute.entries()].slice(0, MAX_ROUTES_PER_FLUSH).map(([key, acc]) => {
    const sep = key.indexOf('|')
    return { bucketTs: Number(key.slice(0, sep)), route: key.slice(sep + 1), ...acc }
  })
  const snapshot: MetricsSnapshot = { rows, live }
  byBucketRoute = new Map()
  live = { count: 0, errors: 0, samples: [] }
  lastFlushAt = now
  return snapshot
}

function pct(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  return Math.round(sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)] ?? 0)
}

/** Persist a snapshot. Never throws (best-effort observability). */
export async function flushMetricsSnapshot(
  env: Pick<Env, 'DB' | 'METRICS_KV'>,
  snapshot: MetricsSnapshot,
  now = new Date(),
): Promise<void> {
  if (env.DB && snapshot.rows.length > 0) {
    try {
      const stmt = env.DB.prepare(
        `INSERT INTO metrics_summary (id, bucket_ts, route, p50_ms, p95_ms, p99_ms, error_count, request_count)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
         ON CONFLICT(id) DO UPDATE SET
           error_count = error_count + excluded.error_count,
           request_count = request_count + excluded.request_count,
           p50_ms = MAX(p50_ms, excluded.p50_ms),
           p95_ms = MAX(p95_ms, excluded.p95_ms),
           p99_ms = MAX(p99_ms, excluded.p99_ms)`,
      )
      await env.DB.batch(
        snapshot.rows.map((r) => {
          const sorted = [...r.samples].sort((a, b) => a - b)
          return stmt.bind(
            `${r.bucketTs}|${r.route}|${ISOLATE_ID}`,
            r.bucketTs,
            r.route,
            pct(sorted, 0.5),
            pct(sorted, 0.95),
            pct(sorted, 0.99),
            r.errors,
            r.count,
          )
        }),
      )
    } catch (err) {
      // Best-effort: metrics must never break requests; the sweep tolerates gaps.
      logBestEffort(err, { traceId: 'metrics-rollup', route: 'metrics.flush', operation: 'd1.batch', reason: 'metrics_summary_write_failed' })
    }
  }
  if (env.METRICS_KV && snapshot.live.count > 0) {
    try {
      await mergeLiveMetricBucket(env.METRICS_KV, snapshot.live, now)
    } catch (err) {
      // Best-effort: the live dashboard tolerates a missed minute.
      logBestEffort(err, { traceId: 'metrics-rollup', route: 'metrics.flush', operation: 'kv.put', reason: 'live_bucket_write_failed' })
    }
  }
}

/** Test helper. */
export function __resetMetricsRollup(): void {
  byBucketRoute = new Map()
  live = { count: 0, errors: 0, samples: [] }
  lastFlushAt = Date.now()
}
