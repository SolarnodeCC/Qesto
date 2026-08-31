import { describe, expect, it, vi } from 'vitest'
import { enqueuePostSessionWork, type PostSessionWorkMessage } from '../../functions/api/lib/queues/producer'

const baseMessage: PostSessionWorkMessage = {
  idempotencyKey: 'sess1:precompute_insights:abc',
  sessionId: 'sess1',
  userId: 'user1',
  taskType: 'precompute_insights',
  payload: { sessionTitle: 'Test' },
  meta: { enqueuedAt: Date.now() },
}

describe('enqueuePostSessionWork', () => {
  it('sends when INSIGHTS_QUEUE is bound', async () => {
    const send = vi.fn().mockResolvedValue(undefined)
    await enqueuePostSessionWork({ INSIGHTS_QUEUE: { send } } as any, baseMessage)
    expect(send).toHaveBeenCalledWith(baseMessage)
  })

  it('does not throw when queue is missing but logs noop event', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await enqueuePostSessionWork({} as any, baseMessage)
    expect(errSpy).toHaveBeenCalled()
    const logged = errSpy.mock.calls[0]?.[0]
    expect(String(logged)).toContain('queue.enqueue.noop')
    errSpy.mockRestore()
  })

  it('swallows send errors after logging', async () => {
    const send = vi.fn().mockRejectedValue(new Error('queue down'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(
      enqueuePostSessionWork({ INSIGHTS_QUEUE: { send } } as any, baseMessage),
    ).resolves.toBeUndefined()
    expect(errSpy).toHaveBeenCalled()
    errSpy.mockRestore()
  })
})
