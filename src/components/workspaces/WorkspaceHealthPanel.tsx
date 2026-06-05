import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import TrendSpark from '../TrendSpark'
import { useT } from '../../i18n'
import { useWorkspaceTrends, type TeamHealthPoint, type TrendWindow } from '../../hooks/useWorkspaceTrends'

type Props = {
  teamId: string
  workspaceId: string
  workspaceTitle: string
  enabled?: boolean
}

const WINDOWS: TrendWindow[] = ['30d', '90d', '180d']

const MOOD_STYLES: Record<TeamHealthPoint['mood'], string> = {
  positive: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
  neutral: 'bg-pulse-100 text-pulse-700 dark:bg-pulse-800 dark:text-pulse-300',
  concerning: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
}

export function WorkspaceHealthPanel({ teamId, workspaceId, workspaceTitle, enabled = true }: Props) {
  const t = useT('retro')
  const [window, setWindow] = useState<TrendWindow>('90d')
  const { trend, loading, planGated, error } = useWorkspaceTrends(
    teamId,
    workspaceId,
    'team_health',
    window,
    enabled,
  )

  const points = useMemo(
    () => (trend?.points ?? []) as TeamHealthPoint[],
    [trend?.points],
  )
  const moodSeries = useMemo(() => points.map((p) => Math.round(p.moodScore * 100)), [points])
  const participationSeries = useMemo(() => points.map((p) => p.participation), [points])

  if (planGated) {
    return (
      <div className="rounded-lg border border-violet-200 bg-violet-50 p-4 dark:border-violet-700 dark:bg-violet-900/20">
        <p className="text-sm text-violet-800 dark:text-violet-300">{t('health.planRequired')}</p>
        <Link to="/pricing" className="mt-2 inline-block text-sm font-medium text-violet-700 underline dark:text-violet-400">
          {t('health.viewPlans')}
        </Link>
      </div>
    )
  }

  if (loading) {
    return <div className="h-24 rounded-md bg-pulse-100 dark:bg-pulse-800 skeleton-shimmer" aria-hidden="true" />
  }

  if (error) {
    return <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
  }

  return (
    <div className="rounded-lg border border-pulse-200 bg-pulse-50/50 p-4 dark:border-pulse-700 dark:bg-pulse-900/20 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-pulse-900 dark:text-pulse-100">{t('health.title')}</h4>
          <p className="text-xs text-pulse-500 dark:text-pulse-400 mt-0.5">{workspaceTitle}</p>
        </div>
        <div className="flex gap-1" role="group" aria-label={t('health.windowLabel')}>
          {WINDOWS.map((w) => (
            <button
              key={w}
              type="button"
              aria-pressed={window === w}
              onClick={() => setWindow(w)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                window === w
                  ? 'bg-teal-600 text-white'
                  : 'border border-pulse-200 text-pulse-600 dark:border-pulse-600 dark:text-pulse-300'
              }`}
            >
              {t(`health.window.${w}`)}
            </button>
          ))}
        </div>
      </div>

      {trend?.message === 'insufficient_data' ? (
        <p className="text-sm text-pulse-500 dark:text-pulse-400">
          {t('health.insufficient', { count: trend.instanceCount })}
        </p>
      ) : points.length === 0 ? (
        <p className="text-sm text-pulse-500 dark:text-pulse-400">{t('health.empty')}</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md bg-white dark:bg-pulse-900/40 p-3 border border-pulse-100 dark:border-pulse-700">
              <p className="text-xs font-medium text-pulse-500 dark:text-pulse-400">{t('health.moodTrend')}</p>
              <div className="mt-2 flex items-center gap-3">
                {moodSeries.length >= 2 && <TrendSpark data={moodSeries} width={72} height={24} />}
                <span className="text-lg font-semibold text-pulse-900 dark:text-pulse-100">
                  {points[points.length - 1]?.moodScore !== undefined
                    ? `${Math.round((points[points.length - 1]?.moodScore ?? 0) * 100)}%`
                    : '—'}
                </span>
              </div>
            </div>
            <div className="rounded-md bg-white dark:bg-pulse-900/40 p-3 border border-pulse-100 dark:border-pulse-700">
              <p className="text-xs font-medium text-pulse-500 dark:text-pulse-400">{t('health.participationTrend')}</p>
              <div className="mt-2 flex items-center gap-3">
                {participationSeries.length >= 2 && (
                  <TrendSpark data={participationSeries} width={72} height={24} />
                )}
                <span className="text-lg font-semibold text-pulse-900 dark:text-pulse-100">
                  {points[points.length - 1]?.participation ?? '—'}
                </span>
              </div>
            </div>
          </div>

          <ul className="space-y-2" aria-live="polite">
            {points.slice(-6).map((p) => (
              <li
                key={p.sessionId}
                className="flex items-center justify-between gap-3 rounded-md border border-pulse-100 bg-white px-3 py-2 text-sm dark:border-pulse-700 dark:bg-pulse-900/30"
              >
                <span className="font-medium text-pulse-800 dark:text-pulse-100">
                  {t('health.instance', { seq: p.instanceSeq })}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${MOOD_STYLES[p.mood]}`}>
                  {t(`health.mood.${p.mood}`)}
                </span>
                <span className="text-xs text-pulse-500 dark:text-pulse-400">
                  {t('health.instanceStats', {
                    cards: p.participation,
                    positive: p.wentWell,
                    negative: p.didntGoWell,
                  })}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
