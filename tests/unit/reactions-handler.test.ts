// REACTIONS-CHANNEL-01 (ADR-0055) — DO handler unit tests

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

const asWs = (ws: MockWebSocket) => ws as unknown as WebSocket

const baseMeta: Meta = {
  sessionId: 'sess-1',
  ownerId: 'owner-1',
  code: 'ABC123',
  title: 'Webinar',
  startedAt: Date.now(),
  votePolicy: 'react',
  sessionMode: 'reflection',
  plan: 'starter',
}

const reactionQuestion: LiveQuestion = {
  id: 'q1',
  kind: 'reaction',
  prompt: 'React!',
  options: [
    { id: '👍', label: 'Thumbs up' },
    { id: '❤️', label: 'Heart' },
  ],
}

async function seedSession(state: MockDurableObjectState, meta: Meta, question: LiveQuestion | null) {
  await state.storage.put(K_META, meta)
  if (question) await state.storage.put(K_QUESTION, question)
}

describe('ReactionsHandler.handleSubmit', () => {
  it('broadcasts aggregate reaction_delta to all sockets', async () => {
    const state = new MockDurableObjectState()
    const handler = new ReactionsHandler(state as never, {} as never)
    await seedSession(state, baseMeta, reactionQuestion)

    const ws1 = connect(state, att('v1'))
    const ws2 = connect(state, att('v2'))

    await handler.handleSubmit(asWs(ws1), att('v1'), { emojiId: '👍' })

    for (const ws of [ws1, ws2]) {
      const msgs = ws.messages()
      expect(msgs.length).toBeGreaterThan(0)
      const delta = msgs.find((m) => (m as { type: string }).type === 'reaction_delta') as {
        type: string
        data: { counts: Record<string, number>; total: number }
      }
      expect(delta).toBeDefined()
      expect(delta.data.counts['👍']).toBe(1)
      expect(delta.data.total).toBe(1)
    }
  })

  it('rejects emoji not in reaction set', async () => {
    const state = new MockDurableObjectState()
    const handler = new ReactionsHandler(state as never, {} as never)
    await seedSession(state, baseMeta, reactionQuestion)
    const ws = connect(state, att('v1'))

    await handler.handleSubmit(asWs(ws), att('v1'), { emojiId: '🚀' })

    const err = ws.messages().find((m) => (m as { type: string }).type === 'error') as {
      data: { code: string }
    }
    expect(err?.data.code).toBe('validation')
  })

  it('rejects when reactions disabled', async () => {
    const state = new MockDurableObjectState()
    const handler = new ReactionsHandler(state as never, {} as never)
    await seedSession(state, { ...baseMeta, votePolicy: 'once' }, null)
    const ws = connect(state, att('v1'))

    await handler.handleSubmit(asWs(ws), att('v1'), { emojiId: '👍' })

    const err = ws.messages().find((m) => (m as { type: string }).type === 'error') as {
      data: { code: string }
    }
    expect(err?.data.code).toBe('reactions_disabled')
  })
})

describe('ReactionsHandler.snapshotForClose', () => {
  it('returns aggregate counts for zero_knowledge (no per-voter leak)', async () => {
    const state = new MockDurableObjectState()
    const handler = new ReactionsHandler(state as never, {} as never)
    await seedSession(state, { ...baseMeta, anonymity: 'zero_knowledge' }, reactionQuestion)
    await handler.handleSubmit(asWs(connect(state, att('v1'))), att('v1'), { emojiId: '👍' })

    const snap = await handler.snapshotForClose('zero_knowledge')
    expect(snap).toEqual({ '👍': 1 })
  })
})
