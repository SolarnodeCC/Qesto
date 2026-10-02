/**
 * Owner integration policy (GitHub #942).
 *
 * Stripe Checkout/portal/webhooks, Reddit, and YouTube are not used in
 * production. Gate them off by default; flip the matching env var to `"true"`
 * to re-enable without a code change.
 *
 * Resend stays available — magic-link / DSA report / password-reset mail depend
 * on `sendEmail()` (dev falls back to console when `RESEND_API_KEY` is unset).
 * Plan/entitlement reads (`effectivePlan`, catalog, quota) stay intact; only
 * Stripe *payment* surfaces are gated.
 */

import type { Env } from '../types'

/** Stripe Checkout, Customer Portal, invoices list, subscription mutate, webhook. */
export function stripePaymentsEnabled(
  env: Pick<Env, 'STRIPE_PAYMENTS_ENABLED'>,
): boolean {
  return env.STRIPE_PAYMENTS_ENABLED === 'true'
}

/** Reddit OAuth connect + mention-monitor Reddit poll + publish. */
export function redditIntegrationEnabled(
  env: Pick<Env, 'REDDIT_INTEGRATION_ENABLED'>,
): boolean {
  return env.REDDIT_INTEGRATION_ENABLED === 'true'
}

/** YouTube OAuth connect + mention-monitor YouTube poll + publish. */
export function youtubeIntegrationEnabled(
  env: Pick<Env, 'YOUTUBE_INTEGRATION_ENABLED'>,
): boolean {
  return env.YOUTUBE_INTEGRATION_ENABLED === 'true'
}

export const STRIPE_DISABLED_CODE = 'stripe_disabled' as const
export const REDDIT_DISABLED_CODE = 'reddit_disabled' as const
export const YOUTUBE_DISABLED_CODE = 'youtube_disabled' as const
