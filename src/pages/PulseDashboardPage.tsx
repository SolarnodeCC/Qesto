import { useEffect, useMemo, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { Activity, EyeOff, HeartPulse, Users } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useT } from '../i18n'
import { api } from '../api/client'
import MainLayout from '../layouts/MainLayout'
import { MetricCard } from '../components/MetricCard'
import TrendSpark from '../components/TrendSpark'

type PulseSeriesRow = {
  day: string
  participationAvg: number
  sentimentAvg: number | null
  sessionCount: number
  responseTotal: number
  masked: boolean
  computedAt: number
}

type PulseSummary = {
  teamId: string
  window: string
  series: PulseSeriesRow[]
  computedAt: number | null
}

type PulseTrends = {
  teamId: string
  window: string
  sessionCount: number
  participationArc: number[]
  sentimentArc: (number | null)[]
  sessions: Array<{ sessionId: string; masked: boolean; participationRate: number }>
}

export default function PulseDashboardPage() {
  const { id: teamId } = useParams<{ id: string }>()
  const auth = useAuth()
  const t = useT('pulse')
  const [window, setWindow] = useState<'30d' | '90d'>('30d')
  const [summary, setSummary] = useState<PulseSummary | null>(null)
  const [trends, setTrends] = useState<PulseTrends | null>(null)
  const [loading, setLoading] = useState(true)
  const [planGated, setPlanGated] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!teamId || auth.status !== 'authenticated') return
    setLoading(true)
    setError(null)
    setPlanGated(false)
    void Promise.all([
      api<PulseSummary>(`/api/teams/${teamId}/pulse/summary?window=${window}`),
      api<PulseTrends>(`/api/teams/${teamId}/pulse/trends?window=${window}`),
    ]).then(([summaryRes, trendsRes]) => {
      if ((!summaryRes.ok && summaryRes.status === 403) || (!trendsRes.ok && trendsRes.status === 403)) {
        setPlanGated(true)
        return
      }
      if (summaryRes.ok) setSummary(summaryRes.data)
      else setError(summaryRes.error.message)
      if (trendsRes.ok) setTrends(trendsRes.data)
    }).finally(() => setLoading(false))
  }, [teamId, window, auth.status])

  const visibleRows = useMemo(
    () => summary?.series.filter((row) => !row.masked) ?? [],
    [summary],
  )
  const maskedCount = summary?.series.filter((row) => row.masked).length ?? 0

  const avgParticipation = useMemo(() => {
    if (visibleRows.length === 0) return null
    const sum = visibleRows.reduce((acc, r) => acc + r.participationAvg, 0)
    return Math.round((sum / visibleRows.length) * 100)
  }, [visibleRows])

  const avgSentiment = useMemo(() => {
    const withSentiment = visibleRows.filter((r) => r.sentimentAvg != null)
    if (withSentiment.length === 0) return null
    const sum = withSentiment.reduce((acc, r) => acc + (r.sentimentAvg ?? 0), 0)
    return Math.round((sum / withSentiment.length) * 100)
  }, [visibleRows])

  if (auth.status === 'loading') {
    return (
      <MainLayout>
        <p className="text-sm text-pulse-500">{t('loading')}</p>
      </MainLayout>
    )
  }

  if (auth.status !== 'authenticated') {
    return <Navigate to="/login" replace />
  }

  if (!teamId) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-pulse-900 dark:text-[#F0F2F8]" tabIndex={-1}>
              {t('title')}
            </h1>
            <p className="mt-1 text-sm text-pulse-500 dark:text-[#8A96B0]">{t('subtitle')}</p>
          </div>
          <div className="flex gap-2">
            {(['30d', '90d'] as const).map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setWindow(w)}
                aria-pressed={window === w}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
                  window === w
                    ? 'bg-teal-600 text-white'
                    : 'border border-pulse-200 dark:border-[#2A3858] text-pulse-700 dark:text-[#A8B3CC]'
                }`}
              >
                {t(`window_${w}`)}
              </button>
            ))}
          </div>
        </header>

        {planGated ? (
          <p className="rounded-xl border border-pulse-200 dark:border-[#1E2A45] bg-pulse-50 dark:bg-[#151C2E] p-4 text-sm text-pulse-700 dark:text-[#A8B3CC]">
            {t('plan_gated')}
          </p>
        ) : error ? (
          <p role="alert" className="text-sm text-red-600">{error}</p>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard label={t('metric_sessions')} value={trends?.sessionCount ?? '—'} icon={Activity} loading={loading} />
              <MetricCard
                label={t('metric_participation')}
                value={avgParticipation != null ? `${avgParticipation}%` : '—'}
                icon={Users}
                loading={loading}
              />
              <MetricCard
                label={t('metric_sentiment')}
                value={avgSentiment != null ? `${avgSentiment}%` : '—'}
                icon={HeartPulse}
                loading={loading}
              />
              <MetricCard label={t('metric_masked_days')} value={maskedCount} icon={EyeOff} loading={loading} />
            </div>

            {trends && trends.participationArc.length >= 2 && (
              <section className="rounded-xl border border-pulse-200 dark:border-[#1E2A45] bg-white dark:bg-[#151C2E] p-6">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-pulse-500 mb-4">{t('trend_heading')}</h2>
                <TrendSpark data={trends.participationArc.map((v) => Math.round(v * 100))} width={240} height={48} />
              </section>
            )}

            <section className="rounded-xl border border-pulse-200 dark:border-[#1E2A45] bg-white dark:bg-[#151C2E] overflow-hidden">
              <h2 className="px-6 py-4 text-sm font-semibold uppercase tracking-wide text-pulse-500 border-b border-pulse-100 dark:border-[#1E2A45]">
                {t('daily_heading')}
              </h2>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-pulse-500 dark:text-[#8A96B0]">
                      <th className="px-6 py-3 font-medium">{t('col_day')}</th>
                      <th className="px-6 py-3 font-medium">{t('col_participation')}</th>
                      <th className="px-6 py-3 font-medium">{t('col_sentiment')}</th>
                      <th className="px-6 py-3 font-medium">{t('col_sessions')}</th>
                      <th className="px-6 py-3 font-medium">{t('col_status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(summary?.series ?? []).map((row) => (
                      <tr key={row.day} className="border-t border-pulse-100 dark:border-[#1E2A45]">
                        <td className="px-6 py-3 font-mono text-pulse-900 dark:text-[#F0F2F8]">{row.day}</td>
                        <td className="px-6 py-3">{row.masked ? '—' : `${Math.round(row.participationAvg * 100)}%`}</td>
                        <td className="px-6 py-3">
                          {row.masked || row.sentimentAvg == null ? '—' : `${Math.round(row.sentimentAvg * 100)}%`}
                        </td>
                        <td className="px-6 py-3">{row.masked ? '—' : row.sessionCount}</td>
                        <td className="px-6 py-3">
                          {row.masked ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 text-xs text-amber-800 dark:text-amber-300">
                              <EyeOff size={12} aria-hidden="true" />
                              {t('masked')}
                            </span>
                          ) : (
                            <span className="text-teal-700 dark:text-teal-400 text-xs font-medium">{t('visible')}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {!loading && (summary?.series.length ?? 0) === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-pulse-500">{t('empty')}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </MainLayout>
  )
}
