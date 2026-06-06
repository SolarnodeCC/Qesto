import { describe, expect, it } from 'vitest'
import {
  IDEATE_INITIAL,
  ideateReducer,
  type IdeateIdea,
  type IdeateState,
} from '../../src/hooks/useIdeateSession'

const idea = (over: Partial<IdeateIdea> = {}): IdeateIdea => ({
  id: 'i1',
  body: 'Ship faster',
  upvotes: 0,
  clusterId: null,
  status: 'active',
  createdAt: 100,
  ...over,
})

const ready = (over: Partial<IdeateState> = {}): IdeateState => ({
  ...IDEATE_INITIAL,
  connection: 'open',
  rev: 5,
  ...over,
})

describe('ideate snapshot', () => {
  it('restores voter dot state from snapshot', () => {
    const s = ideateReducer(ready(), {
      kind: 'snapshot',
      ideas: [idea({ id: 'a' })],
      clusters: [],
      rev: 9,
      dotVoteLimit: 5,
      rankingRevealed: false,
      ranking: [],
      myUpvotes: ['a'],
      dotsUsed: 1,
    })
    expect(s.myUpvotes).toEqual(['a'])
    expect(s.dotsUsed).toBe(1)
  })
})

describe('optimistic upvote', () => {
  it('bumps count and records my upvote', () => {
    const s = ideateReducer(ready({ ideas: [idea({ id: 'x', upvotes: 2 })] }), {
      kind: 'upvote_optimistic',
      itemId: 'x',
    })
    expect(s.ideas.find((i) => i.id === 'x')?.upvotes).toBe(3)
    expect(s.myUpvotes).toContain('x')
  })
})

describe('upvote rollback', () => {
  it('reverts optimistic vote on server error', () => {
    const base = ready({
      ideas: [idea({ id: 'x', upvotes: 3 })],
      myUpvotes: ['x'],
      dotsUsed: 1,
    })
    const s = ideateReducer(base, { kind: 'upvote_rollback', itemId: 'x' })
    expect(s.ideas.find((i) => i.id === 'x')?.upvotes).toBe(2)
    expect(s.myUpvotes).toEqual([])
    expect(s.dotsUsed).toBe(0)
  })
})
