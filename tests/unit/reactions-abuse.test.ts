// REACTIONS-ABUSE-01 — exponential backoff after repeated overages

import { describe, expect, it } from 'vitest'
import { ReactionsHandler } from '../../functions/api/lib/session-room-reactions-handler'
import { MockDurableObjectState, MockWebSocket } from '../helpers/do-mock'
import type { Attachment } from '../../functions/api/lib/session-room-types'
import type { LiveQuestion } from '../../functions/api/realtime'
import type { Meta } from '../../functions/api/lib/session-room-types'
import { K_META, K_QUESTION } from '../../functions/api/lib/session-room-storage-keys'
import { REACTION_ABUSE_STRIKE_LIMIT } from '../../functions/api/lib/reactions-config'

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
  sessionId: 'sess-abuse',
  ownerId: 'owner-1',
  code: 'ABUSE1',
  title: 'Abuse test',
  startedAt: Date.now(),
  votePolicy: 'react',
  sessionMode: 'reflection',
  plan: 'free',
}

const reactionQuestion: LiveQuestion = {
  id: 'q1',
  kind: 'reaction',
  prompt: 'React!',
  options: [{ id: '👍', label: 'Thumbs up' }],
}

describe('REACTIONS-ABUSE-01', () => {
  it('blocks voter after repeated rate-limit overages', async () => {
    const state = new MockDurableObjectState()
    const handler = new ReactionsHandler(state as never, {} as never)
    await state.storage.put(K_META, baseMeta)
    await state.storage.put(K_QUESTION, reactionQuestion)

    const ws = connect(state, att('attacker'))
    const voter = att('attacker')

    for (let i = 0; i < 120; i++) {
      await handler.handleSubmit(ws as unknown as WebSocket, voter, { emojiId: '👍' })
    }

    const errors = ws
      .messages<{ type: string; data?: { code?: string } }>()
      .filter((m) => m.type === 'error' && m.data?.code)
      .map((m) => m.data!.code!)

    expect(
      errors.filter((c) => c === 'reaction_rate_limited' || c === 'reaction_flood').length,
    ).toBeGreaterThanOrEqual(REACTION_ABUSE_STRIKE_LIMIT)
    expect(errors.some((c) => c === 'reaction_blocked')).toBe(true)
  })
})
