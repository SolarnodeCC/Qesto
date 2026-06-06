// Energizer / trivia live state shared between the SessionRoom DO and clients.

export type LiveEnergizerKind =
  | 'quick_finger'
  | 'team_quiz'
  | 'emoji_poll'
  | 'word_cloud'
  | 'bracket'
  | 'battle_royale'
export type LiveEnergizerAnswer = {
  voterId: string
  value: string
  correct: boolean
  speedMs: number
  rank: number
}
export type LiveTeamQuizQuestion = {
  prompt: string
  options: string[]
  correctIndex: number
}
export type LiveTeamQuizSubmission = {
  voterId: string
  questionIndex: number
  value: string
  correct: boolean
}
export type LiveTeamQuizScore = {
  voterId: string
  score: number
  rank: number
}
export type LiveBadgeKind = 'first_answer' | 'speedster' | 'perfect_trivia' | 'engaged'
export type LiveBadgeAward = {
  id: string
  kind: LiveBadgeKind
  label: string
  awardedAt: number
}
export type LiveLeaderboardEntry = {
  voterId: string
  label: string
  score: number
  rank: number
  badges: LiveBadgeAward[]
}
export type LiveEnergizerState = {
  id: string
  kind: LiveEnergizerKind
  title: string
  status: 'active' | 'completed'
  prompt?: string
  options?: string[]
  correctIndex?: number
  startedAt?: number
  answers?: LiveEnergizerAnswer[]
  questions?: LiveTeamQuizQuestion[]
  currentIndex?: number
  submissions?: LiveTeamQuizSubmission[]
  scores?: LiveTeamQuizScore[]
  leaderboard?: LiveLeaderboardEntry[]
  badges?: Record<string, LiveBadgeAward[]>
}
