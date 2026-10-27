/**
 * Requirement: issue #938 — post-session work must not be silently lost. A
 * failing message is retried via Message.retry() (Cloudflare Queues has no
 * nack()), its failure is logged, and the remaining messages in the batch are
 * still processed.
 */
import { describe, expect, it, vi } from 'vitest'
import { handlePostSessionQueue } from '../../worker/queue-consumer'
import type { Env } from '../../functions/api/types'
import type { PostSessionWorkMessage } from '../../functions/api/lib/queues/producer'

function msg(body: Partial<PostSessionWorkMessage>) {
  return { body: body as PostSessionWorkMessage, attempts: 1, ack: vi.fn(), retry: vi.fn() }
}

describe('handlePostSessionQueue', () => {
  it('retries the failing message and keeps processing the batch', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const a = msg({ sessionId: 's1', taskType: 'insights' } as Partial<PostSessionWorkMessage>)
    const b = msg({ sessionId: 's2', taskType: 'insights' } as Partial<PostSessionWorkMessage>)
    const process = vi.fn(async (_env: Env, body: PostSessionWorkMessage) => {
      if (body.sessionId === 's1') throw new Error('ai down')
    })
    await handlePostSessionQueue(
      { messages: [a, b] } as unknown as MessageBatch<PostSessionWorkMessage>,
      {} as Env,
      process as never,
    )
    expect(a.retry).toHaveBeenCalledOnce()
    expect(a.ack).not.toHaveBeenCalled()
    expect(b.ack).toHaveBeenCalledOnce()
    expect(process).toHaveBeenCalledTimes(2)
    vi.restoreAllMocks()
  })
})
