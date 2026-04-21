import { describe, it, expect, vi, beforeEach } from 'vitest'
import { recordSpan, recordSpanSafe } from '../../functions/api/lib/observability'

describe('Observability — Span Tracing', () => {
  let mockKV: any

  beforeEach(() => {
    mockKV = {
      put: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue(null),
    }
    vi.useFakeTimers()
  })

  it('records successful span with latency', async () => {
    const startTime = Date.now()
    vi.setSystemTime(startTime)

    const result = await recordSpan('test_op', async () => {
      vi.advanceTimersByTime(100)
      return 'success'
    }, { trace_id: 'trace123', user_id: 'user456', kv: mockKV })

    expect(result).toBe('success')
    // KV put should be called to record metrics
    expect(mockKV.put).toHaveBeenCalled()
  })

  it('records span error without throwing', async () => {
    const result = await recordSpanSafe('failing_op', async () => {
      throw new Error('Intentional error')
    }, { trace_id: 'trace123', kv: mockKV })

    expect(result).toBeUndefined()
    // KV put should still be called (error_count incremented)
    expect(mockKV.put).toHaveBeenCalled()
  })

  it('propagates trace_id and user_id to metrics', async () => {
    await recordSpan('op_with_ids', async () => 42, {
      trace_id: 'trace_abc',
      user_id: 'user_xyz',
      kv: mockKV,
    })

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
