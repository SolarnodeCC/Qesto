/**
 * Frontend session contracts aligned with `functions/api/types.ts` (@api/types).
 * Import from here instead of re-declaring poll/session shapes on pages (WS5 / F-06).
 */

import type { Question, QuestionKind, Session, SessionStatus } from '@api/types'

export type {
  Anonymity,
  PollOption,
  Question,
  QuestionKind,
  Session,
  SessionMode,
  SessionStatus,
  VotePolicy,
} from '@api/types'

/** Session list row / detail header (narrow pick from `Session`). */
export type SessionSummary = Pick<
  Session,
  'id' | 'owner_id' | 'code' | 'title' | 'status' | 'created_at' | 'started_at' | 'closed_at'
>

/** Standard shape returned by `GET/POST/PATCH /api/sessions/:id`. */
export type SessionDetail = {
  session: SessionSummary
  questions: Question[]
}

/** Public join lookup (`GET /api/sessions/by-code/:code`) before session goes live. */
export type SessionLookupByCode = Pick<Session, 'id' | 'title' | 'code'> & {
  status: Extract<SessionStatus, 'draft' | 'live'>
}

/**
 * Question kinds shown in SessionWizard UI.
 * Backend also supports `consent`; the wizard uses separate UX for ballots.
 */
export type WizardQuestionKind = Exclude<QuestionKind, 'consent'>
