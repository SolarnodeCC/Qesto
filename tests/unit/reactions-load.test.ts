// QA-REACTIONS-LOAD-01 — high-throughput reaction handler stress (S92)

import { describe, expect, it } from 'vitest'
import { ReactionsHandler } from '../../functions/api/lib/session-room-reactions-handler'
import { MockDurableObjectState, MockWebSocket } from '../helpers/do-mock'
import type { Attachment } from '../../functions/api/lib/session-room-types'
import type { LiveQuestion } from '../../functions/api/realtime'
import type { Meta } from '../../functions/api/lib/session-room-types'
import { K_META, K_QUESTION } from '../../functions/api/lib/session-room-storage-keys'

function att(voterId: string): Attachment {
  return { role: 'voter', voterId, ipHash: 'h', bucket: { tokens: 10, lastAt: 0 } }
}

function connect(state: MockDurableObjectState, a: Attachment): MockWebSocket {
  const ws = new MockWebSocket()
  ws.serializeAttachment(a)
  state.acceptWebSocket(ws, [`voter:${a.voterId}`])
  return ws
}

const baseMeta: Meta = {
  sessionId: 'sess-load',
  ownerId: 'owner-1',
  code: 'LOAD01',
  title: 'Load test',
  startedAt: Date.now(),
  votePolicy: 'react',
  sessionMode: 'reflection',
  plan: 'team',
}

const reactionQuestion: LiveQuestion = {
  id: 'q1',
  kind: 'reaction',
  prompt: 'React!',
  options: [{ id: '👍', label: 'Thumbs up' }],
}

describe('QA-REACTIONS-LOAD-01', () => {
  it('processes 500 rapid submits with aggregate broadcasts', async () => {
    const state = new MockDurableObjectState()
    const handler = new ReactionsHandler(state as never, {} as never)
    await state.storage.put(K_META, baseMeta)
    await state.storage.put(K_QUESTION, reactionQuestion)

    const ws = connect(state, att('v-load'))

    const voters = Array.from({ length: 50 }, (_, i) => `v${i}`)
    const start = performance.now()
    for (let i = 0; i < 500; i++) {
      const voter = voters[i % voters.length]!
      await handler.handleSubmit(ws as unknown as WebSocket, att(voter), { emojiId: '👍' })
    }
    const elapsed = performance.now() - start

    const deltas = ws.messages().filter((m) => (m as { type: string }).type === 'reaction_delta')
    expect(deltas.length).toBeGreaterThan(0)
    expect(elapsed).toBeLessThan(15_000)
    const counts = await handler.getCounts()
    expect(counts['👍']).toBeGreaterThan(0)
  })
})
