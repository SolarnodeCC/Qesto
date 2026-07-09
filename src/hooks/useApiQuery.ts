import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { api, type ApiError } from '../api/client'

/**
 * Fetch a single REST resource once on mount / when path changes — shared loader
 * pattern for `useSession`-style hooks (WS5 / F-08).
 */
export function useApiQuery<T>(path: string | undefined): {
  data: T | null
  error: ApiError | null
  /** HTTP status of the last failed request (null while loading / on success). */
  status: number | null
  loading: boolean
  reload: () => Promise<void>
  /** Imperative merge (e.g. optimistic PATCH bodies without a refetch round-trip). */
  setData: Dispatch<SetStateAction<T | null>>
} {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [status, setStatus] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!path) {
      setData(null)
      setError(null)
      setStatus(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const res = await api<T>(path)
    if (res.ok) {
      setData(res.data)
      setError(null)
      setStatus(null)
    } else {
      setError(res.error)
      setStatus(res.status)
      setData(null)
    }
    setLoading(false)
  }, [path])

  useEffect(() => {
    void reload()
  }, [reload])

  return { data, error, status, loading, reload, setData }
}

export type ApiQueryFailure = { error: ApiError; status: number }

/**
 * Fetch several REST resources in parallel as one loading unit — the
 * multi-endpoint variant of {@link useApiQuery} for dashboards that fan out
 * over 2+ endpoints per view. Per-key failures are exposed via `errors` (with
 * HTTP status, e.g. for plan-gate 403 detection); `error` is the first failure
 * as a convenience. A key with an undefined path is skipped (stays null).
 */
export function useParallelApiQuery<T extends Record<string, unknown>>(
  paths: { [K in keyof T]: string | undefined },
): {
  data: { [K in keyof T]: T[K] | null }
  errors: { [K in keyof T]: ApiQueryFailure | null }
  error: ApiError | null
  loading: boolean
  reload: () => Promise<void>
} {
  const keys = Object.keys(paths) as Array<keyof T>
  const pathsKey = keys.map((k) => `${String(k)}=${paths[k] ?? ''}`).join('&')

  const emptyData = useMemo(
    () => Object.fromEntries(keys.map((k) => [k, null])) as { [K in keyof T]: T[K] | null },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pathsKey],
  )
  const emptyErrors = useMemo(
    () => Object.fromEntries(keys.map((k) => [k, null])) as { [K in keyof T]: ApiQueryFailure | null },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pathsKey],
  )
  const [data, setData] = useState<{ [K in keyof T]: T[K] | null }>(emptyData)
  const [errors, setErrors] = useState<{ [K in keyof T]: ApiQueryFailure | null }>(emptyErrors)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    const entries = Object.entries(paths) as Array<[keyof T, string | undefined]>
    const results = await Promise.all(
      entries.map(async ([key, path]) => {
        if (!path) return [key, null, null] as const
        const res = await api<T[typeof key]>(path)
        return res.ok
          ? ([key, res.data, null] as const)
          : ([key, null, { error: res.error, status: res.status }] as const)
      }),
    )
    const nextData = { ...emptyData }
    const nextErrors = { ...emptyErrors }
    for (const [key, value, failure] of results) {
      nextData[key] = value as T[typeof key] | null
      nextErrors[key] = failure
    }
    setData(nextData)
    setErrors(nextErrors)
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathsKey])

  useEffect(() => {
    void reload()
  }, [reload])

  const firstFailure = keys.map((k) => errors[k]).find((f) => f !== null) ?? null
  return { data, errors, error: firstFailure ? firstFailure.error : null, loading, reload }
}
