// Client-side WebSocket state machine for LIVE sessions.
//
// Pattern: reducer + imperative WS client. Reconnect uses exponential
// backoff (1s, 2s, 4s, 8s, 16s) capped at 5 attempts per outage; a
// successful `init` resets the counter. Server is single source of truth —
// we always rehydrate from the `init` payload on reconnect.

import { useCallback, useEffect, useReducer, useRef } from 'react'

export type LivePollOption = { id: string; label: string }
export type LiveQuestion = {
  id: string
  kind: 'poll'
  prompt: string
  options: LivePollOption[]
}

export type LiveSessionSummary = {
  id: string
  code: string
  title: string
  status: 'live' | 'closed'
}

export type LiveState = {
  connection: 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed' | 'failed'
  session: LiveSessionSummary | null
  question: LiveQuestion | null
  results: { counts: Record<string, number>; total: number }
  participants: number
  role: 'presenter' | 'voter' | null
  voterId: string | null
  error: string | null
  reconnectAttempts: number
  lastVote: { optionId: string } | null
}

type Action =
  | { kind: 'connecting' }
  | { kind: 'open' }
  | { kind: 'reconnecting'; attempt: number }
  | { kind: 'closed' }
  | { kind: 'failed'; error: string }
  | {
      kind: 'init'
      session: LiveSessionSummary
      role: 'presenter' | 'voter'
      voterId: string
      question: LiveQuestion | null
      results: { counts: Record<string, number>; total: number }
      participants: number
    }
  | { kind: 'question'; question: LiveQuestion }
  | { kind: 'results'; counts: Record<string, number>; total: number }
  | { kind: 'participants'; count: number }
  | { kind: 'session_closed'; counts: Record<string, number>; total: number }
  | { kind: 'error'; code: string; message: string }
  | { kind: 'vote_sent'; optionId: string }

export const INITIAL: LiveState = {
  connection: 'idle',
  session: null,
  question: null,
  results: { counts: {}, total: 0 },
  participants: 0,
  role: null,
  voterId: null,
  error: null,
  reconnectAttempts: 0,
  lastVote: null,
}

export function reducer(state: LiveState, action: Action): LiveState {
  switch (action.kind) {
    case 'connecting':
      return { ...state, connection: 'connecting', error: null }
    case 'open':
      return { ...state, connection: 'open' }
    case 'reconnecting':
      return { ...state, connection: 'reconnecting', reconnectAttempts: action.attempt }
    case 'closed':
      return { ...state, connection: 'closed' }
    case 'failed':
      return { ...state, connection: 'failed', error: action.error }
    case 'init':
      return {
        ...state,
        session: action.session,
        role: action.role,
        voterId: action.voterId,
        question: action.question,
        results: action.results,
        participants: action.participants,
        reconnectAttempts: 0,
        error: null,
      }
    case 'question':
      return { ...state, question: action.question, lastVote: null }
    case 'results':
      return { ...state, results: { counts: action.counts, total: action.total } }
    case 'participants':
      return { ...state, participants: action.count }
    case 'session_closed':
      return {
        ...state,
        connection: 'closed',
        results: { counts: action.counts, total: action.total },
        session: state.session ? { ...state.session, status: 'closed' } : state.session,
      }
    case 'error':
      return { ...state, error: `${action.code}: ${action.message}` }
    case 'vote_sent':
      return { ...state, lastVote: { optionId: action.optionId } }
  }
}

type Options = {
  fingerprint?: string
  presenterToken?: string
  enabled?: boolean
}

export function useLiveSession(sessionId: string | undefined, opts: Options = {}) {
  const [state, dispatch] = useReducer(reducer, INITIAL)
  const wsRef = useRef<WebSocket | null>(null)
  const attemptRef = useRef(0)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const closedByClientRef = useRef(false)

  const { fingerprint, presenterToken, enabled = true } = opts

  const clearRetryTimer = () => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current)
      retryTimerRef.current = null
    }
  }

  const connect = useCallback(() => {
    if (!sessionId || !enabled) return
    closedByClientRef.current = false
    dispatch({ kind: 'connecting' })

    const apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''
    const wsBase = apiBase
      ? apiBase.replace(/^https:\/\//, 'wss://').replace(/^http:\/\//, 'ws://')
      : `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`
    const url = `${wsBase}/api/sessions/${encodeURIComponent(sessionId)}/ws${
      fingerprint ? `?fp=${encodeURIComponent(fingerprint)}` : ''
    }`
    const subprotocols = presenterToken ? [`qesto.bearer.${presenterToken}`] : undefined
    const ws = new WebSocket(url, subprotocols)
    wsRef.current = ws

    ws.addEventListener('open', () => dispatch({ kind: 'open' }))
    ws.addEventListener('message', (ev) => {
      try {
        const msg = JSON.parse(ev.data as string) as {
          type: string
          data: Record<string, unknown>
        }
        switch (msg.type) {
          case 'init':
            dispatch({
              kind: 'init',
              session: msg.data.session as LiveSessionSummary,
              role: msg.data.role as 'presenter' | 'voter',
              voterId: msg.data.voterId as string,
              question: (msg.data.question as LiveQuestion | null) ?? null,
              results: msg.data.results as { counts: Record<string, number>; total: number },
              participants: msg.data.participants as number,
            })
            break
          case 'question':
            dispatch({ kind: 'question', question: msg.data.question as LiveQuestion })
            break
          case 'results':
            dispatch({
              kind: 'results',
              counts: msg.data.counts as Record<string, number>,
              total: msg.data.total as number,
            })
            break
          case 'participants':
            dispatch({ kind: 'participants', count: msg.data.count as number })
            break
          case 'session_closed':
            dispatch({
              kind: 'session_closed',
              counts: msg.data.counts as Record<string, number>,
              total: msg.data.total as number,
            })
            break
          case 'error':
            dispatch({
              kind: 'error',
              code: msg.data.code as string,
              message: msg.data.message as string,
            })
            break
        }
      } catch {
        /* ignore unparseable frames */
      }
    })
    ws.addEventListener('close', (ev) => {
      if (closedByClientRef.current || ev.code === 1000) {
        dispatch({ kind: 'closed' })
        return
      }
      const attempt = attemptRef.current + 1
      attemptRef.current = attempt
      if (attempt > 5) {
        dispatch({ kind: 'failed', error: 'Connection lost — refresh to retry.' })
        return
      }
      const delay = Math.min(16000, 1000 * Math.pow(2, attempt - 1))
      dispatch({ kind: 'reconnecting', attempt })
      retryTimerRef.current = setTimeout(connect, delay)
    })
    ws.addEventListener('error', () => {
      // Close handler handles the reconnect logic.
    })
  }, [sessionId, enabled, fingerprint, presenterToken])

  useEffect(() => {
    connect()
    return () => {
      closedByClientRef.current = true
      clearRetryTimer()
      wsRef.current?.close(1000, 'unmount')
      wsRef.current = null
    }
  }, [connect])

  const sendVote = useCallback(
    (optionId: string) => {
      const ws = wsRef.current
      if (!ws || ws.readyState !== WebSocket.OPEN || !state.question) return
      ws.send(
        JSON.stringify({
          type: 'vote',
          data: { questionId: state.question.id, optionId },
          timestamp: Date.now(),
        }),
      )
      dispatch({ kind: 'vote_sent', optionId })
    },
    [state.question],
  )

  const requestState = useCallback(() => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type: 'request_state', data: {}, timestamp: Date.now() }))
  }, [])

  const sendAdvance = useCallback(() => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type: 'advance', data: {}, timestamp: Date.now() }))
  }, [])

  return { state, sendVote, requestState, sendAdvance }
}
