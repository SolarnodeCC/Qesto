import { usePolledApi } from './usePolledApi'

export type DailyBucket = {
  day: string
  count: number
}

export type AnalyticsData = {
  sessions_today: number
  sessions_this_month: number
  decisions_today: number
  decisions_this_month: number
  sessions_per_day: DailyBucket[]
  decisions_per_day: DailyBucket[]
  session_status: { draft: number; live: number; closed: number; archived: number }
  consent_rate: number
  avg_participants: number
  ai_cost_estimate_cents: number
  total_sessions_created: number
  total_decisions_processed: number
}

export function useAdminAnalytics() {
  const { data: analytics, loading, error, refresh } = usePolledApi<AnalyticsData>('/api/admin/analytics', 60_000)
  return { analytics, loading, error, refresh }
}
