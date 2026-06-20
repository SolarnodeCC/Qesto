import { describe, expect, it } from 'vitest'
import { parseClientMessage } from '../../functions/api/lib/protocol-schemas'
import {
  applyVoteMutation,
  MAX_DISTINCT_OPTIONS_PER_QUESTION,
  MAX_WORD_CLOUD_ENTRIES_PER_VOTER,
  type SessionVotes,
} from '../../functions/api/lib/session-room-vote'

// #581 — unbounded vote optionId / cardinality storage exhaustion.

describe('vote schema bounds (#581)', () => {
  function voteFrame(optionId: string, questionId = 'q1') {
    return JSON.stringify({
      type: 'vote',
      data: { questionId, optionId },
      timestamp: Date.now(),
    })
  }

  it('accepts an in-bounds vote', () => {
    const parsed = parseClientMessage(voteFrame('option-a'))
    expect(parsed?.type).toBe('vote')
  })

  it('rejects an oversized optionId (> 280 chars)', () => {
    const parsed = parseClientMessage(voteFrame('x'.repeat(281)))
    expect(parsed).toBeNull()
  })

  it('accepts an optionId exactly at the 280-char cap', () => {
    const parsed = parseClientMessage(voteFrame('x'.repeat(280)))
    expect(parsed?.type).toBe('vote')
  })

  it('rejects an empty optionId', () => {
    const parsed = parseClientMessage(voteFrame(''))
    expect(parsed).toBeNull()
  })

  it('rejects an oversized questionId (> 64 chars)', () => {
    const parsed = parseClientMessage(voteFrame('option-a', 'q'.repeat(65)))
    expect(parsed).toBeNull()
  })
})

describe('applyVoteMutation cardinality caps (#581)', () => {
  it('caps distinct word_cloud entries per voter', () => {
    const voters: SessionVotes = {}
    for (let i = 0; i < MAX_WORD_CLOUD_ENTRIES_PER_VOTER; i++) {
      const r = applyVoteMutation(voters, {
        questionKind: 'word_cloud',
        votePolicy: 'multi',
        voterId: 'v1',
        optionId: `word-${i}`,
      })
      expect(r.ok).toBe(true)
    }
    // One past the cap is refused.
    const overflow = applyVoteMutation(voters, {
      questionKind: 'word_cloud',
      votePolicy: 'multi',
      voterId: 'v1',
      optionId: 'word-overflow',
    })
    expect(overflow).toMatchObject({ ok: false, code: 'cardinality_exceeded' })
    expect(voters['v1']).toHaveLength(MAX_WORD_CLOUD_ENTRIES_PER_VOTER)
  })

  it('refuses a NEW option key once per-question cardinality cap is reached', () => {
    const counts: Record<string, number> = {}
    for (let i = 0; i < MAX_DISTINCT_OPTIONS_PER_QUESTION; i++) {
      counts[`opt-${i}`] = 1
    }
    const voters: SessionVotes = {}
    const newKey = applyVoteMutation(voters, {
      questionKind: 'word_cloud',
      votePolicy: 'multi',
      voterId: 'vX',
      optionId: 'brand-new',
      counts,
    })
    expect(newKey).toMatchObject({ ok: false, code: 'cardinality_exceeded' })
  })

  it('still allows voting on an EXISTING key after the cap is reached', () => {
    const counts: Record<string, number> = {}
    for (let i = 0; i < MAX_DISTINCT_OPTIONS_PER_QUESTION; i++) {
      counts[`opt-${i}`] = 1
    }
    const voters: SessionVotes = {}
    const existing = applyVoteMutation(voters, {
      questionKind: 'poll',
      votePolicy: 'once',
      voterId: 'vY',
      optionId: 'opt-0',
      counts,
    })
    expect(existing.ok).toBe(true)
  })
})
