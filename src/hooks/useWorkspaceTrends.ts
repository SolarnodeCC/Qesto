import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'

export type TrendWindow = '30d' | '90d' | '180d'
export type TrendKind = 'participation' | 'team_health'

export type ParticipationPoint = {
  instanceSeq: number
  sessionId: string
  closedAt: number
  responseCount: number
}

export type TeamHealthPoint = {
  instanceSeq: number
  sessionId: string
  closedAt: number
  moodScore: number
  mood: 'positive' | 'neutral' | 'concerning'
  participation: number
  wentWell: number
  didntGoWell: number
  actions: number
}

export type WorkspaceTrendData = {
  instanceCount: number
  message?: string
  points?: ParticipationPoint[] | TeamHealthPoint[]
}

export function useWorkspaceTrends(
  teamId: string | undefined,
  workspaceId: string | undefined,
  kind: TrendKind,
  window: TrendWindow = '90d',
  enabled = true,
) {
  const [trend, setTrend] = useState<WorkspaceTrendData | null>(null)
  const [loading, setLoading] = useState(false)
  const [planGated, setPlanGated] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!teamId || !workspaceId || !enabled) return
    setLoading(true)
    setError(null)
    const res = await api<{ kind: TrendKind; window: TrendWindow; trend: WorkspaceTrendData }>(
      `/api/teams/${teamId}/workspaces/${workspaceId}/trends?kind=${kind}&window=${window}`,
    )
    setLoading(false)
    if (!res.ok) {
      if (res.status === 403) setPlanGated(true)
      else setError(res.error.message)
      return
    }
    setTrend(res.data.trend)
  }, [teamId, workspaceId, kind, window, enabled])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { trend, loading, planGated, error, refresh }
}
