import { useEffect, useState, useCallback } from 'react'
import { api } from '../api/client'

export type PlatformKpis = {
  live_sessions: number
  total_users: number
  sessions_today: number
  sessions_this_month: number
  total_sessions: number
  ai_cost_estimate_cents: number
}

export function useAdminKpis() {
  const [kpis, setKpis] = useState<PlatformKpis | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchKpis = useCallback(async () => {
    const res = await api<PlatformKpis>('/api/admin/kpis')
    if (res.ok) {
      setKpis(res.data)
      setError(null)
    } else {
      setError(res.error.message)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchKpis()
    const interval = setInterval(fetchKpis, 30_000)
    return () => clearInterval(interval)
  }, [fetchKpis])

  return { kpis, loading, error, refresh: fetchKpis }
}
