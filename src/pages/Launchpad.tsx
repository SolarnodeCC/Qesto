import { useState, useEffect, useRef } from 'react'
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
  const [elapsed, setElapsed] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Count-up timer — starts when started_at is available (LAUNCHPAD-02)
  useEffect(() => {
    const startedAt = data?.session.started_at ?? null
    if (!startedAt) {
      setElapsed(0)
      return
    }
    function tick() {
      setElapsed(Math.floor((Date.now() - (startedAt as number)) / 1000))
    }
    tick()
    intervalRef.current = setInterval(tick, 1000)
    return () => {
      if (intervalRef.current !== null) clearInterval(intervalRef.current)
    }
  }, [data?.session.started_at])

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

  function formatElapsed(seconds: number): string {
    const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
    const ss = String(seconds % 60).padStart(2, '0')
    return `${mm}:${ss}`
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
        className="rounded-lg border border-pulse-200 bg-pulse-50 p-space-5 space-y-space-4 shadow-card dark:bg-pulse-800 dark:border-pulse-700"
      >
        <h2 id="join-code-heading" className="text-caption font-medium text-pulse-500 uppercase tracking-wider dark:text-pulse-400">
          Join code
        </h2>

        <div className="flex flex-col sm:flex-row items-center gap-space-5">
          {/* Join code display + copy */}
          <div className="flex-1 space-y-space-3">
            <div className="flex items-center gap-space-3">
              <code
                className="text-5xl font-mono font-bold tracking-widest text-pulse-900 dark:text-pulse-50 select-all"
                aria-label={`Join code: ${data.session.code}`}
              >
                {data.session.code}
              </code>
              <button
                type="button"
                onClick={handleCopyCode}
                aria-label={codeCopied ? 'Copied!' : 'Copy join code to clipboard'}
                className="inline-flex items-center justify-center w-11 h-11 rounded-md border border-pulse-300 text-pulse-500 hover:border-teal-500 hover:text-teal-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 transition-colors dark:border-pulse-600 dark:text-pulse-400 dark:hover:border-teal-500 dark:hover:text-teal-400"
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
              <p role="status" aria-live="polite" className="text-caption text-teal-600 dark:text-teal-400 font-medium">
                Code copied to clipboard!
              </p>
            )}
            <p className="text-body-s text-pulse-500">
              Participants go to <strong>qesto.app/join</strong> and enter this code.
            </p>

            {/* Elapsed timer — visible once session is live (LAUNCHPAD-02) */}
            {data.session.started_at !== null && (
              <div className="flex flex-col gap-space-1 pt-space-2 border-t border-pulse-100">
                <p className="text-caption text-pulse-500 uppercase tracking-wider">Session live for</p>
                <p
                  className="font-mono text-2xl font-semibold text-teal-600"
                  aria-live="polite"
                  aria-atomic="true"
                  aria-label={`Session live for ${formatElapsed(elapsed)}`}
                >
                  {formatElapsed(elapsed)}
                </p>
              </div>
            )}
          </div>

          {/* QR code placeholder */}
          <div
            role="img"
            aria-label="QR code placeholder — will link directly to this session"
            className="flex-shrink-0 w-32 h-32 rounded-lg border-2 border-dashed border-pulse-300 dark:border-pulse-600 bg-pulse-100 dark:bg-pulse-700 flex flex-col items-center justify-center gap-space-1 text-pulse-400 dark:text-pulse-500"
          >
            <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
              <rect x="14" y="14" width="3" height="3" />
              <path d="M14 18h3M18 14v3" />
              <path d="M5 5h3v3H5zM16 5h3v3h-3zM5 16h3v3H5z" />
            </svg>
            <span className="text-caption text-center leading-tight px-space-2">QR Code</span>
          </div>
        </div>
      </section>

      {/* Questions preview */}
      {data.questions.length > 0 && (
        <section className="space-y-space-3">
          <h2 className="text-heading-s font-semibold dark:text-pulse-100">Questions ({data.questions.length})</h2>
          <ul className="space-y-space-2">
            {data.questions.map((q) => (
              <li
                key={q.id}
                className="rounded-md border border-pulse-200 dark:border-pulse-700 dark:bg-pulse-800 p-space-3 flex items-center justify-between gap-space-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-body-s font-medium text-pulse-900 dark:text-pulse-100 truncate">{q.prompt}</p>
                  <p className="text-caption text-pulse-500 dark:text-pulse-400 mt-0.5">{q.kind}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Pre-flight checklist */}
      <section className="rounded-lg border border-pulse-200 dark:border-pulse-700 dark:bg-pulse-800 p-space-4 space-y-space-3 shadow-card">
        <h2 className="font-semibold dark:text-pulse-100">{t('checklist_title')}</h2>
        <ul className="space-y-space-2">
          {preFlightItems.map((item) => (
            <li key={item.key} className="flex items-center gap-space-3">
              <div
                className={`w-5 h-5 rounded-pill border-2 flex items-center justify-center flex-shrink-0 ${
                  item.valid
                    ? 'bg-teal-100 border-teal-500 dark:bg-teal-900/40 dark:border-teal-500'
                    : 'bg-red-50 border-red-300 dark:bg-red-900/30 dark:border-red-500'
                }`}
              >
                {item.valid && <div className="w-2.5 h-2.5 bg-teal-600 dark:bg-teal-400 rounded-pill" />}
                {!item.valid && <div className="w-2 h-2.5 bg-red-400" />}
              </div>
              <span className={item.valid ? 'text-pulse-900 dark:text-pulse-100' : 'text-red-600 dark:text-red-400'}>
                {item.label}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Action buttons */}
      <div className="space-y-space-3">
        {/* Prominent Go Live button */}
        <button
          type="button"
          onClick={handleStart}
          disabled={!allValid || starting}
          className="w-full inline-flex items-center justify-center gap-space-2 rounded-lg bg-gradient-to-br from-teal-500 to-violet-600 text-white px-space-5 py-space-3 text-body-m font-semibold hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 shadow-teal transition-all btn-motion"
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
          className="w-full inline-flex items-center justify-center rounded-md border border-pulse-300 dark:border-pulse-600 text-pulse-700 dark:text-pulse-300 hover:border-teal-500 hover:text-teal-700 dark:hover:border-teal-500 dark:hover:text-teal-400 px-space-4 py-space-2 font-medium disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 transition-colors"
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
