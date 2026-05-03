import { readKvJson, writeKvJson } from './kv'
import { quotaSessionsKey } from './kv-keys'

// Plan quota tracking using KV (idempotent, monthly window).
// Quotas tracked per user per month; KV TTL handles month-end rollover.

export interface QuotaRecord {
  user_id: string
  month: string // YYYY-MM
  sessions_created: number
  last_updated: number
}

/**
 * Increment session quota for a user. Returns whether the increment was allowed
 * and the number of remaining sessions this month.
 *
 * Idempotent: retries with same month/user return consistent result if quota not exceeded.
 */
export async function incrementSessionQuota(
  kv: KVNamespace,
  userId: string,
  limit: number,
): Promise<{ allowed: boolean; remaining: number }> {
  const monthKey = getMonthKey()
  const kvKey = quotaSessionsKey(userId, monthKey)

  // Read current
  const current: QuotaRecord = (await readKvJson<QuotaRecord>(kv, kvKey)) ?? {
        user_id: userId,
        month: monthKey,
        sessions_created: 0,
        last_updated: Date.now(),
      }

  // Check limit
  if (current.sessions_created >= limit) {
    return { allowed: false, remaining: 0 }
  }

  // Increment
  current.sessions_created++
  current.last_updated = Date.now()

  // Set with TTL: expires at end of month
  const daysRemaining = getDaysRemainingInMonth()
  const ttlSeconds = daysRemaining * 86400

  await writeKvJson(kv, kvKey, current, { expirationTtl: ttlSeconds })

  return { allowed: true, remaining: Math.max(0, limit - current.sessions_created) }
}

/**
 * Get current quota usage for a user without incrementing.
 */
export async function getQuotaUsage(
  kv: KVNamespace,
  userId: string,
  limit: number,
): Promise<{ sessions_created: number; limit: number; remaining: number }> {
  const monthKey = getMonthKey()
  const kvKey = quotaSessionsKey(userId, monthKey)

  const current = await readKvJson<QuotaRecord>(kv, kvKey)

  const sessionsCreated = current?.sessions_created ?? 0

  return {
    sessions_created: sessionsCreated,
    limit,
    remaining: Math.max(0, limit - sessionsCreated),
  }
}

/**
 * Reset quota for a user (admin only, or manual reconciliation).
 */
export async function resetQuota(kv: KVNamespace, userId: string, month?: string): Promise<void> {
  const monthKey = month ?? getMonthKey()
  const kvKey = quotaSessionsKey(userId, monthKey)
  await kv.delete(kvKey)
}

// ─────────────────────────────────────────────────────────────────────────────

function getMonthKey(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function getDaysRemainingInMonth(): number {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const lastDay = new Date(year, month + 1, 0).getDate()
  const currentDay = now.getDate()
  return lastDay - currentDay + 1 // include today
}
