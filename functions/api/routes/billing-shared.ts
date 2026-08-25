// Shared billing helpers: Stripe KV key builders, plan-tier mapping, customer
// mapping, and catalog pricing. Split out of the 696-line billing.ts (issue
// #687) so the REST plane (billing.ts) and the webhook plane (billing-webhooks.ts)
// share one definition of each instead of duplicating them.

// Billing API routes (BILL-04): plan management, quota tracking.
//
// Routes (all mounted under `/api`):
//   GET  /api/plans/catalog          public `PLAN_QUOTAS` snapshot (WS6 / F-04)
//   GET  /api/plans/:userId/usage    quota usage for authenticated user
//   POST /api/billing/portal         Stripe billing portal session
//   GET  /api/billing/invoices       Stripe invoice history
//   POST /api/billing/subscription   Stripe subscription management

import { writeKvJson, writeKvText } from '../lib/kv'
import { type Env, type PlanQuotas, type PlanTier } from '../types'
import {
  insertBillingAuditEvent,
  setStripeCustomerId,
  setUserPlan as setUserPlanInDb,
} from '../repositories/billingRepository'



// KV key for Stripe customer ID — stored in USERS_KV alongside password/oauth data.
export const stripeCustomerKey = (userId: string) => `stripe:customer:${userId}`
export const stripeSubscriptionKey = (userId: string) => `stripe:subscription:${userId}`
// Reverse index: Stripe customer id → Qesto user id (#585). Written when checkout
// completes so webhook handlers can resolve the user without scanning KV.
export const stripeCustomerReverseKey = (customerId: string) => `stripe:customer-rev:${customerId}`

/**
 * Map a Stripe price id to a Qesto plan tier using the configured env price ids
 * (#585). Returns null when the price id matches no known tier.
 */
export function tierFromPriceId(env: Env, priceId: string | undefined | null): PlanTier | null {
  if (!priceId) return null
  if (priceId === env.STRIPE_STARTER_MONTHLY_PRICE_ID || priceId === env.STRIPE_STARTER_ANNUAL_PRICE_ID) {
    return 'starter'
  }
  if (priceId === env.STRIPE_TEAM_ANNUAL_PRICE_ID) {
    return 'team'
  }
  return null
}

/** Validate a plan tier coming from Stripe metadata. */
export function validTier(value: unknown): value is PlanTier {
  return value === 'free' || value === 'starter' || value === 'team'
}

/** Set users.plan in D1 (best-effort; logs on failure). */
export async function setUserPlan(env: Pick<Env, 'DB'>, userId: string, plan: PlanTier): Promise<void> {
  try {
    await setUserPlanInDb(env.DB, userId, plan)
  } catch (err) {
    console.error(`[Stripe] setUserPlan failed for ${userId}: ${(err as Error).message}`)
  }
}

/** Persist the bidirectional Stripe customer ↔ user mapping (#585). */
export async function recordCustomerMapping(env: Pick<Env, 'USERS_KV' | 'DB'>, userId: string, customerId: string): Promise<void> {
  await writeKvJson(env.USERS_KV, stripeCustomerKey(userId), { customerId }, {
    expirationTtl: 86400 * 365,
  })
  await writeKvText(env.USERS_KV, stripeCustomerReverseKey(customerId), userId, {
    expirationTtl: 86400 * 365,
  })
  try {
    await setStripeCustomerId(env.DB, userId, customerId)
  } catch {
    // Column may not be migrated yet in some environments; KV mapping is authoritative.
  }
}

/** Write a billing audit row using the real audit_events schema (#585). */
export async function writeBillingAudit(
  env: Pick<Env, 'DB'>,
  userId: string,
  action: string,
  subjectId: string,
  snapshot?: Record<string, unknown>,
): Promise<void> {
  try {
    await insertBillingAuditEvent(env.DB, userId, action, subjectId, snapshot)
  } catch (err) {
    console.error(`[Stripe] audit write failed for ${action}: ${(err as Error).message}`)
  }
}

export function catalogRow(q: PlanQuotas) {
  return {
    max_sessions_per_month: q.maxSessionsPerMonth,
    max_participants_per_session: q.maxParticipantsPerSession,
    features_unlocked: q.featuresUnlocked,
  }
}

export function cents(value: string | undefined, defaultCents: number): number {
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
