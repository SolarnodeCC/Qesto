// VOTE-CORRUPTION (#538) — presenter navigation must clear BOTH the persisted
// and the in-memory vote tally caches. Before the fix, handlePresenterAdvance /
// handlePresenterBack wiped K_COUNTS in storage but left state._counts intact,
// so the next question's first vote accumulated on top of the previous
// question's counts and that corrupted tally was flushed to D1.

import { describe, expect, it } from 'vitest'
import {
  handlePresenterAdvance,
  handlePresenterBack,
} from '../../functions/api/lib/session-room-vote-flow'
import { createSessionRoomState } from '../../functions/api/lib/session-room-context'
import {
  K_QUESTIONS,
  K_QUESTION_INDEX,
  K_QUESTION,
  K_COUNTS,
} from '../../functions/api/lib/session-room-storage-keys'

function makeContext(initial: Record<string, unknown>) {
  const store = new Map<string, unknown>(Object.entries(initial))
  const state = createSessionRoomState()
  // Simulate a stale in-memory tally left over from the previous question.
  state._counts = { 'option-a': 5, 'option-b': 3 }
  state._voters = { 'voter-1': ['option-a'] }

  const self = {
    state,
    env: {} as never,
    ctx: {
      storage: {
        async get<T>(key: string): Promise<T | undefined> {
          return store.get(key) as T | undefined
        },
        async put<T>(key: string, value: T): Promise<void> {
          store.set(key, value)
        },
        async delete(key: string): Promise<void> {
          store.delete(key)
        },
      },
      getWebSockets() {
        return [] as WebSocket[]
      },
    },
    resetVoters(voters: Record<string, string[]>) {
      state._voters = voters
    },
  } as unknown as Parameters<typeof handlePresenterAdvance>[0]

  const ws = { send() {} } as unknown as WebSocket
  return { self, ws, store, state }
}

const presenterAtt = { role: 'presenter' } as unknown as Parameters<typeof handlePresenterAdvance>[2]

const Q0 = { id: 'q0', kind: 'poll', prompt: 'Q0', options: [{ id: 'option-a', label: 'A' }] }
const Q1 = { id: 'q1', kind: 'poll', prompt: 'Q1', options: [{ id: 'option-c', label: 'C' }] }

describe('handlePresenterAdvance clears the in-memory tally (#538)', () => {
  it('resets state._counts to empty when advancing to the next question', async () => {
    const { self, ws, store, state } = makeContext({
      [K_QUESTIONS]: [Q0, Q1],
      [K_QUESTION_INDEX]: 0,
    })

    await handlePresenterAdvance(self, ws, presenterAtt)

    // In-memory tally must be wiped — not carrying option-a:5 into Q1.
    expect(state._counts).toEqual({})
    // Persisted tally is also empty and the question advanced.
    expect(store.get(K_COUNTS)).toEqual({})
    expect(store.get(K_QUESTION_INDEX)).toBe(1)
    expect((store.get(K_QUESTION) as { id: string }).id).toBe('q1')
  })

  it('does not leave a stale counts reference that survives navigation', async () => {
    const { self, ws, state } = makeContext({
      [K_QUESTIONS]: [Q0, Q1],
      [K_QUESTION_INDEX]: 0,
    })
    const before = state._counts
    await handlePresenterAdvance(self, ws, presenterAtt)
    expect(state._counts).not.toBe(before)
    expect(Object.keys(state._counts ?? {})).toHaveLength(0)
  })
})

describe('handlePresenterBack clears the in-memory tally (#538)', () => {
  it('resets state._counts to empty when going back a question', async () => {
    const { self, ws, store, state } = makeContext({
      [K_QUESTIONS]: [Q0, Q1],
      [K_QUESTION_INDEX]: 1,
    })

    await handlePresenterBack(self, ws, presenterAtt)

    expect(state._counts).toEqual({})
    expect(store.get(K_COUNTS)).toEqual({})
    expect(store.get(K_QUESTION_INDEX)).toBe(0)
    expect((store.get(K_QUESTION) as { id: string }).id).toBe('q0')
  })
})
