import { useState, useEffect, useRef } from 'react'
import QRCode from 'react-qr-code'
import { useT } from '../../i18n'

type SessionMeta = {
  code: string
  title: string
  status: string
  started_at: number | null
}

type Props = {
  session: SessionMeta
  starting: boolean
  startError: string | null
  allValid: boolean
  onStart: () => void
  onTransitionToLive: () => void
}

function formatElapsed(seconds: number): string {
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
  const ss = String(seconds % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

export default function JoinCodePanel({
  session,
  starting,
  startError,
  allValid,
  onStart,
  onTransitionToLive,
}: Props) {
  const t = useT('launchpad')
  const [codeCopied, setCodeCopied] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const startedAt = session.started_at
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
  }, [session.started_at])

  async function handleCopyCode() {
    try {
      await navigator.clipboard.writeText(session.code)
      setCodeCopied(true)
      setTimeout(() => setCodeCopied(false), 2000)
    } catch {
      // Clipboard API not available
    }
  }

  async function handleShare() {
    setSharing(true)
    const url = `${window.location.origin}/j/${session.code}`
    if (navigator.share) {
      try {
        await navigator.share({
          title: session.title,
          text: `Join my session: ${session.title}`,
          url,
        })
      } catch {
        // Cancelled by user
      }
    } else {
      try {
        await navigator.clipboard.writeText(url)
      } catch {
        // Clipboard API not available
      }
    }
    setSharing(false)
  }

  const SpinnerIcon = () => (
    <svg aria-hidden="true" className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )

  const PlayIcon = () => (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7L8 5z" />
    </svg>
  )

  return (
    <aside className="w-full lg:w-72 shrink-0 space-y-4">
      {/* Join code */}
      <section
        aria-labelledby="join-code-heading"
        className="rounded-lg border border-pulse-200 dark:border-[#1E2A45] bg-pulse-50 dark:bg-[#151C2E] p-4 space-y-3 shadow-card"
      >
        <h2 id="join-code-heading" className="text-caption font-medium text-pulse-500 uppercase tracking-wider dark:text-[#6B7A99]">
          {t('join_code_heading')}
        </h2>
        <div className="flex items-center gap-3">
          <code
            className="text-4xl font-mono font-bold tracking-widest text-pulse-900 dark:text-pulse-50 select-all"
            aria-label={`${t('join_code_heading')}: ${session.code}`}
          >
            {session.code}
          </code>
          <button
            type="button"
            onClick={() => void handleCopyCode()}
            aria-label={codeCopied ? t('join_code_copied_label') : t('join_code_copy_label')}
            className="inline-flex items-center justify-center w-9 h-9 rounded-md border border-pulse-300 text-pulse-500 hover:border-teal-500 hover:text-teal-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 transition-colors dark:border-pulse-600 dark:text-pulse-400 dark:hover:border-teal-500 dark:hover:text-teal-400"
          >
            {codeCopied ? (
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-teal-600">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
              </svg>
            )}
          </button>
        </div>
        {codeCopied && (
          <p role="status" aria-live="polite" className="text-caption text-teal-600 dark:text-teal-400 font-medium">
            {t('join_code_copied_toast')}
          </p>
        )}
        <p className="text-caption text-pulse-500 dark:text-pulse-400">{t('join_hint')}</p>

        {session.started_at !== null && (
          <div className="pt-2 border-t border-pulse-100 dark:border-[#1E2A45]">
            <p className="text-caption text-pulse-500 uppercase tracking-wider">{t('timer_label')}</p>
            <p
              className="font-mono text-2xl font-semibold text-teal-600"
              aria-live="polite"
              aria-atomic="true"
              aria-label={`${t('timer_label')} ${formatElapsed(elapsed)}`}
            >
              {formatElapsed(elapsed)}
            </p>
          </div>
        )}
      </section>

      {/* QR code */}
      <div
        aria-label={t('qr_aria_label')}
        className="flex justify-center rounded-lg border border-pulse-200 dark:border-[#1E2A45] bg-white dark:bg-[#151C2E] p-4 shadow-sm"
      >
        <QRCode
          value={`${window.location.origin}/j/${session.code}`}
          size={140}
          style={{ display: 'block' }}
        />
      </div>

      {/* Primary CTA */}
      {session.status === 'energizing' ? (
        <button
          type="button"
          onClick={onTransitionToLive}
          disabled={starting}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-br from-teal-500 to-violet-600 text-white px-5 py-3 text-base font-semibold hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 shadow-teal transition-all btn-motion"
        >
          {starting ? (
            <><SpinnerIcon />{t('starting')}</>
          ) : (
            <><PlayIcon />Start Questions</>
          )}
        </button>
      ) : (
        <button
          type="button"
          onClick={onStart}
          disabled={!allValid || starting}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-br from-teal-500 to-violet-600 text-white px-5 py-3 text-base font-semibold hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 shadow-teal transition-all btn-motion"
        >
          {starting ? (
            <><SpinnerIcon />{t('starting')}</>
          ) : (
            <><PlayIcon />{t('open_lobby_button')}</>
          )}
        </button>
      )}

      {startError && (
        <p role="alert" className="text-sm text-red-600">{startError}</p>
      )}

      {/* Share button */}
      <button
        type="button"
        onClick={() => void handleShare()}
        disabled={sharing}
        className="w-full inline-flex items-center justify-center rounded-md border border-pulse-300 dark:border-pulse-600 text-pulse-700 dark:text-pulse-300 hover:border-teal-500 hover:text-teal-700 dark:hover:border-teal-500 dark:hover:text-teal-400 px-4 py-2 font-medium disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 transition-colors"
      >
        {sharing ? t('sharing') : t('share_button')}
      </button>
    </aside>
  )
}
