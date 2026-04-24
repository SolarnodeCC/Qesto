// Wire format for the SessionRoom WebSocket protocol. The SPEC_REALTIME.md
// taxonomy is the north star; v1 ships the subset below (enough for S1–S5
// acceptance). Extra types get added alongside new client features, never
// ahead of them.
//
// All messages are JSON text frames: { type, data, timestamp } where
// `timestamp` is the sender's epoch-ms clock (for latency tracing only —
// never trusted for ordering).

import type { PollOption, QuestionKind, VotePolicy, SessionMode } from './types'

// ── Client → Server ─────────────────────────────────────────────────────────
export type ClientMessage =
  | { type: 'vote'; data: { questionId: string; optionId: string }; timestamp: number }
  | { type: 'advance'; data: Record<string, never>; timestamp: number }
  | { type: 'back'; data: Record<string, never>; timestamp: number }
  | { type: 'request_state'; data: Record<string, never>; timestamp: number }
  | { type: 'pause'; data: Record<string, never>; timestamp: number }
  | { type: 'resume'; data: Record<string, never>; timestamp: number }

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
      type: 'init'
      data: {
        session: LiveSessionSummary
        role: 'presenter' | 'voter'
        voterId: string
        question: LiveQuestion | null
        results: { counts: Record<string, number>; total: number }
        participants: number
        /** Unix ms when the current question auto-advances (fun mode only). */
        expiresAt: number | null
      }
      timestamp: number
    }
  | {
      type: 'question'
      data: { question: LiveQuestion }
      timestamp: number
    }
  | {
      type: 'results'
      data: { counts: Record<string, number>; total: number }
      timestamp: number
    }
  | {
      type: 'participants'
      data: { count: number }
      timestamp: number
    }
  | {
      type: 'session_closed'
      data: { counts: Record<string, number>; total: number }
      timestamp: number
    }
  | {
      type: 'question_timeout'
      data: { questionId: string }
      timestamp: number
    }
  | {
      type: 'session_paused'
      data: Record<string, never>
      timestamp: number
    }
  | {
      type: 'session_resumed'
      data: Record<string, never>
      timestamp: number
    }
  | {
      type: 'all_done'
      data: Record<string, never>
      timestamp: number
    }
  | {
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
