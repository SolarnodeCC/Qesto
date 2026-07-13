// REV-27 — cross-session similarity surfaced on the Results page.
//
// Data source: GET /api/sessions/:id/insights (themes endpoint) whose payload
// carries `similar_sessions` — team-filtered Vectorize matches populated by
// POST /insights/analyze for team sessions on a plan with crossSessionInsights.
// Plan gating is detected from the 403, same convention as useInsights.
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import { useT } from '../../i18n'

export type SimilarSession = { title: string; score: number }

type PanelState =
  | { status: 'loading' }
  | { status: 'hidden' } // governance block (consent/ZK) or hard error — render nothing
  | { status: 'plan_gated' }
  | { status: 'ready'; similar: SimilarSession[] }
  | { status: 'generating'; similar: SimilarSession[] }

type InsightsGetData = { similar_sessions?: SimilarSession[] }
type AnalyzeData = { similar_sessions?: SimilarSession[] }

export default function SimilarSessionsResultsPanel({ sessionId }: { sessionId: string }) {
  const t = useT('results')
  const [state, setState] = useState<PanelState>({ status: 'loading' })
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await api<InsightsGetData>(`/api/sessions/${encodeURIComponent(sessionId)}/insights`)
    if (!res.ok) {
      if (res.status === 403 && res.error.code !== 'consent_required' && res.error.code !== 'zk_not_supported') {
        setState({ status: 'plan_gated' })
      } else {
        setState({ status: 'hidden' })
      }
      return
    }
    setState({ status: 'ready', similar: res.data.similar_sessions ?? [] })
  }, [sessionId])

  useEffect(() => {
    void load()
  }, [load])

  async function handleGenerate() {
    if (state.status !== 'ready') return
    setError(null)
    setState({ status: 'generating', similar: state.similar })
    const res = await api<AnalyzeData>(
      `/api/sessions/${encodeURIComponent(sessionId)}/insights/analyze`,
      { method: 'POST' },
    )
    if (!res.ok) {
      if (res.status === 403 && res.error.code !== 'consent_required' && res.error.code !== 'zk_not_supported') {
        setState({ status: 'plan_gated' })
      } else {
        setError(t('similarSessions.error'))
        setState({ status: 'ready', similar: state.similar })
      }
      return
    }
    setState({ status: 'ready', similar: res.data.similar_sessions ?? [] })
  }

  if (state.status === 'loading' || state.status === 'hidden') return null

  if (state.status === 'plan_gated') {
    return (
      <section
        aria-label={t('similarSessions.title')}
        className="rounded-lg border border-violet-200 bg-violet-50 dark:bg-violet-900/20 dark:border-violet-700 p-6 space-y-3"
      >
        <p className="text-sm text-violet-800 dark:text-violet-300 font-medium">
          {t('similarSessions.planRequired')}
        </p>
        <p className="text-sm text-violet-700 dark:text-violet-400">{t('similarSessions.planHint')}</p>
        <Link
          to="/pricing"
          className="inline-flex items-center gap-1.5 rounded-md bg-violet-600 text-white px-4 py-2 text-sm font-medium hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
        >
          {t('similarSessions.viewPlans')}
        </Link>
      </section>
    )
  }

  const { similar } = state
  const generating = state.status === 'generating'

  return (
    <section
      aria-label={t('similarSessions.title')}
      className="rounded-xl border border-pulse-200 dark:border-[#2A3858] p-6 space-y-3"
    >
      <h2 className="text-lg font-semibold dark:text-pulse-100">{t('similarSessions.title')}</h2>
      {similar.length > 0 ? (
        <>
          <p className="text-sm text-pulse-500">
            {t('similarSessions.description', { count: similar.length })}
          </p>
          <ul className="space-y-2">
            {similar.map((s) => (
              <li key={s.title} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-pulse-700 dark:text-[#A8B3CC] truncate">{s.title}</span>
                <span className="shrink-0 rounded-full bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 px-2 py-0.5 text-xs font-medium">
                  {t('similarSessions.match', { percent: Math.round(s.score * 100) })}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <p className="text-sm text-pulse-500">{t('similarSessions.empty')}</p>
          <button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={generating}
            className="inline-flex items-center rounded-lg border border-pulse-300 dark:border-[#2A3858] text-pulse-700 dark:text-[#A8B3CC] hover:border-teal-500 hover:text-teal-700 dark:hover:border-teal-600 dark:hover:text-teal-400 px-4 py-2 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 btn-motion"
          >
            {generating ? t('generatingInsights') : t('generateInsights')}
          </button>
        </>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </section>
  )
}
