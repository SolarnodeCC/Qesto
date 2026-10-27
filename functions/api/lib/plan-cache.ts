/**
 * Short-lived per-user cache of the STORED plan tier (DD-16, issue #889).
 *
 * planMiddleware used to run `SELECT plan FROM users` on every authenticated
 * request. The plan changes only on a Stripe webhook or an admin edit, so it is
 * cached in ACTIONS_KV for PLAN_CACHE_TTL_SECONDS and deleted explicitly on
 * every write path (billing-shared.setUserPlan, admin user PATCH). The TTL
 * bounds staleness if an invalidation is lost to KV propagation.
 *
 * Only the stored tier is cached. ADR-0074's effectivePlan() is applied after
 * the read on every request, so the free-access window is never frozen here.
 */
import type { Env, PlanTier } from '../types'
import { logBestEffort } from './log'

export const PLAN_CACHE_TTL_SECONDS = 60

export function planCacheKey(userId: string): string {
  return `plan:cache:${userId}`
}

function isPlanTier(v: unknown): v is PlanTier {
  return v === 'free' || v === 'starter' || v === 'team'
}

export async function readCachedPlan(env: Pick<Env, 'ACTIONS_KV'>, userId: string): Promise<PlanTier | null> {
  if (!env.ACTIONS_KV) return null
  try {
    const raw = await env.ACTIONS_KV.get(planCacheKey(userId))
    return isPlanTier(raw) ? raw : null
  } catch (err) {
    // A cache fault must never fail the request — fall through to D1.
    logBestEffort(err, { traceId: 'plan-cache', route: 'lib/plan-cache', operation: 'plan_cache.read' })
    return null
  }
}

export async function writeCachedPlan(
  env: Pick<Env, 'ACTIONS_KV'>,
  userId: string,
  plan: PlanTier,
): Promise<void> {
  if (!env.ACTIONS_KV) return
  await env.ACTIONS_KV.put(planCacheKey(userId), plan, { expirationTtl: PLAN_CACHE_TTL_SECONDS })
}

/** Call after every `UPDATE users SET plan`. */
export async function invalidatePlanCache(env: Pick<Env, 'ACTIONS_KV'>, userId: string): Promise<void> {
  if (!env.ACTIONS_KV) return
  try {
    await env.ACTIONS_KV.delete(planCacheKey(userId))
  } catch (err) {
    // Bounded by the TTL; log so a stuck invalidation is visible.
    logBestEffort(err, { traceId: 'plan-cache', route: 'lib/plan-cache', operation: 'plan_cache.invalidate' })
  }
}
