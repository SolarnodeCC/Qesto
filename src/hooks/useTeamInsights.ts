import { useParallelApiQuery } from './useApiQuery'

export type InsightTrendWindow = '30d' | '90d' | '180d'

export type RecurringTheme = {
  label: string
  sessionCount: number
  firstSeen: string
  lastSeen: string
  score: number
}

export type EngagementTrendPoint = {
  day: string
  sessions: number
  avgVotes: number
  avgConfidence: number
}

export type FacilitatorScorecardEntry = {
  facilitatorId: string
  sessionsRun: number
  avgParticipation: number
  responseRate: number
  themeDiversity: number
  moodTrend: Array<{ day: string; mood: string; sampleSize: number }>
}

type TrendsData = {
  window: string
  recurringThemes: RecurringTheme[]
  engagement: { points: EngagementTrendPoint[]; summary: { sessionCount: number } }
  cached?: boolean
}

type ScorecardData = {
  scorecard: {
    window: string
    facilitators: FacilitatorScorecardEntry[]
    teamSummary: { sessionsRun: number; avgParticipation: number; responseRate: number }
  }
  cached?: boolean
}

export function useTeamInsights(teamId: string | undefined, enabled: boolean, window: InsightTrendWindow = '30d') {
  const q = `?window=${window}`
  const base = teamId && enabled ? `/api/teams/${teamId}/insights` : undefined
  const { data, errors, loading, reload } = useParallelApiQuery<{
    trends: TrendsData
    scorecard: ScorecardData
  }>({
    trends: base ? `${base}/trends${q}` : undefined,
    scorecard: base ? `${base}/scorecard${q}` : undefined,
  })

  const planGated = errors.trends?.status === 403
  return {
    trends: data.trends,
    scorecard: data.scorecard,
    loading,
    planGated,
    error: errors.trends && !planGated ? errors.trends.error.message : null,
    refresh: reload,
  }
}
