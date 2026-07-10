import { useEffect, useMemo, useReducer, useRef, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { Users } from 'lucide-react'
import { api } from '../api/client'
import { useLiveSession } from '../hooks/useLiveSession'
import { useT } from '../i18n'
import { CanvasThemeProvider } from '../components/CanvasThemeProvider'
import { useCanvasTheme } from '../hooks/useCanvasTheme'
import { AdaptiveVizResults } from '../components/AdaptiveVizResults'
import { CaptionsOverlay } from '../components/CaptionsOverlay'
import { ReactionsOverlay, useReactionsTicker } from '../components/ReactionsOverlay'
import { captionsReducer, CAPTIONS_INITIAL } from '../hooks/useCaptions'
import { reactionsReducer, REACTIONS_INITIAL } from '../hooks/useReactions'

type Lookup =
  | { status: 'loading' }
  | { status: 'ready'; sessionId: string; title: string }
  | { status: 'error'; message: string }

export default function Display() {
  const { code } = useParams<{ code: string }>()
  const [lookup, setLookup] = useState<Lookup>({ status: 'loading' })

  useEffect(() => {
    if (!code) return
    let cancelled = false
    ;(async () => {
      const res = await api<{ id: string; title: string; code: string }>(
        `/api/sessions/by-code/${encodeURIComponent(code.toUpperCase())}`,
      )
      if (cancelled) return
      if (res.ok) setLookup({ status: 'ready', sessionId: res.data.id, title: res.data.title })
      else setLookup({ status: 'error', message: res.error.message })
    })()
    return () => {
      cancelled = true
    }
  }, [code])

  if (lookup.status === 'loading') return <LoadingScreen />
  if (lookup.status === 'error') return <ErrorScreen message={lookup.message} />
  return (
    <CanvasThemeProvider>
      <LiveDisplay sessionId={lookup.sessionId} code={code ?? ''} />
    </CanvasThemeProvider>
  )
}

function LoadingScreen() {
  return (
    <div className="fixed inset-0 bg-[#0f1117] flex items-center justify-center">
      <svg aria-hidden="true" className="animate-spin w-12 h-12 text-teal-500" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  )
}

function ErrorScreen({ message }: { message: string }) {
  const t = useT('present')

  return (
    <div className="fixed inset-0 bg-[#0f1117] flex flex-col items-center justify-center gap-3 text-center p-12">
      <p className="text-xl font-semibold text-white">{t('sessionNotFound')}</p>
      <p className="text-sm text-white/50">{message}</p>
    </div>
  )
}

function LiveDisplay({ sessionId, code }: { sessionId: string; code: string }) {
  const [captionsState, captionsDispatch] = useReducer(captionsReducer, CAPTIONS_INITIAL)
  const [reactionsState, reactionsDispatch] = useReducer(reactionsReducer, REACTIONS_INITIAL)
  const captionsActiveRef = useRef(false)
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

  const { state } = useLiveSession(sessionId, {
    onCaptionSegment: (seg) => {
      // Auto-activate the overlay on the first received segment (the presenter
      // started captions server-side; the display just receives the segments).
      if (!captionsActiveRef.current) {
        captionsActiveRef.current = true
        captionsDispatch({ kind: 'start' })
      }
      captionsDispatch({ kind: 'segment', segment: seg })
    },
    onReactionDelta,
  })
  const t = useT('present')
  const { theme } = useCanvasTheme()

  const options = state.question?.options ?? []
  const ordered = useMemo(
    () => options.map((o) => ({ ...o, count: state.results.counts[o.id] ?? 0 })),
    [options, state.results.counts],
  )
  const isEnded = state.session?.status === 'closed' || state.connection === 'closed'

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden"
      data-canvas-theme={theme}
      style={{
        background: 'var(--canvas-bg)',
        color: 'var(--canvas-text)',
        fontFamily: 'var(--canvas-font-body)',
        lineHeight: 'var(--canvas-line-height, 1.6)',
        letterSpacing: 'var(--canvas-letter-spacing, 0em)',
      }}
    >
      {/* Top accent bar */}
      <div className="absolute top-0 left-0 right-0 h-1" style={{ background: 'var(--gradient-brand)' }} />

      {/* Header */}
      <div className="flex items-center justify-between px-12 pt-7 pb-2 shrink-0">
        <div
          className="flex items-center gap-2.5 font-[family-name:var(--canvas-font-display,var(--font-display))] font-bold text-xl"
          style={{ color: 'var(--canvas-text)' }}
        >
          <img src="/favicon.svg" alt="" width={26} height={26} />
          {state.session?.title ?? 'Qesto'}
        </div>
        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--canvas-text-muted)' }}>
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{
              background: state.connection === 'open'
                ? 'var(--canvas-accent)'
                : 'color-mix(in srgb, var(--canvas-text-muted) 40%, transparent)',
              ...(state.connection === 'open' ? { animation: 'pulse 1.8s infinite' } : {}),
            }}
            aria-hidden="true"
          />
          {state.connection === 'open'
            ? t('live')
            : state.connection === 'connecting'
            ? t('connection.connecting')
            : state.connection === 'reconnecting'
            ? t('connection.reconnecting')
            : state.connection === 'failed'
            ? t('connection.failed')
            : t('connection.closed')}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-12 pb-8 pt-4 flex flex-col overflow-hidden">
        {state.allDone && !isEnded ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
            <div className="text-7xl" aria-hidden="true">🎉</div>
            <p className="text-4xl font-bold" style={{ color: 'var(--canvas-text)' }}>
              {t('allDone.heading')}
            </p>
            <p className="text-lg" style={{ color: 'var(--canvas-text-muted)' }}>
              {state.session?.title}
            </p>
          </div>
        ) : isEnded ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
            <p className="text-3xl font-bold" style={{ color: 'var(--canvas-text)' }}>
              {t('sessionEndedTitle')}
            </p>
            <p style={{ color: 'var(--canvas-text-muted)' }}>{t('sessionEndedBody')}</p>
          </div>
        ) : !state.question ? (
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="flex items-center gap-2.5 text-base" style={{ color: 'var(--canvas-text-muted)' }}>
              <span
                className="w-2 h-2 rounded-full animate-pulse"
                style={{ background: 'var(--canvas-accent)' }}
                aria-hidden="true"
              />
              {t('waitingForQuestion')}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col gap-12 overflow-hidden">
            {/* Question prompt */}
            <div className="shrink-0">
              <p
                className="text-xs font-bold tracking-[0.14em] uppercase mb-3"
                style={{ color: 'var(--canvas-accent)' }}
              >
                {t('questionLabel')}
              </p>
              <h1
                className="font-[family-name:var(--canvas-font-display,var(--font-display))] font-bold text-4xl [text-wrap:balance]"
                style={{ color: 'var(--canvas-text)', lineHeight: 'var(--canvas-line-height, 1.6)' }}
              >
                {state.question.prompt}
              </h1>
              <div
                className="mt-3 flex items-center gap-1.5 text-sm"
                style={{ color: 'var(--canvas-text-muted)' }}
              >
                <Users size={13} style={{ color: 'var(--canvas-accent)' }} aria-hidden="true" />
                <span aria-live="polite" aria-atomic="true">
                  {state.results.total} {t('vote', { count: state.results.total })}
                </span>
              </div>
            </div>

            {/* Results — adaptive viz (CANVAS-ADAPTIVE-VIZ-01) */}
            <div className="flex-1 overflow-y-auto">
              <AdaptiveVizResults
                options={ordered}
                total={state.results.total}
                questionKind={state.question.kind}
                tallyHidden={false}
              />
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        className="shrink-0 px-12 py-4 flex items-center justify-between text-xs border-t"
        style={{ borderColor: 'var(--canvas-border)', color: 'var(--canvas-text-muted)' }}
      >
        <span>qesto.cc/j/{state.session?.code ?? code}</span>
        <span
          className="font-[family-name:var(--canvas-font-display,var(--font-display))] font-semibold"
        >
          Qesto
        </span>
      </div>

      {/* Live captions overlay — FE-CAPTIONS-OVERLAY-01 */}
      <CaptionsOverlay segments={captionsState.segments} active={captionsState.active} />

      {/* Live reactions overlay — FE-REACTIONS-RENDER-01 */}
      <ReactionsOverlay
        particles={reactionsState.particles}
        total={reactionsState.total}
        active={reactionsState.total > 0}
      />
    </div>
  )
}
