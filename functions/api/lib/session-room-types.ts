import type { PlanTier, Anonymity, VotePolicy, SessionMode, TownhallModeration } from '../types'
import type { CaptionLocalePref } from './captions-config'

export const SENTIMENT_RETRY_DELAY_MS = 5_000
export const SENTIMENT_MAX_RETRIES = 1
export const FUN_MODE_QUESTION_MS = 60_000
export const PER_IP_CONCURRENT_CAP = 10
export const VOTE_BUCKET_CAPACITY = 10
export const VOTE_BUCKET_REFILL_PER_SEC = 1
export const BROADCAST_DEBOUNCE_MS = 100

// Phase 2.2 vote buffering (ADR-042).
export const FLUSH_INTERVAL_MS = 5000
export const FLUSH_THRESHOLD = 1000
// Phase 2.3 R2 snapshots (ADR-042).
export const SNAPSHOT_INTERVAL_MS = 30_000

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
  /**
   * CAPTIONS (ADR-0051): this socket's chosen caption locale, or 'off'. Drives
   * which translated `caption_segment` variant the DO addresses to this socket
   * and which locales count toward the distinct-active-locale MT fan-out set.
   * Absent = 'off' (no captions).
   */
  captionLocale?: CaptionLocalePref
}

export type BufferedVote = {
  sessionId: string
  questionId: string
  voterId: string
  optionId: string
  submittedAt: number
}
