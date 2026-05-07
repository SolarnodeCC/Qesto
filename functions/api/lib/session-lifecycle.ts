/**
 * Explicit HTTP-facing session state transitions (WS4).
 * Routes keep D1 / DO I/O; this module centralizes allowed states + stable error shapes.
 */

import type { ApiFailStatus } from './http'
import type { Session } from '../types'

export type SessionLifecycleError = {
  code: string
  message: string
  status: ApiFailStatus
}

export type LifecycleOk<S extends Session = Session> = { ok: true; session: S }
export type LifecycleErr = { ok: false; error: SessionLifecycleError }

/** Reasons map to stable conflict messages shared with REST handlers. */
export type DraftGateReason =
  | 'patch'
  | 'start'
  | 'reorder'
  | 'generate_questions'
  | 'add_question'
  | 'ai_refine'
  | 'preflight'

const DRAFT_MESSAGES: Record<DraftGateReason, string> = {
  patch: 'Only DRAFT sessions can be edited via REST',
  start: 'Only DRAFT sessions can be started',
  reorder: 'Only DRAFT sessions can be reordered',
  generate_questions: 'Only DRAFT sessions can generate questions',
  add_question: 'Only DRAFT sessions can be edited via REST',
  ai_refine: 'Only DRAFT sessions can be refined',
  preflight: 'Preflight only valid for DRAFT sessions',
}

export function requireFound(session: Session | null): LifecycleOk | LifecycleErr {
  if (!session) {
    return { ok: false, error: { code: 'not_found', message: 'Session not found', status: 404 } }
  }
  return { ok: true, session }
}

export function requireDraft(session: Session, reason: DraftGateReason): LifecycleOk | LifecycleErr {
  if (session.status !== 'draft') {
    return {
      ok: false,
      error: { code: 'conflict', message: DRAFT_MESSAGES[reason], status: 409 },
    }
  }
  return { ok: true, session }
}

export function requireLiveForClose(session: Session): LifecycleOk | LifecycleErr {
  if (session.status !== 'energizing' && session.status !== 'live') {
    return {
      ok: false,
      error: { code: 'conflict', message: 'Only active sessions can be closed', status: 409 },
    }
  }
  return { ok: true, session }
}

/** WebSocket upgrade — session row must be ENERGIZING or LIVE. */
export function requireLiveForWebSocket(session: Session): LifecycleOk | LifecycleErr {
  if (session.status !== 'energizing' && session.status !== 'live') {
    return {
      ok: false,
      error: { code: 'not_live', message: 'Session is not active', status: 409 },
    }
  }
  return { ok: true, session }
}

/** GET /results — draft has nothing to aggregate yet. */
export function rejectDraftForResults(session: Session): LifecycleOk | LifecycleErr {
  if (session.status === 'draft') {
    return {
      ok: false,
      error: { code: 'conflict', message: 'Draft sessions have no results yet', status: 409 },
    }
  }
  return { ok: true, session }
}

/** Themes / closed-session insights aggregates. */
export function requireClosedOrArchivedForInsights(session: Session): LifecycleOk | LifecycleErr {
  if (session.status !== 'closed' && session.status !== 'archived') {
    return {
      ok: false,
      error: {
        code: 'conflict',
        message: 'Insights only available for closed sessions',
        status: 409,
      },
    }
  }
  return { ok: true, session }
}
