import { useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, useCallback } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import QRCode from 'react-qr-code'
import { Lock, Pause, Sparkles, Users } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useLiveSession, type LivePollOption } from '../hooks/useLiveSession'
import { useT } from '../i18n'
import { CopilotPanel } from '../components/CopilotPanel'
import { api, getAuthToken } from '../api/client'
import { useSoftTimer } from './present/useSoftTimer'
import { PresenterControls } from './present/PresenterControls'
import { CanvasThemeProvider } from '../components/CanvasThemeProvider'
import { useCanvasTheme } from '../hooks/useCanvasTheme'
import { JoinCodeDisplay } from '../ui/JoinCodeDisplay'
import { AdaptiveVizResults } from '../components/AdaptiveVizResults'
import { CaptionsOverlay } from '../components/CaptionsOverlay'
import { ReactionsOverlay, useReactionsTicker } from '../components/ReactionsOverlay'
import { captionsReducer, CAPTIONS_INITIAL, type CaptionSegment } from '../hooks/useCaptions'
import { reactionsReducer, REACTIONS_INITIAL } from '../hooks/useReactions'
import { readPersistedCaptionLocale, type CaptionLocale } from '../components/CaptionsLocalePicker'

export default function Present() {
  const auth = useAuth()
  const t = useT('present')
  const { id } = useParams<{ id: string }>()
  const presenterToken = getAuthToken()

  // ── Captions state (FE-CAPTIONS-OVERLAY-01) ─────────────────────────────
  const [captionsState, captionsDispatch] = useReducer(captionsReducer, CAPTIONS_INITIAL)
  const [captionLocale, setCaptionLocale] = useState<CaptionLocale>(readPersistedCaptionLocale)
  // Plan gating: the server returns 403 with feature=liveCaptions when the plan
  // is insufficient. We surface it via the captions_plan_gate affordance.
  const [captionsPlanGated, setCaptionsPlanGated] = useState(false)
  const [reactionsState, reactionsDispatch] = useReducer(reactionsReducer, REACTIONS_INITIAL)
  const onReactionDelta = useCallback(
    (delta: { counts: Record<string, number>; total: number }) => {
      reactionsDispatch({ kind: 'delta', counts: delta.counts, total: delta.total })
    },
    [],
  )
  const onReactionsTick = useCallback((now: number) => {
    reactionsDispatch({ kind: 'tick', now })
  }, [])
  useReactionsTicker(reactionsState.total > 0, onReactionsTick)

  const { state, sendAdvance, sendBack, sendPause, sendResume, sendAddQuestion, sendEnergizerActivate, sendCaptionsStart, sendCaptionsStop, sendCaptionsSetLocale } = useLiveSession(
    id,
    {
      ...(presenterToken ? { presenterToken } : {}),
      enabled: !!id,
      onCaptionSegment: (seg) => captionsDispatch({ kind: 'segment', segment: seg }),
      onReactionDelta,
    },
  )
  const [closing, setClosing] = useState(false)
  const [closeError, setCloseError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // ── Presenter controls (local state) ─────────────────────────────────────
  const [localPaused, setLocalPaused] = useState(false)
  const [hideTally, setHideTally] = useState(false)
  const [hideSentiment, setHideSentiment] = useState(true) // Default: sentiment hidden (off)
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
  const tallyVisible = !hideTally && state.results.total >= minGate
  const showSentiment =
    state.role === 'presenter' &&
    state.question?.kind === 'open' &&
    state.sentiment !== null &&
    !hideSentiment
  const sentimentLabelKey =
    state.sentiment?.mood === 'positive'
      ? 'sentiment.positive'
      : state.sentiment?.mood === 'concerning'
        ? 'sentiment.concerning'
        : 'sentiment.neutral'

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
    }).catch(() => {
      setCopied(false)
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

  // ── Captions handlers ────────────────────────────────────────────────────

  function handleToggleCaptions() {
    if (captionsState.active) {
      sendCaptionsStop()
      captionsDispatch({ kind: 'stop' })
    } else {
      // sourceLocale = the presenter's UI language (defaults to 'en').
      sendCaptionsStart('en')
      captionsDispatch({ kind: 'start' })
    }
  }

  function handleCaptionLocaleChange(locale: CaptionLocale) {
    setCaptionLocale(locale)
    captionsDispatch({ kind: 'set_locale', locale: locale === 'off' ? 'en' : locale })
    sendCaptionsSetLocale(locale)
  }

  // Detect plan-gate: if the WS error arrives mentioning liveCaptions, mark gated.
  // The real enforcement is server-side; this just updates the UI affordance.
  useEffect(() => {
    if (state.error?.includes('liveCaptions') || state.error?.includes('feature_not_available')) {
      setCaptionsPlanGated(true)
    }
  }, [state.error])

  // Energizer launch handlers — wired to presenter UI in Sprint C
  function handleStartQuickFinger() {
    const sourceOptions = state.question?.options.map((o) => o.label).filter(Boolean) ?? []
    const options = sourceOptions.length > 0 ? sourceOptions.slice(0, 4) : [t('quickFinger.optionYes'), t('quickFinger.optionNo')]
    sendEnergizerActivate({ id: `quick_finger_${state.question?.id ?? Date.now()}`, kind: 'quick_finger', title: t('quickFinger.title'), status: 'active', prompt: state.question?.prompt ?? t('quickFinger.promptFallback'), options })
  }
  function handleStartTeamQuiz() {
    const sourceOptions = state.question?.options.map((o) => o.label).filter(Boolean) ?? []
    const options = sourceOptions.length >= 2 ? sourceOptions.slice(0, 4) : [t('teamQuiz.optionA'), t('teamQuiz.optionB'), t('teamQuiz.optionC'), t('teamQuiz.optionD')]
    sendEnergizerActivate({ id: `team_quiz_${state.question?.id ?? Date.now()}`, kind: 'team_quiz', title: t('teamQuiz.title'), status: 'active', questions: [{ prompt: state.question?.prompt ?? t('teamQuiz.promptFallback'), options, correctIndex: 0 }, { prompt: t('teamQuiz.secondPrompt'), options: [t('teamQuiz.optionA'), t('teamQuiz.optionB')], correctIndex: 1 }] })
  }
  // Reference both handlers to satisfy noUnusedLocals while Sprint C UI wiring is pending
  void ({ handleStartQuickFinger, handleStartTeamQuiz })

  if (auth.status === 'loading') {
    return <main className="min-h-screen flex items-center justify-center p-8 text-pulse-500">{t('loading')}</main>
  }
  if (auth.status === 'anonymous') return <Navigate to="/login" replace />

  return (
    <CanvasThemeProvider>
      <PresentInner
        id={id}
        state={state}
        isLive={isLive}
        isClosed={isClosed}
        closing={closing}
        closeError={closeError}
        copied={copied}
        localPaused={localPaused}
        hideTally={hideTally}
        hideSentiment={hideSentiment}
        minGate={minGate}
        timerInput={timerInput}
        timer={timer}
        scale={scale}
        containerRef={containerRef}
        stageRef={stageRef}
        ordered={ordered}
        baseOptions={baseOptions}
        tallyVisible={tallyVisible}
        showSentiment={showSentiment}
        sentimentLabelKey={sentimentLabelKey}
        onBack={() => sendBack()}
        onAdvance={() => sendAdvance()}
        onClose={handleClose}
        onTogglePause={handleTogglePause}
        onToggleHideTally={() => setHideTally((v) => !v)}
        onToggleHideSentiment={() => setHideSentiment((v) => !v)}
        onShuffle={handleShuffle}
        onMinGateChange={(value) => setMinGate(value)}
        onTimerInputChange={(value) => setTimerInput(value)}
        onStartTimer={handleStartTimer}
        onCopyDisplayLink={handleCopyDisplayLink}
        sendAddQuestion={sendAddQuestion}
        captionsSegments={captionsState.segments}
        captionsActive={captionsState.active}
        captionsPlanGated={captionsPlanGated}
        captionLocale={captionLocale}
        onToggleCaptions={handleToggleCaptions}
        onCaptionLocaleChange={handleCaptionLocaleChange}
        reactionsParticles={reactionsState.particles}
        reactionsTotal={reactionsState.total}
      />
    </CanvasThemeProvider>
  )
}

// ── Inner component — consumes useCanvasTheme() within the provider ────────────

interface PresentInnerProps {
  id: string | undefined
  state: ReturnType<typeof useLiveSession>['state']
  isLive: boolean
  isClosed: boolean
  closing: boolean
  closeError: string | null
  copied: boolean
  localPaused: boolean
  hideTally: boolean
  hideSentiment: boolean
  minGate: number
  timerInput: string
  timer: ReturnType<typeof useSoftTimer>
  scale: number
  containerRef: React.RefObject<HTMLDivElement | null>
  stageRef: React.RefObject<HTMLDivElement | null>
  ordered: Array<{ id: string; label: string; count: number }>
  baseOptions: LivePollOption[]
  tallyVisible: boolean
  showSentiment: boolean
  sentimentLabelKey: string
  onBack: () => void
  onAdvance: () => void
  onClose: () => void
  onTogglePause: () => void
  onToggleHideTally: () => void
  onToggleHideSentiment: () => void
  onShuffle: () => void
  onMinGateChange: (v: number) => void
  onTimerInputChange: (v: string) => void
  onStartTimer: () => void
  onCopyDisplayLink: () => void
  sendAddQuestion: ReturnType<typeof useLiveSession>['sendAddQuestion']
  /** Captions */
  captionsSegments: CaptionSegment[]
  captionsActive: boolean
  captionsPlanGated: boolean
  captionLocale: CaptionLocale
  onToggleCaptions: () => void
  onCaptionLocaleChange: (locale: CaptionLocale) => void
  reactionsParticles: import('../hooks/useReactions').ReactionParticle[]
  reactionsTotal: number
}

function PresentInner({
  id,
  state,
  isLive,
  isClosed,
  closing,
  closeError,
  copied,
  localPaused,
  hideTally,
  hideSentiment,
  minGate,
  timerInput,
  timer,
  scale,
  containerRef,
  stageRef,
  ordered,
  baseOptions,
  tallyVisible,
  showSentiment,
  sentimentLabelKey,
  onBack,
  onAdvance,
  onClose,
  onTogglePause,
  onToggleHideTally,
  onToggleHideSentiment,
  onShuffle,
  onMinGateChange,
  onTimerInputChange,
  onStartTimer,
  onCopyDisplayLink,
  sendAddQuestion,
  captionsSegments,
  captionsActive,
  captionsPlanGated,
  captionLocale,
  onToggleCaptions,
  onCaptionLocaleChange,
  reactionsParticles,
  reactionsTotal,
}: PresentInnerProps) {
  const t = useT('present')
  const { theme } = useCanvasTheme()

  return (
    <div className="fixed inset-0 flex flex-col bg-pulse-950 animate-page-enter">
      {/* COPILOT-05 — presenter-only live facilitator copilot (ADR-0046) */}
      <CopilotPanel sessionId={id} enabled={state.role === 'presenter' && isLive} onAddQuestion={sendAddQuestion} />
      {/* ── 1920×1080 letterboxed stage ────────────────────────────────────── */}
      <div ref={containerRef} className="flex-1 min-h-0 overflow-hidden flex items-center justify-center">
        <div style={{ width: scale * 1920, height: scale * 1080, flexShrink: 0 }}>
        <div
          ref={stageRef}
          className="w-[1920px] h-[1080px] origin-top-left relative overflow-hidden"
          id="main"
          data-canvas-theme={theme}
          style={{
            background: 'var(--canvas-bg)',
            fontFamily: 'var(--canvas-font-body)',
            color: 'var(--canvas-text)',
            lineHeight: 'var(--canvas-line-height, 1.6)',
            letterSpacing: 'var(--canvas-letter-spacing, 0em)',
          }}
        >
          {/* Background glow */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'radial-gradient(1400px 700px at 10% -10%, rgba(20,184,166,0.08), transparent 60%), radial-gradient(1200px 600px at 95% 110%, rgba(139,92,246,0.08), transparent 60%)',
            }}
          />

          {/* Top accent bar */}
          <div className="absolute top-0 left-0 right-0 h-1.5" style={{ background: 'var(--gradient-brand)' }} />

          {/* All done overlay */}
          {state.allDone && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center" style={{ background: 'var(--gradient-brand)' }}>
              <div className="text-[120px] mb-6" aria-hidden="true">🎉</div>
              <h2 className="font-[family-name:var(--canvas-font-display,var(--font-display))] font-bold text-[80px] leading-[1.1] tracking-[-0.02em] text-white text-center [text-wrap:balance]">
                {t('allDone.heading')}
              </h2>
              <p className="mt-6 text-[32px] text-white/80 font-medium">
                {state.session?.title}
              </p>
              <div className="mt-12 flex items-center gap-3 text-[26px] text-white/70 font-medium">
                <Users size={28} className="text-white/60" aria-hidden="true" />
                {state.participants} {t('participant', { count: state.participants })} {t('connectedLabel')}
              </div>
            </div>
          )}

          {/* Paused overlay */}
          {localPaused && !state.allDone && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-sm">
              <div className="flex items-center gap-4 rounded-2xl px-10 py-6 shadow-2xl" style={{ background: 'var(--canvas-surface)' }}>
                <Pause size={36} className="text-amber-500" aria-hidden="true" />
                <span className="font-bold text-[40px] tracking-tight" style={{ color: 'var(--canvas-text)' }}>{t('votingPaused')}</span>
              </div>
            </div>
          )}

          {/* Soft timer arc */}
          {timer.running && (
            <div className="absolute top-[20px] right-[64px] z-10 flex items-center gap-3">
              <div className="relative w-[60px] h-[60px]">
                <svg viewBox="0 0 60 60" className="w-full h-full -rotate-90">
                  <circle cx="30" cy="30" r="26" fill="none" stroke="var(--canvas-border)" strokeWidth="5" />
                  <circle
                    cx="30" cy="30" r="26" fill="none"
                    stroke={timer.pct > 0.25 ? 'var(--canvas-accent)' : '#EF4444'}
                    strokeWidth="5"
                    strokeDasharray={`${2 * Math.PI * 26}`}
                    strokeDashoffset={`${2 * Math.PI * 26 * (1 - timer.pct)}`}
                    strokeLinecap="round"
                    className="transition-[stroke-dashoffset] duration-1000"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[14px] font-bold tabular-nums" style={{ color: 'var(--canvas-text)' }}>
                  {Math.floor(timer.remaining / 60)}:{String(timer.remaining % 60).padStart(2, '0')}
                </span>
              </div>
            </div>
          )}

          {/* ── Top bar ── */}
          <div className="absolute top-[44px] left-[64px] right-[64px] flex items-center justify-between z-10">
            <div className="flex items-center gap-3 font-[family-name:var(--canvas-font-display,var(--font-display))] font-bold text-[28px] tracking-[-0.02em]" style={{ color: 'var(--canvas-text)' }}>
              <img src="/favicon.svg" alt="" width={40} height={40} />
              Qesto
            </div>
            <div className="flex gap-7 items-center text-[20px] font-medium" style={{ color: 'var(--canvas-text-muted)' }}>
              {state.session && <span>{state.session.title}</span>}
              <span className="w-px h-5" style={{ background: 'var(--canvas-border)' }} aria-hidden="true" />
              <span
                className={`flex items-center gap-2.5 font-semibold ${state.connection === 'open' ? '' : 'opacity-60'}`}
                style={{ color: 'var(--canvas-text)' }}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{
                    background: state.connection === 'open' ? 'var(--canvas-accent)' : 'var(--canvas-text-muted)',
                    ...(state.connection === 'open' ? { animation: 'pulse 1.8s infinite', boxShadow: '0 0 0 0 rgba(34,197,94,0.5)' } : {}),
                  }}
                  aria-hidden="true"
                />
                {state.connection === 'open' ? 'Live' : state.connection}
              </span>
              {showSentiment && state.sentiment && (
                <>
                  <span className="w-px h-5" style={{ background: 'var(--canvas-border)' }} aria-hidden="true" />
                  <span
                    className="flex items-center gap-2 rounded-full px-4 py-1 text-[16px] font-semibold"
                    style={{
                      background: 'color-mix(in srgb, var(--canvas-accent) 12%, transparent)',
                      color: 'var(--canvas-accent)',
                    }}
                    title={t('sentiment.hint', { count: state.sentiment.sampleSize })}
                  >
                    <Sparkles size={18} aria-hidden="true" />
                    {t(sentimentLabelKey)}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* ── Question header ── */}
          <div className="absolute top-[144px] left-[64px] right-[600px] z-10">
            <div className="text-[20px] font-bold tracking-[0.12em] uppercase mb-5" style={{ color: 'var(--canvas-accent)' }}>
              {state.question ? 'Question' : 'Waiting for question'}
            </div>
            <h1
              className="font-[family-name:var(--canvas-font-display,var(--font-display))] font-bold text-[76px] leading-[1.05] tracking-[-0.02em] [text-wrap:balance] m-0"
              style={{ color: 'var(--canvas-text)', lineHeight: 'var(--canvas-line-height, 1.05)' }}
            >
              {state.question?.prompt ?? t('connectingToRoom')}
            </h1>
            <div className="mt-5 text-[22px] flex gap-9" style={{ color: 'var(--canvas-text-muted)' }}>
              <span className="flex items-center gap-2">
                <Users size={20} style={{ color: 'var(--canvas-accent)' }} aria-hidden="true" />
                {state.results.total} {t('participant', { count: state.results.total })}
              </span>
              <span className="flex items-center gap-2">
                <Lock size={20} style={{ color: 'var(--canvas-accent)' }} aria-hidden="true" />
                {t('anonymity') ?? 'Full anonymity'}
              </span>
            </div>
          </div>

          {/* ── Results: adaptive viz (CANVAS-ADAPTIVE-VIZ-01) ── */}
          <div className="absolute top-[460px] left-[64px] right-[600px] max-h-96 overflow-y-auto z-10">
            <AdaptiveVizResults
              options={ordered}
              total={state.results.total}
              questionKind={state.question?.kind}
              tallyHidden={!tallyVisible}
            />
          </div>

          {/* ── Join panel ── */}
          <div
            className="absolute right-[64px] top-[144px] w-[440px] p-9 rounded-[32px] shadow-elevated z-10"
            style={{ background: 'var(--canvas-surface)', border: '1px solid var(--canvas-border)' }}
          >
            <h3 className="text-[16px] font-bold tracking-[0.1em] uppercase mb-3" style={{ color: 'var(--canvas-accent)' }}>
              {t('joinThisSession')}
            </h3>
            {state.session && (
              <div className="font-mono text-[20px] font-medium mb-4" style={{ color: 'var(--canvas-text-muted)' }}>
                qesto.cc/join
              </div>
            )}
            {state.session && (
              <JoinCodeDisplay
                code={state.session.code}
                size="xl"
                className="mb-5 bg-gradient-brand bg-clip-text text-transparent"
              />
            )}
            {state.session && (
              <div
                className="w-full aspect-square rounded-[16px] p-3.5"
                style={{ background: 'var(--canvas-bg)', border: '1px solid var(--canvas-border)' }}
                aria-label="QR code to join session"
              >
                <QRCode
                  value={`${window.location.origin}/j/${state.session.code}`}
                  size={368}
                  style={{ display: 'block', width: '100%', height: 'auto' }}
                />
              </div>
            )}
            <div className="mt-5 text-[18px] text-center" style={{ color: 'var(--canvas-text-muted)' }}>
              <span
                className="font-[family-name:var(--canvas-font-display,var(--font-display))] font-bold text-[26px] tracking-[-0.01em]"
                style={{ color: 'var(--canvas-text)' }}
              >
                {state.participants}
              </span>{' '}
              {t('participant', { count: state.participants })} {t('connectedLabel')}
            </div>
          </div>

          {state.energizer?.leaderboard && state.energizer.leaderboard.length > 0 && (
            <div
              className="absolute right-[64px] top-[700px] w-[440px] p-7 rounded-[24px] shadow-elevated z-10"
              style={{ background: 'var(--canvas-surface)', border: '1px solid var(--canvas-border)' }}
            >
              <h3 className="text-[16px] font-bold tracking-[0.1em] uppercase text-orange-700 mb-4">
                {t('leaderboard.title')}
              </h3>
              <ol className="space-y-2">
                {state.energizer.leaderboard.slice(0, 5).map((entry) => (
                  <li
                    key={entry.voterId}
                    className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl px-4 py-3"
                    style={{ background: 'var(--canvas-bg)' }}
                  >
                    <span
                      className="font-[family-name:var(--canvas-font-display,var(--font-display))] font-bold text-[24px] tabular-nums"
                      style={{ color: 'var(--canvas-text)' }}
                    >
                      {entry.rank}
                    </span>
                    <span className="text-[18px] font-semibold truncate" style={{ color: 'var(--canvas-text)' }}>
                      {entry.label}
                    </span>
                    <span className="text-[18px] font-bold text-orange-600 tabular-nums">{entry.score}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* WS / close errors */}
          {state.error && (
            <p role="alert" className="absolute top-[1020px] left-[64px] text-sm text-red-600 z-10">
              {state.error}
            </p>
          )}

          {/* Live captions overlay — FE-CAPTIONS-OVERLAY-01 */}
          <CaptionsOverlay segments={captionsSegments} active={captionsActive} />

          {/* Live reactions overlay — FE-REACTIONS-RENDER-01 */}
          <ReactionsOverlay particles={reactionsParticles} total={reactionsTotal} active={reactionsTotal > 0} />

          {/* ── Bottom chrome (display only — controls are in presenter panel) ── */}
          <div
            className="absolute bottom-[36px] left-[64px] right-[64px] flex justify-between items-center pt-6 z-10 text-[18px] pointer-events-none"
            style={{ borderTop: '1px solid var(--canvas-border)', color: 'var(--canvas-text-muted)' }}
          >
            <div
              className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-full text-[16px] font-semibold"
              style={{
                background: 'color-mix(in srgb, var(--canvas-accent) 10%, transparent)',
                color: 'var(--canvas-accent)',
                border: '1px solid color-mix(in srgb, var(--canvas-accent) 30%, transparent)',
              }}
            >
              <Sparkles size={16} aria-hidden="true" />
              AI recap at session close · Workers AI on Cloudflare
            </div>
            <div className="flex items-center gap-2 font-medium" style={{ color: 'var(--canvas-text-muted)' }}>
              <Lock size={18} style={{ color: 'var(--canvas-accent)' }} aria-hidden="true" />
              Anonymity: Full
            </div>
          </div>
        </div>
        </div>
      </div>

      {/* ── Presenter control panel ───────────────────────────────────────── */}
      <PresenterControls
        id={id}
        isLive={isLive}
        isClosed={isClosed}
        closing={closing}
        closeError={closeError}
        allDone={state.allDone}
        questionIndex={state.questionIndex}
        questionKind={state.question?.kind}
        sessionCode={state.session?.code}
        hasSession={!!state.session}
        localPaused={localPaused}
        hideTally={hideTally}
        hideSentiment={hideSentiment}
        baseOptionsLength={baseOptions.length}
        minGate={minGate}
        timerInput={timerInput}
        timer={timer}
        copied={copied}
        onBack={onBack}
        onAdvance={onAdvance}
        onClose={onClose}
        onTogglePause={onTogglePause}
        onToggleHideTally={onToggleHideTally}
        onToggleHideSentiment={onToggleHideSentiment}
        onShuffle={onShuffle}
        onMinGateChange={onMinGateChange}
        onTimerInputChange={onTimerInputChange}
        onStartTimer={onStartTimer}
        onCopyDisplayLink={onCopyDisplayLink}
        captionsActive={captionsActive}
        captionsPlanGated={captionsPlanGated}
        onToggleCaptions={onToggleCaptions}
        captionLocale={captionLocale}
        onCaptionLocaleChange={onCaptionLocaleChange}
      />
    </div>
  )
}
