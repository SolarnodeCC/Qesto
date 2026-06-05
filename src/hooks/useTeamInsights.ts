import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'

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
  const [trends, setTrends] = useState<TrendsData | null>(null)
  const [scorecard, setScorecard] = useState<ScorecardData | null>(null)
  const [loading, setLoading] = useState(false)
  const [planGated, setPlanGated] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!teamId || !enabled) return
    setLoading(true)
    setError(null)
    setPlanGated(false)
    const q = `?window=${window}`
    const [trendsRes, scoreRes] = await Promise.all([
      api<TrendsData>(`/api/teams/${teamId}/insights/trends${q}`),
      api<ScorecardData>(`/api/teams/${teamId}/insights/scorecard${q}`),
    ])
    if (!trendsRes.ok && trendsRes.status === 403) {
      setPlanGated(true)
      setLoading(false)
      return
    }
    if (trendsRes.ok) setTrends(trendsRes.data)
    else setError(trendsRes.error.message)
    if (scoreRes.ok) setScorecard(scoreRes.data)
    setLoading(false)
  }, [teamId, enabled, window])

  useEffect(() => {
    void load()
  }, [load])

  return { trends, scorecard, loading, planGated, error, refresh: load }
}
