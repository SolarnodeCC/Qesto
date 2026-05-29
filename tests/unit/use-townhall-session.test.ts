import { describe, expect, it } from 'vitest'
import {
  townhallReducer,
  TOWNHALL_INITIAL,
  sortBoard,
  type TownhallState,
  type TownhallBoardItem,
} from '../../src/hooks/useTownhallSession'

const item = (over: Partial<TownhallBoardItem> = {}): TownhallBoardItem => ({
  id: 'i1',
  body: 'Question?',
  displayName: null,
  upvotes: 0,
  status: 'approved',
  isSpotlit: false,
  groupedCount: 0,
  createdAt: 100,
  ...over,
})

const ready = (over: Partial<TownhallState> = {}): TownhallState => ({
  ...TOWNHALL_INITIAL,
  connection: 'open',
  rev: 5,
  ...over,
})

describe('townhall snapshot', () => {
  it('replaces the board, applies spotlight, and resets resync', () => {
    const s = townhallReducer(ready({ needsResync: true }), {
      kind: 'snapshot',
      moderation: 'pre',
      items: [item({ id: 'a' }), item({ id: 'b' })],
      spotlightId: 'b',
      rev: 9,
    })
    expect(s.moderation).toBe('pre')
    expect(s.rev).toBe(9)
    expect(s.needsResync).toBe(false)
    expect(s.items.find((i) => i.id === 'b')?.isSpotlit).toBe(true)
  })
})

describe('delta gating by rev', () => {
  it('applies the next expected rev', () => {
    const s = townhallReducer(ready({ rev: 5 }), { kind: 'added', item: item({ id: 'x' }), rev: 6 })
    expect(s.rev).toBe(6)
    expect(s.items.some((i) => i.id === 'x')).toBe(true)
    expect(s.needsResync).toBe(false)
  })

  it('ignores stale/duplicate deltas', () => {
    const base = ready({ rev: 5, items: [item({ id: 'x', upvotes: 3 })] })
    const s = townhallReducer(base, { kind: 'updated', item: item({ id: 'x', upvotes: 99 }), rev: 5 })
    expect(s).toBe(base) // unchanged reference
  })

  it('flags resync on a forward gap but still applies', () => {
    const s = townhallReducer(ready({ rev: 5 }), { kind: 'added', item: item({ id: 'y' }), rev: 8 })
    expect(s.rev).toBe(8)
    expect(s.needsResync).toBe(true)
    expect(s.items.some((i) => i.id === 'y')).toBe(true)
  })
})

describe('updated / removed', () => {
  it('upserts an existing item', () => {
    const base = ready({ rev: 5, items: [item({ id: 'x', upvotes: 1 })] })
    const s = townhallReducer(base, { kind: 'updated', item: item({ id: 'x', upvotes: 7 }), rev: 6 })
    expect(s.items.find((i) => i.id === 'x')?.upvotes).toBe(7)
  })

  it('removes an item', () => {
    const base = ready({ rev: 5, items: [item({ id: 'x' }), item({ id: 'z' })] })
    const s = townhallReducer(base, { kind: 'removed', itemId: 'x', rev: 6 })
    expect(s.items.map((i) => i.id)).toEqual(['z'])
  })
})

describe('spotlight', () => {
  it('marks only the spotlighted item', () => {
    const base = ready({ rev: 5, items: [item({ id: 'a', isSpotlit: true }), item({ id: 'b' })] })
    const s = townhallReducer(base, { kind: 'spotlight', spotlightId: 'b', rev: 6 })
    expect(s.items.find((i) => i.id === 'a')?.isSpotlit).toBe(false)
    expect(s.items.find((i) => i.id === 'b')?.isSpotlit).toBe(true)
    expect(s.spotlightId).toBe('b')
  })
})

describe('optimistic upvote', () => {
  it('bumps the count once and records my upvote', () => {
    const base = ready({ items: [item({ id: 'x', upvotes: 2 })] })
    const s = townhallReducer(base, { kind: 'upvote_optimistic', itemId: 'x' })
    expect(s.items.find((i) => i.id === 'x')?.upvotes).toBe(3)
    expect(s.myUpvotes).toContain('x')
  })

  it('is idempotent for the same item', () => {
    const base = ready({ items: [item({ id: 'x', upvotes: 2 })], myUpvotes: ['x'] })
    const s = townhallReducer(base, { kind: 'upvote_optimistic', itemId: 'x' })
    expect(s).toBe(base)
  })
})

describe('sortBoard', () => {
  it('orders by upvotes desc then createdAt asc', () => {
    const sorted = sortBoard([
      item({ id: 'a', upvotes: 5, createdAt: 100 }),
      item({ id: 'b', upvotes: 5, createdAt: 50 }),
      item({ id: 'c', upvotes: 9, createdAt: 10 }),
    ])
    expect(sorted.map((i) => i.id)).toEqual(['c', 'b', 'a'])
  })
})
