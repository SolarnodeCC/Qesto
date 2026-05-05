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
  engagement: {
    energizer_activations: number
    energizer_participants: number
    energizer_completions: number
    energizer_dropouts: number
    leaderboard_participants: number
    badges_awarded: number
    ws_error_rate: number
    reconnect_rate: number
  }
  badge_breakdown: Array<{ kind: string; count: number }>
}

export function useAdminAnalytics() {
  const { data: analytics, loading, error, refresh } = usePolledApi<AnalyticsData>('/api/admin/analytics', 60_000)
  return { analytics, loading, error, refresh }
}
