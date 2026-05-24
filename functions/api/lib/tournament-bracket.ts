/**
 * GAM-05 — single-elimination bracket seeding (idempotent by energizer).
 */
import { ulid } from './ulid'

export type BracketParticipant = { id: string; label?: string | undefined }

export type BracketMatchSeed = {
  id: string
  energizer_id: string
  round_number: number
  match_number: number
  participant_a_id: string
  participant_b_id: string
  state: 'pending' | 'active' | 'completed'
  created_at: number
}

/** Pad to next power of 2 with byes (participant id empty string = bye). */
export function seedSingleEliminationBracket(
  energizerId: string,
  participants: BracketParticipant[],
): BracketMatchSeed[] {
  if (participants.length < 2) return []
  const slots: (BracketParticipant | null)[] = [...participants]
  let size = 1
  while (size < slots.length) size *= 2
  while (slots.length < size) slots.push(null)

  const round = 1
  const matches: BracketMatchSeed[] = []
  let matchNum = 0
  const now = Date.now()
  for (let i = 0; i < slots.length; i += 2) {
    const a = slots[i]
    const b = slots[i + 1]
    if (!a && !b) continue
    matchNum++
    matches.push({
      id: ulid(),
      energizer_id: energizerId,
      round_number: round,
      match_number: matchNum,
      participant_a_id: a?.id ?? `bye:${matchNum}:a`,
      participant_b_id: b?.id ?? `bye:${matchNum}:b`,
      state: 'pending',
      created_at: now,
    })
  }
  return matches
}
