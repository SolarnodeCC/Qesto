import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import QRCode from 'react-qr-code'
import { Lock, Pause, Sparkles, Users } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useLiveSession, type LivePollOption } from '../hooks/useLiveSession'
import { useT } from '../i18n'
import { CopilotPanel } from '../components/CopilotPanel'
import { api, getAuthToken } from '../api/client'
import { hashWordColor, getWordFontSize, getTopWords } from './present/wordcloud'
import { useSoftTimer } from './present/useSoftTimer'
import { PresenterControls } from './present/PresenterControls'

export default function Present() {
  const auth = useAuth()
  const t = useT('present')
  const { id } = useParams<{ id: string }>()
  const presenterToken = getAuthToken()
  const { state, sendAdvance, sendBack, sendPause, sendResume, sendAddQuestion, sendEnergizerActivate } = useLiveSession(
    id,
    presenterToken ? { enabled: !!id, presenterToken } : { enabled: !!id },
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
  const max = ordered.reduce((m, o) => Math.max(m, o.count), 0)
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

  const fills = [
    'linear-gradient(135deg,#14B8A6,#0D9488)',
    'linear-gradient(135deg,#2DD4BF,#14B8A6)',
    'linear-gradient(135deg,#A78BFA,#8B5CF6)',
    'linear-gradient(135deg,#C4B5FD,#A78BFA)',
  ]

  return (
    <div className="fixed inset-0 flex flex-col bg-pulse-950 animate-page-enter">
      {/* COPILOT-05 — presenter-only live facilitator copilot (ADR-0046) */}
      <CopilotPanel sessionId={id} enabled={state.role === 'presenter' && isLive} onAddQuestion={sendAddQuestion} />
      {/* ── 1920×1080 letterboxed stage ────────────────────────────────────── */}
      <div ref={containerRef} className="flex-1 min-h-0 overflow-hidden flex items-center justify-center">
        <div style={{ width: scale * 1920, height: scale * 1080, flexShrink: 0 }}>
        <div
          ref={stageRef}
          className="w-[1920px] h-[1080px] origin-top-left relative bg-white overflow-hidden"
          id="main"
          data-theme="light"
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
          <div className="absolute top-0 left-0 right-0 h-1.5" style={{ background: 'var(--gradient-brand)' }} />

          {/* All done overlay */}
          {state.allDone && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center" style={{ background: 'var(--gradient-brand)' }}>
              <div className="text-[120px] mb-6" aria-hidden="true">🎉</div>
              <h2 className="font-[family-name:var(--font-display)] font-bold text-[80px] leading-[1.1] tracking-[-0.02em] text-white text-center [text-wrap:balance]">
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
              {showSentiment && state.sentiment && (
                <>
                  <span className="w-px h-5 bg-pulse-200" />
                  <span
                    className="flex items-center gap-2 rounded-full px-4 py-1 text-[16px] font-semibold bg-violet-50 text-violet-800"
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

          {/* ── Results: bars, wordcloud, or open text ── */}
          {state.question?.kind === 'word_cloud' || state.question?.kind === 'open' ? (
            <div className="absolute top-[460px] left-[64px] right-[600px] max-h-96 flex flex-col z-10">
              {tallyVisible ? (
                Object.entries(state.results.counts).length > 0 ? (
                  <>
                    <div className="flex-1 flex flex-wrap gap-x-4 gap-y-2 items-baseline justify-start py-6 overflow-y-auto">
                      {(() => {
                        const topWords = getTopWords(state.results.counts, 25)
                        const maxCount = Math.max(...topWords.map(w => w[1]), 1)
                        return topWords.map(([word, count]) => (
                          <span
                            key={word}
                            style={{ fontSize: `${getWordFontSize(count, maxCount)}px` }}
                            className={`font-bold leading-tight transition-all duration-500 shrink-0 ${hashWordColor(word)}`}
                            title={`${word}: ${count}`}
                            aria-label={`${word}, ${count} submission${count !== 1 ? 's' : ''}`}
                          >
                            {word}
                          </span>
                        ))
                      })()}
                    </div>
                    {Object.entries(state.results.counts).length > 25 && (
                      <p className="text-xs text-pulse-400 text-right pr-2 pb-2">
                        Showing top 25 of {Object.entries(state.results.counts).length} unique responses
                      </p>
                    )}
                  </>
                ) : (
                  <div className="w-full h-24 flex items-center justify-center">
                    <p className="text-[24px] text-pulse-400 animate-pulse">Waiting for responses…</p>
                  </div>
                )
              ) : (
                <div className="w-full h-24 flex items-center justify-center">
                  <p className="text-[24px] text-pulse-400">{t('tallyHidden')}</p>
                </div>
              )}
            </div>
          ) : (
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
          )}

          {/* ── Join panel ── */}
          <div className="absolute right-[64px] top-[144px] w-[440px] p-9 bg-white border border-pulse-200 rounded-[32px] shadow-elevated z-10">
            <h3 className="text-[16px] font-bold tracking-[0.1em] uppercase text-teal-700 mb-3">{t('joinThisSession')}</h3>
            {state.session && <div className="font-mono text-[20px] font-medium text-pulse-600 mb-4">qesto.cc/join</div>}
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

          {state.energizer?.leaderboard && state.energizer.leaderboard.length > 0 && (
            <div className="absolute right-[64px] top-[700px] w-[440px] p-7 bg-white border border-pulse-200 rounded-[24px] shadow-elevated z-10">
              <h3 className="text-[16px] font-bold tracking-[0.1em] uppercase text-orange-700 mb-4">{t('leaderboard.title')}</h3>
              <ol className="space-y-2">
                {state.energizer.leaderboard.slice(0, 5).map((entry) => (
                  <li key={entry.voterId} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl bg-pulse-50 px-4 py-3">
                    <span className="font-[family-name:var(--font-display)] font-bold text-[24px] text-pulse-900 tabular-nums">{entry.rank}</span>
                    <span className="text-[18px] font-semibold text-pulse-800 truncate">{entry.label}</span>
                    <span className="text-[18px] font-bold text-orange-600 tabular-nums">{entry.score}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* WS / close errors */}
          {state.error && (
            <p role="alert" className="absolute top-[1020px] left-[64px] text-sm text-red-600 z-10">{state.error}</p>
          )}

          {/* ── Bottom chrome (display only — controls are in presenter panel) ── */}
          <div className="absolute bottom-[36px] left-[64px] right-[64px] flex justify-between items-center border-t border-pulse-200 pt-6 z-10 text-[18px] text-pulse-600 pointer-events-none">
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
      />
    </div>
  )
}
