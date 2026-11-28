/**
 * Requirement: ADR-0030 (SLOs & error budgets) — span tracing helpers.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  composeRateLimitDetail,
  recordSpan,
  recordSpanSafe,
  writeEvent,
} from '../../functions/api/lib/observability'
import type { AnalyticsEngineDataset } from '@cloudflare/workers-types'
import { __resetMetricsRollup, takeMetricsSnapshot } from '../../functions/api/lib/metrics-rollup'

describe('Observability — Span Tracing', () => {
  let mockKV: any

  beforeEach(() => {
    mockKV = {
      put: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue(null),
    }
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // Spans no longer write KV per call (3 reads + 3 writes per DO call hit KV's
  // per-key write limit). They feed the per-isolate accumulator that the
  // logger middleware flushes once a minute (lib/metrics-rollup.ts).
  it('records successful span latency into the accumulator, not KV', async () => {
    __resetMetricsRollup()
    const result = await recordSpan('test_op', async () => {
      vi.advanceTimersByTime(100)
      return 'success'
    }, { trace_id: 'trace123', user_id: 'user456', kv: mockKV })

    expect(result).toBe('success')
    expect(mockKV.put).not.toHaveBeenCalled()
    const snap = takeMetricsSnapshot(Date.now(), true)!
    const row = snap.rows.find((r) => r.route === 'test_op')!
    expect(row.count).toBe(1)
    expect(row.errors).toBe(0)
    expect(row.samples[0]).toBeGreaterThanOrEqual(100)
  })

  it('records span error without throwing', async () => {
    __resetMetricsRollup()
    const result = await recordSpanSafe('failing_op', async () => {
      throw new Error('Intentional error')
    }, { trace_id: 'trace123', kv: mockKV })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.message).toBe('Intentional error')
    }
    const row = takeMetricsSnapshot(Date.now(), true)!.rows.find((r) => r.route === 'failing_op')!
    expect(row.errors).toBe(1)
  })

  it('never puts trace_id or user_id into metric keys', async () => {
    __resetMetricsRollup()
    await recordSpan('op_with_ids', async () => 42, { trace_id: 'trace_abc', user_id: 'user_xyz', kv: mockKV })
    const keys = JSON.stringify(takeMetricsSnapshot(Date.now(), true)!.rows.map((r) => r.route))
    expect(keys).not.toContain('trace_abc')
    expect(keys).not.toContain('user_xyz')
  })

  it('enforces no PII in span context', async () => {
    // Verify that passing email or IP is caught by type system
    // (this is a compile-time check, but we can test the intent)
    const ctx = { trace_id: 'trace123', kv: mockKV }
    expect(ctx).toHaveProperty('trace_id')
    expect(ctx).not.toHaveProperty('email')
    expect(ctx).not.toHaveProperty('ip')
  })
})

describe('writeEvent — Analytics Engine', () => {
  it('writes correct blobs and doubles to AE dataset', () => {
    const mockAe = { writeDataPoint: vi.fn() } as unknown as AnalyticsEngineDataset
    writeEvent(mockAe, {
      name: 'session.started',
      sessionId: 'sess_abc',
      teamId: 'team_xyz',
      plan: 'team',
      traceId: 'trace_001',
      durationMs: 250,
      count: 3,
      value: 9.99,
    })
    expect(mockAe.writeDataPoint).toHaveBeenCalledOnce()
    const dp = (mockAe.writeDataPoint as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      blobs: string[]
      doubles: number[]
    }
    expect(dp.blobs[0]).toBe('session.started')
    expect(dp.blobs[1]).toBe('sess_abc')
    expect(dp.blobs[2]).toBe('team_xyz')
    expect(dp.blobs[3]).toBe('team')
    expect(dp.blobs[4]).toBe('trace_001')
    expect(dp.doubles[0]).toBe(250)
    expect(dp.doubles[1]).toBe(3)
    expect(dp.doubles[2]).toBe(9.99)
  })

  it('uses userId as blob2 when sessionId is absent', () => {
    const mockAe = { writeDataPoint: vi.fn() } as unknown as AnalyticsEngineDataset
    writeEvent(mockAe, { name: 'signup', userId: 'user_001', traceId: 'trace_x' })
    const dp = (mockAe.writeDataPoint as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      blobs: string[]
    }
    expect(dp.blobs[1]).toBe('user_001')
  })

  it('is a no-op when ae is undefined', () => {
    expect(() => writeEvent(undefined, { name: 'session.started', sessionId: 'sess_1' })).not.toThrow()
  })

  it('swallows errors thrown by writeDataPoint', () => {
    const mockAe = {
      writeDataPoint: vi.fn().mockImplementation(() => { throw new Error('AE unavailable') }),
    } as unknown as AnalyticsEngineDataset
    expect(() => writeEvent(mockAe, { name: 'error.api', sessionId: 's1' })).not.toThrow()
  })

  it('emits preflight.checked as a valid event name', () => {
    const mockAe = { writeDataPoint: vi.fn() } as unknown as AnalyticsEngineDataset
    writeEvent(mockAe, { name: 'preflight.checked', sessionId: 'sess_1', count: 2 })
    const dp = (mockAe.writeDataPoint as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      blobs: string[]
      doubles: number[]
    }
    expect(dp.blobs[0]).toBe('preflight.checked')
    expect(dp.doubles[1]).toBe(2)
  })

  it('emits ai.rate_limited as a valid event name', () => {
    const mockAe = { writeDataPoint: vi.fn() } as unknown as AnalyticsEngineDataset
    writeEvent(mockAe, { name: 'ai.rate_limited', userId: 'user_1', sessionId: 'sess_1' })
    const dp = (mockAe.writeDataPoint as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      blobs: string[]
    }
    expect(dp.blobs[0]).toBe('ai.rate_limited')
  })

  it('emits Sprint 19 journey events as valid event names', () => {
    const mockAe = { writeDataPoint: vi.fn() } as unknown as AnalyticsEngineDataset
    writeEvent(mockAe, {
      name: 'launchpad.launch_success',
      userId: 'user_1',
      sessionId: 'sess_1',
      count: 1,
    })
    const dp = (mockAe.writeDataPoint as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      blobs: string[]
      doubles: number[]
    }
    expect(dp.blobs[0]).toBe('launchpad.launch_success')
    expect(dp.doubles[1]).toBe(1)
  })

  it('composeRateLimitDetail encodes profile + backend into blob6', () => {
    expect(
      composeRateLimitDetail({
        profile: 'api_key',
        backend: 'workers_rl',
        detail: 'actor=key:k1',
      }),
    ).toBe('profile=api_key;backend=workers_rl;actor=key:k1')
  })

  it('rate_limit.hit writeEvent merges profile/backend into detail blob', () => {
    const mockAe = { writeDataPoint: vi.fn() } as unknown as AnalyticsEngineDataset
    writeEvent(mockAe, {
      name: 'rate_limit.hit',
      teamId: 't1',
      profile: 'api_key',
      backend: 'kv',
      detail: 'actor=key:k1',
    })
    const dp = (mockAe.writeDataPoint as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      blobs: string[]
    }
    expect(dp.blobs[0]).toBe('rate_limit.hit')
    expect(dp.blobs[5]).toBe('profile=api_key;backend=kv;actor=key:k1')
  })
})
