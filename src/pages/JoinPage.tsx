// Voter entry point. The URL is `/j/:code` — a 6-char join code. We look up
// the live session id via the public `/api/sessions/by-code/:code` endpoint
// then open a WebSocket to the DO for real-time voting.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CheckCircle2, Sparkles } from 'lucide-react'
import type { SessionLookupByCode } from '@/types/session'
import { applyBrandingToDocument, cacheJoinSession, readCachedJoinSession } from '../lib/branding'
import { api } from '../api/client'
import { useLiveSession } from '../hooks/useLiveSession'
import { SliderInput, LiveQuickFingerPanel, LiveTeamQuizPanel } from './join/LiveEnergizerPanels'
import { useT } from '../i18n'
import EmojiPollEnergizerView, { type EmojiPollEnergizer } from '../components/EmojiPollEnergizer'
import QuickFingerEnergizerView, { type QuickFingerEnergizer } from '../components/QuickFingerEnergizer'
import TeamQuizEnergizerView, { type TeamQuizEnergizer } from '../components/TeamQuizEnergizer'
import WordCloudEnergizerView, { type WordCloudEnergizer } from '../components/WordCloudEnergizer'
import { inputHint } from '../ui/input-hint'

type Lookup =
  | { status: 'loading' }
  | { status: 'waiting'; sessionId: string; title: string }
  | { status: 'ready'; sessionId: string; title: string }
  | { status: 'error'; message: string }

function WaitingScreen({
  code,
  lookup,
  t,
}: {
  code?: string
  lookup: Extract<Lookup, { status: 'waiting' }>
  t: ReturnType<typeof useT>
}) {
  const [clickCount, setClickCount] = useState(0)
  const emojis = ['👍', '🎉', '👏', '⭐', '🚀', '💫', '🌟', '🎊', '🎈', '👌']
  const currentEmoji = emojis[Math.floor(clickCount / 10) % emojis.length]
  const shouldAnimate = clickCount > 0

  return (
    <main id="main" className="min-h-screen flex flex-col">
      <div className="h-1 bg-gradient-to-br from-teal-500 to-violet-500" aria-hidden="true" />
      <div className="border-b border-pulse-100 dark:border-[#1E2A45] px-5 py-3">
        <span className="font-[family-name:var(--font-display)] font-bold text-[18px] tracking-[-0.02em] text-pulse-900 dark:text-[#F0F2F8]">Qesto</span>
      </div>
      <div className="flex-1 max-w-lg w-full mx-auto px-5 py-12 flex flex-col items-center justify-center gap-8 text-center">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-teal-500 to-violet-500 flex items-center justify-center shadow-lg" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-pulse-900 dark:text-[#F0F2F8]">{lookup.title}</h1>
          <p className="text-sm text-pulse-500 dark:text-[#A8B3CC] max-w-xs">{t('waiting_intro')}</p>
        </div>
        <div className="rounded-xl border border-pulse-200 dark:border-[#1E2A45] bg-pulse-50 dark:bg-[#0F1525] px-6 py-5 w-full max-w-sm space-y-3">
          <div className="flex items-center justify-center gap-2 text-sm font-medium text-pulse-700 dark:text-[#A8B3CC]" role="status" aria-live="polite">
            <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" aria-hidden="true" />
            {t('waiting_status')}
          </div>
          <p className="text-xs text-pulse-400 dark:text-[#6B7A99]">{t('waiting_auto_update')}</p>
        </div>
        <div
          className="cursor-pointer mt-2 transition-transform hover:scale-110 active:scale-95"
          onClick={() => setClickCount((c) => c + 1)}
          role="button"
          aria-label="Easter egg: Click for fun"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setClickCount((c) => c + 1)}
        >
          <span className={`text-6xl block ${shouldAnimate ? 'animate-bounce' : ''}`}>
            {currentEmoji}
          </span>
        </div>
        <p className="text-xs text-pulse-400 dark:text-[#6B7A99]">
          {t('join_code_label')} <span className="font-mono font-semibold text-pulse-600 dark:text-[#A8B3CC]">{code?.toUpperCase()}</span>
        </p>
      </div>
    </main>
  )
}

function JoinLanding() {
  const [code, setCode] = useState('')
  const navigate = useNavigate()
  const t = useT('join')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const clean = code.trim().toUpperCase()
    if (clean.length < 1) return
    navigate(`/j/${clean}`)
  }

  return (
    <main id="main" className="min-h-screen flex flex-col">
      <div className="h-1 bg-gradient-to-br from-teal-500 to-violet-500" aria-hidden="true" />
      <div className="border-b border-pulse-100 dark:border-[#1E2A45] px-5 py-3">
        <a href="/" className="font-[family-name:var(--font-display)] font-bold text-[18px] tracking-[-0.02em] text-pulse-900 dark:text-[#F0F2F8] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded">Qesto</a>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-2">
            <h1 tabIndex={-1} className="text-2xl font-bold text-pulse-900 dark:text-[#F0F2F8] focus:outline-none">{t('heading')}</h1>
            <p className="text-sm text-pulse-500 dark:text-[#A8B3CC]">{t('subtitle')}</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <label className="block">
              <span className="sr-only">{t('codeLabel')}</span>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, ''))}
                {...inputHint(t('codePlaceholder'))}
                maxLength={6}
                autoFocus
                spellCheck={false}
                autoCapitalize="characters"
                aria-label={t('codeLabel')}
                className="w-full rounded-xl border border-pulse-300 dark:border-[#2A3858] bg-white dark:bg-[#1C2540] text-pulse-900 dark:text-[#F0F2F8] text-center font-mono text-2xl font-bold tracking-[0.3em] uppercase px-4 py-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:border-teal-500 placeholder:text-pulse-300 dark:placeholder:text-[#6B7A99] placeholder:tracking-normal placeholder:font-normal placeholder:text-lg"
              />
            </label>
            <button
              type="submit"
              disabled={code.trim().length === 0}
              className="w-full rounded-xl bg-teal-600 text-white text-sm font-semibold py-3 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 transition-colors"
            >
              {t('joinButton')}
            </button>
          </form>
          <p className="text-center text-xs text-pulse-400">
            <a href="/" className="text-teal-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded">{t('back')}</a>
          </p>
        </div>
      </div>
    </main>
  )
}

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
      if (res.data.branding) applyBrandingToDocument(res.data.branding)
      cacheJoinSession(c, res.data as unknown as Record<string, unknown>)
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

  // Start polling when we enter the waiting state
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
      <main className="min-h-screen flex flex-col items-center justify-center gap-3 p-8 text-pulse-500">
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
    return <WaitingScreen code={code} lookup={lookup} t={t} />
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
          <p className="text-lg font-semibold text-pulse-900">{t('not_found_title')}</p>
          <p className="text-sm text-pulse-500">{lookup.message}</p>
        </div>
        <a
          href="/"
          className="text-sm text-teal-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded"
        >
          {t('back_to_home')}
        </a>
      </main>
    )
  }

  return <Voter sessionId={lookup.sessionId} title={lookup.title} />
}


function Voter({ sessionId, title }: { sessionId: string; title: string }) {
  const { state, sendVote, sendEnergizerAnswer } = useLiveSession(sessionId, { enabled: true })
  const isEnded = state.session?.status === 'closed' || state.connection === 'closed'
  const t = useT('join')
  const [myVotes, setMyVotes] = useState<string[]>([])
  const questionKind = state.question?.kind ?? 'poll'
  const isMultiVote = questionKind === 'multi_select' || questionKind === 'upvote'
  const hasVoted = !isMultiVote && myVotes.length > 0

  // Energizer polling — checks for an active energizer every 3s
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

  // Inter-question countdown: when question changes after voting, show 3-2-1
  const prevQuestionIdRef = useRef<string | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const newId = state.question?.id ?? null
    const oldId = prevQuestionIdRef.current
    if (newId && oldId && newId !== oldId) {
      // A new question arrived — show countdown
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
    <main id="main" className="min-h-screen bg-white dark:bg-[#0A0F1E] flex flex-col">
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
      </div>

      <div className="flex-1 max-w-lg w-full mx-auto px-5 py-8 flex flex-col gap-6">
        {/* Session title */}
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
            <p className="text-xs text-pulse-400 dark:text-[#6B7A99]">{t('next_question_countdown', { seconds: countdown })}</p>
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
          <div className="rounded-xl border border-pulse-200 dark:border-[#1E2A45] p-6 text-center space-y-2">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-teal-500 to-violet-500 flex items-center justify-center mx-auto shadow-teal" aria-hidden="true">
              <CheckCircle2 size={28} className="text-white" />
            </div>
            <p className="font-semibold text-pulse-900 dark:text-[#F0F2F8]">{t('session_ended_title')}</p>
            <p className="text-sm text-pulse-500 dark:text-[#A8B3CC]">{t('session_ended_body')}</p>
            {state.results.total > 0 && (
              <div className="mt-4 space-y-3 text-left">
                <p className="text-xs font-semibold uppercase tracking-wider text-pulse-500 dark:text-[#A8B3CC]">{t('final_results')}</p>
                {ordered.map((o) => {
                  const pct = maxCount === 0 ? 0 : Math.round((o.count / state.results.total) * 100)
                  const isWinner = o.count === maxCount && maxCount > 0
                  return (
                    <div key={o.id} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className={isWinner ? 'font-semibold text-teal-700' : 'text-pulse-700 dark:text-[#A8B3CC]'}>
                          {o.label}
                        </span>
                        <span className="text-pulse-500 dark:text-[#6B7A99]">{o.count} · {pct}%</span>
                      </div>
                      <div className="h-2 bg-pulse-100 dark:bg-white/10 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-[width] duration-500 ${isWinner ? 'bg-gradient-to-r from-teal-500 to-violet-500' : 'bg-pulse-300 dark:bg-white/20'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
                <p className="text-xs text-pulse-400 dark:text-[#6B7A99] text-right">{t('total_votes', { count: state.results.total })}</p>
              </div>
            )}
            <div className="mt-4 rounded-[14px] bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 p-4 flex gap-3 items-start text-left">
              <Sparkles size={20} className="text-violet-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="text-[12px] font-bold tracking-[0.06em] uppercase text-violet-700 dark:text-violet-400 mb-1">{t('ai_recap_pending')}</p>
                <p className="text-[13px] text-pulse-600 dark:text-[#A8B3CC] leading-[1.45]">{t('ai_recap_body')}</p>
              </div>
            </div>
          </div>
        )}

        {/* Active energizer — shown above the question */}
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

            {/* Kind-specific vote input */}
            {!state.paused && (() => {
              const qk = questionKind
              const canVote = state.connection === 'open'

              /* ── Word cloud / Open text ───────────────────────────── */
              if (qk === 'word_cloud' || qk === 'open') {
                if (hasVoted) {
                  return (
                    <p role="status" aria-live="polite" className="flex items-center gap-2 text-sm font-medium text-teal-700">
                      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                      {t('vote_recorded')}
                    </p>
                  )
                }
                return (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      const inp = e.currentTarget.elements.namedItem('resp') as HTMLInputElement
                      const val = inp.value.trim()
                      if (!val || !canVote) return
                      handleVote(val)
                    }}
                    className="space-y-2"
                  >
                    <input
                      type="text"
                      name="resp"
                      disabled={!canVote}
                      maxLength={120}
                      {...inputHint(qk === 'word_cloud' ? t('word_phrase_hint') : t('response_hint'))}
                      className="w-full rounded-lg border border-pulse-200 dark:border-[#1E2A45] bg-white dark:bg-[#1C2540] text-pulse-900 dark:text-[#F0F2F8] px-4 py-3 text-sm focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200 dark:focus:ring-teal-400/20 disabled:opacity-50 placeholder:text-pulse-400 dark:placeholder:text-[#6B7A99]"
                      autoComplete="off"
                    />
                    <button
                      type="submit"
                      disabled={!canVote}
                      className="w-full rounded-lg bg-teal-600 text-white py-2.5 text-sm font-medium hover:brightness-110 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                    >
                      {t('submit')}
                    </button>
                  </form>
                )
              }

              /* ── Likert scale ─────────────────────────────────────── */
              if (qk === 'likert') {
                return (
                  <div className="grid grid-cols-5 gap-1.5">
                    {state.question!.options.map((o) => {
                      const voted = myVotes.includes(o.id)
                      return (
                        <button
                          key={o.id}
                          type="button"
                          onClick={() => !hasVoted && canVote && handleVote(o.id)}
                          disabled={hasVoted || !canVote}
                          aria-pressed={voted}
                          className={[
                            'flex flex-col items-center gap-1 rounded-lg border py-3 px-1 text-xs font-medium text-center transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500',
                            voted
                              ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/30 text-teal-800 dark:text-teal-300'
                              : hasVoted
                              ? 'border-pulse-200 dark:border-[#1E2A45] text-pulse-300 dark:text-[#6B7A99] cursor-default'
                              : 'border-pulse-200 dark:border-[#1E2A45] bg-white dark:bg-[#1C2540] text-pulse-700 dark:text-[#A8B3CC] hover:border-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20',
                          ].join(' ')}
                        >
                          {o.label}
                        </button>
                      )
                    })}
                  </div>
                )
              }

              /* ── Slider ───────────────────────────────────────────── */
              if (qk === 'slider') {
                return (
                  <SliderInput
                    options={state.question!.options}
                    hasVoted={hasVoted}
                    canVote={canVote}
                    myVotes={myVotes}
                    onVote={handleVote}
                  />
                )
              }

              /* ── Multi-select ─────────────────────────────────────── */
              if (qk === 'multi_select') {
                return (
                  <ul className="space-y-2" role="list">
                    {state.question!.options.map((o) => {
                      const selected = myVotes.includes(o.id)
                      return (
                        <li key={o.id}>
                          <button
                            type="button"
                            onClick={() => !selected && canVote && handleVote(o.id)}
                            disabled={selected || !canVote}
                            aria-pressed={selected}
                            className={[
                              'w-full text-left rounded-lg border px-4 py-3.5 font-medium transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2',
                              selected
                                ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/30 text-teal-800 dark:text-teal-300'
                                : 'border-pulse-200 dark:border-[#1E2A45] bg-white dark:bg-[#1C2540] text-pulse-900 dark:text-[#F0F2F8] hover:border-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20 active:scale-[0.99]',
                            ].join(' ')}
                          >
                            <span className="flex items-center gap-3">
                              <span
                                className={[
                                  'flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
                                  selected ? 'border-teal-500 bg-teal-500' : 'border-pulse-300',
                                ].join(' ')}
                                aria-hidden="true"
                              >
                                {selected && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                              </span>
                              {o.label}
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )
              }

              /* ── Upvote queue ─────────────────────────────────────── */
              if (qk === 'upvote') {
                return (
                  <ul className="space-y-2" role="list">
                    {state.question!.options.map((o) => {
                      const upvoted = myVotes.includes(o.id)
                      const count = state.results.counts[o.id] ?? 0
                      return (
                        <li key={o.id} className="flex items-center gap-3 rounded-lg border border-pulse-200 dark:border-[#1E2A45] bg-white dark:bg-[#151C2E] px-4 py-3">
                          <button
                            type="button"
                            onClick={() => !upvoted && canVote && handleVote(o.id)}
                            disabled={upvoted || !canVote}
                            aria-label={t('upvote_aria', { label: o.label })}
                            className={[
                              'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500',
                              upvoted
                                ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300'
                                : 'border-pulse-200 dark:border-[#1E2A45] text-pulse-600 dark:text-[#A8B3CC] hover:border-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20',
                            ].join(' ')}
                          >
                            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill={upvoted ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                              <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" />
                              <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                            </svg>
                            {count}
                          </button>
                          <span className="text-sm text-pulse-800 dark:text-[#F0F2F8]">{o.label}</span>
                        </li>
                      )
                    })}
                  </ul>
                )
              }

              /* ── Default: poll / ranking / consent ───────────────── */
              return (
                <ul className="space-y-2" role="list">
                  {state.question!.options.map((o) => {
                    const voted = myVotes.includes(o.id)
                    const otherVoted = hasVoted && !voted
                    return (
                      <li key={o.id}>
                        <button
                          type="button"
                          onClick={() => handleVote(o.id)}
                          disabled={hasVoted || !canVote}
                          aria-pressed={voted}
                          className={[
                            'w-full text-left rounded-lg border px-4 py-3.5 font-medium transition-all duration-150',
                            'focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2',
                            voted
                              ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/30 text-teal-800 dark:text-teal-300'
                              : otherVoted
                              ? 'border-pulse-200 dark:border-[#1E2A45] text-pulse-400 dark:text-[#6B7A99] cursor-default'
                              : 'border-pulse-200 dark:border-[#1E2A45] bg-white dark:bg-[#1C2540] text-pulse-900 dark:text-[#F0F2F8] hover:border-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20 active:scale-[0.99]',
                          ].join(' ')}
                        >
                          <span className="flex items-center gap-3">
                            <span
                              className={[
                                'flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors',
                                voted ? 'border-teal-500 bg-teal-500' : 'border-pulse-300',
                              ].join(' ')}
                              aria-hidden="true"
                            >
                              {voted && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                            </span>
                            {o.label}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )
            })()}

            {/* Post-vote: confirmation + live results bar chart */}
            {/* Shown for single-vote types that have predefined options */}
            {hasVoted && !['word_cloud', 'open', 'slider'].includes(questionKind) && (
              <div className="space-y-4 pt-2 border-t border-pulse-100 dark:border-[#1E2A45]">
                <p role="status" aria-live="polite" className="flex items-center gap-2 text-sm font-medium text-teal-700">
                  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {t('vote_recorded')}
                </p>
                <div className="flex items-center gap-2 text-[12px] text-violet-600 font-medium">
                  <Sparkles size={12} aria-hidden="true" />
                  <span>{t('workers_ai_recap_status')}</span>
                </div>

                {state.results.total > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-pulse-500 dark:text-[#A8B3CC] flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" aria-hidden="true" />
                      {t('live_results')}
                    </p>
                    {ordered.map((o) => {
                      const pct = state.results.total === 0 ? 0 : Math.round((o.count / state.results.total) * 100)
                      const isMyVote = myVotes.includes(o.id)
                      return (
                        <div key={o.id} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className={isMyVote ? 'font-semibold text-teal-700' : 'text-pulse-700 dark:text-[#A8B3CC]'}>
                              {o.label}
                              {isMyVote && <span className="ml-1.5 text-xs text-teal-500">· {t('your_vote')}</span>}
                            </span>
                            <span className="text-pulse-500 dark:text-[#6B7A99] tabular-nums">{pct}%</span>
                          </div>
                          <div className="h-2 bg-pulse-100 dark:bg-white/10 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-[width] duration-300 ${isMyVote ? 'bg-gradient-to-r from-teal-500 to-violet-500' : 'bg-pulse-300 dark:bg-white/20'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                    <p className="text-xs text-pulse-400 dark:text-[#6B7A99] text-right" aria-live="polite" aria-atomic="true">
                      {t('total_votes', { count: state.results.total })}
                    </p>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {state.error && (
          <p role="alert" className="text-sm text-red-600">
            {state.error}
          </p>
        )}
      </div>
    </main>
  )
}
