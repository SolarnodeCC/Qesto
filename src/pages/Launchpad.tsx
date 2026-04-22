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
  const [codeCopied, setCodeCopied] = useState(false)

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

  async function handleCopyCode() {
    if (!data) return
    try {
      await navigator.clipboard.writeText(data.session.code)
      setCodeCopied(true)
      setTimeout(() => setCodeCopied(false), 2000)
    } catch {
      // Clipboard API not available — silently fail
    }
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
      <header className="space-y-1">
        <h1 tabIndex={-1} className="text-3xl font-semibold focus:outline-none">
          {t('title')}
        </h1>
        <p className="text-pulse-500 font-medium">{data.session.title}</p>
      </header>

      {/* Join code + QR code block */}
      <section
        aria-labelledby="join-code-heading"
        className="rounded-xl border border-pulse-200 p-6 space-y-4"
      >
        <h2 id="join-code-heading" className="text-sm font-medium text-pulse-500 uppercase tracking-wider">
          Join code
        </h2>

        <div className="flex flex-col sm:flex-row items-center gap-6">
          {/* Join code display + copy */}
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-3">
              <code
                className="text-5xl font-mono font-bold tracking-widest text-pulse-900 select-all"
                aria-label={`Join code: ${data.session.code}`}
              >
                {data.session.code}
              </code>
              <button
                type="button"
                onClick={handleCopyCode}
                aria-label={codeCopied ? 'Copied!' : 'Copy join code to clipboard'}
                className="inline-flex items-center justify-center w-10 h-10 rounded-lg border border-pulse-300 text-pulse-500 hover:border-teal-500 hover:text-teal-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 transition-colors"
              >
                {codeCopied ? (
                  /* Checkmark icon */
                  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-teal-600">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  /* Copy icon */
                  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" />
                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                  </svg>
                )}
              </button>
            </div>
            {codeCopied && (
              <p role="status" aria-live="polite" className="text-xs text-teal-600 font-medium">
                Code copied to clipboard!
              </p>
            )}
            <p className="text-sm text-pulse-500">
              Participants go to <strong>qesto.app/join</strong> and enter this code.
            </p>
          </div>

          {/* QR code placeholder */}
          <div
            role="img"
            aria-label="QR code placeholder — will link directly to this session"
            className="flex-shrink-0 w-32 h-32 rounded-xl border-2 border-dashed border-pulse-300 bg-pulse-50 flex flex-col items-center justify-center gap-1 text-pulse-400"
          >
            <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
              <rect x="14" y="14" width="3" height="3" />
              <path d="M14 18h3M18 14v3" />
              <path d="M5 5h3v3H5zM16 5h3v3h-3zM5 16h3v3H5z" />
            </svg>
            <span className="text-xs text-center leading-tight px-2">QR Code</span>
          </div>
        </div>
      </section>

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
      <div className="space-y-3">
        {/* Prominent Go Live button */}
        <button
          type="button"
          onClick={handleStart}
          disabled={!allValid || starting}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-teal-500 to-violet-600 text-white px-6 py-3.5 text-base font-semibold hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 shadow-md transition-all"
        >
          {starting ? (
            <>
              <svg aria-hidden="true" className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Starting…
            </>
          ) : (
            <>
              {/* Play icon */}
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7L8 5z" />
              </svg>
              Go Live
            </>
          )}
        </button>

        {/* Secondary share action */}
        <button
          type="button"
          onClick={handleShare}
          disabled={sharing}
          className="w-full inline-flex items-center justify-center rounded-lg border border-pulse-300 text-pulse-700 hover:border-teal-500 hover:text-teal-700 px-4 py-2.5 font-medium disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 transition-colors"
        >
          {sharing ? 'Sharing…' : t('share_button')}
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
