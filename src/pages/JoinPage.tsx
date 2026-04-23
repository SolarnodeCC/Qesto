// Voter entry point. The URL is `/j/:code` — a 6-char join code. We look up
// the live session id via the public `/api/sessions/by-code/:code` endpoint
// then open a WebSocket to the DO for real-time voting.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api/client'
import { useLiveSession } from '../hooks/useLiveSession'
import { useT } from '../i18n'
import EmojiPollEnergizerView, { type EmojiPollEnergizer } from '../components/EmojiPollEnergizer'

type Lookup =
  | { status: 'loading' }
  | { status: 'ready'; sessionId: string; title: string }
  | { status: 'error'; message: string }

export default function JoinPage() {
  const { code } = useParams<{ code: string }>()
  const [lookup, setLookup] = useState<Lookup>({ status: 'loading' })
  const t = useT('join')

  useEffect(() => {
    if (!code) return
    let cancelled = false
    ;(async () => {
      const res = await api<{ id: string; title: string; code: string }>(
        `/api/sessions/by-code/${encodeURIComponent(code.toUpperCase())}`,
      )
      if (cancelled) return
      if (res.ok) setLookup({ status: 'ready', sessionId: res.data.id, title: res.data.title })
      else setLookup({ status: 'error', message: res.error.message })
    })()
    return () => {
      cancelled = true
    }
  }, [code])

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
          ← Back to home
        </a>
      </main>
    )
  }

  return <Voter sessionId={lookup.sessionId} title={lookup.title} />
}

function Voter({ sessionId, title }: { sessionId: string; title: string }) {
  const { state, sendVote } = useLiveSession(sessionId, { enabled: true })
  const hasVoted = !!state.lastVote
  const isEnded = state.session?.status === 'closed' || state.connection === 'closed'
  const t = useT('join')

  // Energizer polling — checks for an active energizer every 3s
  const [activeEnergizer, setActiveEnergizer] = useState<EmojiPollEnergizer | null>(null)
  const energizerPollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchActiveEnergizer = useCallback(async () => {
    const res = await api<{ energizer: EmojiPollEnergizer | null; results: Record<string, number> }>(
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
    <main id="main" className="min-h-screen bg-white dark:bg-pulse-950 flex flex-col">
      {/* Top strip */}
      <div className="border-b border-pulse-100 dark:border-pulse-800 px-5 py-3 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-widest text-teal-600">Qesto</span>
        {state.connection === 'open' ? (
          <span className="flex items-center gap-1.5 text-xs text-pulse-500">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" aria-hidden="true" />
            {t('participants_label', { count: state.participants })}
          </span>
        ) : connectionLabel ? (
          <span className="text-xs text-amber-600">{connectionLabel}</span>
        ) : null}
      </div>

      <div className="flex-1 max-w-lg w-full mx-auto px-5 py-8 flex flex-col gap-6">
        {/* Session title */}
        <h1 tabIndex={-1} className="text-2xl font-semibold text-pulse-900 dark:text-pulse-50 focus:outline-none">
          {title}
        </h1>

        {/* Connecting skeleton */}
        {state.connection === 'connecting' && (
          <div className="space-y-3 animate-pulse">
            <div className="h-5 bg-pulse-100 dark:bg-pulse-800 rounded w-3/4" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 bg-pulse-100 dark:bg-pulse-800 rounded-xl" />
            ))}
          </div>
        )}

        {/* Inter-question countdown */}
        {countdown !== null && (
          <div className="flex flex-col items-center justify-center gap-3 py-8" aria-live="polite" aria-atomic="true">
            <p className="text-sm text-pulse-500">{t('get_ready')}</p>
            <div className="text-6xl font-bold text-teal-600 tabular-nums">{countdown}</div>
            <p className="text-xs text-pulse-400">{t('next_question_countdown', { seconds: countdown })}</p>
          </div>
        )}

        {/* Session ended */}
        {isEnded && countdown === null && (
          <div className="rounded-xl border border-pulse-200 dark:border-pulse-700 p-6 text-center space-y-2">
            <div className="text-3xl">🎉</div>
            <p className="font-semibold text-pulse-900 dark:text-pulse-100">{t('session_ended_title')}</p>
            <p className="text-sm text-pulse-500">{t('session_ended_body')}</p>
            {state.results.total > 0 && (
              <div className="mt-4 space-y-3 text-left">
                <p className="text-xs font-semibold uppercase tracking-wider text-pulse-500">{t('final_results')}</p>
                {ordered.map((o) => {
                  const pct = maxCount === 0 ? 0 : Math.round((o.count / state.results.total) * 100)
                  const isWinner = o.count === maxCount && maxCount > 0
                  return (
                    <div key={o.id} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className={isWinner ? 'font-semibold text-teal-700 dark:text-teal-400' : 'text-pulse-700 dark:text-pulse-300'}>
                          {o.label}
                        </span>
                        <span className="text-pulse-500">{o.count} · {pct}%</span>
                      </div>
                      <div className="h-2 bg-pulse-100 dark:bg-pulse-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-[width] duration-500 ${isWinner ? 'bg-gradient-to-r from-teal-500 to-violet-500' : 'bg-pulse-300 dark:bg-pulse-600'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
                <p className="text-xs text-pulse-400 text-right">{t('total_votes', { count: state.results.total })}</p>
              </div>
            )}
          </div>
        )}

        {/* Active energizer — emoji poll or other types */}
        {!isEnded && activeEnergizer?.kind === 'emoji_poll' && countdown === null && (
          <EmojiPollEnergizerView
            sessionId={sessionId}
            energizer={activeEnergizer}
            role="participant"
            voterId={state.voterId ?? 'anonymous'}
          />
        )}

        {/* Active question — hide during countdown */}
        {!isEnded && state.question && countdown === null && (
          <section className="space-y-4" aria-labelledby="question-heading">
            <h2 id="question-heading" className="text-lg font-medium text-pulse-900 dark:text-pulse-100">
              {state.question.prompt}
            </h2>

            <ul className="space-y-2" role="list">
              {state.question.options.map((o) => {
                const voted = state.lastVote?.optionId === o.id
                const otherVoted = hasVoted && !voted
                return (
                  <li key={o.id}>
                    <button
                      type="button"
                      onClick={() => sendVote(o.id)}
                      disabled={hasVoted || state.connection !== 'open'}
                      aria-pressed={voted}
                      className={[
                        'w-full text-left rounded-xl border-2 px-4 py-3.5 font-medium transition-all duration-150',
                        'focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2',
                        voted
                          ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/30 text-teal-800 dark:text-teal-200'
                          : otherVoted
                          ? 'border-pulse-200 dark:border-pulse-700 text-pulse-400 dark:text-pulse-500 cursor-default'
                          : 'border-pulse-200 dark:border-pulse-700 bg-white dark:bg-pulse-900 text-pulse-900 dark:text-pulse-100 hover:border-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20 active:scale-[0.99]',
                      ].join(' ')}
                    >
                      <span className="flex items-center gap-3">
                        <span
                          className={[
                            'flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors',
                            voted
                              ? 'border-teal-500 bg-teal-500'
                              : 'border-pulse-300 dark:border-pulse-600',
                          ].join(' ')}
                          aria-hidden="true"
                        >
                          {voted && (
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </span>
                        {o.label}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>

            {/* Post-vote confirmation + live results */}
            {hasVoted && (
              <div className="space-y-4 pt-2 border-t border-pulse-100 dark:border-pulse-800">
                <p role="status" aria-live="polite" className="flex items-center gap-2 text-sm font-medium text-teal-700 dark:text-teal-400">
                  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {t('vote_recorded')}
                </p>

                {state.results.total > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-pulse-500 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" aria-hidden="true" />
                      {t('live_results')}
                    </p>
                    {ordered.map((o) => {
                      const pct = state.results.total === 0 ? 0 : Math.round((o.count / state.results.total) * 100)
                      const isMyVote = state.lastVote?.optionId === o.id
                      return (
                        <div key={o.id} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className={isMyVote ? 'font-semibold text-teal-700 dark:text-teal-400' : 'text-pulse-700 dark:text-pulse-300'}>
                              {o.label}
                              {isMyVote && <span className="ml-1.5 text-xs text-teal-500">· {t('your_vote')}</span>}
                            </span>
                            <span className="text-pulse-500 tabular-nums">{pct}%</span>
                          </div>
                          <div className="h-2 bg-pulse-100 dark:bg-pulse-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-[width] duration-300 ${isMyVote ? 'bg-gradient-to-r from-teal-500 to-violet-500' : 'bg-pulse-300 dark:bg-pulse-600'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                    <p className="text-xs text-pulse-400 text-right" aria-live="polite" aria-atomic="true">
                      {t('total_votes', { count: state.results.total })}
                    </p>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {state.error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {state.error}
          </p>
        )}
      </div>
    </main>
  )
}
