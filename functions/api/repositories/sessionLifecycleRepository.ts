/**
 * Session lifecycle repository (ADR-0069).
 *
 * All D1 access for the session start/close/transition flow lives here as pure
 * functions taking a `D1Database` + params — no Hono context, no Env. This keeps
 * the route handlers (routes/sessions/lifecycle.ts) thin and makes the queries
 * unit-testable in isolation.
 */
import { ulid } from '../lib/ulid'
import type { Session } from '../types'

/** Count energizers still in `draft` for a session (drives energizing vs live start). */
export async function countDraftEnergizers(db: D1Database, sessionId: string): Promise<number> {
  const row = await db
    .prepare(`SELECT COUNT(*) as n FROM energizers WHERE session_id = ?1 AND state = 'draft'`)
    .bind(sessionId)
    .first<{ n: number }>()
  return row?.n ?? 0
}

/**
 * Conditional draft → (energizing|live) transition. Returns the number of rows
 * changed; `0` means a concurrent request already won the write.
 */
export async function startSessionTransition(
  db: D1Database,
  id: string,
  ownerId: string,
  status: 'energizing' | 'live',
  startedAt: number,
): Promise<number> {
  const result = await db
    .prepare(
      `UPDATE sessions SET status = ?1, started_at = ?2
       WHERE id = ?3 AND owner_id = ?4 AND status = 'draft'`,
    )
    .bind(status, startedAt, id, ownerId)
    .run()
  return result.meta.changes ?? 0
}

/** Roll the start transition back to draft (best-effort, used on DO init failure). */
export async function rollbackSessionStart(
  db: D1Database,
  id: string,
  ownerId: string,
  status: Session['status'],
  startedAt: number,
): Promise<void> {
  await db
    .prepare(
      `UPDATE sessions SET status = 'draft', started_at = NULL
       WHERE id = ?1 AND owner_id = ?2 AND status = ?3 AND started_at = ?4`,
    )
    .bind(id, ownerId, status, startedAt)
    .run()
}

/** Count the owner's non-draft sessions (OBS-003 first-session detection). */
export async function countNonDraftSessions(db: D1Database, ownerId: string): Promise<number> {
  const row = await db
    .prepare(`SELECT COUNT(*) as n FROM sessions WHERE owner_id = ?1 AND status != 'draft'`)
    .bind(ownerId)
    .first<{ n: number }>()
  return row?.n ?? 0
}

/**
 * Persist per-voter rows on close. `INSERT OR IGNORE` + UNIQUE(question_id, voter_id)
 * guards against replay.
 */
export async function insertCloseVotes(
  db: D1Database,
  sessionId: string,
  questionId: string,
  votes: Array<{ voterId: string; optionId: string }>,
  submittedAt: number,
): Promise<void> {
  if (votes.length === 0) return
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO votes (id, session_id, question_id, voter_id, option_id, submitted_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
  )
  const batch = votes.map((v) => stmt.bind(ulid(), sessionId, questionId, v.voterId, v.optionId, submittedAt))
  await db.batch(batch)
}

/** Mark a session closed. */
export async function markSessionClosed(
  db: D1Database,
  id: string,
  ownerId: string,
  closedAt: number,
): Promise<void> {
  await db
    .prepare(`UPDATE sessions SET status = 'closed', closed_at = ?1 WHERE id = ?2 AND owner_id = ?3`)
    .bind(closedAt, id, ownerId)
    .run()
}

/** Count a session's questions (marketing webhook payload). */
export async function countSessionQuestions(db: D1Database, sessionId: string): Promise<number> {
  const row = await db
    .prepare('SELECT COUNT(*) as cnt FROM questions WHERE session_id = ?')
    .bind(sessionId)
    .first<{ cnt: number }>()
  return row?.cnt ?? 0
}

/**
 * Conditional energizing → live transition. Returns rows changed; `0` means the
 * session was not in `energizing` (concurrent transition or wrong state).
 */
export async function transitionEnergizingToLive(
  db: D1Database,
  id: string,
  ownerId: string,
): Promise<number> {
  const result = await db
    .prepare(`UPDATE sessions SET status = 'live' WHERE id = ?1 AND owner_id = ?2 AND status = 'energizing'`)
    .bind(id, ownerId)
    .run()
  return result.meta.changes ?? 0
}
