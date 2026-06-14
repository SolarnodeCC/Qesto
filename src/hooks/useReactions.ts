/**
 * FE-REACTIONS-RENDER-01 — Client reaction animation state (S92)
 *
 * Consumes aggregate `reaction_delta` frames and spawns ephemeral floating
 * particles for count increases. Particle list is capped to keep render work
 * under 16ms/frame at 60fps on typical hardware.
 */

export type ReactionParticle = {
  id: string
  emojiId: string
  /** Normalized horizontal position 0–1 within the overlay canvas. */
  x: number
  createdAt: number
}

/** Hard cap on simultaneous particles — bounds DOM + layout work. */
export const MAX_REACTION_PARTICLES = 120
export const REACTION_PARTICLE_LIFETIME_MS = 2200

export type ReactionsState = {
  counts: Record<string, number>
  total: number
  particles: ReactionParticle[]
}

export type ReactionsAction =
  | { kind: 'delta'; counts: Record<string, number>; total: number; now?: number }
  | { kind: 'tick'; now: number }
  | { kind: 'reset' }

export const REACTIONS_INITIAL: ReactionsState = {
  counts: {},
  total: 0,
  particles: [],
}

let particleSeq = 0

function spawnParticles(
  prevCounts: Record<string, number>,
  nextCounts: Record<string, number>,
  now: number,
): ReactionParticle[] {
  const spawned: ReactionParticle[] = []
  for (const [emojiId, next] of Object.entries(nextCounts)) {
    const prev = prevCounts[emojiId] ?? 0
    const delta = next - prev
    if (delta <= 0) continue
    const burst = Math.min(delta, 8)
    for (let i = 0; i < burst; i++) {
      spawned.push({
        id: `rp-${++particleSeq}`,
        emojiId,
        x: 0.08 + Math.random() * 0.84,
        createdAt: now + i * 30,
      })
    }
  }
  return spawned
}

export function reactionsReducer(state: ReactionsState, action: ReactionsAction): ReactionsState {
  switch (action.kind) {
    case 'reset':
      return REACTIONS_INITIAL

    case 'tick': {
      const alive = state.particles.filter(
        (p) => action.now - p.createdAt < REACTION_PARTICLE_LIFETIME_MS,
      )
      if (alive.length === state.particles.length) return state
      return { ...state, particles: alive }
    }

    case 'delta': {
      const now = action.now ?? Date.now()
      const spawned = spawnParticles(state.counts, action.counts, now)
      let particles = [...state.particles, ...spawned]
      if (particles.length > MAX_REACTION_PARTICLES) {
        particles = particles.slice(particles.length - MAX_REACTION_PARTICLES)
      }
      return {
        counts: { ...action.counts },
        total: action.total,
        particles,
      }
    }
  }
}
