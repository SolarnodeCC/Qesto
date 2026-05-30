/**
 * COPILOT-05 — presenter copilot panel state (ADR-0046).
 *
 * Polls the live-context snapshot (COPILOT-01) on a debounced interval while
 * the panel is enabled, and exposes the on-the-fly poll draft action
 * (COPILOT-03). All data is aggregate / PII-free.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api/client'

export type CopilotLiveContext = {
  schemaVersion: 1
  sessionId: string
  isLive: boolean
  currentQuestion: { id: string; kind: string; prompt: string; optionCount: number } | null
  responseCount: number
  participantCount: number
  participationRate: number
  mood: 'positive' | 'neutral' | 'concerning' | null
  moodSampleSize: number
  generatedAt: number
}

export type DraftedQuestion = {
  id: string
  kind: string
  prompt: string
  options: { id: string; label: string }[]
}

export type DraftPollResult = {
  draft: DraftedQuestion | null
  alternatives: DraftedQuestion[]
  confidence: number
  source: 'ai' | 'unavailable'
}

/** Live-context refresh cadence while the panel is open (ms). */
export const COPILOT_REFRESH_MS = 15_000

type CopilotState = {
  context: CopilotLiveContext | null
  loading: boolean
  planGated: boolean
  error: string | null
}

export function useCopilot(sessionId: string | undefined, enabled: boolean) {
  const [state, setState] = useState<CopilotState>({ context: null, loading: false, planGated: false, error: null })
  const [drafting, setDrafting] = useState(false)
  const [draft, setDraft] = useState<DraftPollResult | null>(null)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  const refresh = useCallback(async () => {
    if (!sessionId) return
    setState((s) => ({ ...s, loading: true }))
    const res = await api<{ context: CopilotLiveContext }>(`/api/agent/copilot/sessions/${sessionId}/live-context`)
    if (res.ok) {
      setState({ context: res.data.context, loading: false, planGated: false, error: null })
    } else if (res.status === 403) {
      setState({ context: null, loading: false, planGated: true, error: null })
    } else {
      setState((s) => ({ ...s, loading: false, error: res.error.message }))
    }
  }, [sessionId])

  useEffect(() => {
    if (!enabled || !sessionId) return
    void refresh()
    timer.current = setInterval(() => void refresh(), COPILOT_REFRESH_MS)
    return () => {
      if (timer.current) clearInterval(timer.current)
    }
  }, [enabled, sessionId, refresh])

  const draftPoll = useCallback(
    async (intent: string) => {
      const trimmed = intent.trim()
      if (!sessionId || !trimmed) return
      setDrafting(true)
      setDraft(null)
      const res = await api<DraftPollResult>(`/api/agent/copilot/sessions/${sessionId}/draft-poll`, {
        method: 'POST',
        body: { intent: trimmed },
      })
      setDrafting(false)
      if (res.ok) setDraft(res.data)
      else setState((s) => ({ ...s, error: res.error.message }))
    },
    [sessionId],
  )

  const clearDraft = useCallback(() => setDraft(null), [])

  return { ...state, refresh, draftPoll, drafting, draft, clearDraft }
}
