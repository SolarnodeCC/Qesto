import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Users } from 'lucide-react'
import { api } from '../api/client'
import { useLiveSession } from '../hooks/useLiveSession'

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
  return <LiveDisplay sessionId={lookup.sessionId} code={code ?? ''} />
}

function LoadingScreen() {
  return (
    <div className="fixed inset-0 bg-[#0f1117] flex items-center justify-center">
      <svg aria-hidden="true" className="animate-spin w-8 h-8 text-teal-500" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  )
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="fixed inset-0 bg-[#0f1117] flex flex-col items-center justify-center gap-3 text-center p-8">
      <p className="text-xl font-semibold text-white">Session not found</p>
      <p className="text-sm text-white/50">{message}</p>
    </div>
  )
}

const FILLS = [
  'linear-gradient(135deg,#14B8A6,#0D9488)',
  'linear-gradient(135deg,#2DD4BF,#14B8A6)',
  'linear-gradient(135deg,#A78BFA,#8B5CF6)',
  'linear-gradient(135deg,#C4B5FD,#A78BFA)',
]

function LiveDisplay({ sessionId, code }: { sessionId: string; code: string }) {
  const { state } = useLiveSession(sessionId)

  const options = state.question?.options ?? []
  const ordered = useMemo(
    () => options.map((o) => ({ ...o, count: state.results.counts[o.id] ?? 0 })),
    [options, state.results.counts],
  )
  const max = ordered.reduce((m, o) => Math.max(m, o.count), 0)
  const isEnded = state.session?.status === 'closed' || state.connection === 'closed'

  return (
    <div className="fixed inset-0 bg-[#0f1117] flex flex-col overflow-hidden">
      {/* Top accent bar */}
      <div className="absolute top-0 left-0 right-0 h-1" style={{ background: 'var(--gradient-brand)' }} />

      {/* Header */}
      <div className="flex items-center justify-between px-8 pt-7 pb-2 shrink-0">
        <div className="flex items-center gap-2.5 font-[family-name:var(--font-display)] font-bold text-xl text-white">
          <img src="/favicon.svg" alt="" width={26} height={26} />
          {state.session?.title ?? 'Qesto'}
        </div>
        <div className="flex items-center gap-2 text-sm text-white/40">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${state.connection === 'open' ? 'bg-teal-400' : 'bg-white/20'}`}
            style={state.connection === 'open' ? { animation: 'pulse 1.8s infinite' } : undefined}
          />
          {state.connection === 'open' ? 'Live' : state.connection}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-8 pb-6 pt-4 flex flex-col overflow-hidden">
        {state.allDone && !isEnded ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
            <div className="text-7xl" aria-hidden="true">🎉</div>
            <p className="text-4xl font-bold text-white">Bedankt voor jullie input!</p>
            <p className="text-white/50 text-lg">{state.session?.title}</p>
          </div>
        ) : isEnded ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
            <p className="text-3xl font-bold text-white">Session ended</p>
            <p className="text-white/50">Thanks for participating!</p>
          </div>
        ) : !state.question ? (
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="flex items-center gap-2.5 text-white/40 text-base">
              <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
              Waiting for question…
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col gap-8 overflow-hidden">
            {/* Question prompt */}
            <div className="shrink-0">
              <p className="text-xs font-bold tracking-[0.14em] uppercase text-teal-400 mb-3">Question</p>
              <h1 className="font-[family-name:var(--font-display)] font-bold text-4xl leading-tight text-white [text-wrap:balance]">
                {state.question.prompt}
              </h1>
              <div className="mt-3 flex items-center gap-1.5 text-sm text-white/40">
                <Users size={13} className="text-teal-500" aria-hidden="true" />
                {state.results.total} {state.results.total === 1 ? 'vote' : 'votes'}
              </div>
            </div>

            {/* Results bars */}
            <div className="flex flex-col gap-5 overflow-y-auto" aria-live="polite">
              {ordered.map((o, i) => {
                const pct = max === 0 ? 0 : Math.round((o.count / max) * 100)
                return (
                  <div key={o.id} className="space-y-2">
                    <div className="flex items-baseline justify-between gap-4">
                      <span className="text-xl font-semibold text-white leading-snug">{o.label}</span>
                      <span className="font-[family-name:var(--font-display)] font-bold text-3xl text-white tabular-nums shrink-0">
                        {pct}%
                      </span>
                    </div>
                    <div
                      role="img"
                      aria-label={`${o.label}: ${pct}%`}
                      className="h-4 rounded-full overflow-hidden"
                      style={{ background: 'rgba(255,255,255,0.08)' }}
                    >
                      <div
                        className="h-full rounded-full transition-[width] duration-[600ms]"
                        style={{ width: `${pct}%`, background: FILLS[i % FILLS.length] }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        className="shrink-0 px-8 py-4 flex items-center justify-between text-xs border-t"
        style={{ borderColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.25)' }}
      >
        <span>qesto.app/j/{state.session?.code ?? code}</span>
        <span className="font-[family-name:var(--font-display)] font-semibold">Qesto</span>
      </div>
    </div>
  )
}
