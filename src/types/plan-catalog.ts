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
    townhallQA: boolean
    liveCopilot: boolean
    crossSessionInsights: boolean
    recurringWorkspaces: boolean
  }
}

export type PlanCatalogApiPayload = Record<PlanTier, PlanCatalogApiRow>

export type PlanCatalogPricingRow = {
  currency: 'EUR'
  monthly_cents: number | null
  annual_cents: number | null
  monthly_price_id: string | null
  annual_price_id: string | null
  display: string
}

export type PlanCatalogPricingPayload = Record<PlanTier, PlanCatalogPricingRow>

export type PlanCatalogApiResponse = PlanCatalogApiPayload & {
  pricing?: PlanCatalogPricingPayload
}
