/**
 * Auto-close sessions left LIVE / ENERGIZING long after anyone used them.
 *
 * Production had sessions stuck `live` for weeks: a host closes the tab
 * without pressing Close, or a close failed half-way. A stuck session keeps
 * its DO state, its voter salt (DD-03: the salt is only destroyed at close)
 * and counts against nothing useful. Runs hourly from the qesto-api cron.
 *
 * Uses the same path as POST /close: the DO close is idempotent (replays its
 * payload if it was already closed), then the votes + status flip are written
 * by closeSessionWithVotes in one final batch.
 */
import type { Env } from '../types'
import { closeSessionWithVotes, type CloseVoteRow } from '../repositories/sessionLifecycleRepository'
import { logEvent, safeLogContext } from './log'

/** Sessions started longer ago than this are considered abandoned. */
export const STALE_SESSION_AGE_MS = 24 * 60 * 60 * 1000
/** Bound the work per cron tick. */
export const STALE_SESSION_BATCH = 50

type StaleRow = { id: string; owner_id: string }

export async function closeStaleSessions(env: Env, nowMs = Date.now()): Promise<{ scanned: number; closed: number; failed: number }> {
  const cutoff = nowMs - STALE_SESSION_AGE_MS
  const { results } = await env.DB.prepare(
    `SELECT id, owner_id FROM sessions
      WHERE status IN ('live','energizing') AND COALESCE(started_at, created_at) < ?1
      ORDER BY started_at ASC LIMIT ?2`,
  )
    .bind(cutoff, STALE_SESSION_BATCH)
    .all<StaleRow>()

  let closed = 0
  let failed = 0
  for (const row of results ?? []) {
    try {
      let votes: CloseVoteRow[] = []
      let questionId: string | null = null
      if (typeof env.SESSION_ROOM?.idFromName === 'function') {
        const stub = env.SESSION_ROOM.get(env.SESSION_ROOM.idFromName(row.id))
        const res = await stub.fetch('https://do.internal/close', { method: 'POST' })
        if (res.ok) {
          const body = (await res.json().catch(() => null)) as { ok?: boolean; data?: { votes?: CloseVoteRow[]; questionId?: string | null } } | null
          votes = body?.data?.votes ?? []
          questionId = body?.data?.questionId ?? null
        }
        // A DO that was never initialised (409/404) has nothing to persist —
        // still close the D1 row so the session stops showing as live.
      }
      await closeSessionWithVotes(env.DB, { sessionId: row.id, ownerId: row.owner_id, closedAt: nowMs, questionId, votes })
      closed++
      logEvent({ event: 'session.stale_auto_closed', sessionId: row.id, votes: votes.length }, 'warn')
    } catch (err) {
      failed++
      safeLogContext(err, { traceId: 'stale-session-sweep', route: 'cron.stale-session-sweep', errorClass: err instanceof Error ? err.name : 'StaleCloseError', sessionId: row.id, statusCode: 500 })
    }
  }
  return { scanned: results?.length ?? 0, closed, failed }
}
