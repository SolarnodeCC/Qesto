import { useState, useEffect, useRef } from 'react'
import QRCode from 'react-qr-code'
import { Check, Copy, Loader2, Rocket, Share2, Zap } from 'lucide-react'
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
    if (!startedAt) { setElapsed(0); return }
    function tick() {
      setElapsed(Math.floor((Date.now() - (startedAt as number)) / 1000))
    }
    tick()
    intervalRef.current = setInterval(tick, 1000)
    return () => { if (intervalRef.current !== null) clearInterval(intervalRef.current) }
  }, [session.started_at])

  async function handleCopyCode() {
    try {
      await navigator.clipboard.writeText(session.code)
      setCodeCopied(true)
      setTimeout(() => setCodeCopied(false), 2000)
    } catch { /* Clipboard API not available */ }
  }

  async function handleShare() {
    setSharing(true)
    const url = `${window.location.origin}/j/${session.code}`
    if (navigator.share) {
      try { await navigator.share({ title: session.title, text: `Join my session: ${session.title}`, url }) }
      catch { /* Cancelled */ }
    } else {
      try { await navigator.clipboard.writeText(url) }
      catch { /* Clipboard API not available */ }
    }
    setSharing(false)
  }

  const isEnergizing = session.status === 'energizing'

  return (
    <aside className="w-full lg:w-[330px] shrink-0 space-y-3">
      {/* Unified join-code card — gradient-brand-subtle background */}
      <section
        aria-labelledby="join-code-heading"
        className="rounded-xl border border-teal-100 dark:border-[#1E2A45] p-6 text-center space-y-4 shadow-card"
        style={{ background: 'var(--gradient-brand-subtle, linear-gradient(135deg,#F0FDFA 0%,#F5F3FF 100%))' }}
      >
        {/* Eyebrow */}
        <p
          id="join-code-heading"
          className="text-xs font-bold tracking-[0.1em] uppercase text-teal-700 dark:text-teal-400"
        >
          {t('join_code_heading')}
        </p>

        {/* Code + copy button */}
        <button
          type="button"
          onClick={() => void handleCopyCode()}
          aria-label={codeCopied ? t('join_code_copied_label') : t('join_code_copy_label')}
          className="inline-flex items-center gap-2 border-none bg-transparent cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 rounded-md"
        >
          <code
            className="text-gradient-brand font-mono font-semibold text-[2.6rem] leading-none tracking-[0.08em] select-all"
            aria-label={`${t('join_code_heading')}: ${session.code}`}
          >
            {session.code}
          </code>
          <span className={`transition-colors ${codeCopied ? 'text-teal-500' : 'text-pulse-400 hover:text-pulse-600'}`}>
            {codeCopied
              ? <Check size={18} aria-hidden="true" />
              : <Copy size={18} aria-hidden="true" />}
          </span>
        </button>

        {/* Copy feedback */}
        <p
          role="status"
          aria-live="polite"
          className={`text-xs font-semibold text-teal-600 dark:text-teal-400 h-4 transition-opacity ${codeCopied ? 'opacity-100' : 'opacity-0'}`}
        >
          {t('join_code_copied_toast')}
        </p>

        {/* QR code */}
        <div
          aria-label={t('qr_aria_label')}
          className="mx-auto w-[128px] h-[128px] rounded-[14px] border border-[var(--surface-border,#E5E5E5)] bg-white flex items-center justify-center p-2.5"
        >
          <QRCode
            value={`${window.location.origin}/j/${session.code}`}
            size={104}
            style={{ display: 'block' }}
          />
        </div>

        {/* Hint */}
        <p className="text-xs text-pulse-500 dark:text-pulse-400 leading-snug">
          {t('join_hint')} <span className="font-mono text-pulse-700 dark:text-pulse-300">qesto.cc/join</span>
        </p>

        {/* Live timer (energizing / live) */}
        {session.started_at !== null && (
          <div className="pt-3 border-t border-teal-100 dark:border-[#1E2A45]">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-pulse-400">{t('timer_label')}</p>
            <p
              className="font-mono text-2xl font-semibold text-teal-600 dark:text-teal-400"
              aria-live="polite"
              aria-atomic="true"
              aria-label={`${t('timer_label')} ${formatElapsed(elapsed)}`}
            >
              {formatElapsed(elapsed)}
            </p>
          </div>
        )}

        {/* Primary CTA */}
        <button
          type="button"
          onClick={isEnergizing ? onTransitionToLive : onStart}
          disabled={(!isEnergizing && !allValid) || starting}
          className="w-full inline-flex items-center justify-center gap-2 rounded-[var(--radius-md,10px)] bg-gradient-brand text-white px-5 py-3 text-[15px] font-semibold hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 shadow-teal transition-all btn-motion"
          style={{ boxShadow: 'var(--shadow-teal)' }}
        >
          {starting
            ? <><Loader2 size={16} className="animate-spin" aria-hidden="true" />{t('starting')}</>
            : isEnergizing
              ? <><Zap size={16} aria-hidden="true" />{t('joinPanel.startQuestions')}</>
              : <><Rocket size={16} aria-hidden="true" />{t('open_lobby_button')}</>}
        </button>

        {startError && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">{startError}</p>
        )}

        {/* Share link */}
        <button
          type="button"
          onClick={() => void handleShare()}
          disabled={sharing}
          className="w-full inline-flex items-center justify-center gap-2 rounded-[var(--radius-md,10px)] border border-[var(--surface-border-strong,#D4D4D4)] dark:border-[#2A3858] bg-transparent text-pulse-600 dark:text-pulse-300 px-4 py-2.5 text-[13.5px] font-semibold hover:border-teal-400 hover:text-teal-700 dark:hover:border-teal-500 dark:hover:text-teal-400 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 transition-colors"
        >
          <Share2 size={14} aria-hidden="true" />
          {sharing ? t('sharing') : t('share_button')}
        </button>
      </section>
    </aside>
  )
}
