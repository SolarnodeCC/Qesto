// KV caching middleware — reduce D1 load on frequently-accessed data (Phase 10 Step 2)
//
// Strategy:
// - Plan usage: 5 min TTL (changes infrequently, high-query volume)
// - Team metadata: 10 min TTL (ownership, settings, limits)
// - User roles: 5 min TTL (role changes less frequent)
// - Leaderboard: 1 min TTL (updates frequently during sessions)

import { MiddlewareHandler } from 'hono'
import type { Env } from '../types'
import type { AuthVariables } from './auth'

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
      const cached = await c.env.DECISIONS_KV.get(key, 'json')
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

  // Helper to set in KV with TTL
  const setCached = async (key: string, data: any, ttl_sec: number): Promise<void> => {
    try {
      await c.env.DECISIONS_KV.put(
        key,
        JSON.stringify({ data, expires_at: Date.now() + ttl_sec * 1000 }),
        { expirationTtl: ttl_sec }
      )
    } catch (err) {
      console.error(`[kv-cache] Failed to cache ${key}:`, err)
    }
  }

  // Pre-load plan usage cache for current user
  if (user?.sub) {
    const planUsageKey = `cache:plan:${user.sub}`
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
  const key = `cache:plan:${userId}`
  try {
    await c.env.DECISIONS_KV.put(
      key,
      JSON.stringify({ data: usage, expires_at: Date.now() + ttl * 1000 }),
      { expirationTtl: ttl }
    )
  } catch (err) {
    console.error(`[kv-cache] Failed to cache plan usage:`, err)
  }
}

/**
 * Get cached plan usage or fetch from D1
 */
export async function getPlanUsageWithCache(
  c: any,
  userId: string
): Promise<Record<string, any>> {
  const key = `cache:plan:${userId}`

  // Try cache first
  try {
    const cached = await c.env.DECISIONS_KV.get(key, 'json')
    if (cached && cached.expires_at && cached.expires_at > Date.now()) {
      return cached.data
    }
  } catch (err) {
    // Fall through to D1 fetch
  }

  // Fetch from D1
  const result = await (c.env.DB.prepare as any)(
    `SELECT plan, sessions_used, sessions_limit, results_viewed, results_limit, exports_used, exports_limit
     FROM users WHERE id = ?1`,
  )
    .bind(userId)
    .first()

  if (result) {
    const usage = {
      plan: result.plan,
      sessions: { used: result.sessions_used || 0, limit: result.sessions_limit || 100 },
      results: { used: result.results_viewed || 0, limit: result.results_limit || 500 },
      exports: { used: result.exports_used || 0, limit: result.exports_limit || 50 },
    }

    // Cache for 5 minutes
    await cachePlanUsage(c, userId, usage, 5 * 60)
    return usage
  }

  return { sessions: { used: 0, limit: 100 }, results: { used: 0, limit: 500 }, exports: { used: 0, limit: 50 } }
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
  const key = `cache:team:${teamId}`
  try {
    await c.env.DECISIONS_KV.put(
      key,
      JSON.stringify({ data: metadata, expires_at: Date.now() + ttl * 1000 }),
      { expirationTtl: ttl }
    )
  } catch (err) {
    console.error(`[kv-cache] Failed to cache team metadata:`, err)
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
  const key = `cache:roles:${userId}`
  try {
    await c.env.DECISIONS_KV.put(
      key,
      JSON.stringify({ data: roles, expires_at: Date.now() + ttl * 1000 }),
      { expirationTtl: ttl }
    )
  } catch (err) {
    console.error(`[kv-cache] Failed to cache user roles:`, err)
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
  const key = `cache:leaderboard:${sessionId}`
  try {
    await c.env.DECISIONS_KV.put(
      key,
      JSON.stringify({ data: entries, expires_at: Date.now() + ttl * 1000 }),
      { expirationTtl: ttl }
    )
  } catch (err) {
    console.error(`[kv-cache] Failed to cache leaderboard:`, err)
  }
}

/**
 * Invalidate cache entries (on mutation)
 */
export async function invalidateCache(c: any, ...keys: string[]): Promise<void> {
  for (const key of keys) {
    try {
      await c.env.DECISIONS_KV.delete(key)
    } catch (err) {
      // Ignore delete errors
    }
  }
}
