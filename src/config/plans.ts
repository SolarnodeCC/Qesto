// Display metadata for pricing / upgrade flows. Numeric limits and feature gates
// come from `PLAN_QUOTAS` (@api/types) or `GET /api/plans/catalog` at runtime (WS6).

import { PLAN_QUOTAS, type PlanTier } from '@api/types'
import type { PlanCatalogApiPayload, PlanCatalogPricingPayload, PlanCatalogPricingRow } from '../types/plan-catalog'

export interface PlanDisplayMeta {
  id: PlanTier
  name: string
  description: string
  price: number
  pricing: PlanCatalogPricingRow
  cta: string
  ctaVariant: 'primary' | 'secondary'
  badge: string | null
}

export const DEFAULT_PLAN_PRICING: PlanCatalogPricingPayload = {
  free: {
    currency: 'EUR',
    monthly_cents: 0,
    annual_cents: 0,
    monthly_price_id: null,
    annual_price_id: null,
    display: '€0 / host / month',
  },
  starter: {
    currency: 'EUR',
    monthly_cents: 2900,
    annual_cents: 2400,
    monthly_price_id: null,
    annual_price_id: null,
    display: '€24 / host / month billed annually; €29 month-to-month',
  },
  team: {
    currency: 'EUR',
    monthly_cents: null,
    annual_cents: null,
    monthly_price_id: null,
    annual_price_id: null,
    display: 'Custom annual contract',
  },
}

export const PLAN_DISPLAY: PlanDisplayMeta[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'Get started with interactive sessions',
    price: 0,
    pricing: DEFAULT_PLAN_PRICING.free,
    cta: 'Get Started',
    ctaVariant: 'secondary',
    badge: null,
  },
  {
    id: 'starter',
    name: 'Starter',
    description: 'For growing teams and increased engagement',
    price: 29,
    pricing: DEFAULT_PLAN_PRICING.starter,
    cta: 'Start Free Trial',
    ctaVariant: 'primary',
    badge: null,
  },
  {
    id: 'team',
    name: 'Team',
    description: 'Full power — AI insights, unlimited scale',
    price: 99,
    pricing: DEFAULT_PLAN_PRICING.team,
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
    townhallQA: boolean
    liveCopilot: boolean
    crossSessionInsights: boolean
    recurringWorkspaces: boolean
  }
}

function rowToFeatures(row: PlanCatalogApiPayload[PlanTier]): PlanConfig['features'] {
  return {
    sessionsPerMonth: row.max_sessions_per_month,
    participantsPerSession: row.max_participants_per_session,
    ...row.features_unlocked,
  }
}

function displayPrice(meta: PlanDisplayMeta, pricing: PlanCatalogPricingRow): number {
  const cents = pricing.monthly_cents ?? pricing.annual_cents
  return cents === null ? meta.price : cents / 100
}

/** Merge display copy with authoritative quota rows (API or in-process PLAN_QUOTAS). */
export function buildPlansFromCatalog(catalog: PlanCatalogApiPayload, pricing = DEFAULT_PLAN_PRICING): PlanConfig[] {
  return PLAN_DISPLAY.map((meta) => {
    const planPricing = pricing[meta.id] ?? meta.pricing
    return {
      ...meta,
      price: displayPrice(meta, planPricing),
      pricing: planPricing,
      features: rowToFeatures(catalog[meta.id]),
    }
  })
}

function quotasToCatalog(): PlanCatalogApiPayload {
  const tiers: PlanTier[] = ['free', 'starter', 'team']
  const catalog = {} as PlanCatalogApiPayload
  for (const t of tiers) {
    const q = PLAN_QUOTAS[t]
    catalog[t] = {
      max_sessions_per_month: q.maxSessionsPerMonth,
      max_participants_per_session: q.maxParticipantsPerSession,
      features_unlocked: q.featuresUnlocked,
    }
  }
  return catalog
}

/** Default catalog — always matches deployed worker types (no network). */
export const PLANS: PlanConfig[] = buildPlansFromCatalog(quotasToCatalog())

export const CHECKOUT_URL = (import.meta.env.VITE_CHECKOUT_URL as string | undefined) ?? 'https://checkout.qesto.cc'
