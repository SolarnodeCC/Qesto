import type { PlanTier, Anonymity, VotePolicy, SessionMode, TownhallModeration } from '../types'

export const SENTIMENT_RETRY_DELAY_MS = 5_000
export const SENTIMENT_MAX_RETRIES = 1
export const FUN_MODE_QUESTION_MS = 60_000
export const PER_IP_CONCURRENT_CAP = 10
export const VOTE_BUCKET_CAPACITY = 10
export const VOTE_BUCKET_REFILL_PER_SEC = 1
export const BROADCAST_DEBOUNCE_MS = 100

export type Meta = {
  sessionId: string
  ownerId: string
  teamId?: string
  code: string
  title: string
  startedAt: number
  votePolicy: VotePolicy
  sessionMode: SessionMode
  anonymity?: Anonymity
  plan?: PlanTier
  questionExpiresAt?: number
  paused?: boolean
  townhallModeration?: TownhallModeration
  retroDotVoteLimit?: number
  leaderboardDisplay?: 'names' | 'aliases' | 'hidden'
}

export type Counts = Record<string, number>

export type Votes = Record<string, string[]>

export function normaliseVotes(raw: Record<string, string | string[]> | undefined): Votes {
  const out: Votes = {}
  if (!raw) return out
  for (const [voterId, value] of Object.entries(raw)) {
    out[voterId] = Array.isArray(value) ? value : [value]
  }
  return out
}

export type Attachment = {
  role: 'presenter' | 'voter'
  voterId: string
  ipHash: string
  bucket: { tokens: number; lastAt: number }
  permissions?: string[]
  colo?: string
  protocolVersion?: number
}

export type BufferedVote = {
  sessionId: string
  questionId: string
  voterId: string
  optionId: string
  submittedAt: number
}
