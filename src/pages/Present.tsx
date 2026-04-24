import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import QRCode from 'react-qr-code'
import { ChevronRight, Download, Eye, EyeOff, Link2, Lock, Pause, Play, Shuffle, Sparkles, Timer, Users } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useLiveSession, type LivePollOption } from '../hooks/useLiveSession'
import { useT } from '../i18n'
import { api } from '../api/client'

// ── Soft-timer hook ────────────────────────────────────────────────────────
function useSoftTimer() {
  const [totalSecs, setTotalSecs] = useState(0)
  const [remaining, setRemaining] = useState(0)
  const [running, setRunning] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const start = useCallback((secs: number) => {
    setTotalSecs(secs)
    setRemaining(secs)
    setRunning(true)
  }, [])

  const stop = useCallback(() => {
    setRunning(false)
    setRemaining(0)
    setTotalSecs(0)
  }, [])

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          setRunning(false)
          return 0
        }
        return r - 1
      })
    }, 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [running])

  const pct = totalSecs > 0 ? remaining / totalSecs : 0
  return { remaining, running, pct, start, stop }
}

export default function Present() {
  const auth = useAuth()
  const t = useT('present')
  const { id } = useParams<{ id: string }>()
  const { state, sendAdvance, sendPause, sendResume } = useLiveSession(id, { enabled: !!id })
  const [closing, setClosing] = useState(false)
  const [closeError, setCloseError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // ── Presenter controls (local state) ─────────────────────────────────────
  const [localPaused, setLocalPaused] = useState(false)
  const [hideTally, setHideTally] = useState(false)
  const [minGate, setMinGate] = useState(0)
  const [shuffledOptions, setShuffledOptions] = useState<LivePollOption[]>([])
  const [timerInput, setTimerInput] = useState('2')
  const timer = useSoftTimer()

  const isClosed = state.session?.status === 'closed'
  const isLive = state.connection === 'open' && !isClosed

  // Keep localPaused in sync with server state
  useEffect(() => { setLocalPaused(state.paused) }, [state.paused])

  // Reset shuffle when question changes
  useEffect(() => { setShuffledOptions([]) }, [state.question?.id])

  const baseOptions = state.question?.options ?? []
  const displayOptions = shuffledOptions.length > 0 ? shuffledOptions : baseOptions

  const ordered = useMemo(
    () => displayOptions.map((o) => ({ ...o, count: state.results.counts[o.id] ?? 0 })),
    [displayOptions, state.results.counts],
  )
  const max = ordered.reduce((m, o) => Math.max(m, o.count), 0)
  const tallyVisible = !hideTally && state.results.total >= minGate

  const [scale, setScale] = useState(1)
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    function fit() {
      const container = containerRef.current
      if (!container || !stageRef.current) return
      const { width, height } = container.getBoundingClientRect()
      const s = Math.min(width / 1920, height / 1080)
      stageRef.current.style.transform = `scale(${s})`
      setScale(s)
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

  function handleCopyDisplayLink() {
    if (!state.session?.code) return
    const url = `${window.location.origin}/display/${state.session.code}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

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

  function handleTogglePause() {
    if (localPaused) {
      sendResume()
      setLocalPaused(false)
    } else {
      sendPause()
      setLocalPaused(true)
    }
  }

  function handleShuffle() {
    const arr = [...baseOptions]
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    setShuffledOptions(arr)
  }

  function handleStartTimer() {
    const secs = Math.max(10, Math.min(600, parseInt(timerInput, 10) * 60))
    timer.start(secs)
  }

  if (auth.status === 'loading') {
    return <main className="min-h-screen flex items-center justify-center p-8 text-pulse-500">{t('loading')}</main>
  }
  if (auth.status === 'anonymous') return <Navigate to="/login" replace />

  const fills = [
    'linear-gradient(135deg,#14B8A6,#0D9488)',
    'linear-gradient(135deg,#2DD4BF,#14B8A6)',
    'linear-gradient(135deg,#A78BFA,#8B5CF6)',
    'linear-gradient(135deg,#C4B5FD,#A78BFA)',
  ]

  return (
    <div className="fixed inset-0 flex flex-col bg-pulse-950 animate-page-enter">
      {/* ── 1920×1080 letterboxed stage ────────────────────────────────────── */}
      <div ref={containerRef} className="flex-1 min-h-0 overflow-hidden flex items-center justify-center">
        <div style={{ width: scale * 1920, height: scale * 1080, flexShrink: 0 }}>
        <div
          ref={stageRef}
          className="w-[1920px] h-[1080px] origin-top-left relative bg-white overflow-hidden"
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
          <div className="absolute top-0 left-0 right-0 h-[6px]" style={{ background: 'var(--gradient-brand)' }} />

          {/* Paused overlay */}
          {localPaused && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-sm">
              <div className="flex items-center gap-4 bg-white rounded-2xl px-10 py-6 shadow-2xl">
                <Pause size={36} className="text-amber-500" aria-hidden="true" />
                <span className="font-bold text-[40px] text-pulse-900 tracking-tight">{t('votingPaused')}</span>
              </div>
            </div>
          )}

          {/* Soft timer arc */}
          {timer.running && (
            <div className="absolute top-[20px] right-[64px] z-10 flex items-center gap-3">
              <div className="relative w-[60px] h-[60px]">
                <svg viewBox="0 0 60 60" className="w-full h-full -rotate-90">
                  <circle cx="30" cy="30" r="26" fill="none" stroke="#E2E8F0" strokeWidth="5" />
                  <circle
                    cx="30" cy="30" r="26" fill="none"
                    stroke={timer.pct > 0.25 ? '#14B8A6' : '#EF4444'}
                    strokeWidth="5"
                    strokeDasharray={`${2 * Math.PI * 26}`}
                    strokeDashoffset={`${2 * Math.PI * 26 * (1 - timer.pct)}`}
                    strokeLinecap="round"
                    className="transition-[stroke-dashoffset] duration-1000"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[14px] font-bold text-pulse-900 tabular-nums">
                  {Math.floor(timer.remaining / 60)}:{String(timer.remaining % 60).padStart(2, '0')}
                </span>
              </div>
            </div>
          )}

          {/* ── Top bar ── */}
          <div className="absolute top-[44px] left-[64px] right-[64px] flex items-center justify-between z-10">
            <div className="flex items-center gap-3 font-[family-name:var(--font-display)] font-bold text-[28px] tracking-[-0.02em] text-pulse-900">
              <img src="/favicon.svg" alt="" width={40} height={40} />
              Qesto
            </div>
            <div className="flex gap-7 items-center text-[20px] text-pulse-600 font-medium">
              {state.session && <span>{state.session.title}</span>}
              <span className="w-px h-5 bg-pulse-200" />
              <span className={`flex items-center gap-2.5 font-semibold text-pulse-900 ${state.connection === 'open' ? '' : 'opacity-60'}`}>
                <span
                  className={`w-2.5 h-2.5 rounded-full ${state.connection === 'open' ? 'bg-[var(--signal-success)]' : 'bg-pulse-400'}`}
                  style={state.connection === 'open' ? { animation: 'pulse 1.8s infinite', boxShadow: '0 0 0 0 rgba(34,197,94,0.5)' } : undefined}
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
                {state.results.total} {t('participant', { count: state.results.total })}
              </span>
              <span className="flex items-center gap-2">
                <Lock size={20} className="text-teal-600" aria-hidden="true" />
                {t('anonymity') ?? 'Full anonymity'}
              </span>
            </div>
          </div>

          {/* ── Results bars ── */}
          <div className="absolute top-[460px] left-[64px] right-[600px] grid gap-7 z-10" aria-live="polite">
            {tallyVisible
              ? ordered.map((o, i) => {
                  const pct = max === 0 ? 0 : Math.round((o.count / max) * 100)
                  return (
                    <div key={o.id} className="grid gap-2">
                      <div className="grid grid-cols-[1fr_auto] items-baseline gap-5">
                        <span className="text-[32px] font-semibold leading-snug text-pulse-900">{o.label}</span>
                        <span className="font-[family-name:var(--font-display)] font-bold text-[44px] tracking-[-0.02em] text-pulse-900 tabular-nums">
                          {pct}%
                        </span>
                      </div>
                      <div role="img" aria-label={`${o.label}: ${pct}%`} className="h-6 bg-pulse-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-[width] duration-[600ms]"
                          style={{ width: `${pct}%`, background: fills[i % fills.length] }}
                        />
                      </div>
                    </div>
                  )
                })
              : ordered.map((o) => (
                  <div key={o.id} className="grid gap-2">
                    <div className="grid grid-cols-[1fr_auto] items-baseline gap-5">
                      <span className="text-[32px] font-semibold leading-snug text-pulse-900">{o.label}</span>
                      <span className="font-[family-name:var(--font-display)] font-bold text-[44px] tracking-[-0.02em] text-pulse-400 tabular-nums">—</span>
                    </div>
                    <div className="h-6 bg-pulse-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-pulse-200" style={{ width: '0%' }} />
                    </div>
                  </div>
                ))}
          </div>

          {/* ── Join panel ── */}
          <div className="absolute right-[64px] top-[144px] w-[440px] p-9 bg-white border border-pulse-200 rounded-[32px] shadow-elevated z-10">
            <h3 className="text-[16px] font-bold tracking-[0.1em] uppercase text-teal-700 mb-3">{t('joinThisSession')}</h3>
            {state.session && <div className="font-mono text-[20px] font-medium text-pulse-600 mb-4">qesto.app/join</div>}
            {state.session && (
              <div className="font-mono text-[52px] font-medium tracking-[0.12em] leading-none mb-5 bg-clip-text text-transparent" style={{ backgroundImage: 'var(--gradient-brand)' }}>
                {state.session.code}
              </div>
            )}
            {state.session && (
              <div className="w-full aspect-square bg-pulse-50 rounded-[16px] p-3.5 shadow-[inset_0_0_0_1px_var(--surface-border)]" aria-label="QR code to join session">
                <QRCode
                  value={`${window.location.origin}/j/${state.session.code}`}
                  size={368}
                  style={{ display: 'block', width: '100%', height: 'auto' }}
                />
              </div>
            )}
            <div className="mt-5 text-[18px] text-pulse-600 text-center">
              <span className="font-[family-name:var(--font-display)] font-bold text-[26px] tracking-[-0.01em] text-pulse-900">{state.participants}</span>{' '}
              {t('participant', { count: state.participants })} {t('connectedLabel')}
            </div>
          </div>

          {/* WS / close errors */}
          {state.error && (
            <p role="alert" className="absolute top-[1020px] left-[64px] text-sm text-red-600 z-10">{state.error}</p>
          )}

          {/* ── Bottom chrome ── */}
          <div className="absolute bottom-[36px] left-[64px] right-[64px] flex justify-between items-center border-t border-pulse-200 pt-6 z-10 text-[18px] text-pulse-600">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => sendAdvance()}
                disabled={!isLive}
                className="inline-flex items-center gap-2 rounded-md text-white px-5 py-2.5 text-[16px] font-semibold shadow-card disabled:opacity-50 transition-all duration-[120ms] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
                style={{ background: 'var(--gradient-brand)' }}
              >
                <ChevronRight size={18} aria-hidden="true" />
                Next question
              </button>
              <button
                type="button"
                onClick={handleClose}
                disabled={closing || isClosed}
                className="inline-flex items-center rounded-md border border-pulse-300 text-pulse-700 hover:border-red-400 hover:text-red-700 px-5 py-2.5 text-[16px] font-medium disabled:opacity-50 transition-all duration-[120ms] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
              >
                {isClosed ? 'Session closed' : closing ? 'Closing…' : 'Close session'}
              </button>
              {closeError && <span className="text-sm text-red-600">{closeError}</span>}
              {id && isClosed && (
                <Link to={`/sessions/${id}/results`} className="text-sm text-teal-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 rounded">
                  View results →
                </Link>
              )}
            </div>
            {state.session && (
              <button
                type="button"
                onClick={handleCopyDisplayLink}
                disabled={!state.session.code}
                title="Copy display URL to embed in PowerPoint"
                className="inline-flex items-center gap-2 rounded-md border border-pulse-300 text-pulse-700 hover:border-teal-400 hover:text-teal-700 px-4 py-2.5 text-[16px] font-medium transition-all duration-[120ms] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
              >
                <Link2 size={16} aria-hidden="true" />
                {copied ? 'Copied!' : 'Display link'}
              </button>
            )}
            <div className="inline-flex items-center gap-2.5 px-4 py-2.5 bg-violet-50 border border-violet-200 rounded-full text-[16px] font-semibold text-violet-700">
              <Sparkles size={16} className="text-violet-600" aria-hidden="true" />
              AI recap at session close · Workers AI on Cloudflare
            </div>
            <div className="flex items-center gap-2 font-medium text-pulse-600">
              <Lock size={18} className="text-teal-600" aria-hidden="true" />
              Anonymity: Full
            </div>
          </div>
        </div>
        </div>
      </div>

      {/* ── Presenter control panel ───────────────────────────────────────── */}
      <div className="bg-pulse-900 border-t border-pulse-700 px-4 py-2 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-white shrink-0">

        {/* Pause / Resume */}
        <button
          type="button"
          onClick={handleTogglePause}
          disabled={!isLive}
          aria-pressed={localPaused}
          className={[
            'inline-flex items-center gap-1.5 rounded px-3 py-1.5 font-medium min-h-[36px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 disabled:opacity-40',
            localPaused ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-pulse-700 text-white hover:bg-pulse-600',
          ].join(' ')}
        >
          {localPaused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}
          {localPaused ? 'Resume' : 'Pause'}
        </button>

        <span className="w-px h-5 bg-pulse-700" aria-hidden="true" />

        {/* Hide tally live */}
        <button
          type="button"
          onClick={() => setHideTally((v) => !v)}
          aria-pressed={hideTally}
          className={[
            'inline-flex items-center gap-1.5 rounded px-3 py-1.5 font-medium min-h-[36px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400',
            hideTally ? 'bg-teal-600 text-white hover:bg-teal-700' : 'bg-pulse-700 text-white hover:bg-pulse-600',
          ].join(' ')}
        >
          {hideTally ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
          {hideTally ? 'Tally hidden' : 'Hide tally'}
        </button>

        {/* Option shuffle */}
        <button
          type="button"
          onClick={handleShuffle}
          disabled={baseOptions.length < 2}
          className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 font-medium min-h-[36px] bg-pulse-700 text-white hover:bg-pulse-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 disabled:opacity-40"
        >
          <Shuffle size={14} aria-hidden="true" />
          Shuffle options
        </button>

        <span className="w-px h-5 bg-pulse-700" aria-hidden="true" />

        {/* Minimum tally gate */}
        <label className="flex items-center gap-2 text-pulse-300">
          Min. votes to show tally
          <input
            type="number"
            min={0}
            max={999}
            value={minGate}
            onChange={(e) => setMinGate(Math.max(0, parseInt(e.target.value, 10) || 0))}
            className="w-14 rounded border border-pulse-600 bg-pulse-800 text-white text-center px-1 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
            aria-label="Minimum votes required before tally is shown"
          />
        </label>

        <span className="w-px h-5 bg-pulse-700" aria-hidden="true" />

        {/* Soft timer */}
        <div className="flex items-center gap-2">
          <Timer size={14} className="text-pulse-400" aria-hidden="true" />
          <label className="text-pulse-300 flex items-center gap-1.5">
            Timer
            <input
              type="number"
              min={1}
              max={10}
              value={timerInput}
              onChange={(e) => setTimerInput(e.target.value)}
              disabled={timer.running}
              className="w-12 rounded border border-pulse-600 bg-pulse-800 text-white text-center px-1 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 disabled:opacity-40"
              aria-label="Timer duration in minutes"
            />
            min
          </label>
          {timer.running ? (
            <button
              type="button"
              onClick={timer.stop}
              className="rounded px-2.5 py-1.5 text-xs font-medium min-h-[36px] bg-red-600 text-white hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
            >
              Stop
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStartTimer}
              className="rounded px-2.5 py-1.5 text-xs font-medium min-h-[36px] bg-pulse-700 text-white hover:bg-pulse-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
            >
              Start
            </button>
          )}
          {timer.running && (
            <span className="tabular-nums text-teal-400 font-mono text-sm">
              {Math.floor(timer.remaining / 60)}:{String(timer.remaining % 60).padStart(2, '0')}
            </span>
          )}
        </div>

        <span className="w-px h-5 bg-pulse-700" aria-hidden="true" />

        {/* One-click export */}
        {id && (
          <a
            href={`/api/sessions/${encodeURIComponent(id)}/export.csv`}
            download
            className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 font-medium min-h-[36px] bg-pulse-700 text-white hover:bg-pulse-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
          >
            <Download size={14} aria-hidden="true" />
            Export CSV
          </a>
        )}
      </div>
    </div>
  )
}
