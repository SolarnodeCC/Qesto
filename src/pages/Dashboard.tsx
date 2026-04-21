import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useSessions } from '../hooks/useSessions'
import MainLayout from '../layouts/MainLayout'
import { SessionListSkeleton } from '../components/SkeletonLoader'

export default function Dashboard() {
  const auth = useAuth()
  const { state, create } = useSessions()
  const [title, setTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (auth.status === 'loading') {
    return (
      <MainLayout mainClassName="min-h-screen max-w-3xl mx-auto p-8 space-y-8">
        <div className="space-y-2">
          <div className="h-9 w-48 rounded-lg bg-pulse-200 skeleton-shimmer" aria-hidden="true" />
          <div className="h-4 w-64 rounded-md bg-pulse-200 skeleton-shimmer" aria-hidden="true" />
        </div>
        <SessionListSkeleton rows={3} />
      </MainLayout>
    )
  }
  if (auth.status === 'anonymous') {
    return <Navigate to="/login" replace />
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    setCreating(true)
    setError(null)
    const res = await create(trimmed)
    setCreating(false)
    if (!res.ok) {
      setError(res.error.message)
      return
    }
    setTitle('')
  }

  const navSlot = (
    <button
      type="button"
      onClick={() => void auth.logout()}
      className="text-sm text-teal-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 rounded"
    >
      Sign out
    </button>
  )

  return (
    <MainLayout navSlot={navSlot} mainClassName="min-h-screen max-w-3xl mx-auto p-8 space-y-8">
      {/* animate-page-enter: entire content fades + slides up on mount (LAYOUT-MOTION-01) */}
      <div className="animate-page-enter space-y-8">
        <div>
          <h1 tabIndex={-1} className="text-3xl font-semibold focus:outline-none">Your sessions</h1>
          <p className="text-sm text-pulse-500">Signed in as {auth.user.email}.</p>
        </div>

        <form onSubmit={handleCreate} className="flex flex-col gap-3 rounded-xl border border-pulse-200 p-5">
          <label htmlFor="new-session-title" className="text-sm font-medium">
            New session
          </label>
          <input
            id="new-session-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Q2 team retro"
            maxLength={120}
            disabled={creating}
            className="border border-pulse-300 rounded-lg px-3 py-2 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
          />
          {error ? (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={creating || title.trim().length === 0}
            className="self-start inline-flex items-center rounded-lg bg-gradient-to-br from-teal-500 to-violet-600 text-white px-4 py-2 font-medium hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 btn-motion"
          >
            {creating ? 'Creating…' : 'Create draft'}
          </button>
        </form>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Draft &amp; live</h2>
          {state.status === 'loading' ? (
            /* LAYOUT-SKELETON-01: replace text placeholder with geometric skeleton */
            <SessionListSkeleton rows={3} />
          ) : state.status === 'error' ? (
            <p role="alert" className="text-sm text-red-600">
              {state.error.message}
            </p>
          ) : state.sessions.length === 0 ? (
            <p className="text-sm text-pulse-500">No sessions yet. Create your first one above.</p>
          ) : (
            <ul className="divide-y divide-pulse-200 rounded-xl border border-pulse-200">
              {state.sessions.map((s, i) => (
                <li
                  key={s.id}
                  className="animate-list-item p-4 flex items-center justify-between gap-4"
                  style={{ '--stagger-index': i } as React.CSSProperties}
                >
                  <div>
                    <Link
                      to={
                        s.status === 'live'
                          ? `/sessions/${s.id}/present`
                          : s.status === 'closed' || s.status === 'archived'
                          ? `/sessions/${s.id}/results`
                          : `/sessions/${s.id}`
                      }
                      className="font-medium text-pulse-800 hover:text-teal-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 rounded"
                    >
                      {s.title}
                    </Link>
                    <p className="text-xs text-pulse-500">
                      code {s.code} · {new Date(s.created_at).toLocaleString()}
                    </p>
                  </div>
                  <span
                    className={
                      'text-xs uppercase tracking-wider rounded-full px-2 py-0.5 ' +
                      (s.status === 'draft'
                        ? 'bg-pulse-100 text-pulse-600'
                        : s.status === 'live'
                        ? 'bg-teal-100 text-teal-700'
                        : 'bg-violet-100 text-violet-700')
                    }
                  >
                    {s.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </MainLayout>
  )
}
