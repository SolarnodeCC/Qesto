// Voter entry point. The URL is `/j/:code` — a 6-char join code. We look up
// the live session id via the public `/api/sessions/by-code/:code` endpoint
// then open a WebSocket to the DO for real-time voting.

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api/client'
import { useLiveSession } from '../hooks/useLiveSession'

type Lookup =
  | { status: 'loading' }
  | { status: 'ready'; sessionId: string; title: string }
  | { status: 'error'; message: string }

export default function JoinPage() {
  const { code } = useParams<{ code: string }>()
  const [lookup, setLookup] = useState<Lookup>({ status: 'loading' })

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
        <span className="text-sm">Looking up session…</span>
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
          <p className="text-lg font-semibold text-pulse-900">Can&rsquo;t find that session</p>
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
      ? `Reconnecting (${state.reconnectAttempts}/5)…`
      : state.connection === 'failed'
      ? 'Connection lost — refresh to try again.'
      : state.connection === 'connecting'
      ? 'Connecting…'
      : null

  return (
    <main id="main" className="min-h-screen bg-white dark:bg-pulse-950 flex flex-col">
      {/* Top strip */}
      <div className="border-b border-pulse-100 dark:border-pulse-800 px-5 py-3 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-widest text-teal-600">Qesto</span>
        {state.connection === 'open' ? (
          <span className="flex items-center gap-1.5 text-xs text-pulse-500">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" aria-hidden="true" />
            {state.participants} in the room
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

        {/* Session ended */}
        {isEnded && (
          <div className="rounded-xl border border-pulse-200 dark:border-pulse-700 p-6 text-center space-y-2">
            <div className="text-3xl">🎉</div>
            <p className="font-semibold text-pulse-900 dark:text-pulse-100">Session has ended</p>
            <p className="text-sm text-pulse-500">Thanks for participating!</p>
            {state.results.total > 0 && (
              <div className="mt-4 space-y-3 text-left">
                <p className="text-xs font-semibold uppercase tracking-wider text-pulse-500">Final results</p>
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
                <p className="text-xs text-pulse-400 text-right">{state.results.total} total votes</p>
              </div>
            )}
          </div>
        )}

        {/* Active question */}
        {!isEnded && state.question && (
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
                  Vote recorded — thanks!
                </p>

                {state.results.total > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-pulse-500 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" aria-hidden="true" />
                      Live results
                    </p>
                    {ordered.map((o) => {
                      const pct = state.results.total === 0 ? 0 : Math.round((o.count / state.results.total) * 100)
                      const isMyVote = state.lastVote?.optionId === o.id
                      return (
                        <div key={o.id} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className={isMyVote ? 'font-semibold text-teal-700 dark:text-teal-400' : 'text-pulse-700 dark:text-pulse-300'}>
                              {o.label}
                              {isMyVote && <span className="ml-1.5 text-xs text-teal-500">· your vote</span>}
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
                      {state.results.total} {state.results.total === 1 ? 'vote' : 'votes'}
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
