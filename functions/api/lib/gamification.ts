// Gamification helpers — Battle Royale + Bracket competition (Phase 9 Step 1)
//
// Energizer state machine for advanced competition modes:
// - Battle Royale: multi-round elimination with scoring multipliers
// - Bracket: tournament-style head-to-head competitions (4/8/16 participants)

export type EnergizerKind = 'poll' | 'ranking' | 'consent' | 'open' | 'battle_royale' | 'bracket'

export interface BattleRoyaleConfig {
  num_rounds: number
  participants: string[] // user IDs
  scoring_multiplier: number // scale factor per round
  elimination_threshold: number // bottom N% eliminated per round
}

export interface BracketConfig {
  bracket_size: 4 | 8 | 16 // number of participants
  participants: string[] // user IDs
  match_format: 'single_elimination' | 'double_elimination'
}

export interface EnergizerState {
  id: string
  kind: EnergizerKind
  prompt: string
  options: Array<{ id: string; label: string }>
  config: BattleRoyaleConfig | BracketConfig | Record<string, any>
  state: 'draft' | 'active' | 'completed'
  created_at: number
}

// ─── Battle Royale Orchestration ───────────────────────────────────────────

/**
 * Initialize a battle royale competition with participants.
 * Returns the initial round configuration.
 */
export function initializeBattleRoyale(
  participants: string[],
  config: Partial<BattleRoyaleConfig> = {},
): BattleRoyaleConfig {
  const numRounds = config.num_rounds ?? Math.ceil(Math.log2(participants.length))
  return {
    num_rounds: numRounds,
    participants: participants.sort(() => Math.random() - 0.5), // shuffle
    scoring_multiplier: config.scoring_multiplier ?? 1,
    elimination_threshold: config.elimination_threshold ?? 0.5, // bottom 50%
  }
}

/**
 * Calculate next round participants based on scores.
 * Eliminates bottom performers, scales scores by multiplier.
 */
export function advanceBattleRoyaleRound(
  currentParticipants: string[],
  scores: Record<string, number>,
  eliminationThreshold: number,
  scoringMultiplier: number,
): { advancing: string[]; eliminated: string[]; scaledScores: Record<string, number> } {
  // Sort by score descending
  const sorted = currentParticipants.sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0))

  // Calculate elimination cutoff
  const cutoffIndex = Math.ceil(sorted.length * (1 - eliminationThreshold))
  const advancing = sorted.slice(0, Math.max(1, cutoffIndex))
  const eliminated = sorted.slice(cutoffIndex)

  // Scale scores for next round
  const scaledScores: Record<string, number> = {}
  advancing.forEach((pid) => {
    scaledScores[pid] = Math.round((scores[pid] ?? 0) * scoringMultiplier)
  })

  return { advancing, eliminated, scaledScores }
}

/**
 * Determine battle royale winner (last participant standing).
 */
export function getBattleRoyaleWinner(finalParticipants: string[]): string | null {
  return finalParticipants.length === 1 ? finalParticipants[0] : null
}

// ─── Bracket Orchestration ────────────────────────────────────────────────

/**
 * Initialize bracket competition with participant shuffling.
 * Returns the first round match pairings.
 */
export function initializeBracket(
  participants: string[],
  bracketSize: 4 | 8 | 16,
): BracketConfig & { firstRoundMatches: Array<[string, string]> } {
  if (participants.length > bracketSize) {
    throw new Error(`Too many participants for bracket size ${bracketSize}`)
  }

  // Pad with byes if needed
  const padded = [...participants]
  while (padded.length < bracketSize) {
    padded.push(`bye_${padded.length}`)
  }

  // Shuffle and create match pairings
  padded.sort(() => Math.random() - 0.5)
  const firstRoundMatches: Array<[string, string]> = []
  for (let i = 0; i < padded.length; i += 2) {
    firstRoundMatches.push([padded[i], padded[i + 1]])
  }

  return {
    bracket_size: bracketSize,
    participants: padded,
    match_format: 'single_elimination',
    firstRoundMatches,
  }
}

/**
 * Advance bracket to next round based on match winners.
 * Returns the next round's match pairings.
 */
export function advanceBracketRound(
  currentRoundWinners: string[],
): Array<[string, string]> {
  const nextRound: Array<[string, string]> = []
  for (let i = 0; i < currentRoundWinners.length; i += 2) {
    nextRound.push([currentRoundWinners[i], currentRoundWinners[i + 1]])
  }
  return nextRound
}

/**
 * Determine bracket champion (last winner standing).
 */
export function getBracketWinner(finalWinner: string): string {
  return finalWinner.startsWith('bye_') ? null : finalWinner
}

// ─── Badge Awards ────────────────────────────────────────────────────────

export type BadgeType = 'first_answer' | 'speedster' | 'perfect_trivia' | 'engagement' | 'leaderboard' | 'streak' | 'consensus' | 'comeback'

/**
 * Determine which badges should be awarded based on session performance.
 */
export function determineBadgesAwarded(
  userId: string,
  sessionStats: {
    first_answer?: boolean
    response_time_ms?: number
    accuracy?: number
    answer_count?: number
    leaderboard_rank?: number
    streak_count?: number
    vote_agreement?: number
  },
): BadgeType[] {
  const badges: BadgeType[] = []

  if (sessionStats.first_answer) badges.push('first_answer')
  if (sessionStats.response_time_ms !== undefined && sessionStats.response_time_ms < 2000) badges.push('speedster')
  if (sessionStats.accuracy !== undefined && sessionStats.accuracy === 1.0) badges.push('perfect_trivia')
  if (sessionStats.answer_count !== undefined && sessionStats.answer_count > 8) badges.push('engagement')
  if (sessionStats.leaderboard_rank !== undefined && sessionStats.leaderboard_rank === 1) badges.push('leaderboard')
  if (sessionStats.streak_count !== undefined && sessionStats.streak_count >= 3) badges.push('streak')
  if (sessionStats.vote_agreement !== undefined && sessionStats.vote_agreement > 0.8) badges.push('consensus')
  if (sessionStats.leaderboard_rank !== undefined && sessionStats.leaderboard_rank <= 3) badges.push('comeback')

  return [...new Set(badges)] // deduplicate
}
