import { Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useT } from '../../i18n'
import type { SessionSummary } from '../../hooks/useSessions'
import type { AggregatedTheme } from '../../hooks/useInsights'
import type { DashboardSection } from '../../layouts/AppShellLayout'
import InsightThemeCard from '../../components/InsightThemeCard'
import TeamInsightsPanel from '../../components/insights/TeamInsightsPanel'
import { WorkspacePanel } from '../../components/workspaces/WorkspacePanel'
import AINarrative from '../../components/AINarrative'
import { CoachingCard } from '../../components/CoachingCard'
import { SimilarSessionsPanel } from '../../components/SimilarSessionsPanel'
import type { DashboardTeam } from './types'

interface InsightsSectionProps {
  closedSessions: SessionSummary[]
  insightThemes: AggregatedTheme[]
  insightsLoading: boolean
  planGated: boolean
  teams: DashboardTeam[]
  activeSection: DashboardSection
  analyzeSession: (id: string) => void
}

export function InsightsSection({
  closedSessions,
  insightThemes,
  insightsLoading,
  planGated,
  teams,
  activeSection,
  analyzeSession,
}: InsightsSectionProps) {
  const t = useT('dashboard')
  return (
    <section id="section-insights" aria-labelledby="insights-heading">
      <h2 id="insights-heading" className="text-xl font-semibold text-pulse-900 dark:text-[#F0F2F8] mb-8">
        {t('insights')}
      </h2>
      <div className="space-y-8">
        <AINarrative />
        {closedSessions[0] && !planGated && (
          <>
            <CoachingCard sessionId={closedSessions[0].id} enabled={!insightsLoading} />
            <SimilarSessionsPanel
              sessionId={closedSessions[0].id}
              defaultQuery={closedSessions[0].title}
              enabled={!insightsLoading}
            />
          </>
        )}
        {teams[0] && (
          <TeamInsightsPanel
            teamId={teams[0].id}
            enabled={activeSection === 'insights'}
          />
        )}
        {teams[0] && (
          <WorkspacePanel teamId={teams[0].id} enabled={activeSection === 'insights'} />
        )}
        <div className="space-y-3">
          <h3 className="text-heading-s font-semibold dark:text-pulse-100">{t('topThemes')}</h3>
          {planGated ? (
            <div className="rounded-lg border border-violet-200 bg-violet-50 dark:bg-violet-900/20 dark:border-violet-700 p-6 space-y-3">
              <p className="text-body-s text-violet-800 dark:text-violet-300 font-medium">{t('aiInsightsPlanRequired')}</p>
              <p className="text-body-s text-violet-700 dark:text-violet-400">{t('upgradeForInsights')}</p>
              <Link to="/pricing" className="inline-flex items-center gap-1.5 rounded-md bg-violet-600 text-white px-4 py-2 text-sm font-medium hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2">
                View plans →
              </Link>
            </div>
          ) : closedSessions.length === 0 ? (
            <p className="text-body-s text-pulse-500 dark:text-pulse-400">
              AI-identified themes across your closed sessions. Close more sessions to see richer patterns.
            </p>
          ) : insightsLoading ? (
            <ul className="space-y-3">
              {[1, 2, 3].map((i) => (
                <li key={i} className="h-24 rounded-lg bg-pulse-200 dark:bg-pulse-700 skeleton-shimmer" aria-hidden="true" />
              ))}
            </ul>
          ) : insightThemes.length === 0 ? (
            <div className="space-y-4">
              <p className="text-body-s text-pulse-500 dark:text-pulse-400">{t('insightsEmpty')}</p>
              <div className="space-y-2">
                {closedSessions.slice(0, 3).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => void analyzeSession(s.id)}
                    className="w-full text-left flex items-center justify-between gap-3 p-3 rounded-lg border border-pulse-200 dark:border-[#1E2A45] hover:border-teal-400 dark:hover:border-teal-600 hover:bg-teal-50 dark:hover:bg-teal-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:focus-visible:ring-teal-400 focus-visible:ring-offset-2 transition-colors"
                  >
                    <span className="text-sm font-medium text-pulse-800 dark:text-pulse-200">{s.title}</span>
                    <span className="text-xs text-teal-600 dark:text-teal-400 font-medium flex items-center gap-1">
                      <Sparkles size={12} aria-hidden="true" />
                      Analyze
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <ul className="space-y-3">
              {insightThemes.map((theme) => (
                <li key={theme.id}>
                  <InsightThemeCard
                    title={theme.title}
                    description={theme.description}
                    sessionCount={theme.sessionCount}
                    confidence={theme.confidence}
                    trend30d={theme.trend30d}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
