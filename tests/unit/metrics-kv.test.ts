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

  describe('bucketKeyFor', () => {
    it('generates key with YYYYMMDDHHMM format', () => {
      const key = bucketKeyFor(new Date('2026-04-21T14:35:00Z'))
      expect(key).toMatch(/^\d{12}$/)
      expect(key).toBe('202604211435')
    })

    it('zero-pads month and day', () => {
      const key = bucketKeyFor(new Date('2026-01-05T09:05:00Z'))
      expect(key).toBe('202601050905')
    })
  })

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
      const [key] = mockKV.put.mock.calls[0]
      expect(key).toContain('metrics:')
      expect(key).toContain('GET_/api/sessions') // route slug
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

      const [, value] = mockKV.put.mock.calls[0]
      const parsed = JSON.parse(value)
      expect(parsed.error_count).toBeGreaterThan(0)
    })

    it('does not increment error_count on status < 500', async () => {
      mockKV.get.mockResolvedValueOnce(null) // no existing data

      await recordMetric(
        mockKV,
        'POST /api/votes',
        300,
        404,
        'user123',
        'trace456',
      )

      const [, value] = mockKV.put.mock.calls[0]
      const parsed = JSON.parse(value)
      expect(parsed.error_count).toBe(0)
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

      const [key] = mockKV.put.mock.calls[0]
      expect(key).not.toContain('secret_user_123')
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

      const [, , options] = mockKV.put.mock.calls[0]
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

  describe('readBucket', () => {
    it('parses KV bucket and calculates percentiles', async () => {
      const bucketData = {
        latencies: [100, 150, 200, 250, 300, 350, 400, 450, 500],
        error_count: 2,
        request_count: 100,
      }
      mockKV.get.mockResolvedValueOnce(JSON.stringify(bucketData))

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
      mockKV.get.mockResolvedValueOnce(null)

      const result = await readBucket(
        mockKV,
        'GET /api/sessions',
        new Date(),
      )

      expect(result).toBeNull()
    })
  })
})
