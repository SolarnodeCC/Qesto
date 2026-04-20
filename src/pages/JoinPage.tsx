// Voter entry point. The URL is `/j/:code` — a 6-char join code. We look up
// the live session id via the public `/api/sessions/by-code/:code` endpoint
// then open a WebSocket to the DO for real-time voting.

import { useEffect, useState } from 'react'
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
      <main className="min-h-screen flex items-center justify-center p-8 text-pulse-500">
        Looking up session…
      </main>
    )
  }
  if (lookup.status === 'error') {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-8 text-center space-y-3">
        <p className="text-lg font-medium">Can&rsquo;t find that session.</p>
        <p className="text-sm text-pulse-500">{lookup.message}</p>
      </main>
    )
  }
  return <Voter sessionId={lookup.sessionId} title={lookup.title} />
}

function Voter({ sessionId, title }: { sessionId: string; title: string }) {
  const { state, sendVote } = useLiveSession(sessionId, { enabled: true })
  const hasVoted = !!state.lastVote

  return (
    <main className="min-h-screen max-w-lg mx-auto p-6 flex flex-col gap-6">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-widest text-teal-600">Qesto · Voter</p>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-xs text-pulse-500">
          {state.connection === 'open'
            ? `Live · ${state.participants} in the room`
            : state.connection === 'reconnecting'
            ? `Reconnecting (${state.reconnectAttempts}/5)…`
            : state.connection === 'closed'
            ? 'Session ended'
            : state.connection === 'failed'
            ? 'Couldn’t stay connected — refresh to try again.'
            : 'Connecting…'}
        </p>
      </header>

      {state.question ? (
        <section className="space-y-4">
          <h2 className="text-lg font-medium">{state.question.prompt}</h2>
          <ul className="space-y-3">
            {state.question.options.map((o) => {
              const voted = state.lastVote?.optionId === o.id
              return (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => sendVote(o.id)}
                    disabled={hasVoted || state.connection !== 'open' || state.session?.status === 'closed'}
                    className={
                      'w-full text-left rounded-xl border px-4 py-3 font-medium transition ' +
                      (voted
                        ? 'border-teal-500 bg-teal-50 text-teal-800'
                        : 'border-pulse-300 bg-white hover:border-teal-500 hover:bg-teal-50 disabled:opacity-60 disabled:cursor-not-allowed')
                    }
                  >
                    {o.label}
                  </button>
                </li>
              )
            })}
          </ul>
          {hasVoted ? (
            <p role="status" className="text-sm text-teal-700">
              Vote recorded. Thanks for participating.
            </p>
          ) : null}
        </section>
      ) : state.session?.status === 'closed' ? (
        <p className="text-sm text-pulse-500">The presenter has closed this session.</p>
      ) : null}

      {state.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}
    </main>
  )
}
