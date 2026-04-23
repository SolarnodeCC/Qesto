import { describe, it, expect, beforeEach, vi } from 'vitest'
import { recordMetric, readBucket, percentile, bucketKeyFor } from '../../functions/api/lib/metrics-kv'

describe('Metrics KV — Time-Series Bucketing', () => {
  let mockKV: any

  beforeEach(() => {
    mockKV = {
      put: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue(null),
    }
  })

  // bucketKeyFor returns { dateKey, minuteKey } — tests combine them to compare
  describe('bucketKeyFor', () => {
    it('generates key with YYYYMMDDHHMM format', () => {
      const key = bucketKeyFor(new Date('2026-04-21T14:35:00Z'))
      const combined = key.dateKey + key.minuteKey
      expect(combined).toMatch(/^\d{12}$/)
      expect(combined).toBe('202604211435')
    })

    it('zero-pads month and day', () => {
      const key = bucketKeyFor(new Date('2026-01-05T09:05:00Z'))
      const combined = key.dateKey + key.minuteKey
      expect(combined).toBe('202601050905')
    })
  })

  // recordMetric writes 3 separate KV keys (latency array, error_count, request_count)
  describe('recordMetric', () => {
    it('records latency for a route', async () => {
      await recordMetric(
        mockKV,
        'GET /api/sessions',
        150,
        200,
        'user123',
        'trace456',
      )

      expect(mockKV.put).toHaveBeenCalled()
      const keys = mockKV.put.mock.calls.map((c: string[]) => c[0])
      expect(keys.some((k: string) => k.startsWith('metrics:'))).toBe(true)
      expect(keys.some((k: string) => k.includes('GET__api_sessions'))).toBe(true)
    })

    it('increments error_count on status >= 500', async () => {
      await recordMetric(
        mockKV,
        'POST /api/votes',
        300,
        500,
        'user123',
        'trace456',
      )

      const errorCall = mockKV.put.mock.calls.find((c: string[]) => c[0].endsWith(':error_count'))
      expect(errorCall).toBeDefined()
      expect(Number.parseInt(errorCall[1], 10)).toBeGreaterThan(0)
    })

    it('does not increment error_count on status < 500', async () => {
      await recordMetric(
        mockKV,
        'POST /api/votes',
        300,
        404,
        'user123',
        'trace456',
      )

      const errorCall = mockKV.put.mock.calls.find((c: string[]) => c[0].endsWith(':error_count'))
      expect(errorCall).toBeDefined()
      expect(Number.parseInt(errorCall[1], 10)).toBe(0)
    })

    it('does not leak user_id into KV key', async () => {
      await recordMetric(
        mockKV,
        'GET /api/sessions',
        100,
        200,
        'secret_user_123',
        'trace456',
      )

      const keys = mockKV.put.mock.calls.map((c: string[]) => c[0])
      for (const key of keys) {
        expect(key).not.toContain('secret_user_123')
      }
    })

    it('sets 7-day TTL on KV write', async () => {
      await recordMetric(
        mockKV,
        'GET /api/sessions',
        100,
        200,
        'user123',
        'trace456',
      )

      const options = mockKV.put.mock.calls[0][2]
      expect(options.expirationTtl).toBe(7 * 24 * 60 * 60)
    })
  })

  describe('percentile', () => {
    it('calculates p50 (median)', () => {
      const samples = [100, 150, 200, 250, 300]
      const p50 = percentile(samples, 50)
      expect(p50).toBe(200)
    })

    it('calculates p95', () => {
      const samples = Array.from({ length: 100 }, (_, i) => i + 1)
      const p95 = percentile(samples, 95)
      expect(p95).toBeGreaterThanOrEqual(95)
      expect(p95).toBeLessThanOrEqual(100)
    })

    it('handles single sample', () => {
      const p50 = percentile([42], 50)
      expect(p50).toBe(42)
    })

    it('clamps index to valid range', () => {
      const samples = [10, 20, 30]
      const p99 = percentile(samples, 99)
      expect(p99).toBe(30)
    })
  })

  // readBucket uses 3 separate KV keys — mock them individually
  describe('readBucket', () => {
    it('parses KV bucket and calculates percentiles', async () => {
      const latencySamples = [100, 150, 200, 250, 300, 350, 400, 450, 500].map((latency_ms) => ({
        latency_ms,
        status: 200,
        trace_id: 'test',
        ts: Date.now(),
      }))
      // readBucket calls kv.get 3 times: latency (json), error_count, request_count
      mockKV.get
        .mockResolvedValueOnce(latencySamples) // latency array (pre-parsed by KV json type)
        .mockResolvedValueOnce('2')             // error_count
        .mockResolvedValueOnce('100')           // request_count

      const result = await readBucket(
        mockKV,
        'GET /api/sessions',
        new Date(),
      )

      expect(result).toHaveProperty('p50')
      expect(result).toHaveProperty('p95')
      expect(result).toHaveProperty('p99')
      expect(result?.error_rate).toBeCloseTo(0.02, 2)
    })

    it('returns null for missing bucket', async () => {
      // All 3 KV reads return null
      const result = await readBucket(
        mockKV,
        'GET /api/sessions',
        new Date(),
      )

      expect(result).toBeNull()
    })
  })
})
