import { usePolledApi } from './usePolledApi'

export type PlatformKpis = {
  live_sessions: number
  total_users: number
  sessions_today: number
  sessions_this_month: number
  total_sessions: number
  ai_cost_estimate_cents: number
}

export function useAdminKpis() {
  const { data: kpis, loading, error, refresh } = usePolledApi<PlatformKpis>('/api/admin/kpis', 30_000)
  return { kpis, loading, error, refresh }
}
