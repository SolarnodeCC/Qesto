import { usePolledApi } from './usePolledApi'

export type ServiceStatus = 'healthy' | 'degraded' | 'down'

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
  updated_at: number
}

export function useAdminOps() {
  const { data: ops, loading, error, refresh } = usePolledApi<OpsSummary>('/api/admin/ops/summary', 15_000)
  return { ops, loading, error, refresh }
}
