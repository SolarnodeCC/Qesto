import { describe, expect, it } from 'vitest'
import { reactionsReducer, REACTIONS_INITIAL, MAX_REACTION_PARTICLES } from '../../src/hooks/useReactions'

describe('useReactions reducer (FE-REACTIONS-RENDER-01)', () => {
  it('spawns particles on count increases and caps list size', () => {
    let state = REACTIONS_INITIAL
    state = reactionsReducer(state, {
      kind: 'delta',
      counts: { '👍': 20 },
      total: 20,
      now: 1000,
    })
    expect(state.particles.length).toBeGreaterThan(0)
    expect(state.particles.length).toBeLessThanOrEqual(MAX_REACTION_PARTICLES)
    expect(state.total).toBe(20)
  })

  it('expires particles on tick', () => {
    const state = reactionsReducer(
      {
        counts: { '👍': 1 },
        total: 1,
        particles: [{ id: 'p1', emojiId: '👍', x: 0.5, createdAt: 0 }],
      },
      { kind: 'tick', now: 5000 },
    )
    expect(state.particles).toHaveLength(0)
  })
})
