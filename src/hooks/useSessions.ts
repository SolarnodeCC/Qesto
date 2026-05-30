import { useCallback, useEffect, useState } from 'react'
import type { PollOption, Question, SessionDetail, SessionSummary } from '@/types/session'
export type {
  PollOption,
  Question,
  SessionDetail,
  SessionSummary,
  SessionStatus,
} from '@/types/session'
import { api, type ApiError } from '../api/client'
import { useApiQuery } from './useApiQuery'

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

  const create = useCallback(
    async (title: string) => {
      const idemKey = crypto.randomUUID()
      const activeTeamId = localStorage.getItem('activeTeamId') ?? undefined
      const res = await api<SessionDetail>('/api/sessions', {
        method: 'POST',
        body: { title, ...(activeTeamId ? { teamId: activeTeamId } : {}) },
        idempotencyKey: idemKey,
      })
      if (res.ok) await refresh()
      return res
    },
    [refresh],
  )

  return { state, refresh, create }
}

export function useSession(id: string | undefined) {
  const path =
    id === undefined ? undefined : `/api/sessions/${encodeURIComponent(id)}`

  const { data, error, loading, reload, setData } = useApiQuery<SessionDetail>(path)

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
    [id, setData],
  )

  return { data, error, loading, reload, patch }
}
