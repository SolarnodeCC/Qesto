import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { RateLimiter, pruneRateLimitMap } from '../../functions/api/lib/session-room-rate-limiter'

/**
 * Phase 2: Session Room Rate Limiter — IP and vote token bucket tests
 *
 * Tests verify:
 * - IP-level connection rate limiting (per-minute caps)
 * - Token bucket refill and consumption
 * - Rate limit state persistence
 */

describe('RateLimiter', () => {
  let storage: { get: any; put: any }
  let limiter: RateLimiter

  beforeEach(() => {
    // Mock DurableObjectStorage
    storage = {
      get: vi.fn(),
      put: vi.fn(),
    }
    limiter = new RateLimiter(storage as any)
  })

  describe('checkIpRateLimit', () => {
    it('allows first connection within limit', async () => {
      storage.get.mockResolvedValue(null)
      storage.put.mockResolvedValue(undefined)

      const result = await limiter.checkIpRateLimit('ip:192.168.1.1', 10)

      expect(result).toBe(false)
      expect(storage.put).toHaveBeenCalledOnce()
      const [, stored] = storage.put.mock.calls[0]
      expect(stored['ip:192.168.1.1']).toHaveLength(1)
    })

    it('allows multiple connections below limit', async () => {
      const now = Date.now()
      const existing = [now - 5000, now - 3000, now - 1000]
      storage.get.mockResolvedValue({ 'ip:192.168.1.1': existing })
      storage.put.mockResolvedValue(undefined)

      const result = await limiter.checkIpRateLimit('ip:192.168.1.1', 10)

      expect(result).toBe(false)
      const [, stored] = storage.put.mock.calls[0]
      expect(stored['ip:192.168.1.1']).toHaveLength(4) // 3 existing + 1 new
    })

    it('rejects connection when limit is reached', async () => {
      const now = Date.now()
      // 10 recent connections (at the limit)
      const existing = Array.from({ length: 10 }, (_, i) => now - (i + 1) * 1000)
      storage.get.mockResolvedValue({ 'ip:192.168.1.1': existing })

      const result = await limiter.checkIpRateLimit('ip:192.168.1.1', 10)

      expect(result).toBe(true)
      // Storage should not be updated when rejected
      expect(storage.put).not.toHaveBeenCalled()
    })

    it('cleans up old timestamps outside 60-second window', async () => {
      const now = Date.now()
      const oldTimestamps = [now - 70000, now - 65000] // Outside 60s window
      const recentTimestamps = [now - 30000, now - 5000] // Within window
      const allTimestamps = [...oldTimestamps, ...recentTimestamps]

      storage.get.mockResolvedValue({ 'ip:192.168.1.1': allTimestamps })
      storage.put.mockResolvedValue(undefined)

      const result = await limiter.checkIpRateLimit('ip:192.168.1.1', 10)

      expect(result).toBe(false)
      const [, stored] = storage.put.mock.calls[0]
      // Should only have 2 recent + 1 new = 3 timestamps
      expect(stored['ip:192.168.1.1']).toHaveLength(3)
      expect(stored['ip:192.168.1.1']).not.toContain(oldTimestamps[0])
    })

    it('tracks multiple IPs independently', async () => {
      const now = Date.now()
      storage.get.mockResolvedValue({
        'ip:192.168.1.1': [now - 5000, now - 3000],
        'ip:10.0.0.1': [now - 4000],
      })
      storage.put.mockResolvedValue(undefined)

      const result = await limiter.checkIpRateLimit('ip:192.168.1.1', 10)

      expect(result).toBe(false)
      const [, stored] = storage.put.mock.calls[0]
      expect(stored['ip:192.168.1.1']).toHaveLength(3) // 2 existing + 1 new
      expect(stored['ip:10.0.0.1']).toHaveLength(1) // Unchanged
    })

    it('handles edge case: limit exactly at threshold', async () => {
      const now = Date.now()
      const existing = Array.from({ length: 9 }, (_, i) => now - (i + 1) * 1000)
      storage.get.mockResolvedValue({ 'ip:192.168.1.1': existing })
      storage.put.mockResolvedValue(undefined)

      const result = await limiter.checkIpRateLimit('ip:192.168.1.1', 10)

      expect(result).toBe(false) // Still have room for 1 more
      const [, stored] = storage.put.mock.calls[0]
      expect(stored['ip:192.168.1.1']).toHaveLength(10)
    })

    it('handles edge case: limit exceeded by 1', async () => {
      const now = Date.now()
      const existing = Array.from({ length: 10 }, (_, i) => now - (i + 1) * 1000)
      storage.get.mockResolvedValue({ 'ip:192.168.1.1': existing })

      const result = await limiter.checkIpRateLimit('ip:192.168.1.1', 10)

      expect(result).toBe(true)
    })

    it('persists state to storage', async () => {
      const now = Date.now()
      storage.get.mockResolvedValue({ 'ip:192.168.1.1': [now - 5000] })
      storage.put.mockResolvedValue(undefined)

      await limiter.checkIpRateLimit('ip:192.168.1.1', 10)

      expect(storage.put).toHaveBeenCalledWith(
        'ip_rate_limit',
        expect.objectContaining({
          'ip:192.168.1.1': expect.arrayContaining([expect.any(Number)])
        })
      )
    })

    it('handles storage failure gracefully', async () => {
      storage.get.mockRejectedValue(new Error('Storage error'))

      // Should throw, not suppress the error
      await expect(limiter.checkIpRateLimit('ip:192.168.1.1', 10)).rejects.toThrow()
    })

    // #582: the per-IP map must not grow unbounded.
    it('prunes entries that have only stale timestamps when a new IP connects', async () => {
      const now = Date.now()
      storage.get.mockResolvedValue({
        // entirely outside the 60s window → should be pruned
        'ip:stale': [now - 120_000, now - 90_000],
        // still active → retained
        'ip:active': [now - 1_000],
      })
      storage.put.mockResolvedValue(undefined)

      const result = await limiter.checkIpRateLimit('ip:new', 10)

      expect(result).toBe(false)
      const [, stored] = storage.put.mock.calls[0]
      expect(stored['ip:stale']).toBeUndefined()
      expect(stored['ip:active']).toBeDefined()
      expect(stored['ip:new']).toHaveLength(1)
    })

    it('never prunes the IP currently connecting even if its own old timestamps expire', async () => {
      const now = Date.now()
      storage.get.mockResolvedValue({ 'ip:me': [now - 120_000] })
      storage.put.mockResolvedValue(undefined)

      await limiter.checkIpRateLimit('ip:me', 10)

      const [, stored] = storage.put.mock.calls[0]
      // The fresh timestamp keeps it alive.
      expect(stored['ip:me']).toHaveLength(1)
    })
  })

  describe('pruneRateLimitMap (#582)', () => {
    it('deletes keys whose timestamps are all stale', () => {
      const now = Date.now()
      const cutoff = now - 60_000
      const map: Record<string, number[]> = {
        a: [now - 120_000],
        b: [now - 1_000],
      }
      pruneRateLimitMap(map, cutoff, 'b')
      expect(map.a).toBeUndefined()
      expect(map.b).toHaveLength(1)
    })

    it('bounds the map size by evicting oldest-active keys', () => {
      const now = Date.now()
      const cutoff = now - 60_000
      const map: Record<string, number[]> = {}
      // 10,005 active keys with increasing recency.
      for (let i = 0; i < 10_005; i++) {
        map[`ip:${i}`] = [now - (10_005 - i)]
      }
      pruneRateLimitMap(map, cutoff, 'ip:10004')
      expect(Object.keys(map).length).toBeLessThanOrEqual(10_000)
      // The most-recent key (and keepKey) survive; the oldest are evicted.
      expect(map['ip:10004']).toBeDefined()
      expect(map['ip:0']).toBeUndefined()
    })
  })

  describe('consumeVoteToken (static)', () => {
    // Pin the clock so elapsed-time refill is exact. Without this, the few
    // milliseconds between capturing `lastAt` and the internal `Date.now()`
    // call refill fractional tokens (refillPerSec=2 → 0.002/ms), making
    // exact-equality assertions like `toBe(4)` non-deterministic under CI load.
    const FIXED_NOW = 1_700_000_000_000
    beforeEach(() => {
      vi.spyOn(Date, 'now').mockReturnValue(FIXED_NOW)
    })
    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('consumes token when available', () => {
      const bucket = { tokens: 5, lastAt: Date.now() }
      const result = RateLimiter.consumeVoteToken(bucket, 10, 2)

      expect(result.allowed).toBe(true)
      expect(result.bucket.tokens).toBe(4)
    })

    it('denies token when none available', () => {
      const bucket = { tokens: 0, lastAt: Date.now() }
      const result = RateLimiter.consumeVoteToken(bucket, 10, 2)

      expect(result.allowed).toBe(false)
      expect(result.bucket.tokens).toBe(0)
    })

    it('refills tokens over time', () => {
      const now = Date.now()
      const bucket = { tokens: 1, lastAt: now - 2000 } // 2 seconds ago

      // At 2 refills/sec, should have 1 + 2*2 = 5 tokens, consume 1 → 4
      const result = RateLimiter.consumeVoteToken(bucket, 10, 2)

      expect(result.allowed).toBe(true)
      expect(result.bucket.tokens).toBe(4)
    })

    it('caps refill at capacity', () => {
      const now = Date.now()
      const bucket = { tokens: 8, lastAt: now - 10000 } // 10 seconds ago

      // 10 seconds * 2 refills/sec = 20 tokens, but capped at capacity (10)
      // So: min(10, 8 + 20) = 10, consume 1 → 9
      const result = RateLimiter.consumeVoteToken(bucket, 10, 2)

      expect(result.allowed).toBe(true)
      expect(result.bucket.tokens).toBe(9)
    })

    it('updates lastAt to now', () => {
      const oldTime = Date.now() - 5000
      const bucket = { tokens: 5, lastAt: oldTime }

      const before = Date.now()
      const result = RateLimiter.consumeVoteToken(bucket, 10, 2)
      const after = Date.now()

      expect(result.bucket.lastAt).toBeGreaterThanOrEqual(before)
      expect(result.bucket.lastAt).toBeLessThanOrEqual(after)
    })

    it('handles zero refill rate', () => {
      const now = Date.now()
      const bucket = { tokens: 1, lastAt: now - 10000 }

      // No refill, so just consume from 1 token
      const result = RateLimiter.consumeVoteToken(bucket, 10, 0)

      expect(result.allowed).toBe(true)
      expect(result.bucket.tokens).toBe(0)
    })

    it('handles very high refill rate', () => {
      const now = Date.now()
      const bucket = { tokens: 0, lastAt: now - 1 } // 1ms ago

      // At 1000 refills/sec, 1ms = 1 token
      const result = RateLimiter.consumeVoteToken(bucket, 10, 1000)

      expect(result.allowed).toBe(true)
      expect(result.bucket.tokens).toBeGreaterThanOrEqual(0)
    })

    it('does not exceed capacity after refill and consume', () => {
      const now = Date.now()
      const bucket = { tokens: 9, lastAt: now - 100 } // 100ms ago

      // 100ms * 2 refills/sec = 0.2 tokens refilled
      // 9 + 0.2 = 9.2, consume 1 → 8.2, cap still under 10
      const result = RateLimiter.consumeVoteToken(bucket, 10, 2)

      expect(result.bucket.tokens).toBeLessThanOrEqual(10)
      expect(result.bucket.tokens).toBeGreaterThanOrEqual(0)
    })
  })
})
