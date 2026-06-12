/**
 * EmbedWidget — the Qesto-hosted page rendered inside the sandboxed iframe.
 * Route: /embed/widget  (loaded by the qesto-embed.js SDK loader)
 *
 * Security contract (ADR-0050 §3b, §3c):
 * - Runs in a sandboxed iframe WITHOUT allow-same-origin; has no host DOM access.
 * - Speaks the widget side of the postMessage protocol; validates event.origin on
 *   every inbound message against the `origin` query-param (the host origin).
 * - Displays AGGREGATE-ONLY results — never per-participant identity.
 * - Sends resize events when content height changes so the host can auto-adjust.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { HostToEmbedMessage, EmbedToHostMessage } from '@api/types'
import { useT } from '../i18n'

// ── API response shapes (aggregate-only, no PII) ──────────────────────────────

type HandshakeResponse = {
  participant_token: string
  session: {
    code: string
    status: string
    title: string
    anonymity_mode?: string
  }
  branding?: {
    primaryColor?: string
    logoUrl?: string | null
  }
}

type SessionState = {
  status: string
  active_question: {
    id: string
    kind: string
    prompt: string
    options: Array<{ id: string; label: string }>
  } | null
  response_count: number
  participation_rate?: number
}

type SessionResults = {
  question_id: string
  counts_by_option: Record<string, number>
  total: number
}

type WidgetPhase =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'waiting'; title: string; code: string }
  | { kind: 'live'; title: string; code: string; state: SessionState; results: SessionResults | null }
  | { kind: 'closed'; title: string }

// ── Widget API client (no auth cookie — uses Bearer widget token) ─────────────

async function widgetFetch<T>(
  path: string,
  token: string,
  opts: { method?: string; signal?: AbortSignal } = {},
): Promise<{ ok: true; data: T } | { ok: false; status: number; message: string }> {
  try {
    const res = await fetch(`/api/embed/v1${path}`, {
      method: opts.method ?? 'GET',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      signal: opts.signal ?? null,
    })
    const json = await res.json() as { ok?: boolean; data?: T; error?: { message?: string } }
    if (res.ok && json?.ok) return { ok: true, data: json.data as T }
    return { ok: false, status: res.status, message: json?.error?.message ?? `HTTP ${res.status}` }
  } catch (err) {
    if ((err as Error).name === 'AbortError') return { ok: false, status: 0, message: 'aborted' }
    return { ok: false, status: 0, message: (err as Error).message ?? 'Network error' }
  }
}

// ── Polling intervals ─────────────────────────────────────────────────────────
const POLL_STATE_MS = 3000
const POLL_RESULTS_MS = 4000

// ── Resize observer utility ───────────────────────────────────────────────────
function useResizeNotify(containerRef: React.RefObject<HTMLElement | null>, send: (msg: EmbedToHostMessage) => void) {
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    let lastH = 0
    function notify() {
      const h = el!.scrollHeight
      if (h !== lastH && h > 0) {
        lastH = h
        send({ source: 'qesto-embed', v: 1, type: 'resize', height: h })
      }
    }
    const ro = new ResizeObserver(notify)
    ro.observe(el)
    notify()
    return () => ro.disconnect()
  })
}

// ── Main component ────────────────────────────────────────────────────────────

export default function EmbedWidget() {
  const [searchParams] = useSearchParams()
  const t = useT('embed')

  const sessionParam = searchParams.get('session') ?? ''
  const tokenParam = searchParams.get('token') ?? ''
  const hostOriginParam = searchParams.get('origin') ?? ''
  const themeParam = (searchParams.get('theme') ?? 'light') as 'light' | 'dark'

  const [phase, setPhase] = useState<WidgetPhase>({ kind: 'loading' })
  const [theme, setTheme] = useState<'light' | 'dark'>(themeParam)
  const [hostReady, setHostReady] = useState(false)
  const [participantToken, setParticipantToken] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // ── postMessage send helper ─────────────────────────────────────────────────
  const send = useCallback((msg: EmbedToHostMessage) => {
    // Send to parent; targetOrigin is the host origin the widget was loaded for.
    // When running in sandbox without allow-same-origin, parent === window.parent.
    const targetOrigin = hostOriginParam || '*'
    try {
      window.parent.postMessage(msg, targetOrigin)
    } catch (_) {
      // sandbox may deny postMessage in some edge cases; swallow silently.
    }
  }, [hostOriginParam])

  // ── postMessage receive handler ─────────────────────────────────────────────
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      // ADR-0050 §3c: validate origin against the registered host origin.
      if (hostOriginParam && event.origin !== hostOriginParam) return
      const msg = event.data as HostToEmbedMessage
      if (!msg || msg.source !== 'qesto-embed' || msg.v !== 1) return
      if (msg.type === 'host_ready') {
        setHostReady(true)
      } else if (msg.type === 'config' && msg.theme) {
        setTheme(msg.theme)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [hostOriginParam])

  // ── Handshake on mount ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionParam || !tokenParam) {
      setPhase({ kind: 'error', message: 'Missing session or token.' })
      return
    }
    let cancelled = false
    const ac = new AbortController()
    ;(async () => {
      const res = await widgetFetch<HandshakeResponse>('/handshake', tokenParam, {
        method: 'POST',
        signal: ac.signal,
      })
      if (cancelled) return
      if (!res.ok) {
        setPhase({ kind: 'error', message: res.message })
        return
      }
      setParticipantToken(res.data.participant_token)
      const s = res.data.session
      if (s.status === 'live') {
        setPhase({ kind: 'live', title: s.title, code: s.code, state: { status: 'live', active_question: null, response_count: 0 }, results: null })
      } else if (s.status === 'closed') {
        setPhase({ kind: 'closed', title: s.title })
      } else {
        setPhase({ kind: 'waiting', title: s.title, code: s.code })
      }
    })()
    return () => { cancelled = true; ac.abort() }
  }, [sessionParam, tokenParam])

  // ── Announce 'ready' once handshake done and host_ready received ────────────
  useEffect(() => {
    if (phase.kind !== 'loading' && phase.kind !== 'error') {
      // Send ready as soon as the widget is mounted; host will respond with host_ready.
      send({ source: 'qesto-embed', v: 1, type: 'ready' })
    }
  }, [phase.kind, send])

  // ── Poll state + results when live ─────────────────────────────────────────
  useEffect(() => {
    if (phase.kind !== 'live') return
    let cancelled = false

    async function pollState() {
      const res = await widgetFetch<SessionState>(`/sessions/${encodeURIComponent(sessionParam)}/state`, tokenParam)
      if (cancelled || !res.ok) return
      const s = res.data
      if (s.status === 'closed') {
        const title = phase.kind === 'live' ? phase.title : ''
        setPhase({ kind: 'closed', title })
        send({ source: 'qesto-embed', v: 1, type: 'event', event: 'session_closed', payload: { code: sessionParam } })
        return
      }
      setPhase((prev) => {
        if (prev.kind !== 'live') return prev
        const prev_qid = prev.state.active_question?.id
        const new_qid = s.active_question?.id
        if (prev_qid !== new_qid && new_qid) {
          send({ source: 'qesto-embed', v: 1, type: 'event', event: 'results_updated', payload: { questionId: new_qid } })
        }
        return { ...prev, state: s }
      })
    }

    async function pollResults() {
      const res = await widgetFetch<SessionResults>(`/sessions/${encodeURIComponent(sessionParam)}/results`, tokenParam)
      if (cancelled || !res.ok) return
      setPhase((prev) => {
        if (prev.kind !== 'live') return prev
        return { ...prev, results: res.data }
      })
    }

    const stateId = setInterval(() => { void pollState() }, POLL_STATE_MS)
    const resultsId = setInterval(() => { void pollResults() }, POLL_RESULTS_MS)
    void pollState()
    void pollResults()

    return () => {
      cancelled = true
      clearInterval(stateId)
      clearInterval(resultsId)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase.kind, sessionParam, tokenParam, send])

  // Suppress unused var lint; participantToken is reserved for future write scope.
  void participantToken
  void hostReady

  // ── Auto-resize ─────────────────────────────────────────────────────────────
  useResizeNotify(containerRef, send)

  // ── Theme class ─────────────────────────────────────────────────────────────
  const isDark = theme === 'dark'
  const bg = isDark ? 'bg-[#0F1628] text-[#F0F2F8]' : 'bg-white text-[#1A2035]'
  const border = isDark ? 'border-[#1E2A45]' : 'border-[#E2E8F0]'
  const muted = isDark ? 'text-[#6B7A99]' : 'text-slate-500'
  const card = isDark ? 'bg-[#151C2E] border-[#1E2A45]' : 'bg-slate-50 border-slate-200'

  // ── Render helpers ──────────────────────────────────────────────────────────
  function renderLoading() {
    return (
      <div className="flex items-center justify-center min-h-[160px]" role="status" aria-live="polite" aria-label={t('widgetLoading')}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-teal-500 border-t-transparent animate-spin" aria-hidden="true" />
          <span className={`text-sm ${muted}`}>{t('widgetLoading')}</span>
        </div>
      </div>
    )
  }

  function renderError(msg: string) {
    return (
      <div className="flex items-center justify-center min-h-[120px] px-4" role="alert">
        <p className="text-sm text-red-500 text-center">{msg}</p>
      </div>
    )
  }

  function renderWaiting(title: string) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-10 px-4" aria-live="polite">
        <div className="w-10 h-10 rounded-full border-2 border-teal-400 border-t-transparent animate-spin" aria-hidden="true" />
        <div className="text-center">
          <p className="font-semibold text-base">{title}</p>
          <p className={`text-sm mt-1 ${muted}`}>{t('waitingForSession')}</p>
        </div>
      </div>
    )
  }

  function renderClosed(title: string) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-10 px-4 text-center" role="status" aria-live="polite">
        <svg aria-hidden="true" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-teal-500">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="font-semibold text-base">{title}</p>
        <p className={`text-sm ${muted}`}>{t('sessionClosed')}</p>
        <p className={`text-xs ${muted}`}>{t('sessionClosedSubtext')}</p>
      </div>
    )
  }

  function renderLive(title: string, state: SessionState, results: SessionResults | null) {
    const q = state.active_question
    return (
      <section aria-label={title}>
        {/* Session header */}
        <div className={`px-4 py-3 border-b ${border}`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-500">Live</p>
          <p className="font-semibold text-sm mt-0.5 truncate">{title}</p>
        </div>

        {/* Active question */}
        {q ? (
          <div className="px-4 py-4">
            <p className="font-medium text-sm leading-snug mb-4">{q.prompt}</p>

            {/* Result bars — aggregate only, no voter identity */}
            <div
              role="list"
              aria-label={t('liveResults')}
              aria-live="polite"
              aria-atomic="false"
              className="space-y-2"
            >
              {q.options.map((opt) => {
                const count = results?.counts_by_option[opt.id] ?? 0
                const total = results?.total ?? 0
                const pct = total > 0 ? Math.round((count / total) * 100) : 0
                return (
                  <div key={opt.id} role="listitem" className={`rounded-lg border ${card} overflow-hidden`}>
                    <div className="flex items-center justify-between px-3 py-2 text-sm">
                      <span className="truncate pr-2">{opt.label}</span>
                      <span className={`shrink-0 text-xs font-medium ${muted}`}>{pct}%</span>
                    </div>
                    {total > 0 && (
                      <div className="h-1 bg-teal-500 transition-all duration-500" style={{ width: `${pct}%` }} aria-hidden="true" />
                    )}
                  </div>
                )
              })}
            </div>

            {/* Response count — aggregate, no individual data */}
            <p className={`mt-3 text-xs ${muted}`} aria-live="polite">
              {t('responseCount_other', { count: state.response_count })}
            </p>
            <p className={`mt-1 text-xs ${muted}`}>{t('aggregateNotice')}</p>
          </div>
        ) : (
          <div className="px-4 py-8 text-center">
            <p className={`text-sm ${muted}`}>{t('waitingForSession')}</p>
          </div>
        )}
      </section>
    )
  }

  // ── Main render ─────────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className={`min-h-[160px] rounded-lg font-sans text-sm ${bg} border ${border} overflow-hidden`}
      data-testid="embed-widget"
    >
      {phase.kind === 'loading' && renderLoading()}
      {phase.kind === 'error' && renderError(phase.message)}
      {phase.kind === 'waiting' && renderWaiting(phase.title)}
      {phase.kind === 'closed' && renderClosed(phase.title)}
      {phase.kind === 'live' && renderLive(phase.title, phase.state, phase.results)}
    </div>
  )
}
