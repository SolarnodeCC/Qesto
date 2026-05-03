// Display metadata for pricing / upgrade flows. Numeric limits and feature gates
// come from `PLAN_QUOTAS` (@api/types) or `GET /api/plans/catalog` at runtime (WS6).

import { PLAN_QUOTAS, type PlanTier } from '@api/types'
import type { PlanCatalogApiPayload } from '../types/plan-catalog'

export interface PlanDisplayMeta {
  id: PlanTier
  name: string
  description: string
  price: number
  cta: string
  ctaVariant: 'primary' | 'secondary'
  badge: string | null
}

export const PLAN_DISPLAY: PlanDisplayMeta[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'Get started with interactive sessions',
    price: 0,
    cta: 'Get Started',
    ctaVariant: 'secondary',
    badge: null,
  },
  {
    id: 'starter',
    name: 'Starter',
    description: 'For growing teams and increased engagement',
    price: 29,
    cta: 'Start Free Trial',
    ctaVariant: 'primary',
    badge: null,
  },
  {
    id: 'team',
    name: 'Team',
    description: 'Full power — AI insights, unlimited scale',
    price: 99,
    cta: 'Start Free Trial',
    ctaVariant: 'primary',
    badge: 'Most Popular',
  },
]

export interface PlanConfig extends PlanDisplayMeta {
  features: {
    sessionsPerMonth: number
    participantsPerSession: number
    resultsExport: boolean
    semanticSearch: boolean
    insightsAI: boolean
    customBranding: boolean
    consentMode: boolean
    rankingQuestions: boolean
    samlSso: boolean
  }
}

function rowToFeatures(row: PlanCatalogApiPayload[PlanTier]): PlanConfig['features'] {
  return {
    sessionsPerMonth: row.max_sessions_per_month,
    participantsPerSession: row.max_participants_per_session,
    ...row.features_unlocked,
  }
}

/** Merge display copy with authoritative quota rows (API or in-process PLAN_QUOTAS). */
export function buildPlansFromCatalog(catalog: PlanCatalogApiPayload): PlanConfig[] {
  return PLAN_DISPLAY.map((meta) => ({
    ...meta,
    features: rowToFeatures(catalog[meta.id]),
  }))
}

function quotasToCatalog(): PlanCatalogApiPayload {
  const tiers: PlanTier[] = ['free', 'starter', 'team']
  return Object.fromEntries(
    tiers.map((t) => {
      const q = PLAN_QUOTAS[t]
      return [
        t,
        {
          max_sessions_per_month: q.maxSessionsPerMonth,
          max_participants_per_session: q.maxParticipantsPerSession,
          features_unlocked: q.featuresUnlocked,
        },
      ]
    }),
  ) as PlanCatalogApiPayload
}

/** Default catalog — always matches deployed worker types (no network). */
export const PLANS: PlanConfig[] = buildPlansFromCatalog(quotasToCatalog())

export const CHECKOUT_URL = (import.meta.env.VITE_CHECKOUT_URL as string | undefined) ?? 'https://checkout.qesto.cc'
