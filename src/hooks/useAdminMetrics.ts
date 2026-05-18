import { useCallback, useMemo, useState } from 'react'
import { api } from '../api/client'
import { usePolledApi } from './usePolledApi'

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
  const {
    data: liveMetrics,
    loading: liveLoading,
    error: liveError,
    refresh: fetchLiveMetrics,
  } = usePolledApi<LiveMetrics>('/api/admin/metrics/live', 5000)

  const [historicalData, setHistoricalData] = useState<HistoricalBucket[]>([])
  const [historicalLoading, setHistoricalLoading] = useState(true)
  const [localError, setLocalError] = useState<string | null>(null)

  const fetchHistorical = useCallback(async (startDate: Date, endDate: Date, route?: string) => {
    setHistoricalLoading(true)
    try {
      const params = new URLSearchParams({
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        ...(route && { route }),
      })
      const res = await api<HistoricalBucket[]>(`/api/admin/metrics/historical?${params}`)
      if (res.ok) {
        setHistoricalData(res.data)
        setLocalError(null)
      } else {
        setLocalError(res.error.message)
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to fetch historical data')
    } finally {
      setHistoricalLoading(false)
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
        setLocalError(`Export failed: ${res.statusText}`)
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
      setLocalError(err instanceof Error ? err.message : 'Export failed')
    }
  }, [])

  const error = useMemo(() => liveError ?? localError, [liveError, localError])

  const loading = useMemo(
    () => historicalLoading || (liveLoading && liveMetrics === null),
    [historicalLoading, liveLoading, liveMetrics],
  )

  return {
    liveMetrics,
    historicalData,
    loading,
    liveLoading,
    historicalLoading,
    error,
    liveError,
    historicalError: localError,
    fetchLiveMetrics,
    fetchHistorical,
    exportCSV,
  }
}
