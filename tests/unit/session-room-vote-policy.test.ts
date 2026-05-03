// WS4-A — characterization tests for SessionRoom vote semantics (pure applyVoteMutation).

import { describe, expect, it } from 'vitest'
import {
  applyVoteMutation,
  isFreeTextQuestionKind,
  isMultiVoteQuestionKind,
  type SessionVotes,
} from '../../functions/api/lib/session-room-vote'

function voters(): SessionVotes {
  return {}
}

describe('applyVoteMutation — multi-vote kinds trump votePolicy', () => {
  it('multi_select allows multiple distinct options from one voter', () => {
    const v = voters()
    expect(
      applyVoteMutation(v, {
        questionKind: 'multi_select',
        votePolicy: 'once',
        voterId: 'v1',
        optionId: 'a',
      }),
    ).toEqual({ ok: true, countKey: 'a', countDecKey: null })
    expect(
      applyVoteMutation(v, {
        questionKind: 'multi_select',
        votePolicy: 'once',
        voterId: 'v1',
        optionId: 'b',
      }),
    ).toEqual({ ok: true, countKey: 'b', countDecKey: null })
    expect(v.v1).toEqual(['a', 'b'])
  })

  it('multi_select rejects exact duplicate optionId', () => {
    const v = voters()
    applyVoteMutation(v, {
      questionKind: 'multi_select',
      votePolicy: 'multi',
      voterId: 'v1',
      optionId: 'a',
    })
    const second = applyVoteMutation(v, {
      questionKind: 'multi_select',
      votePolicy: 'multi',
      voterId: 'v1',
      optionId: 'a',
    })
    expect(second).toMatchObject({
      ok: false,
      code: 'duplicate',
      message: 'You already selected this option',
    })
    expect(v.v1).toEqual(['a'])
  })

  it('word_cloud behaves like multi-vote kind for accumulation', () => {
    const v = voters()
    applyVoteMutation(v, {
      questionKind: 'word_cloud',
      votePolicy: 'once',
      voterId: 'v1',
      optionId: 'hello',
    })
    applyVoteMutation(v, {
      questionKind: 'word_cloud',
      votePolicy: 'once',
      voterId: 'v1',
      optionId: 'world',
    })
    expect(v.v1).toEqual(['hello', 'world'])
  })
})

describe('applyVoteMutation — poll + once', () => {
  it('accepts first vote and rejects change', () => {
    const v = voters()
    expect(
      applyVoteMutation(v, {
        questionKind: 'poll',
        votePolicy: 'once',
        voterId: 'v1',
        optionId: 'a',
      }).ok,
    ).toBe(true)
    const dup = applyVoteMutation(v, {
      questionKind: 'poll',
      votePolicy: 'once',
      voterId: 'v1',
      optionId: 'b',
    })
    expect(dup).toMatchObject({
      ok: false,
      code: 'duplicate',
      message: 'You already voted on this question',
    })
    expect(v.v1).toEqual(['a'])
  })
})

describe('applyVoteMutation — poll + multi (change vote)', () => {
  it('increments new option and exposes previous for count decrement', () => {
    const v = voters()
    expect(
      applyVoteMutation(v, {
        questionKind: 'poll',
        votePolicy: 'multi',
        voterId: 'v1',
        optionId: 'a',
      }),
    ).toEqual({ ok: true, countKey: 'a', countDecKey: null })

    expect(
      applyVoteMutation(v, {
        questionKind: 'poll',
        votePolicy: 'multi',
        voterId: 'v1',
        optionId: 'b',
      }),
    ).toEqual({ ok: true, countKey: 'b', countDecKey: 'a' })
    expect(v.v1).toEqual(['b'])
  })

  it('rejects selecting the same option again', () => {
    const v = voters()
    applyVoteMutation(v, {
      questionKind: 'poll',
      votePolicy: 'multi',
      voterId: 'v1',
      optionId: 'a',
    })
    const dup = applyVoteMutation(v, {
      questionKind: 'poll',
      votePolicy: 'multi',
      voterId: 'v1',
      optionId: 'a',
    })
    expect(dup.ok).toBe(false)
  })
})

describe('applyVoteMutation — poll + react', () => {
  it('allows consecutive votes without dedupe; stored choice is last only', () => {
    const v = voters()
    expect(
      applyVoteMutation(v, {
        questionKind: 'poll',
        votePolicy: 'react',
        voterId: 'v1',
        optionId: 'a',
      }).ok,
    ).toBe(true)
    expect(
      applyVoteMutation(v, {
        questionKind: 'poll',
        votePolicy: 'react',
        voterId: 'v1',
        optionId: 'b',
      }),
    ).toEqual({ ok: true, countKey: 'b', countDecKey: null })
    // Caller increments counts for both (+1 each); votes map holds last emoji only.
    expect(v.v1).toEqual(['b'])
  })
})

describe('kind helpers', () => {
  it('isMultiVoteQuestionKind matches multi-accumulator kinds', () => {
    expect(isMultiVoteQuestionKind('multi_select')).toBe(true)
    expect(isMultiVoteQuestionKind('upvote')).toBe(true)
    expect(isMultiVoteQuestionKind('word_cloud')).toBe(true)
    expect(isMultiVoteQuestionKind('poll')).toBe(false)
    expect(isMultiVoteQuestionKind('open')).toBe(false)
  })

  it('isFreeTextQuestionKind matches open-ended text', () => {
    expect(isFreeTextQuestionKind('word_cloud')).toBe(true)
    expect(isFreeTextQuestionKind('open')).toBe(true)
    expect(isFreeTextQuestionKind('poll')).toBe(false)
  })
})
