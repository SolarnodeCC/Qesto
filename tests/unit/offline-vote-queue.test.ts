import { describe, expect, it, beforeEach } from 'vitest'
import {
  enqueueOfflineVote,
  flushOfflineVoteQueue,
  pendingOfflineVoteCount,
} from '../../src/lib/offline-vote-queue'

describe('offline vote queue', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('queues and flushes votes for a session', () => {
    enqueueOfflineVote('sess-1', { type: 'vote', data: { optionId: 'a' } })
    expect(pendingOfflineVoteCount('sess-1')).toBe(1)
    const sent = flushOfflineVoteQueue('sess-1', () => true)
    expect(sent).toBe(1)
    expect(pendingOfflineVoteCount('sess-1')).toBe(0)
  })
})
