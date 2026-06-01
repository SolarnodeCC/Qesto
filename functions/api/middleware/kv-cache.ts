// KV caching middleware — reduce D1 load on frequently-accessed data (Phase 10 Step 2)
//
// Strategy:
// - Plan usage: 5 min TTL (changes infrequently, high-query volume)
// - Team metadata: 10 min TTL (ownership, settings, limits)
// - User roles: 5 min TTL (role changes less frequent)
// - Leaderboard: 1 min TTL (updates frequently during sessions)

import { MiddlewareHandler } from 'hono'
import type { Env, PlanTier } from '../types'
import { safeLogContext } from '../lib/log'
import { PLAN_QUOTAS } from '../types'
import { getQuotaUsage } from '../lib/quota'
import {
  cacheLeaderboardKey,
  cachePlanUsageKey,
  cacheTeamMetadataKey,
  cacheUserRolesKey,
} from '../lib/kv-keys'
import type { AuthVariables } from './auth'
import { validateData, CachedDataSchema } from '../lib/validators'
import type { UserRow } from '../lib/db-row-types'

/** Route cache keys to the KV namespace that owns that domain (ST-04 — never DECISIONS_KV). */
export function kvNamespaceForCacheKey(key: string): 'USERS_KV' | 'TEAMS_KV' | 'SESSIONS_KV' {
  if (key.startsWith('cache:team:')) return 'TEAMS_KV'
  if (key.startsWith('cache:leaderboard:')) return 'SESSIONS_KV'
  return 'USERS_KV'
}

function cacheKv(c: { env: Env }, key: string): KVNamespace {
  return c.env[kvNamespaceForCacheKey(key)]
}

export interface CacheVariables {
  cachedPlanUsage?: Record<string, any>
  cachedTeamMetadata?: Record<string, any>
  cachedUserRoles?: Record<string, any>
  cacheHit?: boolean
}

export const kvCacheMiddleware: MiddlewareHandler<{
  Bindings: Env
  Variables: AuthVariables & CacheVariables
}> = async (c, next) => {
  const user = c.get('user')
  const cacheMarkings: Record<string, string> = {}

  // Helper to get from KV with TTL check
  const getCached = async (key: string): Promise<any | null> => {
    try {
      const cached = await cacheKv(c, key).get(key, 'json') as { data: unknown; expires_at: number } | null
      if (cached && cached.expires_at && cached.expires_at > Date.now()) {
        cacheMarkings[key] = 'HIT'
        return cached.data
      }
      if (cached) {
        cacheMarkings[key] = 'EXPIRED'
      }
    } catch (err) {
      cacheMarkings[key] = 'ERROR'
    }
    return null
  }

  // Pre-load plan usage cache for current user
  if (user?.sub) {
    const planUsageKey = cachePlanUsageKey(user.sub)
    const cached = await getCached(planUsageKey)

    if (cached) {
      c.set('cachedPlanUsage', cached)
      c.set('cacheHit', true)
    }
  }

  // Proceed to next middleware
  await next()

  // Post-response: populate cache for future requests if data was fetched
  // (This would be done in route handlers when setting plan usage data)
}

/**
 * Cache plan usage quota for a user (prevents repeated D1 queries)
 * TTL: 5 minutes (plan limits change infrequently)
 */
export async function cachePlanUsage(
  c: any,
  userId: string,
  usage: Record<string, any>,
  ttl: number = 5 * 60
): Promise<void> {
  const key = cachePlanUsageKey(userId)
  try {
    await cacheKv(c, key).put(
      key,
      JSON.stringify({ data: usage, expires_at: Date.now() + ttl * 1000 }),
      { expirationTtl: ttl }
    )
  } catch (err) {
    safeLogContext(err, { traceId: 'system', route: 'kv-cache/plan-usage', errorClass: err instanceof Error ? err.name : 'UnknownError' })
  }
}

/**
 * Get cached plan usage or fetch from D1
 */
export async function getPlanUsageWithCache(
  c: any,
  userId: string
): Promise<Record<string, any>> {
  const key = cachePlanUsageKey(userId)

  // Try cache first
  try {
    const raw = await c.env.USERS_KV.get(key, 'json')
    const cached = validateData(raw, CachedDataSchema)
    if (cached && cached.expires_at && cached.expires_at > Date.now()) {
      return cached.data as Record<string, any>
    }
  } catch {
    // Fall through to D1 + quota KV
  }

  const row = (await c.env.DB.prepare(
    `SELECT plan FROM users WHERE id = ?1`,
  ).bind(userId).first()) as Pick<UserRow, "plan"> | null

  const plan: PlanTier = row?.plan ?? 'free'
  const sessionLimit = PLAN_QUOTAS[plan].maxSessionsPerMonth
  const quota = await getQuotaUsage(c.env.SESSIONS_KV, userId, sessionLimit)

  const usage = {
    plan,
    sessions: {
      used: quota.sessions_created,
      limit: quota.limit,
      remaining: quota.remaining,
    },
  }

  await cachePlanUsage(c, userId, usage, 5 * 60)
  return usage
}

/**
 * Cache team metadata (rarely changes)
 * TTL: 10 minutes
 */
export async function cacheTeamMetadata(
  c: any,
  teamId: string,
  metadata: Record<string, any>,
  ttl: number = 10 * 60
): Promise<void> {
  const key = cacheTeamMetadataKey(teamId)
  try {
    await cacheKv(c, key).put(
      key,
      JSON.stringify({ data: metadata, expires_at: Date.now() + ttl * 1000 }),
      { expirationTtl: ttl }
    )
  } catch (err) {
    safeLogContext(err, { traceId: 'system', route: 'kv-cache/team-metadata', errorClass: err instanceof Error ? err.name : 'UnknownError' })
  }
}

/**
 * Cache user roles (changes infrequently)
 * TTL: 5 minutes
 */
export async function cacheUserRoles(
  c: any,
  userId: string,
  roles: string[],
  ttl: number = 5 * 60
): Promise<void> {
  const key = cacheUserRolesKey(userId)
  try {
    await cacheKv(c, key).put(
      key,
      JSON.stringify({ data: roles, expires_at: Date.now() + ttl * 1000 }),
      { expirationTtl: ttl }
    )
  } catch (err) {
    safeLogContext(err, { traceId: 'system', route: 'kv-cache/user-roles', errorClass: err instanceof Error ? err.name : 'UnknownError' })
  }
}

/**
 * Cache session leaderboard (updates frequently)
 * TTL: 1 minute (refresh frequently for live updates)
 */
export async function cacheLeaderboard(
  c: any,
  sessionId: string,
  entries: Record<string, any>[],
  ttl: number = 1 * 60
): Promise<void> {
  const key = cacheLeaderboardKey(sessionId)
  try {
    await cacheKv(c, key).put(
      key,
      JSON.stringify({ data: entries, expires_at: Date.now() + ttl * 1000 }),
      { expirationTtl: ttl }
    )
  } catch (err) {
    safeLogContext(err, { traceId: 'system', route: 'kv-cache/leaderboard', errorClass: err instanceof Error ? err.name : 'UnknownError' })
  }
}

/**
 * Invalidate cache entries (on mutation)
 */
export async function invalidateCache(c: { env: Env }, ...keys: string[]): Promise<void> {
  for (const key of keys) {
    try {
      await cacheKv(c, key).delete(key)
    } catch {
      // Ignore delete errors
    }
  }
}
