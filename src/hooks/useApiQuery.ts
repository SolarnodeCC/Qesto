import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { api, type ApiError } from '../api/client'

/**
 * Fetch a single REST resource once on mount / when path changes — shared loader
 * pattern for `useSession`-style hooks (WS5 / F-08).
 */
export function useApiQuery<T>(path: string | undefined): {
  data: T | null
  error: ApiError | null
  loading: boolean
  reload: () => Promise<void>
  /** Imperative merge (e.g. optimistic PATCH bodies without a refetch round-trip). */
  setData: Dispatch<SetStateAction<T | null>>
} {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!path) {
      setData(null)
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const res = await api<T>(path)
    if (res.ok) {
      setData(res.data)
      setError(null)
    } else {
      setError(res.error)
      setData(null)
    }
    setLoading(false)
  }, [path])

  useEffect(() => {
    void reload()
  }, [reload])

  return { data, error, loading, reload, setData }
}
