import { describe, expect, it } from 'vitest'
import { mergeIdeateUpvoters } from '../../functions/api/lib/session-room-ideate'

describe('mergeIdeateUpvoters', () => {
  it('unions voter ids without double-counting', () => {
    expect(mergeIdeateUpvoters([['a', 'b'], ['b', 'c']])).toEqual(['a', 'b', 'c'])
  })

  it('returns empty array for no voters', () => {
    expect(mergeIdeateUpvoters([[], []])).toEqual([])
  })
})
