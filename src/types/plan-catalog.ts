import type { PlanTier } from '@api/types'

/** Row shape returned by `GET /api/plans/catalog` (matches `/api/plans/:id/usage` quota keys). */
export type PlanCatalogApiRow = {
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

export type PlanCatalogApiPayload = Record<PlanTier, PlanCatalogApiRow>
