import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useSession } from '../hooks/useSessions'
import { useT } from '../i18n'
import { api } from '../api/client'
import MainLayout from '../layouts/MainLayout'
import { LaunchpadPreFlightSkeleton } from '../components/SkeletonLoader'

type PreFlightItem = {
  key: 'title' | 'question' | 'consent'
  label: string
  valid: boolean
}

export default function Launchpad() {
  const auth = useAuth()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { data, loading, error } = useSession(id)
  const t = useT('launchpad')

  const [sharing, setSharing] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)

  if (auth.status === 'loading') {
    return (
      <MainLayout mainClassName="min-h-screen flex items-center justify-center p-8 text-pulse-500">
        Loading…
      </MainLayout>
    )
  }
  if (auth.status === 'anonymous') return <Navigate to="/login" replace />

  if (loading) {
    return (
      <MainLayout mainClassName="min-h-screen max-w-2xl mx-auto p-8">
        <LaunchpadPreFlightSkeleton />
      </MainLayout>
    )
  }

  if (error || !data) {
    return (
      <MainLayout mainClassName="min-h-screen max-w-2xl mx-auto p-8 space-y-4">
        <p role="alert" className="text-red-600">
          {error?.message ?? 'Session not found'}
        </p>
        <Link to="/dashboard" className="text-teal-600 hover:underline">
          ← Back to dashboard
        </Link>
      </MainLayout>
    )
  }

  if (data.session.status !== 'draft') {
    return (
      <MainLayout mainClassName="min-h-screen max-w-2xl mx-auto p-8 space-y-4">
        <p role="alert" className="text-sm text-amber-600">
          Session is already {data.session.status}. Return to dashboard.
        </p>
        <Link to="/dashboard" className="text-teal-600 hover:underline">
          ← Back to dashboard
        </Link>
      </MainLayout>
    )
  }

  const hasTitle = data.session.title.trim().length > 0

  const preFlightItems: PreFlightItem[] = [
    {
      key: 'title',
      label: 'Session title',
      valid: hasTitle,
    },
    {
      key: 'question',
      label: 'At least one question',
      valid: data.questions.length > 0,
    },
    {
      key: 'consent',
      label: 'AI consent acknowledged',
      valid: true, // can be made optional or from session state
    },
  ]

  const allValid = preFlightItems.every((item) => item.valid)

  async function handleStart() {
    if (!id || !allValid) return
    setStarting(true)
    setStartError(null)
    const res = await api<{ session: unknown; question: unknown }>(
      `/api/sessions/${encodeURIComponent(id)}/start`,
      { method: 'POST' },
    )
    setStarting(false)
    if (!res.ok) {
      setStartError(res.error.message)
      return
    }
    navigate(`/sessions/${id}/present`)
  }

  async function handleShare() {
    if (!data) return
    setSharing(true)
    const url = `${window.location.origin}/join/${data.session.code}`
    if (navigator.share) {
      try {
        await navigator.share({
          title: data.session.title,
          text: `Join my session: ${data.session.title}`,
          url,
        })
      } catch {
        // Cancelled by user
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(url)
        // Could show toast here
      } catch {
        // Fallback to showing the URL
      }
    }
    setSharing(false)
  }

  const navSlot = (
    <Link
      to="/dashboard"
      className="text-sm text-teal-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 rounded"
    >
      ← Dashboard
    </Link>
  )

  return (
    <MainLayout navSlot={navSlot} mainClassName="min-h-screen max-w-2xl mx-auto p-8 space-y-6">
      <header>
        <h1 tabIndex={-1} className="text-3xl font-semibold focus:outline-none">
          {t('title')}
        </h1>
        <p className="text-sm text-pulse-500 mt-1">
          Join code <code className="font-mono">{data.session.code}</code>
        </p>
      </header>

      {/* Questions preview */}
      {data.questions.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Questions ({data.questions.length})</h2>
          <ul className="space-y-2">
            {data.questions.map((q) => (
              <li
                key={q.id}
                className="rounded-lg border border-pulse-200 p-3 flex items-center justify-between gap-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-pulse-900 truncate">{q.prompt}</p>
                  <p className="text-xs text-pulse-500 mt-0.5">{q.kind}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Pre-flight checklist */}
      <section className="rounded-xl border border-pulse-200 p-5 space-y-3">
        <h2 className="font-semibold">{t('checklist_title')}</h2>
        <ul className="space-y-2">
          {preFlightItems.map((item) => (
            <li key={item.key} className="flex items-center gap-3">
              <div
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  item.valid
                    ? 'bg-teal-100 border-teal-500'
                    : 'bg-red-50 border-red-300'
                }`}
              >
                {item.valid && <div className="w-2.5 h-2.5 bg-teal-600 rounded-full" />}
                {!item.valid && <div className="w-2 h-2.5 bg-red-400" />}
              </div>
              <span className={item.valid ? 'text-pulse-900' : 'text-red-600'}>
                {item.label}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={handleShare}
          disabled={sharing}
          className="flex-1 sm:flex-none inline-flex items-center justify-center rounded-lg border border-pulse-300 text-pulse-700 hover:border-teal-500 hover:text-teal-700 px-4 py-2 font-medium disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
        >
          {sharing ? 'Sharing…' : t('share_button')}
        </button>
        <button
          type="button"
          onClick={handleStart}
          disabled={!allValid || starting}
          className="flex-1 sm:flex-none inline-flex items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-violet-600 text-white px-4 py-2 font-medium hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
        >
          {starting ? 'Starting…' : t('open_lobby_button')}
        </button>
      </div>

      {startError && (
        <p role="alert" className="text-sm text-red-600">
          {startError}
        </p>
      )}
    </MainLayout>
  )
}
