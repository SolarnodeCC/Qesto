/**
 * REACTIONS GA (ADR-0055) — rate budgets, feature flag, default emoji sets.
 */
import type { PlanTier } from '../types'

export const REACTIONS_FEATURE = 'reactions_channel'

/** Per-session reaction budget (messages per rolling 60s). */
export function reactionBudgetPerMinute(plan: PlanTier | undefined): number {
  if (plan === 'team') return 2000
  if (plan === 'starter') return 500
  return 100
}

export const REACTION_RATE_WINDOW_MS = 60_000
export const REACTION_VOTER_FLOOD_WINDOW_MS = 30_000
/** Block voter after this many times their fair share in the flood window. */
export const REACTION_FLOOD_MULTIPLIER = 3

export const REACTION_BROADCAST_DEBOUNCE_MS = 100

export const DEFAULT_REACTION_EMOJIS: ReadonlyArray<{ id: string; label: string }> = [
  { id: '👍', label: 'Thumbs up' },
  { id: '❤️', label: 'Heart' },
  { id: '😂', label: 'Laughing' },
  { id: '🎉', label: 'Celebration' },
  { id: '👏', label: 'Clap' },
]

export function isValidReactionEmojiId(id: string): boolean {
  return id.length >= 1 && id.length <= 16
}
