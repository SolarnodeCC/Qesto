// Wire format for the SessionRoom WebSocket protocol. The SPEC_REALTIME.md
// taxonomy is the north star; v1 ships the subset below (enough for S1–S5
// acceptance). Extra types get added alongside new client features, never
// ahead of them.
//
// All messages are JSON text frames: { v, type, data, timestamp } where
// `v` is the protocol version. Missing `v` is accepted as legacy v1 and
// `timestamp` is the sender's epoch-ms clock (for latency tracing only —
// never trusted for ordering).

import type { PollOption, QuestionKind, VotePolicy, SessionMode } from './types'

export const LIVE_PROTOCOL_VERSION = 1
export type LiveProtocolVersion = typeof LIVE_PROTOCOL_VERSION

export type VersionedClientEnvelope = {
  v?: LiveProtocolVersion
  type?: string
  data?: unknown
  timestamp?: number
}

export type LiveEnergizerKind = 'quick_finger' | 'team_quiz' | 'emoji_poll' | 'word_cloud'
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

// ── Client → Server ─────────────────────────────────────────────────────────
export type ClientMessage =
  | { v?: LiveProtocolVersion; type: 'vote'; data: { questionId: string; optionId: string }; timestamp: number }
  | { v?: LiveProtocolVersion; type: 'advance'; data: Record<string, never>; timestamp: number }
  | { v?: LiveProtocolVersion; type: 'back'; data: Record<string, never>; timestamp: number }
  | { v?: LiveProtocolVersion; type: 'request_state'; data: Record<string, never>; timestamp: number }
  | { v?: LiveProtocolVersion; type: 'pause'; data: Record<string, never>; timestamp: number }
  | { v?: LiveProtocolVersion; type: 'resume'; data: Record<string, never>; timestamp: number }
  | { v?: LiveProtocolVersion; type: 'energizer_activate'; data: { energizer: LiveEnergizerState }; timestamp: number }
  | { v?: LiveProtocolVersion; type: 'energizer_answer'; data: { energizerId: string; value: string }; timestamp: number }
  | { v?: LiveProtocolVersion; type: 'energizer_advance'; data: { energizerId: string }; timestamp: number }

// ── Server → Client ─────────────────────────────────────────────────────────
export type LiveQuestion = {
  id: string
  kind: QuestionKind
  prompt: string
  options: PollOption[]
}

export type LiveSessionSummary = {
  id: string
  code: string
  title: string
  status: 'live' | 'closed'
  votePolicy: VotePolicy
  sessionMode: SessionMode
}

export type ServerMessage =
  | {
      v?: LiveProtocolVersion
      type: 'init'
      data: {
        session: LiveSessionSummary
        role: 'presenter' | 'voter'
        voterId: string
        question: LiveQuestion | null
        questionIndex: number
        questionTotal: number
        results: { counts: Record<string, number>; total: number }
        participants: number
        energizer: LiveEnergizerState | null
        /** Unix ms when the current question auto-advances (fun mode only). */
        expiresAt: number | null
      }
      timestamp: number
    }
  | {
      v?: LiveProtocolVersion
      type: 'question'
      data: { question: LiveQuestion; index: number; total: number }
      timestamp: number
    }
  | {
      v?: LiveProtocolVersion
      type: 'results'
      data: { counts: Record<string, number>; total: number }
      timestamp: number
    }
  | {
      v?: LiveProtocolVersion
      type: 'participants'
      data: { count: number }
      timestamp: number
    }
  | {
      v?: LiveProtocolVersion
      type: 'session_closed'
      data: { counts: Record<string, number>; total: number }
      timestamp: number
    }
  | {
      v?: LiveProtocolVersion
      type: 'question_timeout'
      data: { questionId: string }
      timestamp: number
    }
  | {
      v?: LiveProtocolVersion
      type: 'session_paused'
      data: Record<string, never>
      timestamp: number
    }
  | {
      v?: LiveProtocolVersion
      type: 'session_resumed'
      data: Record<string, never>
      timestamp: number
    }
  | {
      v?: LiveProtocolVersion
      type: 'all_done'
      data: Record<string, never>
      timestamp: number
    }
  | {
      v?: LiveProtocolVersion
      type: 'energizer_state'
      data: { energizer: LiveEnergizerState | null }
      timestamp: number
    }
  | {
      v?: LiveProtocolVersion
      type: 'error'
      data: { code: string; message: string }
      timestamp: number
    }

// Close codes (SPEC_REALTIME.md §WebSocket Protocol).
export const CLOSE_NORMAL = 1000
export const CLOSE_POLICY_VIOLATION = 1008
export const CLOSE_SERVER_ERROR = 1011

// Subprotocol prefix for presenter auth: `qesto.bearer.<JWT>`.
export const PRESENTER_SUBPROTOCOL_PREFIX = 'qesto.bearer.'
