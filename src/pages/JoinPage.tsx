// Voter entry point. The URL is `/j/:code` — a 6-char join code. We look up
// the live session id via the public `/api/sessions/by-code/:code` endpoint
// then open a WebSocket to the DO for real-time voting.

import { Suspense, lazy, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import type { SessionLookupByCode } from '@/types/session'
import { applyBrandingCssVars, tryCacheJoinSession, readCachedJoinSession } from '../lib/branding'
import { api } from '../api/client'
import { useLiveSession } from '../hooks/useLiveSession'
import { LiveQuickFingerPanel, LiveTeamQuizPanel } from './join/LiveEnergizerPanels'
import { useT } from '../i18n'
import EmojiPollEnergizerView, { type EmojiPollEnergizer } from '../components/EmojiPollEnergizer'
import QuickFingerEnergizerView, { type QuickFingerEnergizer } from '../components/QuickFingerEnergizer'
import TeamQuizEnergizerView, { type TeamQuizEnergizer } from '../components/TeamQuizEnergizer'
import WordCloudEnergizerView, { type WordCloudEnergizer } from '../components/WordCloudEnergizer'
import { WaitingScreen } from './join/WaitingScreen'
import { JoinLanding } from './join/JoinLanding'
import { SessionEndedCard } from './join/SessionEndedCard'
import { QuestionVoteInput } from './join/QuestionVoteInput'
import { PostVoteResults } from './join/PostVoteResults'
import { ReactionsOverlay, useReactionsTicker } from '../components/ReactionsOverlay'
import { reactionsReducer, REACTIONS_INITIAL } from '../hooks/useReactions'
import type { XrAvatarSync } from '../hooks/useLiveSession'
import { useWebXrSupport } from '../xr/useWebXrSupport'

// XR-SPATIAL-01 / XR-AVATAR-01 (ADR-0066): lazy-loaded so the immersive beta
// module never lands in the critical bundle. Mounted only when the user
// clicks the opt-in "Enter immersive mode (beta)" button, which itself is
// only rendered when the DO has advertised the `'xr'` feature.
const XrSessionOverlay = lazy(() => import('../xr/XrSessionOverlay'))

type Lookup =
  | { status: 'loading' }
  | { status: 'waiting'; sessionId: string; title: string }
  | { status: 'ready'; sessionId: string; title: string }
  | { status: 'error'; message: string }

export default function JoinPage() {
  const { code } = useParams<{ code: string }>()
  const [lookup, setLookup] = useState<Lookup>({ status: 'loading' })
  const t = useT('join')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const lookupCode = useCallback(async (c: string, silent = false) => {
    const res = await api<SessionLookupByCode>(
      `/api/sessions/by-code/${encodeURIComponent(c.toUpperCase())}`,
    )
    if (res.ok) {
      if (res.data.branding) applyBrandingCssVars(res.data.branding)
      tryCacheJoinSession(c, res.data as unknown as Record<string, unknown>)
      if (res.data.status === 'live') {
        if (pollRef.current) {
          clearInterval(pollRef.current)
          pollRef.current = null
        }
        setLookup({ status: 'ready', sessionId: res.data.id, title: res.data.title })
      } else if (!silent) {
        setLookup({ status: 'waiting', sessionId: res.data.id, title: res.data.title })
      }
    } else if (!silent) {
      const cached = readCachedJoinSession(c)
      if (cached && typeof cached.id === 'string') {
        setLookup({
          status: cached.status === 'live' ? 'ready' : 'waiting',
          sessionId: String(cached.id),
          title: typeof cached.title === 'string' ? cached.title : 'Session',
        })
        return
      }
      setLookup({ status: 'error', message: res.error.message })
    }
  }, [])

  useEffect(() => {
    if (!code) return
    lookupCode(code as string)
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [code, lookupCode])

  useEffect(() => {
    if (lookup.status !== 'waiting' || !code) return
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(() => {
      lookupCode(code, true)
    }, 3000)
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [lookup.status, code, lookupCode])

  if (!code) return <JoinLanding />

  if (lookup.status === 'loading') {
    return (
      <main id="main" tabIndex={-1} className="min-h-screen flex flex-col items-center justify-center gap-3 p-8 text-pulse-500 focus:outline-none">
        <svg
          aria-hidden="true"
          className="animate-spin w-6 h-6 text-teal-500"
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-sm">{t('looking_up')}</span>
      </main>
    )
  }

  if (lookup.status === 'waiting') {
    return <WaitingScreen code={code} lookup={lookup} />
  }

  if (lookup.status === 'error') {
    return (
      <main id="main" className="min-h-screen flex flex-col items-center justify-center p-8 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-500">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <div className="space-y-1">
          <p className="text-lg font-semibold text-pulse-900 dark:text-[#F0F2F8]">{t('not_found_title')}</p>
          <p className="text-sm text-pulse-500 dark:text-[#A8B3CC]">{t('not_found_help')}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => { setLookup({ status: 'loading' }); lookupCode(code) }}
            className="inline-flex items-center rounded-lg bg-teal-600 text-white text-sm font-semibold px-4 py-2 hover:bg-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 transition-colors"
          >
            {t('try_again')}
          </button>
          <a
            href="/"
            className="text-sm text-teal-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded"
          >
            {t('back_to_home')}
          </a>
        </div>
      </main>
    )
  }

  return <Voter sessionId={lookup.sessionId} title={lookup.title} />
}


function Voter({ sessionId, title }: { sessionId: string; title: string }) {
  const [reactionsState, reactionsDispatch] = useReducer(reactionsReducer, REACTIONS_INITIAL)
  const onReactionDelta = useCallback(
    (delta: { counts: Record<string, number>; total: number }) => {
      reactionsDispatch({ kind: 'delta', counts: delta.counts, total: delta.total })
    },
    [],
  )
  const onTick = useCallback((now: number) => {
    reactionsDispatch({ kind: 'tick', now })
  }, [])
  useReactionsTicker(reactionsState.total > 0, onTick)

  // XR-AVATAR-01 (ADR-0066): merged avatar batches arrive as a ServerMessage,
  // not core LiveState, so the lazy XR module is the only consumer and the
  // critical path's state shape stays unchanged when XR is off.
  const [xrAvatars, setXrAvatars] = useState<XrAvatarSync['avatars']>([])
  const onXrAvatarSync = useCallback((sync: XrAvatarSync) => {
    setXrAvatars(sync.avatars)
  }, [])

  const tXr = useT('xr')

  const { state, sendVote, sendEnergizerAnswer, sendReactionSubmit, sendXrAvatarSync } = useLiveSession(sessionId, {
    enabled: true,
    onReactionDelta,
    onXrAvatarSync,
  })

  // Opt-in only — never a gate. The button is rendered solely when the DO has
  // advertised the `'xr'` capability for this (non-ZK) session; the overlay
  // mounts only after an explicit click. The capability gate (real WebXR
  // device detection, ADR-0066 D5 / FE-XR-LAUNCHER-01) is independent of the
  // flag gate above and only changes the button's label/affordance and
  // whether the overlay shows the fallback notice — it never hides the
  // button or blocks the 2D path.
  const xrAvailable = state.features.includes('xr')
  const webXrSupport = useWebXrSupport()
  const isWebXrCapable = webXrSupport === 'supported'
  const [xrOpen, setXrOpen] = useState(false)
  const xrEnterButtonRef = useRef<HTMLButtonElement>(null)
  const openXr = useCallback(() => setXrOpen(true), [])
  const closeXr = useCallback(() => {
    setXrOpen(false)
    // Return focus to the launching control so closing the overlay never
    // strands keyboard users (ADR-0066: dismissible, no focus trap on exit).
    window.setTimeout(() => xrEnterButtonRef.current?.focus(), 0)
  }, [])
  const isEnded = state.session?.status === 'closed' || state.connection === 'closed'
  const t = useT('join')
  const [myVotes, setMyVotes] = useState<string[]>([])
  const questionKind = state.question?.kind ?? 'poll'
  const isMultiVote = questionKind === 'multi_select' || questionKind === 'upvote'
  const hasVoted = !isMultiVote && myVotes.length > 0

  type AnyEnergizer = EmojiPollEnergizer | QuickFingerEnergizer | TeamQuizEnergizer | WordCloudEnergizer
  const [activeEnergizer, setActiveEnergizer] = useState<AnyEnergizer | null>(null)
  const energizerPollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchActiveEnergizer = useCallback(async () => {
    const res = await api<{ energizer: AnyEnergizer | null }>(
      `/api/sessions/${encodeURIComponent(sessionId)}/energizers/active`,
    )
    if (res.ok) {
      setActiveEnergizer(res.data.energizer)
    }
  }, [sessionId])

  useEffect(() => {
    if (isEnded) {
      if (energizerPollRef.current) clearInterval(energizerPollRef.current)
      return
    }
    fetchActiveEnergizer()
    energizerPollRef.current = setInterval(fetchActiveEnergizer, 3000)
    return () => {
      if (energizerPollRef.current) clearInterval(energizerPollRef.current)
    }
  }, [isEnded, fetchActiveEnergizer])

  const prevQuestionIdRef = useRef<string | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const newId = state.question?.id ?? null
    const oldId = prevQuestionIdRef.current
    if (newId && oldId && newId !== oldId) {
      setCountdown(3)
      if (countdownRef.current) clearInterval(countdownRef.current)
      countdownRef.current = setInterval(() => {
        setCountdown((c) => {
          if (c === null || c <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current)
            return null
          }
          return c - 1
        })
      }, 1000)
    }
    prevQuestionIdRef.current = newId
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [state.question?.id])

  useEffect(() => {
    setMyVotes([])
  }, [state.question?.id])

  function handleVote(optionId: string) {
    sendVote(optionId)
    setMyVotes((prev) => [...prev, optionId])
  }

  const options = state.question?.options ?? []
  const ordered = useMemo(
    () => options.map((o) => ({ ...o, count: state.results.counts[o.id] ?? 0 })),
    [options, state.results.counts],
  )
  const maxCount = ordered.reduce((m, o) => Math.max(m, o.count), 0)

  const connectionLabel =
    state.connection === 'open'
      ? null
      : state.connection === 'reconnecting'
      ? t('reconnecting', { attempt: state.reconnectAttempts, total: 5 })
      : state.connection === 'failed'
      ? t('connection_lost')
      : state.connection === 'connecting'
      ? t('connecting')
      : null

  return (
    <main id="main" className="relative min-h-screen bg-white dark:bg-[#0A0F1E] flex flex-col">
      <ReactionsOverlay
        particles={reactionsState.particles}
        total={reactionsState.total}
        active={reactionsState.total > 0 || questionKind === 'reaction'}
      />
      {/* Top brand bar */}
      <div className="h-1 bg-gradient-to-br from-teal-500 to-violet-500" aria-hidden="true" />
      <div className="border-b border-pulse-100 dark:border-[#1E2A45] px-5 py-3 flex items-center justify-between">
        <span className="font-[family-name:var(--font-display)] font-bold text-[18px] tracking-[-0.02em] text-pulse-900 dark:text-[#F0F2F8]">Qesto</span>
        {state.connection === 'open' ? (
          <span className="flex items-center gap-1.5 text-xs text-pulse-500 dark:text-[#A8B3CC]">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" aria-hidden="true" />
            {t('participants_label', { count: state.participants })}
          </span>
        ) : connectionLabel ? (
          <span className="text-xs text-amber-600">{connectionLabel}</span>
        ) : null}
        {xrAvailable && (
          <button
            ref={xrEnterButtonRef}
            type="button"
            onClick={openXr}
            title={isWebXrCapable ? tXr('enter_button_hint') : tXr('enter_button_fallback_hint')}
            className="min-h-[44px] inline-flex items-center gap-1.5 rounded-lg border border-teal-500/40 bg-teal-50 dark:bg-teal-900/20 px-3 text-xs font-medium text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            {isWebXrCapable ? tXr('enter_button') : tXr('enter_button_fallback')}
          </button>
        )}
      </div>

      <div className="flex-1 max-w-lg w-full mx-auto px-5 py-8 flex flex-col gap-6">
        <h1 tabIndex={-1} className="text-2xl font-semibold text-pulse-900 dark:text-[#F0F2F8] focus:outline-none">
          {title}
        </h1>

        {/* Zero-knowledge trust badge */}
        {state.session?.anonymity === 'zero_knowledge' && (
          <div
            role="status"
            aria-label={t('trust_badge')}
            className="flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800 dark:border-teal-700 dark:bg-teal-900/20 dark:text-teal-300"
          >
            <svg aria-hidden="true" className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.955 11.955 0 003 12c0 6.627 5.373 12 12 12s12-5.373 12-12c0-2.027-.505-3.938-1.396-5.617" />
            </svg>
            <span>{t('trust_badge')}</span>
          </div>
        )}

        {/* Connecting skeleton */}
        {state.connection === 'connecting' && (
          <div className="space-y-3 animate-pulse">
            <div className="h-5 bg-pulse-100 dark:bg-white/10 rounded w-3/4" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 bg-pulse-100 dark:bg-white/10 rounded-xl" />
            ))}
          </div>
        )}

        {/* Inter-question countdown */}
        {countdown !== null && (
          <div className="flex flex-col items-center justify-center gap-3 py-8" aria-live="polite" aria-atomic="true">
            <p className="text-sm text-pulse-500 dark:text-[#A8B3CC]">{t('get_ready')}</p>
            <div className="text-6xl font-bold text-teal-600 tabular-nums">{countdown}</div>
            <p className="text-xs text-pulse-500 dark:text-[#8A96B0]">{t('next_question_countdown', { seconds: countdown })}</p>
          </div>
        )}

        {/* All questions done */}
        {state.allDone && !isEnded && countdown === null && (
          <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
            <div className="text-6xl" aria-hidden="true">🎉</div>
            <h2 className="text-2xl font-bold text-pulse-900 dark:text-[#F0F2F8]">{t('allDone.heading')}</h2>
            <p className="text-sm text-pulse-500 dark:text-[#A8B3CC]">{title}</p>
          </div>
        )}

        {/* Session ended */}
        {isEnded && countdown === null && (
          <SessionEndedCard ordered={ordered} maxCount={maxCount} resultsTotal={state.results.total} />
        )}

        {/* Active energizer — live WS state */}
        {!isEnded && state.energizer?.kind === 'quick_finger' && countdown === null && (
          <LiveQuickFingerPanel
            energizer={state.energizer}
            voterId={state.voterId}
            onAnswer={sendEnergizerAnswer}
          />
        )}

        {!isEnded && state.energizer?.kind === 'team_quiz' && countdown === null && (
          <LiveTeamQuizPanel
            energizer={state.energizer}
            voterId={state.voterId}
            onAnswer={sendEnergizerAnswer}
          />
        )}

        {/* Active energizer — REST-polled (non-WS energizers) */}
        {!isEnded && !state.energizer && activeEnergizer !== null && countdown === null && (() => {
          const vid = state.voterId ?? 'anonymous'
          if (activeEnergizer.kind === 'emoji_poll')
            return <EmojiPollEnergizerView sessionId={sessionId} energizer={activeEnergizer as EmojiPollEnergizer} role="participant" voterId={vid} />
          if (activeEnergizer.kind === 'quick_finger')
            return <QuickFingerEnergizerView sessionId={sessionId} energizer={activeEnergizer as QuickFingerEnergizer} role="participant" voterId={vid} />
          if (activeEnergizer.kind === 'team_quiz')
            return <TeamQuizEnergizerView sessionId={sessionId} energizer={activeEnergizer as TeamQuizEnergizer} role="participant" voterId={vid} />
          if (activeEnergizer.kind === 'word_cloud')
            return <WordCloudEnergizerView sessionId={sessionId} energizer={activeEnergizer as WordCloudEnergizer} role="participant" voterId={vid} />
          return null
        })()}

        {/* Active question — hide during countdown */}
        {!isEnded && state.question && countdown === null && (
          <section className="space-y-4" aria-labelledby="question-heading">
            <h2 id="question-heading" className="text-lg font-medium text-pulse-900 dark:text-[#F0F2F8]">
              {state.question.prompt}
            </h2>

            {/* Paused banner */}
            {state.paused && (
              <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700" role="status">
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </svg>
                {t('voting_paused')}
              </div>
            )}

            {/* Inline reconnect notice — the disabled vote controls below would
                otherwise look tappable with no explanation (offline state). */}
            {!state.paused && state.connection !== 'open' && (
              <div className="flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 px-4 py-3 text-sm text-amber-700 dark:text-amber-300" role="status" aria-live="polite">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" aria-hidden="true" />
                {t('vote_unavailable_offline')}
              </div>
            )}

            {!state.paused && (
              <QuestionVoteInput
                questionKind={questionKind}
                hasVoted={hasVoted}
                canVote={state.connection === 'open'}
                myVotes={myVotes}
                options={state.question.options}
                results={state.results}
                onVote={handleVote}
                onReaction={sendReactionSubmit}
              />
            )}

            {hasVoted && (
              <PostVoteResults
                questionKind={questionKind}
                ordered={ordered}
                resultsTotal={state.results.total}
                myVotes={myVotes}
              />
            )}
          </section>
        )}

        {state.error && (
          <p role="alert" className="text-sm text-red-600">
            {state.error}
          </p>
        )}
      </div>

      {/* XR-SPATIAL-01 / XR-AVATAR-01 (ADR-0066): lazy-mounted only after opt-in.
          Never blocks the 2D path above — Suspense fallback is a minimal status
          line, not a full-page blocker, since the 2D UI keeps running underneath. */}
      {xrOpen && (
        <Suspense
          fallback={
            <div
              role="status"
              aria-live="polite"
              className="fixed inset-0 z-[60] flex items-center justify-center bg-[#04060C]/95 text-white text-sm"
            >
              {tXr('connecting')}
            </div>
          }
        >
          <XrSessionOverlay
            question={state.question}
            avatars={xrAvatars}
            onSendPose={sendXrAvatarSync}
            onClose={closeXr}
            isWebXrCapable={isWebXrCapable}
          />
        </Suspense>
      )}
    </main>
  )
}
