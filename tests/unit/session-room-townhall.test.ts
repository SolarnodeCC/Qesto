import { describe, expect, it } from 'vitest'
import type { TownhallItem } from '../../functions/api/realtime'
import {
  TOWNHALL_KEYS,
  nextRev,
  createTownhallItem,
  normalizeBody,
  isDuplicateBody,
  applyTownhallUpvote,
  applyTownhallModeration,
  isAudienceVisible,
  mergedUpvoteCount,
  toBoardItem,
  compareForDisplay,
} from '../../functions/api/lib/session-room-townhall'

const baseItem = (over: Partial<TownhallItem> = {}): TownhallItem => ({
  id: 'i1',
  body: 'How will this affect Q3?',
  displayName: null,
  authorHash: 'voter-a',
  status: 'pending',
  upvotes: 0,
  groupParent: null,
  createdAt: 1000,
  rev: 1,
  ...over,
})

describe('storage key layout', () => {
  it('builds point-addressable keys', () => {
    expect(TOWNHALL_KEYS.item('x')).toBe('th:item:x')
    expect(TOWNHALL_KEYS.upvoters('x')).toBe('th:upvoters:x')
    expect(TOWNHALL_KEYS.submitRate('v')).toBe('th:submit_rate:v')
    expect(TOWNHALL_KEYS.meta).toBe('th:meta')
  })
})

describe('createTownhallItem', () => {
  it('pre-moderation starts pending (hidden)', () => {
    const item = createTownhallItem({ id: 'i', body: '  hi there  ', authorHash: 'a', moderation: 'pre', now: 5, rev: 2 })
    expect(item.status).toBe('pending')
    expect(item.body).toBe('hi there')
    expect(item.displayName).toBeNull()
    expect(item.upvotes).toBe(0)
  })

  it('post-moderation starts approved (visible)', () => {
    const item = createTownhallItem({ id: 'i', body: 'q', authorHash: 'a', moderation: 'post', now: 5, rev: 2 })
    expect(item.status).toBe('approved')
  })

  it('keeps a trimmed display name when provided', () => {
    const item = createTownhallItem({
      id: 'i', body: 'q', displayName: '  Sam ', authorHash: 'a', moderation: 'post', now: 5, rev: 2,
    })
    expect(item.displayName).toBe('Sam')
  })
})

describe('duplicate-body suppression', () => {
  it('normalizes case and whitespace', () => {
    expect(normalizeBody('  How   ARE you? ')).toBe('how are you?')
  })
  it('detects near-identical bodies', () => {
    expect(isDuplicateBody(['How are you?'], 'how   are you?')).toBe(true)
    expect(isDuplicateBody(['How are you?'], 'Different question')).toBe(false)
  })
})

describe('applyTownhallUpvote', () => {
  it('adds a new upvoter and bumps count to set size', () => {
    const r = applyTownhallUpvote(baseItem({ upvotes: 0 }), [], 'voter-b', 7)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.upvoters).toEqual(['voter-b'])
      expect(r.item.upvotes).toBe(1)
      expect(r.item.rev).toBe(7)
    }
  })

  it('rejects a duplicate upvote from the same voter', () => {
    const r = applyTownhallUpvote(baseItem(), ['voter-b'], 'voter-b', 7)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('duplicate')
  })
})

describe('moderation state machine', () => {
  it('approves a pending item', () => {
    const r = applyTownhallModeration(baseItem({ status: 'pending' }), 'approve', { rev: 3 })
    expect(r).toMatchObject({ ok: true, kind: 'item' })
    if (r.ok && r.kind === 'item') expect(r.item.status).toBe('approved')
  })

  it('rejects approving an already-approved item', () => {
    const r = applyTownhallModeration(baseItem({ status: 'approved' }), 'approve', { rev: 3 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('invalid_transition')
  })

  it('dismiss then restore round-trips to approved', () => {
    const dismissed = applyTownhallModeration(baseItem({ status: 'approved' }), 'dismiss', { rev: 4 })
    expect(dismissed).toMatchObject({ ok: true, kind: 'item' })
    if (dismissed.ok && dismissed.kind === 'item') {
      expect(dismissed.item.status).toBe('dismissed')
      const restored = applyTownhallModeration(dismissed.item, 'restore', { rev: 5 })
      if (restored.ok && restored.kind === 'item') expect(restored.item.status).toBe('approved')
    }
  })

  it('answers an approved item', () => {
    const r = applyTownhallModeration(baseItem({ status: 'approved' }), 'answer', { rev: 6 })
    if (r.ok && r.kind === 'item') expect(r.item.status).toBe('answered')
  })

  it('spotlight returns a pointer change for approved/answered only', () => {
    const ok = applyTownhallModeration(baseItem({ status: 'approved' }), 'spotlight', { rev: 7 })
    expect(ok).toEqual({ ok: true, kind: 'spotlight', spotlightId: 'i1' })
    const clear = applyTownhallModeration(baseItem({ status: 'approved' }), 'clear_spotlight', { rev: 7 })
    expect(clear).toEqual({ ok: true, kind: 'spotlight', spotlightId: null })
    const bad = applyTownhallModeration(baseItem({ status: 'pending' }), 'spotlight', { rev: 7 })
    expect(bad.ok).toBe(false)
  })

  it('group requires a parent id and forbids self-grouping', () => {
    expect(applyTownhallModeration(baseItem(), 'group', { rev: 8 }).ok).toBe(false)
    expect(applyTownhallModeration(baseItem(), 'group', { rev: 8, groupParentId: 'i1' }).ok).toBe(false)
    const r = applyTownhallModeration(baseItem({ status: 'approved' }), 'group', { rev: 8, groupParentId: 'i2' })
    if (r.ok && r.kind === 'item') {
      expect(r.item.status).toBe('grouped')
      expect(r.item.groupParent).toBe('i2')
    }
  })

  it('ungroup returns a grouped child to approved', () => {
    const r = applyTownhallModeration(baseItem({ status: 'grouped', groupParent: 'i2' }), 'ungroup', { rev: 9 })
    if (r.ok && r.kind === 'item') {
      expect(r.item.status).toBe('approved')
      expect(r.item.groupParent).toBeNull()
    }
  })
})

describe('visibility & projection', () => {
  it('only approved/answered are audience-visible', () => {
    expect(isAudienceVisible('approved')).toBe(true)
    expect(isAudienceVisible('answered')).toBe(true)
    expect(isAudienceVisible('pending')).toBe(false)
    expect(isAudienceVisible('dismissed')).toBe(false)
    expect(isAudienceVisible('grouped')).toBe(false)
  })

  it('merged upvotes are the union of sets (no double-count)', () => {
    // parent + two grouped children, with an overlapping voter across all three.
    expect(mergedUpvoteCount([['a', 'b'], ['b', 'c'], ['a', 'c']])).toBe(3)
    expect(mergedUpvoteCount([[], []])).toBe(0)
  })

  it('toBoardItem hides authorHash and carries merged count', () => {
    const board = toBoardItem(baseItem({ status: 'approved', authorHash: 'secret' }), {
      isSpotlit: true,
      groupedCount: 2,
      mergedUpvotes: 9,
    })
    expect(board).not.toHaveProperty('authorHash')
    expect(board.upvotes).toBe(9)
    expect(board.isSpotlit).toBe(true)
    expect(board.groupedCount).toBe(2)
  })

  it('sorts by upvotes desc then createdAt asc', () => {
    const a = toBoardItem(baseItem({ id: 'a', status: 'approved', createdAt: 100 }), { isSpotlit: false, groupedCount: 0, mergedUpvotes: 5 })
    const b = toBoardItem(baseItem({ id: 'b', status: 'approved', createdAt: 50 }), { isSpotlit: false, groupedCount: 0, mergedUpvotes: 5 })
    const c = toBoardItem(baseItem({ id: 'c', status: 'approved', createdAt: 10 }), { isSpotlit: false, groupedCount: 0, mergedUpvotes: 9 })
    const sorted = [a, b, c].sort(compareForDisplay).map((x) => x.id)
    expect(sorted).toEqual(['c', 'b', 'a']) // c highest votes; b before a (older)
  })
})

describe('nextRev', () => {
  it('monotonically increments', () => {
    expect(nextRev(0)).toBe(1)
    expect(nextRev(41)).toBe(42)
  })
})
