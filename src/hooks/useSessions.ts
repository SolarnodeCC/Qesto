import { useCallback, useEffect, useState } from 'react'
import type { Question as ApiQuestion, Session as ApiSession, SessionStatus } from '@api/types'
import { api, type ApiError } from '../api/client'

export type { SessionStatus }

/** Session row shape returned by list/detail session APIs (subset of `Session`). */
export type SessionSummary = Pick<
  ApiSession,
  'id' | 'owner_id' | 'code' | 'title' | 'status' | 'created_at' | 'started_at' | 'closed_at'
>

export type Question = ApiQuestion

export type PollOption = ApiQuestion['options'][number]

export type SessionDetail = {
  session: SessionSummary
  questions: Question[]
}

type ListState =
  | { status: 'loading' }
  | { status: 'ready'; sessions: SessionSummary[] }
  | { status: 'error'; error: ApiError }

export function useSessions() {
  const [state, setState] = useState<ListState>({ status: 'loading' })

  const refresh = useCallback(async () => {
    setState({ status: 'loading' })
    const res = await api<{ sessions: SessionSummary[] }>('/api/sessions')
    if (res.ok) setState({ status: 'ready', sessions: res.data.sessions })
    else setState({ status: 'error', error: res.error })
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refresh])

  const create = useCallback(async (title: string) => {
    const idemKey = crypto.randomUUID()
    const res = await api<SessionDetail>('/api/sessions', {
      method: 'POST',
      body: { title },
      idempotencyKey: idemKey,
    })
    if (res.ok) await refresh()
    return res
  }, [refresh])

  return { state, refresh, create }
}

export function useSession(id: string | undefined) {
  const [data, setData] = useState<SessionDetail | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    const res = await api<SessionDetail>(`/api/sessions/${encodeURIComponent(id)}`)
    if (res.ok) {
      setData(res.data)
      setError(null)
    } else {
      setError(res.error)
      setData(null)
    }
    setLoading(false)
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const patch = useCallback(
    async (payload: {
      title?: string
      question?: { kind: Question['kind']; prompt: string; options: PollOption[] }
    }) => {
      if (!id) return { ok: false as const, status: 0, error: { code: 'no_id', message: 'Missing session id' } }
      const res = await api<SessionDetail>(`/api/sessions/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: payload,
      })
      if (res.ok) setData(res.data)
      return res
    },
    [id],
  )

  return { data, error, loading, reload: load, patch }
}
