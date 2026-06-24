/**
 * session-room-rate-limiter.ts
 * RateLimiter collaborator for SessionRoom.
 * Owns IP-level connect rate limiting and the vote token-bucket.
 * Previously inline in SessionRoom.ts — extracted as part of TD-01 refactor.
 * See TECH_DEBT_AUDIT_2026-05.md TD-01.
 */

import type { DurableObjectStorage } from '@cloudflare/workers-types'

const K_IP_RATE_LIMIT = 'ip_rate_limit'

// Backstop against unbounded growth of the per-IP rate-limit map (#582). Even
// with empty-entry pruning, a flood of distinct source IPs (or spoofed
// X-Forwarded-For values upstream) could grow the map without bound. We cap the
// number of tracked IP keys and evict the least-recently-active ones.
const MAX_TRACKED_IPS = 10_000

export class RateLimiter {
  constructor(private readonly storage: DurableObjectStorage) {}

  /**
   * Check if an IP has exceeded its per-minute connection rate.
   * Records the attempt and returns true when the limit is exceeded.
   */
  async checkIpRateLimit(ipHash: string, maxPerMin: number): Promise<boolean> {
    const limits = (await this.storage.get<Record<string, number[]>>(K_IP_RATE_LIMIT)) ?? {}
    const nowMs = Date.now()
    const cutoffMs = nowMs - 60_000

    const timestamps = limits[ipHash] ?? []
    const recent = timestamps.filter((ts) => ts > cutoffMs)

    if (recent.length >= maxPerMin) return true

    recent.push(nowMs)
    limits[ipHash] = recent

    pruneRateLimitMap(limits, cutoffMs, ipHash)

    await this.storage.put(K_IP_RATE_LIMIT, limits)
    return false
  }

  /**
   * Refill a token-bucket and consume one token.
   * Returns the updated bucket and whether the token was consumed.
   */
  static consumeVoteToken(
    bucket: { tokens: number; lastAt: number },
    capacity: number,
    refillPerSec: number,
  ): { bucket: { tokens: number; lastAt: number }; allowed: boolean } {
    const nowMs = Date.now()
    const elapsed = (nowMs - bucket.lastAt) / 1000
    const refilled = Math.min(capacity, bucket.tokens + elapsed * refillPerSec)
    if (refilled < 1) {
      return { bucket: { tokens: refilled, lastAt: nowMs }, allowed: false }
    }
    return { bucket: { tokens: refilled - 1, lastAt: nowMs }, allowed: true }
  }
}

/**
 * Prune the per-IP rate-limit map in place (#582):
 *  - drop entries whose every timestamp is older than the window (empty after
 *    filtering), so idle IPs do not accumulate forever;
 *  - if the map still exceeds MAX_TRACKED_IPS, evict the entries with the oldest
 *    most-recent activity until under the cap (never evicting `keepKey`, the IP
 *    we just recorded).
 */
export function pruneRateLimitMap(
  limits: Record<string, number[]>,
  cutoffMs: number,
  keepKey: string,
): void {
  for (const key of Object.keys(limits)) {
    if (key === keepKey) continue
    const recent = limits[key].filter((ts) => ts > cutoffMs)
    if (recent.length === 0) {
      delete limits[key]
    } else {
      limits[key] = recent
    }
  }

  const keys = Object.keys(limits)
  if (keys.length <= MAX_TRACKED_IPS) return

  // Evict by oldest last-activity timestamp first.
  const sortable = keys
    .filter((k) => k !== keepKey)
    .map((k) => ({ k, last: limits[k].length ? Math.max(...limits[k]) : 0 }))
    .sort((a, b) => a.last - b.last)

  let toEvict = keys.length - MAX_TRACKED_IPS
  for (const { k } of sortable) {
    if (toEvict <= 0) break
    delete limits[k]
    toEvict--
  }
}
