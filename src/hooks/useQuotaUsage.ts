import { useApiQuery } from './useApiQuery'

export interface QuotaUsage {
  plan: string
  quotas: {
    max_sessions_per_month: number
    max_participants_per_session: number
    features_unlocked: {
      resultsExport: boolean
      semanticSearch: boolean
      insightsAI: boolean
      customBranding: boolean
      consentMode: boolean
      rankingQuestions: boolean
      samlSso: boolean
    }
  }
  usage: {
    sessions_created: number
    remaining: number
    insights_generated: number
  }
  reset_date: string
}

export function useQuotaUsage(userId: string | undefined) {
  const { data, loading } = useApiQuery<QuotaUsage>(
    userId ? `/api/plans/${encodeURIComponent(userId)}/usage` : undefined,
  )
  return { data, loading }
}
