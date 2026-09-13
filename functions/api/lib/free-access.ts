/**
 * free-access.ts — ADR-0074: temporary all-users free access.
 *
 * Grants an entitlement tier at request time for a bounded window. `users.plan`
 * is never written, so the exit is a variable flip and a deploy — no migration,
 * no Stripe state to unwind, and paying subscribers keep their real tier
 * underneath the whole time.
 *
 * Two gates must both hold for the promo to be live:
 *   1. FREE_ACCESS_ALL === 'true'
 *   2. now < FREE_ACCESS_UNTIL
 * A flag left switched on past the window is inert — the promo cannot be
 * extended by forgetting to turn it off.
 *
 * @see knowledge-base/adr/ADR-0074-temporary-free-access-promo.md
 */

import type { Env, PlanTier } from '../types'

const TIER_RANK: Record<PlanTier, number> = { free: 0, starter: 1, team: 2 }

/** Whether the promo window is currently open. Both env gates must hold. */
export function freeAccessActive(env: Pick<Env, 'FREE_ACCESS_ALL' | 'FREE_ACCESS_UNTIL'>, now = Date.now()): boolean {
  if (env.FREE_ACCESS_ALL !== 'true') return false
  const until = Date.parse(env.FREE_ACCESS_UNTIL ?? '')
  return Number.isFinite(until) && now < until
}

/** Tier granted while the window is open. Defaults to `team`. */
export function grantedTier(env: Pick<Env, 'FREE_ACCESS_TIER'>): PlanTier {
  return env.FREE_ACCESS_TIER === 'starter' ? 'starter' : 'team'
}

/**
 * Resolve the tier a request should be served at.
 *
 * Only ever upgrades: a paying `starter` customer is served the granted tier
 * while the promo runs and falls back to `starter` — never `free` — when it
 * lapses. Callers that read `users.plan` (or a team's stored plan) directly
 * MUST pass it through here, otherwise the promo silently misses that surface.
 */
export function effectivePlan(env: FreeAccessEnv, stored: PlanTier, now = Date.now()): PlanTier {
  if (!freeAccessActive(env, now)) return stored
  const granted = grantedTier(env)
  return TIER_RANK[granted] > TIER_RANK[stored] ? granted : stored
}

export type FreeAccessEnv = Pick<Env, 'FREE_ACCESS_ALL' | 'FREE_ACCESS_UNTIL' | 'FREE_ACCESS_TIER'>

export type FreeAccessStatus = {
  active: boolean
  /** ISO-8601 close time, or null when the promo is off or misconfigured. */
  until: string | null
  /** Tier granted while active, or null when inactive. */
  granted_tier: PlanTier | null
}

/**
 * Promo status for API payloads (`/api/auth/me`, `/api/plans/catalog`). The SPA
 * uses this to render the countdown banner and suppress upgrade CTAs.
 */
export function freeAccessStatus(env: FreeAccessEnv, now = Date.now()): FreeAccessStatus {
  const active = freeAccessActive(env, now)
  if (!active) return { active: false, until: null, granted_tier: null }
  const until = Date.parse(env.FREE_ACCESS_UNTIL ?? '')
  return {
    active: true,
    until: new Date(until).toISOString(),
    granted_tier: grantedTier(env),
  }
}

export const __internal = { TIER_RANK }
