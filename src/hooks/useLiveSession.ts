// Client-side WebSocket state machine for LIVE sessions.
//
// Pattern: reducer + imperative WS client. Reconnect uses exponential
// backoff (1s, 2s, 4s, 8s, 16s) capped at 5 attempts per outage; a
// successful `init` resets the counter. Server is single source of truth —
// we always rehydrate from the `init` payload on reconnect.

import type { PollOption, QuestionKind } from '@api/types'
import { useCallback, useEffect, useReducer, useRef } from 'react'
import { buildLiveSessionWsUrl, sendWsJson } from './liveSessionWsTransport'

const LIVE_PROTOCOL_VERSION = 1

export type LiveEnergizerState = {
  id: string
  kind: 'quick_finger' | 'team_quiz' | 'emoji_poll' | 'word_cloud'
  title: string
  status: 'active' | 'completed'
  prompt?: string
  options?: string[]
  correctIndex?: number
  startedAt?: number
  answers?: {
    voterId: string
    value: string
    correct: boolean
    speedMs: number
    rank: number
  }[]
  questions?: {
    prompt: string
    options: string[]
    correctIndex: number
  }[]
  currentIndex?: number
  submissions?: {
    voterId: string
    questionIndex: number
    value: string
    correct: boolean
  }[]
  scores?: {
    voterId: string
    score: number
    rank: number
  }[]
  leaderboard?: {
    voterId: string
    label: string
    score: number
    rank: number
    badges: {
      id: string
      kind: 'first_answer' | 'speedster' | 'perfect_trivia' | 'engaged'
      label: string
      awardedAt: number
    }[]
  }[]
  badges?: Record<
    string,
    {
      id: string
      kind: 'first_answer' | 'speedster' | 'perfect_trivia' | 'engaged'
      label: string
      awardedAt: number
    }[]
  >
}

/** Wire-level option row — same shape as REST `PollOption`. */
export type LivePollOption = PollOption
export type LiveQuestion = {
  id: string
  kind: QuestionKind | string
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
  paused: boolean
  allDone: boolean
  energizer: LiveEnergizerState | null
  questionIndex: number
  questionTotal: number
}

type Action =
  | { kind: 'connecting' }
  | { kind: 'open' }
  | { kind: 'reconnecting'; attempt: number; message?: string }
  | { kind: 'closed' }
  | { kind: 'failed'; error: string }
  | {
      kind: 'init'
      session: LiveSessionSummary
      role: 'presenter' | 'voter'
      voterId: string
      question: LiveQuestion | null
      questionIndex: number
      questionTotal: number
      results: { counts: Record<string, number>; total: number }
      participants: number
      energizer?: LiveEnergizerState | null
    }
  | { kind: 'question'; question: LiveQuestion; index: number; total: number }
  | { kind: 'results'; counts: Record<string, number>; total: number }
  | { kind: 'participants'; count: number }
  | { kind: 'session_closed'; counts: Record<string, number>; total: number }
  | { kind: 'error'; code: string; message: string }
  | { kind: 'vote_sent'; optionId: string }
  | { kind: 'session_paused' }
  | { kind: 'session_resumed' }
  | { kind: 'all_done' }
  | { kind: 'energizer_state'; energizer: LiveEnergizerState | null }

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
  paused: false,
  allDone: false,
  energizer: null,
  questionIndex: 0,
  questionTotal: 0,
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
        questionIndex: action.questionIndex,
        questionTotal: action.questionTotal,
        results: action.results,
        participants: action.participants,
        energizer: action.energizer ?? null,
        reconnectAttempts: 0,
        error: null,
        paused: false,
      }
    case 'question':
      return { ...state, question: action.question, lastVote: null, allDone: false, questionIndex: action.index, questionTotal: action.total }
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
    case 'session_paused':
      return { ...state, paused: true }
    case 'session_resumed':
      return { ...state, paused: false }
    case 'all_done':
      return { ...state, allDone: true }
    case 'energizer_state':
      return { ...state, energizer: action.energizer }
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

    const url = buildLiveSessionWsUrl(sessionId, fingerprint)
    // Always offer 'qesto-v1' so the server can legally echo it back (RFC 6455
    // requires the server to choose from the offered list). The bearer token is
    // offered alongside it so the server can identify the presenter role.
    const subprotocols = presenterToken
      ? [`qesto.bearer.${presenterToken}`, 'qesto-v1']
      : ['qesto-v1']
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
              questionIndex: (msg.data.questionIndex as number) ?? 0,
              questionTotal: (msg.data.questionTotal as number) ?? 0,
              results: msg.data.results as { counts: Record<string, number>; total: number },
              participants: msg.data.participants as number,
              energizer: (msg.data.energizer as LiveEnergizerState | null | undefined) ?? null,
            })
            break
          case 'question':
            dispatch({
              kind: 'question',
              question: msg.data.question as LiveQuestion,
              index: (msg.data.index as number) ?? 0,
              total: (msg.data.total as number) ?? 0,
            })
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
          case 'session_paused':
            dispatch({ kind: 'session_paused' })
            break
          case 'session_resumed':
            dispatch({ kind: 'session_resumed' })
            break
          case 'all_done':
            dispatch({ kind: 'all_done' })
            break
          case 'energizer_state':
            dispatch({
              kind: 'energizer_state',
              energizer: (msg.data.energizer as LiveEnergizerState | null | undefined) ?? null,
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
        dispatch({
          kind: 'failed',
          error: 'Unable to connect to the live session. Please refresh the page and try again.',
        })
        return
      }
      const delay = Math.min(16000, 1000 * Math.pow(2, attempt - 1))
      const waitSeconds = Math.round(delay / 1000)
      dispatch({ kind: 'reconnecting', attempt, message: `Reconnecting in ${waitSeconds} seconds...` })
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
      if (!state.question) return
      if (
        !sendWsJson(ws, {
          v: LIVE_PROTOCOL_VERSION,
          type: 'vote',
          data: { questionId: state.question.id, optionId },
          timestamp: Date.now(),
        })
      )
        return
      dispatch({ kind: 'vote_sent', optionId })
    },
    [state.question],
  )

  const requestState = useCallback(() => {
    sendWsJson(wsRef.current, { v: LIVE_PROTOCOL_VERSION, type: 'request_state', data: {}, timestamp: Date.now() })
  }, [])

  const sendAdvance = useCallback(() => {
    sendWsJson(wsRef.current, { v: LIVE_PROTOCOL_VERSION, type: 'advance', data: {}, timestamp: Date.now() })
  }, [])

  const sendBack = useCallback(() => {
    sendWsJson(wsRef.current, { v: LIVE_PROTOCOL_VERSION, type: 'back', data: {}, timestamp: Date.now() })
  }, [])

  const sendPause = useCallback(() => {
    sendWsJson(wsRef.current, { v: LIVE_PROTOCOL_VERSION, type: 'pause', data: {}, timestamp: Date.now() })
  }, [])

  const sendResume = useCallback(() => {
    sendWsJson(wsRef.current, { v: LIVE_PROTOCOL_VERSION, type: 'resume', data: {}, timestamp: Date.now() })
  }, [])

  const sendEnergizerActivate = useCallback((energizer: LiveEnergizerState) => {
    sendWsJson(wsRef.current, {
      v: LIVE_PROTOCOL_VERSION,
      type: 'energizer_activate',
      data: { energizer },
      timestamp: Date.now(),
    })
  }, [])

  const sendEnergizerAnswer = useCallback((energizerId: string, value: string) => {
    sendWsJson(wsRef.current, {
      v: LIVE_PROTOCOL_VERSION,
      type: 'energizer_answer',
      data: { energizerId, value },
      timestamp: Date.now(),
    })
  }, [])

  const sendEnergizerAdvance = useCallback((energizerId: string) => {
    sendWsJson(wsRef.current, {
      v: LIVE_PROTOCOL_VERSION,
      type: 'energizer_advance',
      data: { energizerId },
      timestamp: Date.now(),
    })
  }, [])

  return {
    state,
    sendVote,
    requestState,
    sendAdvance,
    sendBack,
    sendPause,
    sendResume,
    sendEnergizerActivate,
    sendEnergizerAnswer,
    sendEnergizerAdvance,
  }
}
