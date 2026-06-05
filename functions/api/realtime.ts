// Wire format for the SessionRoom WebSocket protocol. The SPEC_REALTIME.md
import { getFlag } from './lib/flags'
// taxonomy is the north star; v1 ships the subset below (enough for S1–S5
// acceptance). Extra types get added alongside new client features, never
// ahead of them.
//
// All messages are JSON text frames: { v, type, data, timestamp } where

// `timestamp` is the sender's epoch-ms clock (for latency tracing only —
// never trusted for ordering).

import type {
  PollOption,
  QuestionKind,
  VotePolicy,
  SessionMode,
  Anonymity,
  TownhallModeration,
  TownhallItemStatus,
} from './types'

export const LIVE_PROTOCOL_VERSION = 1
export const LIVE_PROTOCOL_VERSION_V2 = 2
export const LIVE_PROTOCOL_VERSION_V3 = 3
export type LiveProtocolVersion = 1 | 2 | 3

export const SUPPORTED_LIVE_PROTOCOL_VERSIONS: LiveProtocolVersion[] = [1, 2, 3]

export function defaultLiveProtocolVersion(env: {
  REALTIME_V2_DEFAULT?: string
  REALTIME_V2_ENABLED?: string
  REALTIME_V3_ENABLED?: string
}): LiveProtocolVersion {
  if (getFlag(env, 'REALTIME_V2_DEFAULT') && env.REALTIME_V2_ENABLED !== 'false') return 2
  return 1
}

export function isLiveProtocolSupported(
  version: number | undefined,
  env: { REALTIME_V2_ENABLED?: string; REALTIME_V2_DEFAULT?: string; REALTIME_V3_ENABLED?: string },
): boolean {
  const v = version ?? defaultLiveProtocolVersion(env)
  if (v === 1) return true
  if (v === 2) return getFlag(env, 'REALTIME_V2_ENABLED') || getFlag(env, 'REALTIME_V2_DEFAULT')
  if (v === 3) return getFlag(env, 'REALTIME_V3_ENABLED')
  return false
}

export function liveProtocolFeatures(version: LiveProtocolVersion): string[] {
  if (version === 2) return ['delta_results', 'participants_delta']
  if (version === 3) return ['delta_results', 'participants_delta', 'results_delta']
  return []
}

// TOWNHALL (ADR-0044). Townhall messages are an additive family on v1, gated by an
// env flag rather than a protocol version bump. The DO appends this string to the
// `init.features` array when the flag is on and the session is in townhall mode, so
// clients capability-detect the same way they do for `delta_results`.
export const TOWNHALL_FEATURE = 'townhall_board'
export const IDEATE_FEATURE = 'ideate_board'

export function townhallEnabled(env: { REALTIME_TOWNHALL_ENABLED?: string }): boolean {
  return getFlag(env, 'REALTIME_TOWNHALL_ENABLED')
}

export type VersionedClientEnvelope = {
  v?: LiveProtocolVersion
  type?: string
  data?: unknown
  timestamp?: number
}

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

// ── TOWNHALL board (ADR-0044) ────────────────────────────────────────────────
// Moderator actions on a single board item. `spotlight`/`clear_spotlight` move an
// O(1) pointer; `group` requires a `groupParentId`.
export type TownhallModerateAction =
  | 'approve'
  | 'dismiss'
  | 'restore'
  | 'answer'
  | 'spotlight'
  | 'clear_spotlight'
  | 'group'
  | 'ungroup'

// Server-internal item (full record kept in DO storage; includes authorHash).
export type TownhallItem = {
  id: string
  body: string
  displayName: string | null
  authorHash: string
  status: TownhallItemStatus
  upvotes: number
  groupParent: string | null
  createdAt: number
  rev: number
}

// Audience/console-facing projection — never carries authorHash.
export type TownhallBoardItem = {
  id: string
  body: string
  displayName: string | null
  upvotes: number
  status: Exclude<TownhallItemStatus, 'grouped'>
  isSpotlit: boolean
  groupedCount: number
  createdAt: number
}

export type TownhallMeta = {
  moderation: TownhallModeration
  anonymity: Anonymity
  version: number
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
  // COPILOT-06 (ADR-0046). Presenter injects a copilot-drafted question into the live set.
  | {
      v?: LiveProtocolVersion
      type: 'add_question'
      data: { question: { kind: QuestionKind; prompt: string; options: { label: string }[] } }
      timestamp: number
    }
  // TOWNHALL (ADR-0044). submit/upvote open to voters; moderate requires presenter + session:moderate.
  | { v?: LiveProtocolVersion; type: 'townhall_submit'; data: { body: string; displayName?: string }; timestamp: number }
  | { v?: LiveProtocolVersion; type: 'townhall_upvote'; data: { itemId: string }; timestamp: number }
  | {
      v?: LiveProtocolVersion
      type: 'townhall_moderate'
      data: { itemId: string; action: TownhallModerateAction; groupParentId?: string }
      timestamp: number
    }
  // RETRO (ADR-0048). 3-column board submit + dot-vote on actions.
  | {
      v?: LiveProtocolVersion
      type: 'retro_submit'
      data: { column: 'went_well' | 'didnt_go_well' | 'actions'; body: string }
      timestamp: number
    }
  | { v?: LiveProtocolVersion; type: 'retro_upvote'; data: { itemId: string }; timestamp: number }
  // IDEATE (ADR-0048). Idea submit + dot-vote.
  | { v?: LiveProtocolVersion; type: 'ideate_submit'; data: { body: string }; timestamp: number }
  | { v?: LiveProtocolVersion; type: 'ideate_upvote'; data: { itemId: string }; timestamp: number }
  | { v?: LiveProtocolVersion; type: 'ideate_reveal'; data: Record<string, never>; timestamp: number }
  // ENTERPRISE-POLISH §1c — presenter approves or rejects a pending open response.
  | { v?: LiveProtocolVersion; type: 'approve_response'; data: { questionId: string; responseId: string }; timestamp: number }
  | { v?: LiveProtocolVersion; type: 'reject_response'; data: { questionId: string; responseId: string }; timestamp: number }

// ── Server → Client ─────────────────────────────────────────────────────────
export type LiveQuestion = {
  id: string
  kind: QuestionKind
  prompt: string
  options: PollOption[]
  /**
   * ENTERPRISE-POLISH §1c — response moderation for open questions.
   * When true, open-question responses are buffered in the DO and only
   * broadcast after the presenter approves them.
   */
  moderated?: boolean
}

export type LiveSessionSummary = {
  id: string
  code: string
  title: string
  status: 'live' | 'closed'
  votePolicy: VotePolicy
  sessionMode: SessionMode
  anonymity?: Anonymity
}

export type ServerMessage =
  | {
      v?: LiveProtocolVersion
      type: 'init'
      data: {
        session: LiveSessionSummary
        role: 'presenter' | 'voter'
        voterId: string
        protocolVersion?: LiveProtocolVersion
        features?: string[]
        question: LiveQuestion | null
        questionIndex: number
        questionTotal: number
        results: { counts: Record<string, number>; total: number }
        participants: number
        energizer: LiveEnergizerState | null
        /** Unix ms when the current question auto-advances (fun mode only). */
        expiresAt: number | null
        /** Aggregate mood for open questions (presenter only, AI-SENTIMENT-01). */
        sentiment: { mood: 'positive' | 'neutral' | 'concerning'; sampleSize: number } | null
        /**
         * ENTERPRISE-POLISH s2a: set to true when a presenter reconnects to a
         * session they own. The frontend uses this to auto-route back to the run
         * screen without requiring manual navigation.
         */
        presenterReconnect?: boolean
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
      type: 'session_energizing_complete'
      data: Record<string, never>
      timestamp: number
    }
  | {
      v?: LiveProtocolVersion
      type: 'sentiment_signal'
      data: { mood: 'positive' | 'neutral' | 'concerning'; sampleSize: number }
      timestamp: number
    }
  // TOWNHALL (ADR-0044). Full snapshot only on init/request_state; everything else is a
  // delta carrying the monotonic board revision `rev`. Audience sockets receive only
  // visible items (pre-mod: approved+; post-mod: all-but-dismissed).
  | {
      v?: LiveProtocolVersion
      type: 'townhall_state'
      data: { moderation: TownhallModeration; items: TownhallBoardItem[]; spotlightId: string | null; rev: number }
      timestamp: number
    }
  | {
      v?: LiveProtocolVersion
      type: 'townhall_question_added'
      data: { item: TownhallBoardItem; rev: number }
      timestamp: number
    }
  | {
      v?: LiveProtocolVersion
      type: 'townhall_question_updated'
      data: { item: TownhallBoardItem; rev: number }
      timestamp: number
    }
  | {
      v?: LiveProtocolVersion
      type: 'townhall_question_removed'
      data: { itemId: string; rev: number }
      timestamp: number
    }
  | {
      v?: LiveProtocolVersion
      type: 'townhall_spotlight_changed'
      data: {
        spotlightId: string | null
        rev: number
        /** Full item included so the frontend can render the now-answering card
         *  without a state lookup. Null when spotlight is cleared. */
        item: TownhallBoardItem | null
      }
      timestamp: number
    }
  | {
      v?: LiveProtocolVersion
      type: 'retro_state'
      data: {
        items: Array<{
          id: string
          column: 'went_well' | 'didnt_go_well' | 'actions'
          body: string
          upvotes: number
          createdAt: number
          carried?: boolean
        }>
        rev: number
        dotVoteLimit: number
        columns: Array<'went_well' | 'didnt_go_well' | 'actions'>
        /** Present for voter connections — reconnect sync for dot budget. */
        myUpvotes?: string[]
        dotsUsed?: number
      }
      timestamp: number
    }
  | {
      v?: LiveProtocolVersion
      type: 'retro_item_added'
      data: {
        item: {
          id: string
          column: 'went_well' | 'didnt_go_well' | 'actions'
          body: string
          upvotes: number
          createdAt: number
          carried?: boolean
        }
        rev: number
      }
      timestamp: number
    }
  | {
      v?: LiveProtocolVersion
      type: 'retro_item_updated'
      data: {
        item: {
          id: string
          column: 'went_well' | 'didnt_go_well' | 'actions'
          body: string
          upvotes: number
          createdAt: number
          carried?: boolean
        }
        rev: number
      }
      timestamp: number
    }
  | {
      v?: LiveProtocolVersion
      type: 'ideate_state'
      data: {
        ideas: Array<{
          id: string
          body: string
          upvotes: number
          clusterId: string | null
          status: 'active' | 'dismissed'
          createdAt: number
        }>
        clusters: Array<{ id: string; label: string; ideaIds: string[]; updatedAt: number }>
        rev: number
        dotVoteLimit: number
        rankingRevealed: boolean
        ranking: Array<{ rank: number; ideaId: string; body: string; upvotes: number }>
      }
      timestamp: number
    }
  | {
      v?: LiveProtocolVersion
      type: 'ideate_idea_added'
      data: {
        idea: {
          id: string
          body: string
          upvotes: number
          clusterId: string | null
          status: 'active' | 'dismissed'
          createdAt: number
        }
        rev: number
      }
      timestamp: number
    }
  | {
      v?: LiveProtocolVersion
      type: 'ideate_idea_updated'
      data: {
        idea: {
          id: string
          body: string
          upvotes: number
          clusterId: string | null
          status: 'active' | 'dismissed'
          createdAt: number
        }
        rev: number
      }
      timestamp: number
    }
  | {
      v?: LiveProtocolVersion
      type: 'ideate_clusters_updated'
      data: {
        clusters: Array<{ id: string; label: string; ideaIds: string[]; updatedAt: number }>
        ideas: Array<{
          id: string
          body: string
          upvotes: number
          clusterId: string | null
          status: 'active' | 'dismissed'
          createdAt: number
        }>
        rev: number
      }
      timestamp: number
    }
  | {
      v?: LiveProtocolVersion
      type: 'ideate_ranking_revealed'
      data: {
        ranking: Array<{ rank: number; ideaId: string; body: string; upvotes: number }>
        rev: number
      }
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
