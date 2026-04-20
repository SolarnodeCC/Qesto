import { useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useLiveSession } from '../hooks/useLiveSession'
import { api } from '../api/client'

export default function Present() {
  const auth = useAuth()
  const { id } = useParams<{ id: string }>()
  const { state } = useLiveSession(id, { enabled: !!id })
  const [closing, setClosing] = useState(false)
  const [closeError, setCloseError] = useState<string | null>(null)

  const options = state.question?.options ?? []
  const ordered = useMemo(
    () => options.map((o) => ({ ...o, count: state.results.counts[o.id] ?? 0 })),
    [options, state.results.counts],
  )
  const max = ordered.reduce((m, o) => Math.max(m, o.count), 0)

  async function handleClose() {
    if (!id) return
    setClosing(true)
    setCloseError(null)
    const res = await api<{ session: unknown; results: unknown }>(`/api/sessions/${encodeURIComponent(id)}/close`, {
      method: 'POST',
    })
    setClosing(false)
    if (!res.ok) setCloseError(res.error.message)
  }

  if (auth.status === 'loading') {
    return <main className="min-h-screen flex items-center justify-center p-8 text-pulse-500">Loading…</main>
  }
  if (auth.status === 'anonymous') return <Navigate to="/login" replace />

  return (
    <main className="min-h-screen max-w-3xl mx-auto p-8 space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/dashboard" className="text-sm text-teal-600 hover:underline">
          ← Dashboard
        </Link>
        <span
          className={
            'text-xs uppercase tracking-wider rounded-full px-2 py-0.5 ' +
            (state.connection === 'open'
              ? 'bg-teal-100 text-teal-700'
              : state.connection === 'reconnecting' || state.connection === 'connecting'
              ? 'bg-amber-100 text-amber-700'
              : state.connection === 'failed'
              ? 'bg-red-100 text-red-700'
              : 'bg-pulse-100 text-pulse-600')
          }
        >
          {state.connection}
          {state.reconnectAttempts > 0 && state.connection === 'reconnecting'
            ? ` · ${state.reconnectAttempts}/5`
            : ''}
        </span>
      </div>

      {state.session ? (
        <header>
          <p className="text-sm uppercase tracking-widest text-teal-600">Presenter</p>
          <h1 className="text-3xl font-semibold">{state.session.title}</h1>
          <p className="text-sm text-pulse-500">
            Join code <code className="font-mono">{state.session.code}</code> · {state.participants}{' '}
            {state.participants === 1 ? 'participant' : 'participants'}
          </p>
        </header>
      ) : (
        <p className="text-sm text-pulse-500">Connecting to live room…</p>
      )}

      {state.question ? (
        <section className="rounded-xl border border-pulse-200 p-5 space-y-4">
          <h2 className="text-xl font-semibold">{state.question.prompt}</h2>
          <ul className="space-y-3">
            {ordered.map((o) => {
              const pct = max === 0 ? 0 : Math.round((o.count / max) * 100)
              return (
                <li key={o.id} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>{o.label}</span>
                    <span className="font-medium">{o.count}</span>
                  </div>
                  <div className="h-2 bg-pulse-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-teal-500 to-violet-500 transition-[width] duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
          <p className="text-xs text-pulse-500">Total votes: {state.results.total}</p>
        </section>
      ) : null}

      {state.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleClose}
          disabled={closing || state.session?.status === 'closed'}
          className="inline-flex items-center rounded-lg border border-pulse-300 text-pulse-700 hover:border-red-400 hover:text-red-700 px-4 py-2 font-medium disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {state.session?.status === 'closed' ? 'Session closed' : closing ? 'Closing…' : 'Close session'}
        </button>
        {closeError ? <span className="text-sm text-red-600">{closeError}</span> : null}
      </div>
    </main>
  )
}
