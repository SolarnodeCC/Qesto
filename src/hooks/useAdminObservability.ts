import { usePolledApi } from './usePolledApi'

export type MetricState = 'ok' | 'warn' | 'crit'
export type ObservabilityWindow = '1h' | '24h' | '7d'

export type RouteMetric = {
  route: string
  request_count: number
  error_count: number
  p50_ms: number
  p95_ms: number
  p99_ms: number
  error_rate: number
  requests_per_min: number
  state: MetricState
}

export type ObservabilityThresholds = {
  error_rate: { warn: number; crit: number }
  p95_ms: { warn: number; crit: number }
  d1_slow_ms: { warn: number; crit: number }
  reconnect_rate: { warn: number; crit: number }
  ai_rate_limit_used: { warn: number; crit: number }
}

export type ObservabilitySnapshot = {
  generated_at: number
  window: string
  thresholds: ObservabilityThresholds
  components: {
    workers: { routes: RouteMetric[]; overall_error_rate: number; state: MetricState; note: string }
    d1: { spans: RouteMetric[]; slow_count: number; state: MetricState; synthetic: boolean }
    workers_ai: { spans: RouteMetric[]; state: MetricState; rate_limit_used: null; synthetic: boolean }
    durable_objects: { active_instances: number; state: MetricState; synthetic: boolean }
    vectorize: {
      indexes: Array<{ name: string; dimensions: number | null; count: number | null }>
      query_latency_ms: number | null
      state: MetricState
      synthetic: boolean
    }
    kv: { synthetic: boolean; note: string }
  }
  degraded_sources: string[]
}

export type WafBlock = {
  id: string
  ts: number
  rule_id: string | null
  action: string
  user_agent: string | null
  crawler_class: string
  path: string | null
  country: string | null
  legit_crawler_block: boolean
}

export type WafMonitor = {
  window: string
  total_blocks: number
  legit_crawler_block_count: number
  legit_crawler_blocks: WafBlock[]
  recent_blocks: WafBlock[]
  synthetic: boolean
}

/** Module 2 — observability snapshot, polled near-realtime (20s). */
export function useAdminObservability(window: ObservabilityWindow) {
  const { data, loading, error, refresh } = usePolledApi<ObservabilitySnapshot>(
    `/api/admin/observability/snapshot?window=${window}`,
    20_000,
  )
  return { snapshot: data, loading, error, refresh }
}

/** Module 2 — WAF / crawler-block monitor, polled every 60s. */
export function useAdminWaf(window: ObservabilityWindow) {
  const { data, loading, error, refresh } = usePolledApi<WafMonitor>(
    `/api/admin/observability/waf?window=${window}`,
    60_000,
  )
  return { waf: data, loading, error, refresh }
}
