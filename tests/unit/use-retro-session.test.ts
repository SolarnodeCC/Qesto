import { describe, expect, it } from 'vitest'
import {
  RETRO_INITIAL,
  itemsByColumn,
  retroReducer,
  sortActionsByUpvotes,
  type RetroItem,
  type RetroState,
} from '../../src/hooks/useRetroSession'

const item = (over: Partial<RetroItem> = {}): RetroItem => ({
  id: 'i1',
  column: 'actions',
  body: 'Fix CI',
  upvotes: 0,
  createdAt: 100,
  ...over,
})

const ready = (over: Partial<RetroState> = {}): RetroState => ({
  ...RETRO_INITIAL,
  connection: 'open',
  rev: 5,
  ...over,
})

describe('retro snapshot', () => {
  it('restores voter dot state from snapshot', () => {
    const s = retroReducer(ready(), {
      kind: 'snapshot',
      items: [item({ id: 'a' })],
      rev: 9,
      dotVoteLimit: 2,
      myUpvotes: ['a'],
      dotsUsed: 1,
    })
    expect(s.rev).toBe(9)
    expect(s.dotVoteLimit).toBe(2)
    expect(s.myUpvotes).toEqual(['a'])
    expect(s.dotsUsed).toBe(1)
  })
})

describe('optimistic upvote', () => {
  it('bumps count and records my upvote', () => {
    const s = retroReducer(ready({ items: [item({ id: 'x', upvotes: 2 })] }), {
      kind: 'upvote_optimistic',
      itemId: 'x',
    })
    expect(s.items.find((i) => i.id === 'x')?.upvotes).toBe(3)
    expect(s.myUpvotes).toContain('x')
    expect(s.dotsUsed).toBe(1)
  })

  it('is idempotent for the same item', () => {
    const base = ready({ items: [item({ id: 'x', upvotes: 2 })], myUpvotes: ['x'], dotsUsed: 1 })
    const s = retroReducer(base, { kind: 'upvote_optimistic', itemId: 'x' })
    expect(s).toBe(base)
  })
})

describe('upvote rollback', () => {
  it('reverts optimistic vote on server error', () => {
    const base = ready({
      items: [item({ id: 'x', upvotes: 3 })],
      myUpvotes: ['x'],
      dotsUsed: 1,
    })
    const s = retroReducer(base, { kind: 'upvote_rollback', itemId: 'x' })
    expect(s.items.find((i) => i.id === 'x')?.upvotes).toBe(2)
    expect(s.myUpvotes).toEqual([])
    expect(s.dotsUsed).toBe(0)
  })
})

describe('sortActionsByUpvotes', () => {
  it('orders by upvotes desc then createdAt asc', () => {
    const sorted = sortActionsByUpvotes([
      item({ id: 'a', upvotes: 5, createdAt: 100 }),
      item({ id: 'b', upvotes: 5, createdAt: 50 }),
      item({ id: 'c', upvotes: 9, createdAt: 10 }),
    ])
    expect(sorted.map((i) => i.id)).toEqual(['c', 'b', 'a'])
  })
})

describe('itemsByColumn', () => {
  it('sorts action items by upvotes', () => {
    const items = [
      item({ id: 'a', column: 'actions', upvotes: 1, createdAt: 10 }),
      item({ id: 'b', column: 'went_well', upvotes: 0, createdAt: 5 }),
      item({ id: 'c', column: 'actions', upvotes: 3, createdAt: 20 }),
    ]
    expect(itemsByColumn(items, 'actions').map((i) => i.id)).toEqual(['c', 'a'])
    expect(itemsByColumn(items, 'went_well').map((i) => i.id)).toEqual(['b'])
  })
})
