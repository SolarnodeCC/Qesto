import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'

type UsePolledApiResult<T> = {
  data: T | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function usePolledApi<T>(endpoint: string, intervalMs: number): UsePolledApiResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const res = await api<T>(endpoint)
    if (res.ok) {
      setData(res.data)
      setError(null)
    } else {
      setError(res.error.message)
    }
    setLoading(false)
  }, [endpoint])

  useEffect(() => {
    void refresh()
    const id = setInterval(() => {
      void refresh()
    }, intervalMs)
    return () => clearInterval(id)
  }, [refresh, intervalMs])

  return { data, loading, error, refresh }
}
