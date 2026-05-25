/**
 * GAM-05-LIVE-01 — bracket / battle royale progression in SessionRoom.
 */
import type { LiveEnergizerState } from '../realtime'

export type TournamentAdvanceResult =
  | { type: 'continue'; state: LiveEnergizerState }
  | { type: 'round_complete'; state: LiveEnergizerState; eliminated: string[] }
  | { type: 'completed'; state: LiveEnergizerState; winnerId: string }

/** Battle royale: eliminate bottom 25% when all participants answered. */
export function maybeAdvanceBattleRoyale(active: LiveEnergizerState): TournamentAdvanceResult | null {
  if (active.kind !== 'battle_royale') return null
  const answers = active.answers ?? []
  const minParticipants = Math.max(2, active.options?.length ?? 2)
  if (answers.length < minParticipants) return null

  const sorted = [...answers].sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0))
  const eliminateCount = Math.max(1, Math.floor(sorted.length * 0.25))
  const survivors = sorted.slice(0, sorted.length - eliminateCount)
  const eliminated = sorted.slice(-eliminateCount).map((a) => a.voterId)

  if (survivors.length <= 1) {
    const winnerId = survivors[0]?.voterId ?? eliminated[0] ?? 'unknown'
    return {
      type: 'completed',
      state: { ...active, status: 'completed', answers: survivors },
      winnerId,
    }
  }

  return {
    type: 'round_complete',
    state: {
      ...active,
      answers: [],
      options: survivors.map((s) => s.voterId),
    },
    eliminated,
  }
}

/** Bracket pick: when 2+ picks recorded, mark match progress (simplified LIVE). */
export function recordBracketPick(active: LiveEnergizerState, voterId: string, pick: string): LiveEnergizerState {
  const existing = active.answers ?? []
  if (existing.some((a) => a.voterId === voterId)) return active
  return {
    ...active,
    answers: [...existing, { voterId, value: pick, correct: true, speedMs: 0, rank: existing.length + 1 }],
  }
}

export function bracketReadyToAdvance(active: LiveEnergizerState): boolean {
  if (active.kind !== 'bracket') return false
  const answers = active.answers ?? []
  return answers.length >= 2
}
