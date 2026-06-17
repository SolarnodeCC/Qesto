/**
 * useEmbedWidgets — CRUD hook for embed_widgets configs (ADR-0050).
 * Authenticated host-facing; requires Chorus plan entitlement (embedWidgets).
 */
import { useCallback, useEffect, useState } from 'react'
import { api, type ApiError } from '../api/client'
import type { EmbedWidget } from '@api/types'

export interface CreateWidgetParams {
  session_id: string
  allowed_origins: string[]
}

export interface MintTokenResult {
  token: string
  exp: number
}

export type WidgetsState =
  | { status: 'loading' }
  | { status: 'ready'; widgets: EmbedWidget[] }
  | { status: 'denied' }
  | { status: 'error'; error: ApiError }

export function useEmbedWidgets() {
  const [state, setState] = useState<WidgetsState>({ status: 'loading' })
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setState({ status: 'loading' })
    const res = await api<{ widgets: EmbedWidget[] }>('/api/embed/widgets')
    if (res.ok) {
      setState({ status: 'ready', widgets: res.data.widgets })
    } else if (res.status === 403) {
      setState({ status: 'denied' })
    } else {
      setState({ status: 'error', error: res.error })
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const createWidget = useCallback(
    async (params: CreateWidgetParams): Promise<EmbedWidget | null> => {
      setCreating(true)
      setCreateError(null)
      const res = await api<{ widget: EmbedWidget }>('/api/embed/widgets', {
        method: 'POST',
        body: params,
      })
      setCreating(false)
      if (res.ok) {
        await load()
        return res.data.widget
      }
      setCreateError(res.error.message)
      return null
    },
    [load],
  )

  const mintToken = useCallback(
    async (
      widgetId: string,
      opts?: { origins?: string[]; ttl?: number },
    ): Promise<MintTokenResult | null> => {
      const res = await api<MintTokenResult>(`/api/embed/widgets/${widgetId}/token`, {
        method: 'POST',
        body: opts ?? {},
      })
      if (res.ok) return res.data
      return null
    },
    [],
  )

  const revokeWidget = useCallback(
    async (widgetId: string): Promise<boolean> => {
      const res = await api<unknown>(`/api/embed/widgets/${widgetId}`, { method: 'DELETE' })
      if (res.ok) {
        await load()
        return true
      }
      return false
    },
    [load],
  )

  return {
    state,
    reload: load,
    creating,
    createError,
    createWidget,
    mintToken,
    revokeWidget,
  }
}
