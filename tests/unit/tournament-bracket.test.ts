import { describe, expect, it } from 'vitest'
import { seedSingleEliminationBracket } from '../../functions/api/lib/tournament-bracket'

describe('seedSingleEliminationBracket (GAM-05)', () => {
  it('creates first-round matches for even participant count', () => {
    const matches = seedSingleEliminationBracket('eg1', [
      { id: 'a' },
      { id: 'b' },
      { id: 'c' },
      { id: 'd' },
    ])
    expect(matches.length).toBe(2)
    expect(matches[0].round_number).toBe(1)
    expect(matches[0].energizer_id).toBe('eg1')
  })

  it('returns empty for fewer than 2 participants', () => {
    expect(seedSingleEliminationBracket('eg1', [{ id: 'solo' }])).toEqual([])
  })
})
