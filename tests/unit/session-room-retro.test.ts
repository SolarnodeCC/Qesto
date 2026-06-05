import { describe, expect, it } from 'vitest'
import {
  RETRO_KEYS,
  RETRO_COLUMNS,
  canUpvoteColumn,
  createRetroItem,
  nextRetroRev,
} from '../../functions/api/lib/session-room-retro'

describe('retro storage keys', () => {
  it('builds point-addressable keys', () => {
    expect(RETRO_KEYS.item('x')).toBe('retro:item:x')
    expect(RETRO_KEYS.upvoters('x')).toBe('retro:upvoters:x')
    expect(RETRO_KEYS.voterDots('v')).toBe('retro:voter_dots:v')
    expect(RETRO_KEYS.index).toBe('retro:index')
  })
})

describe('createRetroItem', () => {
  it('creates items with trimmed body and optional carried flag', () => {
    const item = createRetroItem('actions', '  Ship faster  ', true)
    expect(item.column).toBe('actions')
    expect(item.body).toBe('Ship faster')
    expect(item.upvotes).toBe(0)
    expect(item.carried).toBe(true)
  })
})

describe('canUpvoteColumn', () => {
  it('only allows dot votes on action items', () => {
    expect(canUpvoteColumn('actions')).toBe(true)
    expect(canUpvoteColumn('went_well')).toBe(false)
    expect(canUpvoteColumn('didnt_go_well')).toBe(false)
  })
})

describe('nextRetroRev', () => {
  it('increments revision counter', () => {
    expect(nextRetroRev(0)).toBe(1)
    expect(nextRetroRev(4)).toBe(5)
  })
})

describe('RETRO_COLUMNS', () => {
  it('lists the three retro columns in order', () => {
    expect(RETRO_COLUMNS).toEqual(['went_well', 'didnt_go_well', 'actions'])
  })
})
