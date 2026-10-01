/**
 * ADR-042 Phase 2.1 — queue producer: binding missing → error log + waitUntil fallback.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { enqueuePostSessionWork, computePayloadHash } from '../../functions/api/lib/queues/producer'
import type { Env } from '../../functions/api/types'

const baseMessage = {
  idempotencyKey: 'sess1:precompute_insights:abc',
  sessionId: 'sess1',
  userId: 'user1',
  taskType: 'precompute_insights' as const,
  payload: { sessionTitle: 'T', plan: 'team', traceId: 'tr-1' },
  meta: { enqueuedAt: Date.now() },
}

describe('computePayloadHash', () => {
  it('is stable for the same payload regardless of key order', () => {
    expect(computePayloadHash({ a: 1, b: 2 })).toBe(computePayloadHash({ b: 2, a: 1 }))
  })
})

describe('enqueuePostSessionWork', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    errorSpy.mockRestore()
    vi.restoreAllMocks()
  })

  it('returns queued when INSIGHTS_QUEUE.send succeeds', async () => {
    const send = vi.fn(async () => undefined)
    const env = { INSIGHTS_QUEUE: { send } } as unknown as Env
    const result = await enqueuePostSessionWork(env, baseMessage)
    expect(result).toBe('queued')
    expect(send).toHaveBeenCalledOnce()
  })

  it('logs an error and falls back via waitUntil when unbound', async () => {
    const waitUntil = vi.fn((p: Promise<unknown>) => {
      void p.catch(() => undefined)
    })
    // Dynamic import of consumer will fail in unit env without full Env —
    // waitUntil still must be scheduled.
    vi.doMock('../../functions/api/lib/queues/consumer', () => ({
      processPostSessionWork: vi.fn(async () => undefined),
    }))

    const env = {} as Env
    const result = await enqueuePostSessionWork(env, baseMessage, {
      executionCtx: { waitUntil },
    })
    expect(result).toBe('fallback')
    expect(waitUntil).toHaveBeenCalledOnce()
    expect(errorSpy).toHaveBeenCalled()
    const logged = String(errorSpy.mock.calls[0]?.[0] ?? '')
    expect(logged).toContain('QueueBindingMissing')
  })

  it('returns dropped when unbound and no executionCtx', async () => {
    const env = {} as Env
    const result = await enqueuePostSessionWork(env, baseMessage)
    expect(result).toBe('dropped')
    expect(errorSpy).toHaveBeenCalled()
  })
})
