import { useEffect, useState, useCallback } from 'react'
import { api } from '../api/client'

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
  const [ops, setOps] = useState<OpsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchOps = useCallback(async () => {
    const res = await api<OpsSummary>('/api/admin/ops/summary')
    if (res.ok) {
      setOps(res.data)
      setError(null)
    } else {
      setError(res.error.message)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchOps()
    const interval = setInterval(fetchOps, 15_000)
    return () => clearInterval(interval)
  }, [fetchOps])

  return { ops, loading, error, refresh: fetchOps }
}
