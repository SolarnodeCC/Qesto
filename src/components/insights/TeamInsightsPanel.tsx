import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useT } from '../../i18n'
import { useTeamInsights, type InsightTrendWindow } from '../../hooks/useTeamInsights'
import { InsightsTabSkeleton } from '../SkeletonLoader'

type Props = {
  teamId: string | undefined
  enabled: boolean
}

const WINDOWS: InsightTrendWindow[] = ['30d', '90d', '180d']

export default function TeamInsightsPanel({ teamId, enabled }: Props) {
  const t = useT('insights')
  const [window, setWindow] = useState<InsightTrendWindow>('30d')
  const { trends, scorecard, loading, planGated, error } = useTeamInsights(teamId, enabled, window)

  const windowLabel = useMemo(() => {
    if (window === '90d') return t('crossSession.window90d')
    if (window === '180d') return t('crossSession.window180d')
    return t('crossSession.window30d')
  }, [window, t])

  if (!teamId) {
    return (
      <p className="text-body-s text-pulse-500 dark:text-pulse-400">{t('crossSession.selectTeam')}</p>
    )
  }

  if (planGated) {
    return (
      <div className="rounded-lg border border-violet-200 bg-violet-50 dark:bg-violet-900/20 dark:border-violet-700 p-5 space-y-3">
        <p className="text-body-s text-violet-800 dark:text-violet-300 font-medium">{t('crossSession.planRequired')}</p>
        <p className="text-body-s text-violet-700 dark:text-violet-400">{t('crossSession.planHint')}</p>
        <Link
          to="/pricing"
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md bg-violet-600 text-white px-4 py-2 text-sm font-medium hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
        >
          {t('crossSession.viewPlans')}
        </Link>
      </div>
    )
  }

  if (loading) return <InsightsTabSkeleton />

  if (error) {
    return (
      <p role="alert" className="text-body-s text-red-600 dark:text-red-400">
        {t('loadError')}
      </p>
    )
  }

  const recurring = trends?.recurringThemes ?? []
  const engagement = trends?.engagement?.points ?? []
  const facilitators = scorecard?.scorecard?.facilitators ?? []
  const summary = scorecard?.scorecard?.teamSummary

  return (
    <div className="space-y-6" aria-live="polite">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('crossSession.windowLabel')}>
        {WINDOWS.map((w) => (
          <button
            key={w}
            type="button"
            aria-pressed={window === w}
            onClick={() => setWindow(w)}
            className={[
              'min-h-[44px] rounded-full px-3 py-2 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500',
              window === w
                ? 'bg-teal-600 text-white'
                : 'border border-pulse-200 dark:border-[#1E2A45] text-pulse-600 dark:text-[#A8B3CC]',
            ].join(' ')}
          >
            {w === '30d' ? t('crossSession.window30d') : w === '90d' ? t('crossSession.window90d') : t('crossSession.window180d')}
          </button>
        ))}
        <span className="text-xs text-pulse-500 dark:text-pulse-400 sr-only">{windowLabel}</span>
      </div>

      <section aria-labelledby="cross-recurring-heading">
        <h3 id="cross-recurring-heading" className="text-heading-s font-semibold dark:text-pulse-100 mb-2">
          {t('crossSession.recurringTitle')}
        </h3>
        {recurring.length === 0 ? (
          <p className="text-body-s text-pulse-500 dark:text-pulse-400">{t('crossSession.recurringEmpty')}</p>
        ) : (
          <ul className="space-y-2">
            {recurring.map((theme) => (
              <li
                key={theme.label}
                className="flex min-h-[44px] items-center justify-between gap-3 rounded-lg border border-pulse-200 dark:border-[#1E2A45] px-4 py-3"
              >
                <span className="font-medium text-pulse-800 dark:text-pulse-100">{theme.label}</span>
                <span className="text-xs text-pulse-500 dark:text-pulse-400">
                  {t('crossSession.sessionCount', { count: theme.sessionCount })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="cross-trend-heading">
        <h3 id="cross-trend-heading" className="text-heading-s font-semibold dark:text-pulse-100 mb-2">
          {t('crossSession.trendTitle')}
        </h3>
        {engagement.length === 0 ? (
          <p className="text-body-s text-pulse-500 dark:text-pulse-400">{t('crossSession.trendEmpty')}</p>
        ) : (
          <ul className="space-y-1 text-sm text-pulse-700 dark:text-pulse-300">
            {engagement.slice(-6).map((p) => (
              <li key={p.day} className="flex justify-between gap-2">
                <span>{p.day}</span>
                <span>
                  {t('crossSession.trendLine', { sessions: p.sessions, votes: p.avgVotes })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="cross-scorecard-heading">
        <h3 id="cross-scorecard-heading" className="text-heading-s font-semibold dark:text-pulse-100 mb-2">
          {t('crossSession.scorecardTitle')}
        </h3>
        {summary && (
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4 text-sm">
            <div className="rounded-lg bg-pulse-50 dark:bg-[#151C2E] p-3">
              <dt className="text-pulse-500 dark:text-pulse-400">{t('crossSession.sessionsRun')}</dt>
              <dd className="text-lg font-semibold text-pulse-900 dark:text-pulse-100">{summary.sessionsRun}</dd>
            </div>
            <div className="rounded-lg bg-pulse-50 dark:bg-[#151C2E] p-3">
              <dt className="text-pulse-500 dark:text-pulse-400">{t('crossSession.avgParticipation')}</dt>
              <dd className="text-lg font-semibold text-pulse-900 dark:text-pulse-100">{summary.avgParticipation}</dd>
            </div>
            <div className="rounded-lg bg-pulse-50 dark:bg-[#151C2E] p-3">
              <dt className="text-pulse-500 dark:text-pulse-400">{t('crossSession.responseRate')}</dt>
              <dd className="text-lg font-semibold text-pulse-900 dark:text-pulse-100">
                {Math.round(summary.responseRate * 100)}%
              </dd>
            </div>
          </dl>
        )}
        {facilitators.length === 0 ? (
          <p className="text-body-s text-pulse-500 dark:text-pulse-400">{t('crossSession.scorecardEmpty')}</p>
        ) : (
          <ul className="space-y-2">
            {facilitators.slice(0, 5).map((f) => (
              <li
                key={f.facilitatorId}
                className="rounded-lg border border-pulse-200 dark:border-[#1E2A45] px-4 py-3 text-sm"
              >
                <p className="font-medium text-pulse-800 dark:text-pulse-100">
                  {t('crossSession.facilitator', { id: f.facilitatorId.slice(0, 8) })}
                </p>
                <p className="text-pulse-500 dark:text-pulse-400 mt-1">
                  {t('crossSession.facilitatorStats', {
                    sessions: f.sessionsRun,
                    participation: f.avgParticipation,
                    rate: Math.round(f.responseRate * 100),
                  })}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
