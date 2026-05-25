import { describe, it, expect } from 'vitest'
import {
  maybeAdvanceBattleRoyale,
  recordBracketPick,
  bracketReadyToAdvance,
} from '../../functions/api/lib/tournament-live'
import type { LiveEnergizerState } from '../../functions/api/realtime'

const base: LiveEnergizerState = {
  id: 'e1',
  kind: 'battle_royale',
  title: 'BR',
  status: 'active',
  options: ['a', 'b', 'c', 'd'],
}

describe('tournament-live', () => {
  it('advances battle royale when all slots answered', () => {
    const active: LiveEnergizerState = {
      ...base,
      answers: [
        { voterId: 'v1', value: 'a', correct: true, speedMs: 0, rank: 1 },
        { voterId: 'v2', value: 'b', correct: true, speedMs: 0, rank: 2 },
        { voterId: 'v3', value: 'c', correct: true, speedMs: 0, rank: 3 },
        { voterId: 'v4', value: 'd', correct: true, speedMs: 0, rank: 4 },
      ],
    }
    const result = maybeAdvanceBattleRoyale(active)
    expect(result).not.toBeNull()
    expect(result?.type === 'round_complete' || result?.type === 'completed').toBe(true)
  })

  it('records bracket picks without duplicate', () => {
    const first = recordBracketPick({ ...base, kind: 'bracket' }, 'v1', 'pick-a')
    expect(first.answers).toHaveLength(1)
    const second = recordBracketPick(first, 'v1', 'pick-b')
    expect(second.answers).toHaveLength(1)
  })

  it('detects bracket ready to advance', () => {
    const active = recordBracketPick(
      recordBracketPick({ ...base, kind: 'bracket' }, 'v1', 'a'),
      'v2',
      'b',
    )
    expect(bracketReadyToAdvance(active)).toBe(true)
  })
})
