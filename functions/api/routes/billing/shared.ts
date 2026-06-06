// Billing route shared helpers (BILL-04): KV keys, plan catalog, shared types.
import type { AuthVariables } from '../../middleware/auth'
import type { PlanVariables } from '../../middleware/plan'
import { PLAN_QUOTAS, type Env, type PlanQuotas, type PlanTier } from '../../types'

export type Vars = AuthVariables & PlanVariables

// KV key for Stripe customer ID — stored in USERS_KV alongside password/oauth data.
export const stripeCustomerKey = (userId: string) => `stripe:customer:${userId}`
export const stripeSubscriptionKey = (userId: string) => `stripe:subscription:${userId}`

export function catalogRow(q: PlanQuotas) {
  return {
    max_sessions_per_month: q.maxSessionsPerMonth,
    max_participants_per_session: q.maxParticipantsPerSession,
    features_unlocked: q.featuresUnlocked,
  }
}

function cents(value: string | undefined, defaultCents: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : defaultCents
}

export function catalogPricing(env: Env) {
  return {
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
      monthly_cents: cents(env.STARTER_MONTHLY_EUR_CENTS, 2900),
      annual_cents: cents(env.STARTER_ANNUAL_EUR_CENTS, 2400),
      monthly_price_id: env.STRIPE_STARTER_MONTHLY_PRICE_ID ?? null,
      annual_price_id: env.STRIPE_STARTER_ANNUAL_PRICE_ID ?? null,
      display: '€24 / host / month billed annually; €29 month-to-month',
    },
    team: {
      currency: 'EUR',
      monthly_cents: null,
      annual_cents: env.TEAM_ANNUAL_EUR_CENTS ? cents(env.TEAM_ANNUAL_EUR_CENTS, 0) : null,
      monthly_price_id: null,
      annual_price_id: env.STRIPE_TEAM_ANNUAL_PRICE_ID ?? null,
      display: 'Custom annual contract',
    },
  } satisfies Record<
    PlanTier,
    {
      currency: 'EUR'
      monthly_cents: number | null
      annual_cents: number | null
      monthly_price_id: string | null
      annual_price_id: string | null
      display: string
    }
  >
}

export function planCatalog() {
  const tiers: PlanTier[] = ['free', 'starter', 'team']
  return Object.fromEntries(tiers.map((t) => [t, catalogRow(PLAN_QUOTAS[t])])) as Record<
    PlanTier,
    ReturnType<typeof catalogRow>
  >
}
