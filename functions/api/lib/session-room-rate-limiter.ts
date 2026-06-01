/**
 * session-room-rate-limiter.ts
 * RateLimiter collaborator for SessionRoom.
 * Owns IP-level connect rate limiting and the vote token-bucket.
 * Previously inline in SessionRoom.ts — extracted as part of TD-01 refactor.
 * See TECH_DEBT_AUDIT_2026-05.md TD-01.
 */

import type { DurableObjectStorage } from '@cloudflare/workers-types'

const K_IP_RATE_LIMIT = 'ip_rate_limit'

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
