import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import QRCode from 'react-qr-code'
import { ChevronRight, Lock, Sparkles, Users } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useLiveSession } from '../hooks/useLiveSession'
import { useT } from '../i18n'
import { api } from '../api/client'

export default function Present() {
  const auth = useAuth()
  const t = useT('present')
  const { id } = useParams<{ id: string }>()
  const { state, sendAdvance } = useLiveSession(id, { enabled: !!id })
  const [closing, setClosing] = useState(false)
  const [closeError, setCloseError] = useState<string | null>(null)

  const options = state.question?.options ?? []
  const ordered = useMemo(
    () => options.map((o) => ({ ...o, count: state.results.counts[o.id] ?? 0 })),
    [options, state.results.counts],
  )
  const max = ordered.reduce((m, o) => Math.max(m, o.count), 0)

  const stageRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function fit() {
      if (!stageRef.current) return
      const s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080)
      stageRef.current.style.transform = `scale(${s})`
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

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
    return <main className="min-h-screen flex items-center justify-center p-8 text-pulse-500">{t('loading')}</main>
  }
  if (auth.status === 'anonymous') return <Navigate to="/login" replace />

  return (
    /* animate-page-enter: presenter surface fades in (LAYOUT-MOTION-01) */
    <div className="fixed inset-0 grid place-items-center bg-pulse-50 animate-page-enter">
      {/* 1920×1080 letterboxed stage */}
      <div
        ref={stageRef}
        className="w-[1920px] h-[1080px] origin-center relative bg-white overflow-hidden"
        id="main"
      >
        {/* Background glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(1400px 700px at 10% -10%, rgba(20,184,166,0.10), transparent 60%), radial-gradient(1200px 600px at 95% 110%, rgba(139,92,246,0.10), transparent 60%)',
          }}
        />

        {/* Top accent bar */}
        <div
          className="absolute top-0 left-0 right-0 h-[6px]"
          style={{ background: 'var(--gradient-brand)' }}
        />

        {/* ── Top bar ── */}
        <div className="absolute top-[44px] left-[64px] right-[64px] flex items-center justify-between z-10">
          {/* Brand */}
          <div className="flex items-center gap-3 font-[family-name:var(--font-display)] font-bold text-[28px] tracking-[-0.02em] text-pulse-900">
            <img src="/favicon.svg" alt="" width={40} height={40} />
            Qesto
          </div>
          {/* Session info + live indicator */}
          <div className="flex gap-7 items-center text-[20px] text-pulse-600 font-medium">
            {state.session && <span>{state.session.title}</span>}
            <span className="w-px h-5 bg-pulse-200" />
            <span
              className={`flex items-center gap-2.5 font-semibold text-pulse-900 ${
                state.connection === 'open' ? '' : 'opacity-60'
              }`}
            >
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  state.connection === 'open' ? 'bg-[var(--signal-success)]' : 'bg-pulse-400'
                }`}
                style={
                  state.connection === 'open'
                    ? { animation: 'pulse 1.8s infinite', boxShadow: '0 0 0 0 rgba(34,197,94,0.5)' }
                    : undefined
                }
              />
              {state.connection === 'open' ? 'Live' : state.connection}
            </span>
          </div>
        </div>

        {/* ── Question header ── */}
        <div className="absolute top-[144px] left-[64px] right-[600px] z-10">
          <div className="text-[20px] font-bold tracking-[0.12em] uppercase text-teal-700 mb-5">
            {state.question ? 'Question' : 'Waiting for question'}
          </div>
          <h1 className="font-[family-name:var(--font-display)] font-bold text-[76px] leading-[1.05] tracking-[-0.02em] text-pulse-900 [text-wrap:balance] m-0">
            {state.question?.prompt ?? t('connectingToRoom')}
          </h1>
          <div className="mt-5 text-[22px] text-pulse-600 flex gap-9">
            <span className="flex items-center gap-2">
              <Users size={20} className="text-teal-600" aria-hidden="true" />
              {state.results.total} {state.results.total === 1 ? t('participant') : t('participants')}
            </span>
            <span className="flex items-center gap-2">
              <Lock size={20} className="text-teal-600" aria-hidden="true" />
              {t('anonymity') ?? 'Full anonymity'}
            </span>
          </div>
        </div>

        {/* ── Results bars ── */}
        <div
          className="absolute top-[460px] left-[64px] right-[600px] grid gap-7 z-10"
          aria-live="polite"
        >
          {ordered.map((o, i) => {
            const pct = max === 0 ? 0 : Math.round((o.count / max) * 100)
            const fills = [
              'linear-gradient(135deg,#14B8A6,#0D9488)',
              'linear-gradient(135deg,#2DD4BF,#14B8A6)',
              'linear-gradient(135deg,#A78BFA,#8B5CF6)',
              'linear-gradient(135deg,#C4B5FD,#A78BFA)',
            ]
            return (
              <div key={o.id} className="grid gap-2">
                <div className="grid grid-cols-[1fr_auto] items-baseline gap-5">
                  <span className="text-[32px] font-semibold leading-snug text-pulse-900">{o.label}</span>
                  <span className="font-[family-name:var(--font-display)] font-bold text-[44px] tracking-[-0.02em] text-pulse-900 tabular-nums">
                    {pct}%
                  </span>
                </div>
                <div
                  role="img"
                  aria-label={`${o.label}: ${pct}%`}
                  className="h-6 bg-pulse-100 rounded-full overflow-hidden"
                >
                  <div
                    className="h-full rounded-full transition-[width] duration-[600ms]"
                    style={{ width: `${pct}%`, background: fills[i % fills.length] }}
                  />
                </div>
              </div>
            )
          })}
        </div>

        {/* ── Join panel ── */}
        <div className="absolute right-[64px] top-[144px] w-[440px] p-9 bg-white border border-pulse-200 rounded-[32px] shadow-elevated z-10">
          <h3 className="text-[16px] font-bold tracking-[0.1em] uppercase text-teal-700 mb-3">Join this session</h3>
          {state.session && (
            <div className="font-mono text-[20px] font-medium text-pulse-600 mb-4">qesto.app/join</div>
          )}
          {state.session && (
            <div
              className="font-mono text-[52px] font-medium tracking-[0.12em] leading-none mb-5 bg-clip-text text-transparent"
              style={{ backgroundImage: 'var(--gradient-brand)' }}
            >
              {state.session.code}
            </div>
          )}
          {state.session && (
            <div
              className="w-full aspect-square bg-pulse-50 rounded-[16px] p-3.5 shadow-[inset_0_0_0_1px_var(--surface-border)]"
              aria-label="QR code to join session"
            >
              <QRCode
                value={`${window.location.origin}/j/${state.session.code}`}
                size={368}
                style={{ display: 'block', width: '100%', height: 'auto' }}
              />
            </div>
          )}
          <div className="mt-5 text-[18px] text-pulse-600 text-center">
            <span className="font-[family-name:var(--font-display)] font-bold text-[26px] tracking-[-0.01em] text-pulse-900">
              {state.participants}
            </span>{' '}
            {state.participants === 1 ? t('participant') : t('participants')} connected
          </div>
        </div>

        {/* ── WS / close errors ── */}
        {state.error && (
          <p role="alert" className="absolute top-[1020px] left-[64px] text-sm text-red-600 z-10">
            {state.error}
          </p>
        )}

        {/* ── Bottom chrome ── */}
        <div className="absolute bottom-[36px] left-[64px] right-[64px] flex justify-between items-center border-t border-pulse-200 pt-6 z-10 text-[18px] text-pulse-600">
          {/* Controls */}
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => sendAdvance()}
              disabled={state.connection !== 'open' || state.session?.status === 'closed'}
              className="inline-flex items-center gap-2 rounded-md text-white px-5 py-2.5 text-[16px] font-semibold shadow-card hover:shadow-teal disabled:opacity-50 transition-all duration-[120ms] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
              style={{ background: 'var(--gradient-brand)' }}
            >
              <ChevronRight size={18} aria-hidden="true" />
              Next question
            </button>
            <button
              type="button"
              onClick={handleClose}
              disabled={closing || state.session?.status === 'closed'}
              className="inline-flex items-center rounded-md border border-pulse-300 text-pulse-700 hover:border-red-400 hover:text-red-700 px-5 py-2.5 text-[16px] font-medium disabled:opacity-50 transition-all duration-[120ms] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
            >
              {state.session?.status === 'closed' ? 'Session closed' : closing ? 'Closing…' : 'Close session'}
            </button>
            {closeError && <span className="text-sm text-red-600">{closeError}</span>}
            {id && state.session?.status === 'closed' && (
              <Link
                to={`/sessions/${id}/results`}
                className="text-sm text-teal-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 rounded"
              >
                View results →
              </Link>
            )}
          </div>
          {/* AI disclosure */}
          <div className="inline-flex items-center gap-2.5 px-4 py-2.5 bg-violet-50 border border-violet-200 rounded-full text-[16px] font-semibold text-violet-700">
            <Sparkles size={16} className="text-violet-600" aria-hidden="true" />
            AI recap at session close · Workers AI on Cloudflare
          </div>
          {/* Lock indicator */}
          <div className="flex items-center gap-2 font-medium text-pulse-600">
            <Lock size={18} className="text-teal-600" aria-hidden="true" />
            Anonymity: Full
          </div>
        </div>
      </div>
    </div>
  )
}
