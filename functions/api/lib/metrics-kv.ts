// Time-series metrics bucketed in KV for per-minute aggregation.
//
// Layout: three keys per (minute, route) bucket form a composite sample:
//   metrics:YYYYMMDD:HHMM:${route}:latency        — JSON array of latency_ms samples
//   metrics:YYYYMMDD:HHMM:${route}:error_count    — integer
//   metrics:YYYYMMDD:HHMM:${route}:request_count  — integer
//
// TTL is 7 days (604800s) to cap KV cost. Older windows are summarised into D1
// `metrics_summary` by a scheduled worker.
//
// Hard rule: NEVER persist PII in the metric payloads. Only trace_id (opaque
// UUID), opaque user_id (JWT `sub` claim = ULID) and numeric latency/status.
// No emails, IPs or JWT tokens. Verified by `tests/unit/observability.test.ts`.

export const METRICS_TTL_SECONDS = 7 * 24 * 60 * 60

export type MetricSample = {
  latency_ms: number
  status: number
  user_id?: string
  trace_id: string
  ts: number
}

export type BucketKey = {
  dateKey: string // YYYYMMDD
  minuteKey: string // HHMM
}

/** Normalise a Date into UTC YYYYMMDD / HHMM components. */
export function bucketKeyFor(date: Date): BucketKey {
  const yyyy = date.getUTCFullYear().toString().padStart(4, '0')
  const mm = (date.getUTCMonth() + 1).toString().padStart(2, '0')
  const dd = date.getUTCDate().toString().padStart(2, '0')
  const hh = date.getUTCHours().toString().padStart(2, '0')
  const mi = date.getUTCMinutes().toString().padStart(2, '0')
  return { dateKey: `${yyyy}${mm}${dd}`, minuteKey: `${hh}${mi}` }
}

/** Sanitise a route path into a key-safe slug (strip IDs + leading slash). */
export function routeKey(path: string): string {
  // Collapse ULID/UUID/hex segments to `:id` so we aggregate across instances.
  const collapsed = path
    .replace(/\/[0-9A-HJKMNP-TV-Z]{26}\b/gi, '/:id') // ULID
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '/:id') // UUID
    .replace(/\/\d+\b/g, '/:n')
  return collapsed.replace(/^\/+/, '').replace(/[^a-zA-Z0-9_:.-]/g, '_') || 'root'
}

function latencyKey(b: BucketKey, route: string): string {
  return `metrics:${b.dateKey}:${b.minuteKey}:${route}:latency`
}
function errorKey(b: BucketKey, route: string): string {
  return `metrics:${b.dateKey}:${b.minuteKey}:${route}:error_count`
}
function requestKey(b: BucketKey, route: string): string {
  return `metrics:${b.dateKey}:${b.minuteKey}:${route}:request_count`
}

/**
 * Record a single request sample into the current minute bucket.
 * Safe to call without awaiting (best-effort — metrics never block the hot path).
 * If `kv` is undefined (tests/pre-bootstrap) this is a no-op.
 */
export async function recordMetric(
  kv: KVNamespace | undefined,
  route: string,
  latency_ms: number,
  status: number,
  user_id: string | undefined,
  trace_id: string,
  now: Date = new Date(),
): Promise<void> {
  if (!kv) return
  const normalisedRoute = routeKey(route)
  const bucket = bucketKeyFor(now)

  const lKey = latencyKey(bucket, normalisedRoute)
  const eKey = errorKey(bucket, normalisedRoute)
  const rKey = requestKey(bucket, normalisedRoute)

  // Best-effort read-modify-write. KV is eventually consistent so concurrent
  // writers in the same minute may drop samples; this is acceptable — we size
  // the sample set for p95 stability, not correctness.
  const [latRaw, errRaw, reqRaw] = await Promise.all([
    kv.get(lKey, 'json'),
    kv.get(eKey),
    kv.get(rKey),
  ])

  const samples = Array.isArray(latRaw) ? (latRaw as MetricSample[]) : []
  // Cap samples per bucket to avoid KV 25MB value limit. 2000 samples ≈ 200KB.
  if (samples.length < 2000) {
    samples.push({
      latency_ms,
      status,
      trace_id,
      ts: now.getTime(),
      ...(user_id ? { user_id } : {}),
    })
  }

  const errorCount = (errRaw ? Number.parseInt(errRaw, 10) : 0) + (status >= 500 ? 1 : 0)
  const requestCount = (reqRaw ? Number.parseInt(reqRaw, 10) : 0) + 1

  await Promise.all([
    kv.put(lKey, JSON.stringify(samples), { expirationTtl: METRICS_TTL_SECONDS }),
    kv.put(eKey, errorCount.toString(), { expirationTtl: METRICS_TTL_SECONDS }),
    kv.put(rKey, requestCount.toString(), { expirationTtl: METRICS_TTL_SECONDS }),
  ])
}

/** Percentile over a sorted-in-place copy of the latency array. */
export function percentile(samples: number[], p: number): number {
  if (samples.length === 0) return 0
  if (p < 0 || p > 100) throw new Error(`percentile must be 0..100, got ${p}`)
  const sorted = [...samples].sort((a, b) => a - b)
  // Nearest-rank method: index = ceil(p/100 * N) - 1, clamped into range.
  const rank = Math.ceil((p / 100) * sorted.length) - 1
  const idx = Math.max(0, Math.min(sorted.length - 1, rank))
  return sorted[idx]
}

export type RouteStats = {
  route: string
  p50: number
  p95: number
  p99: number
  error_rate: number
  request_count: number
}

/**
 * Load and compute percentiles for a (minute, route) bucket.
 * Returns null if no samples were recorded.
 */
export async function readBucket(
  kv: KVNamespace | undefined,
  route: string,
  at: Date = new Date(),
): Promise<RouteStats | null> {
  if (!kv) return null
  const normalisedRoute = routeKey(route)
  const bucket = bucketKeyFor(at)
  const [latRaw, errRaw, reqRaw] = await Promise.all([
    kv.get(latencyKey(bucket, normalisedRoute), 'json'),
    kv.get(errorKey(bucket, normalisedRoute)),
    kv.get(requestKey(bucket, normalisedRoute)),
  ])
  const samples = Array.isArray(latRaw) ? (latRaw as MetricSample[]) : []
  if (samples.length === 0) return null
  const latencies = samples.map((s) => s.latency_ms)
  const request_count = reqRaw ? Number.parseInt(reqRaw, 10) : samples.length
  const error_count = errRaw ? Number.parseInt(errRaw, 10) : 0
  return {
    route: normalisedRoute,
    p50: percentile(latencies, 50),
    p95: percentile(latencies, 95),
    p99: percentile(latencies, 99),
    error_rate: request_count === 0 ? 0 : error_count / request_count,
    request_count,
  }
}

type LiveBucket = {
  active_sessions: number
  total_participants: number
  revenue_24h_cents: number
  p95_latency_ms: number
  error_count: number
  request_count: number
  latency_samples: number[]
}

function liveBucketKey(now: Date): string {
  const yyyy = now.getUTCFullYear()
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(now.getUTCDate()).padStart(2, '0')
  const hh = String(now.getUTCHours()).padStart(2, '0')
  const mi = String(now.getUTCMinutes()).padStart(2, '0')
  return `metrics:live:${yyyy}${mm}${dd}T${hh}${mi}`
}

/**
 * Increment the current-minute live bucket with a single request sample.
 * Called from the logger middleware via waitUntil — never blocks the response.
 * Maintains a capped latency array (200 samples) for p95 computation on read.
 */
export async function writeLiveMetricBucket(
  kv: KVNamespace,
  latency_ms: number,
  isError: boolean,
  now: Date = new Date(),
): Promise<void> {
  const key = liveBucketKey(now)
  const existing = await kv.get<LiveBucket>(key, 'json')
  const latencySamples = [...(existing?.latency_samples ?? []), latency_ms].slice(-200)
  const sorted = [...latencySamples].sort((a, b) => a - b)
  const p95 = sorted[Math.max(0, Math.ceil(0.95 * sorted.length) - 1)] ?? latency_ms

  const bucket: LiveBucket = {
    active_sessions: existing?.active_sessions ?? 0,
    total_participants: existing?.total_participants ?? 0,
    revenue_24h_cents: existing?.revenue_24h_cents ?? 0,
    p95_latency_ms: p95,
    error_count: (existing?.error_count ?? 0) + (isError ? 1 : 0),
    request_count: (existing?.request_count ?? 0) + 1,
    latency_samples: latencySamples,
  }

  await kv.put(key, JSON.stringify(bucket), { expirationTtl: 7 * 24 * 60 * 60 })
}
