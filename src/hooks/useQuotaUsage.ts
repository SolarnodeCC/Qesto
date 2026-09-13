import { useApiQuery } from './useApiQuery'

export interface QuotaUsage {
  plan: string
  /** ADR-0074: tier the account actually holds, present only when the promo upgraded it. */
  plan_stored?: string
  free_access?: { active: boolean; until: string | null; granted_tier: string | null }
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
    /** ADR-0074 monthly AI ceiling while the promo runs; null when uncapped. */
    insights_limit?: number | null
  }
  reset_date: string
}

export function useQuotaUsage(userId: string | undefined) {
  const { data, loading } = useApiQuery<QuotaUsage>(
    userId ? `/api/plans/${encodeURIComponent(userId)}/usage` : undefined,
  )
  return { data, loading }
}
