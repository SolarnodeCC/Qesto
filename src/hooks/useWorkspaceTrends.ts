import { useApiQuery } from './useApiQuery'

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
  const path =
    teamId && workspaceId && enabled
      ? `/api/teams/${teamId}/workspaces/${workspaceId}/trends?kind=${kind}&window=${window}`
      : undefined
  const { data, error, status, loading, reload } = useApiQuery<{
    kind: TrendKind
    window: TrendWindow
    trend: WorkspaceTrendData
  }>(path)

  const planGated = status === 403
  return {
    trend: data?.trend ?? null,
    loading,
    planGated,
    error: error && !planGated ? error.message : null,
    refresh: reload,
  }
}
