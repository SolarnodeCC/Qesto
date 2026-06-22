import { usePolledApi } from './usePolledApi'

export type ServiceStatus = 'healthy' | 'degraded' | 'down'

export type ComponentHealth = {
  status: ServiceStatus
  detail: string | null
  metric: number | null
  unit: string | null
  synthetic?: boolean
}

export type PlatformAlert = {
  id: string
  severity: 1 | 2 | 3
  title: string
  source: 'incident' | 'health'
  created_at: number
}

export type PlatformOverview = {
  generated_at: number
  cached: boolean
  components: {
    workers: ComponentHealth
    d1: ComponentHealth
    durable_objects: ComponentHealth
    workers_ai: ComponentHealth
    vectorize: ComponentHealth
  }
  live_now: {
    active_sessions: number
    total_participants: number
    ws_connections: number
    synthetic: boolean
  }
  business: {
    signups_today: number
    active_subscriptions: number
    total_users: number
    revenue: {
      window_24h_cents: number
      window_7d_cents: number
      window_30d_cents: number
    }
    is_estimate: boolean
  }
  alerts: PlatformAlert[]
  degraded_sources: string[]
}

/**
 * Platformbeheer Module 1 — the cached "is alles oké?" overview. Polls every
 * 30s, matching the server cache TTL so we never poll faster than the data
 * changes.
 */
export function useAdminPlatformOverview() {
  const { data, loading, error, refresh } = usePolledApi<PlatformOverview>('/api/admin/platform/overview', 30_000)
  return { overview: data, loading, error, refresh }
}
