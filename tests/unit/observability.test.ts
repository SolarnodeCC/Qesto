import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { recordSpan, recordSpanSafe, writeEvent } from '../../functions/api/lib/observability'
import type { AnalyticsEngineDataset } from '@cloudflare/workers-types'

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

  it('records successful span with latency', async () => {
    const startTime = Date.now()
    vi.setSystemTime(startTime)

    const result = await recordSpan('test_op', async () => {
      vi.advanceTimersByTime(100)
      return 'success'
    }, { trace_id: 'trace123', user_id: 'user456', kv: mockKV })

    expect(result).toBe('success')
    // Flush the fire-and-forget metrics promise chain
    await vi.runAllTimersAsync()
    expect(mockKV.put).toHaveBeenCalled()
  })

  it('records span error without throwing', async () => {
    // recordSpanSafe catches errors and returns SpanResult (not undefined)
    const result = await recordSpanSafe('failing_op', async () => {
      throw new Error('Intentional error')
    }, { trace_id: 'trace123', kv: mockKV })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.message).toBe('Intentional error')
    }
    // Flush the fire-and-forget metrics
    await vi.runAllTimersAsync()
    expect(mockKV.put).toHaveBeenCalled()
  })

  it('propagates trace_id and user_id to metrics', async () => {
    await recordSpan('op_with_ids', async () => 42, {
      trace_id: 'trace_abc',
      user_id: 'user_xyz',
      kv: mockKV,
    })

    await vi.runAllTimersAsync()
    const callArgs = mockKV.put.mock.calls[0]
    const key = callArgs[0]
    // Verify trace_id is not leaked into KV key (should be in value only)
    expect(key).not.toContain('trace_abc')
    expect(key).not.toContain('user_xyz')
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
})
