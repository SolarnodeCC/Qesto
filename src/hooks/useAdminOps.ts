import { usePolledApi } from './usePolledApi'

export type ServiceStatus = 'healthy' | 'degraded' | 'down'

export type HourlyCorrelation = {
  hour: string
  energizer_activations: number
  energizer_answers: number
  ws_reconnects: number
  ws_errors: number
  ws_capacity_exceeded: number
}

export type OpsSummary = {
  status: ServiceStatus
  sev1: number
  sev2: number
  sev3: number
  impact_sessions: number
  impact_users: number
  services: {
    d1: ServiceStatus
    sessions_kv: ServiceStatus
    workers_ai: ServiceStatus
    session_rooms: ServiceStatus
  }
  realtime: {
    ws_error_rate: number
    reconnect_rate: number
    vote_p95_ms: number | null
  }
  issues: Array<{ action: string; count: number }>
  correlation?: HourlyCorrelation[]
  updated_at: number
}

export function useAdminOps() {
  const { data: ops, loading, error, refresh } = usePolledApi<OpsSummary>('/api/admin/ops/summary', 15_000)
  return { ops, loading, error, refresh }
}

export function useAdminOpsCorrelation() {
  const { data, loading, error, refresh } = usePolledApi<OpsSummary>('/api/admin/ops/summary?timeseries=1', 60_000)
  return { correlation: data?.correlation ?? null, loading, error, refresh }
}
