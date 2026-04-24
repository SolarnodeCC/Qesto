import { useEffect, useState, useCallback } from 'react'
import { api } from '../api/client'

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
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAnalytics = useCallback(async () => {
    const res = await api<AnalyticsData>('/api/admin/analytics')
    if (res.ok) {
      setAnalytics(res.data)
      setError(null)
    } else {
      setError(res.error.message)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAnalytics()
    const interval = setInterval(fetchAnalytics, 60_000)
    return () => clearInterval(interval)
  }, [fetchAnalytics])

  return { analytics, loading, error, refresh: fetchAnalytics }
}
