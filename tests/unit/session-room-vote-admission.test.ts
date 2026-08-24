// Regression coverage for the DO-side vote admission glue. The pure vote
// mutation and D1 flush layers are tested separately; these tests prove the
// handler carries count-decrement intent into the buffered vote shape.

import { describe, expect, it } from 'vitest'
import { handleVote } from '../../functions/api/lib/session-room-vote-admission'
import { createSessionRoomState, type SessionRoomContext } from '../../functions/api/lib/session-room-context'
import {
  K_COUNTS,
  K_META,
  K_QUESTION,
  K_STATUS,
  K_VOTERS,
} from '../../functions/api/lib/session-room-storage-keys'
import { normaliseVotes, type Attachment, type Counts, type Meta, type Votes } from '../../functions/api/lib/session-room-types'
import type { LiveQuestion } from '../../functions/api/realtime'
import type { Env } from '../../functions/api/types'
import { MockDurableObjectState, MockWebSocket } from '../helpers/do-mock'

const pollQuestion: LiveQuestion = {
  id: 'q1',
  kind: 'poll',
  prompt: 'Pick one',
  options: [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
  ],
}

const multiSelectQuestion: LiveQuestion = {
  id: 'q2',
  kind: 'multi_select',
  prompt: 'Pick many',
  options: [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
  ],
}

type Harness = {
  self: SessionRoomContext
  ws: MockWebSocket
  attachment: Attachment
  calls: { flush: number; scheduleFlush: number; broadcast: number }
}

async function makeHarness(args: {
  question: LiveQuestion
  votePolicy: Meta['votePolicy']
  voters?: Record<string, string | string[]>
  counts?: Counts
}): Promise<Harness> {
  const durableState = new MockDurableObjectState()
  const roomState = createSessionRoomState()
  const calls = { flush: 0, scheduleFlush: 0, broadcast: 0 }
  const attachment: Attachment = {
    role: 'voter',
    voterId: 'voter-1',
    ipHash: 'ip-1',
    bucket: { tokens: 10, lastAt: 0 },
  }
  const meta: Meta = {
    sessionId: 'session-1',
    ownerId: 'owner-1',
    code: 'ABC123',
    title: 'Regression session',
    startedAt: 1_700_000_000_000,
    votePolicy: args.votePolicy,
    sessionMode: 'reflection',
    plan: 'starter',
  }

  await durableState.storage.put(K_STATUS, 'live')
  await durableState.storage.put(K_META, meta)
  await durableState.storage.put(K_QUESTION, args.question)
  await durableState.storage.put(K_COUNTS, args.counts ?? {})
  await durableState.storage.put(K_VOTERS, args.voters ?? {})

  const ws = new MockWebSocket()
  ws.serializeAttachment(attachment)
  durableState.acceptWebSocket(ws, ['role:voter', 'voter:voter-1'])

  const self = {
    ctx: durableState as unknown as DurableObjectState,
    env: {} as Env,
    state: roomState,
    async ensureVoters(): Promise<Votes> {
      if (roomState._voters !== null) return roomState._voters
      const raw = await durableState.storage.get<Record<string, string | string[]>>(K_VOTERS)
      roomState._voters = normaliseVotes(raw)
      return roomState._voters
    },
    resetVoters(voters: Votes): void {
      roomState._voters = voters
    },
    async scheduleAlarm(): Promise<void> {},
    scheduleFlush(): void {
      calls.scheduleFlush += 1
      roomState.flushScheduled = true
    },
    async scheduleResultsBroadcast(): Promise<void> {
      calls.broadcast += 1
      roomState.resultsDirty = true
    },
    async flushVotes(): Promise<void> {
      calls.flush += 1
    },
  } as unknown as SessionRoomContext

  return { self, ws, attachment, calls }
}

describe('handleVote — buffered vote supersede glue', () => {
  it("carries supersedesOptionId when vote_policy='multi' changes a single-choice answer", async () => {
    const { self, ws, attachment, calls } = await makeHarness({
      question: pollQuestion,
      votePolicy: 'multi',
      voters: { 'voter-1': ['a'] },
      counts: { a: 1 },
    })

    await handleVote(self, ws as unknown as WebSocket, attachment, { questionId: 'q1', optionId: 'b' })

    expect(self.state.voteBuffer).toEqual([
      expect.objectContaining({
        sessionId: 'session-1',
        questionId: 'q1',
        voterId: 'voter-1',
        optionId: 'b',
        supersedesOptionId: 'a',
      }),
    ])
    expect(self.state._voters).toEqual({ 'voter-1': ['b'] })
    expect(self.state._counts).toEqual({ a: 0, b: 1 })
    expect(calls).toEqual({ flush: 0, scheduleFlush: 1, broadcast: 1 })
    expect(ws.messages()).toEqual([])
  })

  it('does not mark accumulated multi_select options as superseding each other', async () => {
    const { self, ws, attachment, calls } = await makeHarness({
      question: multiSelectQuestion,
      votePolicy: 'multi',
      voters: { 'voter-1': ['a'] },
      counts: { a: 1 },
    })

    await handleVote(self, ws as unknown as WebSocket, attachment, { questionId: 'q2', optionId: 'b' })

    expect(self.state.voteBuffer).toEqual([
      expect.objectContaining({
        sessionId: 'session-1',
        questionId: 'q2',
        voterId: 'voter-1',
        optionId: 'b',
      }),
    ])
    expect(self.state.voteBuffer[0]).not.toHaveProperty('supersedesOptionId')
    expect(self.state._voters).toEqual({ 'voter-1': ['a', 'b'] })
    expect(self.state._counts).toEqual({ a: 1, b: 1 })
    expect(calls).toEqual({ flush: 0, scheduleFlush: 1, broadcast: 1 })
    expect(ws.messages()).toEqual([])
  })
})
