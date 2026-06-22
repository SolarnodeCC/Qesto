// Platformbeheer Module 2 — pure observability helpers.
//
// Kept free of env/bindings so the threshold and crawler-classification logic
// is unit-testable in isolation and reusable by both the read API and any
// future WAF-event ingest worker. (The span/event tracer lives in
// observability.ts; this file is the alerting + classification layer.)

/** Visual alert state for a metric: green / orange / red. */
export type MetricState = 'ok' | 'warn' | 'crit'

/** Per-metric warn/crit thresholds. Operator-configurable, persisted in KV. */
export type ObservabilityThresholds = {
  /** Error rate (0..1) across a window. */
  error_rate: { warn: number; crit: number }
  /** p95 latency in ms. */
  p95_ms: { warn: number; crit: number }
  /** D1 slow-query threshold in ms (a query slower than this is "slow"). */
  d1_slow_ms: { warn: number; crit: number }
  /** WebSocket reconnect rate (0..1). */
  reconnect_rate: { warn: number; crit: number }
  /** Workers AI rate-limit usage (0..1 of the limit consumed). */
  ai_rate_limit_used: { warn: number; crit: number }
}

export const DEFAULT_THRESHOLDS: ObservabilityThresholds = {
  error_rate: { warn: 0.02, crit: 0.05 },
  p95_ms: { warn: 300, crit: 500 },
  d1_slow_ms: { warn: 200, crit: 500 },
  reconnect_rate: { warn: 0.1, crit: 0.25 },
  ai_rate_limit_used: { warn: 0.7, crit: 0.9 },
}

/**
 * Merge a (possibly partial, possibly untrusted) stored override onto the
 * defaults, keeping only known keys and numeric warn/crit pairs. Guards the
 * read path against a malformed KV blob.
 */
export function mergeThresholds(stored: unknown): ObservabilityThresholds {
  const out: ObservabilityThresholds = {
    error_rate: { ...DEFAULT_THRESHOLDS.error_rate },
    p95_ms: { ...DEFAULT_THRESHOLDS.p95_ms },
    d1_slow_ms: { ...DEFAULT_THRESHOLDS.d1_slow_ms },
    reconnect_rate: { ...DEFAULT_THRESHOLDS.reconnect_rate },
    ai_rate_limit_used: { ...DEFAULT_THRESHOLDS.ai_rate_limit_used },
  }
  if (!stored || typeof stored !== 'object') return out
  for (const key of Object.keys(out) as Array<keyof ObservabilityThresholds>) {
    const v = (stored as Record<string, unknown>)[key]
    if (v && typeof v === 'object') {
      const warn = (v as Record<string, unknown>).warn
      const crit = (v as Record<string, unknown>).crit
      if (typeof warn === 'number' && Number.isFinite(warn)) out[key].warn = warn
      if (typeof crit === 'number' && Number.isFinite(crit)) out[key].crit = crit
    }
  }
  return out
}

/**
 * Classify a metric value against warn/crit thresholds. For every metric here
 * higher is worse, so the value crosses warn before crit. `null`/NaN → 'ok'
 * (no data is not an alert; absence is surfaced separately as synthetic).
 */
export function evaluateState(value: number | null, t: { warn: number; crit: number }): MetricState {
  if (value === null || Number.isNaN(value)) return 'ok'
  if (value >= t.crit) return 'crit'
  if (value >= t.warn) return 'warn'
  return 'ok'
}

/** The worst state in a set — used to roll a component up from its metrics. */
export function worstState(states: MetricState[]): MetricState {
  if (states.includes('crit')) return 'crit'
  if (states.includes('warn')) return 'warn'
  return 'ok'
}

export type CrawlerClass = 'googlebot' | 'bingbot' | 'other_known' | 'unknown'

// Substrings that identify well-known, legitimate search crawlers. A block on
// any of these is a red flag — it usually means a bot rule is mis-scoped and
// real search engines can't index the site (the prior incident the brief cites).
const KNOWN_CRAWLER_PATTERNS: Array<{ pattern: RegExp; cls: CrawlerClass }> = [
  { pattern: /googlebot|google-inspectiontool|storebot-google/i, cls: 'googlebot' },
  { pattern: /bingbot|adidxbot|bingpreview/i, cls: 'bingbot' },
  { pattern: /duckduckbot|yandex(bot)?|baiduspider|applebot|slurp/i, cls: 'other_known' },
]

/** Classify a User-Agent string. Used at ingest and as a read-path fallback. */
export function classifyCrawler(userAgent: string | null | undefined): CrawlerClass {
  if (!userAgent) return 'unknown'
  for (const { pattern, cls } of KNOWN_CRAWLER_PATTERNS) {
    if (pattern.test(userAgent)) return cls
  }
  return 'unknown'
}

/** True when a blocked request came from a legitimate crawler — alert-worthy. */
export function isLegitCrawlerBlock(crawlerClass: CrawlerClass): boolean {
  return crawlerClass !== 'unknown'
}

/** Window keys supported across the observability module. */
export type ObservabilityWindow = '1h' | '24h' | '7d'

/** Convert a window key to its duration in milliseconds. Defaults to 24h. */
export function windowToMs(window: string | null | undefined): number {
  switch (window) {
    case '1h':
      return 60 * 60 * 1000
    case '7d':
      return 7 * 24 * 60 * 60 * 1000
    case '24h':
    default:
      return 24 * 60 * 60 * 1000
  }
}
