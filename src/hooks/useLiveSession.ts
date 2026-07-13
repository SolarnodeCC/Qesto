// Client-side WebSocket state machine for LIVE sessions.
//
// Pattern: reducer + shared reconnecting-WS transport (liveSessionWsTransport).
// Reconnect uses exponential backoff (1s, 2s, 4s, 8s, 16s) capped at 5
// attempts. Server is single source of truth — we always rehydrate from the
// `init` payload on reconnect.

import type { PollOption, QuestionKind } from '@api/types'
import type { EnergizerBackendKind } from '../types/session'
import { useCallback, useEffect, useReducer, useRef } from 'react'
import { enqueueOfflineVote, flushOfflineVoteQueue } from '../lib/offline-vote-queue'
import { parseInitPayload, parseServerEnvelope } from '../lib/live-session-protocol'
import {
  buildLiveSessionWsUrl,
  buildLiveSessionSubprotocols,
  createReconnectingWs,
  sendWsJson,
} from './liveSessionWsTransport'
import type { CaptionSegment } from './useCaptions'

export type ReactionDelta = {
  counts: Record<string, number>
  total: number
}

const LIVE_PROTOCOL_VERSION = 1

export type LiveEnergizerState = {
  id: string
  kind: EnergizerBackendKind
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
  // Aggregate value→count tally (emoji_poll / word_cloud) — the only
  // cross-voter result data participants receive; raw answers are redacted
  // server-side to the viewer's own.
  optionCounts?: Record<string, number>
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
  anonymity?: 'full' | 'partial' | 'none' | 'zero_knowledge'
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
  /** Presenter-only aggregate mood (AI-SENTIMENT-01). */
  sentiment: { mood: 'positive' | 'neutral' | 'concerning'; sampleSize: number } | null
  /**
   * Additive capability list from `init.data.features[]` (ADR-0066 and prior
   * additive features). The XR launcher mounts only when `'xr'` is present
   * here — never as a gate, always an opt-in overlay.
   */
  features: string[]
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
      sentiment?: { mood: 'positive' | 'neutral' | 'concerning'; sampleSize: number } | null
      features?: string[]
    }
  | { kind: 'sentiment'; mood: 'positive' | 'neutral' | 'concerning'; sampleSize: number }
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
  sentiment: null,
  features: [],
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
        sentiment: action.sentiment ?? null,
        features: action.features ?? [],
        reconnectAttempts: 0,
        error: null,
        paused: false,
      }
    case 'sentiment':
      return { ...state, sentiment: { mood: action.mood, sampleSize: action.sampleSize } }
    case 'question':
      return { ...state, question: action.question, lastVote: null, allDone: false, questionIndex: action.index, questionTotal: action.total, sentiment: null }
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
  /** Called whenever a caption_segment ServerMessage arrives. */
  onCaptionSegment?: (seg: CaptionSegment) => void
  /** Called whenever a reaction_delta ServerMessage arrives. */
  onReactionDelta?: (delta: ReactionDelta) => void
  /**
   * Called whenever an `xr_avatar_sync` ServerMessage arrives (ADR-0066). Only
   * ever fires when the DO has the XR feature enabled for this session — the
   * XR overlay is the sole consumer, kept out of core LiveState so the XR
   * module can stay lazy-loaded and not bloat the critical bundle's state shape.
   */
  onXrAvatarSync?: (sync: XrAvatarSync) => void
}

/** Wire shape of the XR avatar batch (ADR-0066) — ephemeral id + pose only, no PII. */
export type XrAvatarSync = {
  avatars: Array<{ a: string; p: [number, number, number]; q: [number, number, number, number] }>
  rev: number
}

export function useLiveSession(sessionId: string | undefined, opts: Options = {}) {
  const [state, dispatch] = useReducer(reducer, INITIAL)
  const wsRef = useRef<WebSocket | null>(null)

  const { fingerprint, presenterToken, enabled = true, onCaptionSegment, onReactionDelta, onXrAvatarSync } = opts
  // Stable ref so the message handler closure never captures a stale callback.
  const onCaptionSegmentRef = useRef(onCaptionSegment)
  onCaptionSegmentRef.current = onCaptionSegment
  const onReactionDeltaRef = useRef(onReactionDelta)
  onReactionDeltaRef.current = onReactionDelta
  const onXrAvatarSyncRef = useRef(onXrAvatarSync)
  onXrAvatarSyncRef.current = onXrAvatarSync

  const handleMessage = useCallback(
    (ev: MessageEvent) => {
      try {
        const text = typeof ev.data === 'string' ? ev.data : String(ev.data)
        const rawUnknown: unknown = JSON.parse(text)
        const msg = parseServerEnvelope(rawUnknown)
        if (!msg) return
        switch (msg.type) {
          case 'init': {
            const init = parseInitPayload(msg.data)
            if (!init) return
            dispatch({
              kind: 'init',
              session: init.session as LiveSessionSummary,
              role: init.role,
              voterId: init.voterId,
              question: (init.question as LiveQuestion | null) ?? null,
              questionIndex: init.questionIndex,
              questionTotal: init.questionTotal,
              results: init.results,
              participants: init.participants,
              energizer: (init.energizer as LiveEnergizerState | null | undefined) ?? null,
              sentiment:
                (init.sentiment as { mood: 'positive' | 'neutral' | 'concerning'; sampleSize: number } | null | undefined) ??
                null,
              features: (init.features as string[] | undefined) ?? [],
            })
            break
          }
          case 'sentiment_signal': {
            const mood =
              msg.data.mood === 'positive' || msg.data.mood === 'neutral' || msg.data.mood === 'concerning'
                ? msg.data.mood
                : null
            if (!mood) return
            dispatch({
              kind: 'sentiment',
              mood,
              sampleSize: typeof msg.data.sampleSize === 'number' ? msg.data.sampleSize : 0,
            })
            break
          }
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
          case 'caption_segment': {
            const d = msg.data
            if (
              typeof d.id === 'string' &&
              typeof d.ts === 'number' &&
              typeof d.lang === 'string' &&
              typeof d.text === 'string' &&
              typeof d.isFinal === 'boolean'
            ) {
              onCaptionSegmentRef.current?.({
                id: d.id,
                ts: d.ts,
                lang: d.lang,
                text: d.text,
                isFinal: d.isFinal,
              })
            }
            break
          }
          case 'reaction_delta': {
            const d = msg.data
            const counts = d.counts
            if (typeof counts === 'object' && counts !== null && typeof d.total === 'number') {
              onReactionDeltaRef.current?.({
                counts: counts as Record<string, number>,
                total: d.total,
              })
            }
            break
          }
          case 'xr_avatar_sync': {
            const d = msg.data
            if (Array.isArray(d.avatars) && typeof d.rev === 'number') {
              onXrAvatarSyncRef.current?.({
                avatars: d.avatars as XrAvatarSync['avatars'],
                rev: d.rev,
              })
            }
            break
          }
        }
      } catch {
        /* ignore unparseable frames */
      }
    },
    [],
  )

  useEffect(() => {
    if (!sessionId || !enabled) return
    const handle = createReconnectingWs({
      url: buildLiveSessionWsUrl(sessionId, fingerprint),
      subprotocols: buildLiveSessionSubprotocols(presenterToken),
      onSocket: (ws) => {
        wsRef.current = ws
      },
      onOpen: (ws) => flushOfflineVoteQueue(sessionId, (payload) => sendWsJson(ws, payload)),
      onMessage: handleMessage,
      onStatus: (s) => {
        switch (s.kind) {
          case 'connecting':
            dispatch({ kind: 'connecting' })
            break
          case 'open':
            dispatch({ kind: 'open' })
            break
          case 'reconnecting':
            dispatch({
              kind: 'reconnecting',
              attempt: s.attempt,
              message: `Reconnecting in ${Math.round(s.delayMs / 1000)} seconds...`,
            })
            break
          case 'closed':
            dispatch({ kind: 'closed' })
            break
          case 'failed':
            dispatch({
              kind: 'failed',
              error: 'Unable to connect to the live session. Please refresh the page and try again.',
            })
            break
        }
      },
    })
    return () => {
      handle.close()
    }
  }, [sessionId, enabled, fingerprint, presenterToken, handleMessage])

  const sendVote = useCallback(
    (optionId: string) => {
      const ws = wsRef.current
      if (!state.question) return
      const payload = {
        v: LIVE_PROTOCOL_VERSION,
        type: 'vote',
        data: { questionId: state.question.id, optionId },
        timestamp: Date.now(),
      }
      if (!sendWsJson(ws, payload)) {
        if (sessionId) enqueueOfflineVote(sessionId, payload)
      }
      dispatch({ kind: 'vote_sent', optionId })
    },
    [sessionId, state.question],
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

  // COPILOT-06: presenter injects a copilot-drafted question into the live set.
  const sendAddQuestion = useCallback(
    (question: { kind: string; prompt: string; options: { label: string }[] }) => {
      sendWsJson(wsRef.current, {
        v: LIVE_PROTOCOL_VERSION,
        type: 'add_question',
        data: { question },
        timestamp: Date.now(),
      })
    },
    [],
  )

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

  // ── Captions (ADR-0051, FE-CAPTIONS-OVERLAY-01) ──────────────────────────

  const sendCaptionsStart = useCallback((sourceLocale: string) => {
    sendWsJson(wsRef.current, {
      v: LIVE_PROTOCOL_VERSION,
      type: 'captions_start',
      data: { sourceLocale },
      timestamp: Date.now(),
    })
  }, [])

  const sendCaptionsStop = useCallback(() => {
    sendWsJson(wsRef.current, {
      v: LIVE_PROTOCOL_VERSION,
      type: 'captions_stop',
      data: {},
      timestamp: Date.now(),
    })
  }, [])

  const sendCaptionsSetLocale = useCallback(
    (locale: 'en' | 'nl' | 'es' | 'de' | 'fr' | 'off') => {
      sendWsJson(wsRef.current, {
        v: LIVE_PROTOCOL_VERSION,
        type: 'captions_set_locale',
        data: { locale },
        timestamp: Date.now(),
      })
    },
    [],
  )

  const sendReactionSubmit = useCallback((emojiId: string) => {
    sendWsJson(wsRef.current, {
      v: LIVE_PROTOCOL_VERSION,
      type: 'reaction_submit',
      data: { emojiId },
      timestamp: Date.now(),
    })
  }, [])

  // ── XR (ADR-0066, XR-AVATAR-01) ───────────────────────────────────────────
  // Local participant's quantized pose. Caller (the lazy XR overlay) is
  // responsible for throttling the call cadence — this just forwards a frame.
  const sendXrAvatarSync = useCallback(
    (p: [number, number, number], q: [number, number, number, number]) => {
      sendWsJson(wsRef.current, {
        v: LIVE_PROTOCOL_VERSION,
        type: 'xr_avatar_sync',
        data: { p, q },
        timestamp: Date.now(),
      })
    },
    [],
  )

  return {
    state,
    sendVote,
    requestState,
    sendAdvance,
    sendBack,
    sendPause,
    sendResume,
    sendAddQuestion,
    sendEnergizerActivate,
    sendEnergizerAnswer,
    sendEnergizerAdvance,
    sendCaptionsStart,
    sendCaptionsStop,
    sendCaptionsSetLocale,
    sendReactionSubmit,
    sendXrAvatarSync,
  }
}
