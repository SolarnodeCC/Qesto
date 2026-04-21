import { useEffect, useState, useCallback } from 'react'
import { api } from '../api/client'

export type LiveMetrics = {
  active_sessions: number
  total_participants: number
  revenue_24h_cents: number
  p95_latency_ms: number
  error_rate: number
  refresh_ts: number
  stub?: boolean
}

export type HistoricalBucket = {
  bucket_ts: number
  route: string | null
  request_count: number
  error_count: number
  p50_ms: number
  p95_ms: number
  p99_ms: number
}

export function useAdminMetrics() {
  const [liveMetrics, setLiveMetrics] = useState<LiveMetrics | null>(null)
  const [historicalData, setHistoricalData] = useState<HistoricalBucket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchLiveMetrics = useCallback(async () => {
    try {
      const res = await api<LiveMetrics>('/api/admin/metrics/live')
      if (res.ok) {
        setLiveMetrics(res.data)
      } else {
        setError(res.error.message)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch live metrics')
    }
  }, [])

  const fetchHistorical = useCallback(async (startDate: Date, endDate: Date, route?: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        ...(route && { route }),
      })
      const res = await api<HistoricalBucket[]>(`/api/admin/metrics/historical?${params}`)
      if (res.ok) {
        setHistoricalData(res.data)
        setError(null)
      } else {
        setError(res.error.message)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch historical data')
    } finally {
      setLoading(false)
    }
  }, [])

  const exportCSV = useCallback(async (startDate: Date, endDate: Date) => {
    const apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''
    try {
      const res = await fetch(`${apiBase}/api/admin/metrics/export`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        }),
      })

      if (!res.ok) {
        setError(`Export failed: ${res.statusText}`)
        return
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `metrics-${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed')
    }
  }, [])

  // Fetch live metrics on mount and every 5 seconds
  useEffect(() => {
    setLoading(true)
    fetchLiveMetrics()
    const interval = setInterval(fetchLiveMetrics, 5000)
    return () => clearInterval(interval)
  }, [fetchLiveMetrics])

  // Fetch historical data on mount (last 7 days)
  useEffect(() => {
    const endDate = new Date()
    const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000)
    fetchHistorical(startDate, endDate)
  }, [fetchHistorical])

  return {
    liveMetrics,
    historicalData,
    loading,
    error,
    fetchLiveMetrics,
    fetchHistorical,
    exportCSV,
  }
}
