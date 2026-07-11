/** GET /sessions/:sessionId/leaderboard — host-only session leaderboard. */
import { sanitizeError } from '../../lib/error-handler'
import { safeLogContext } from '../../lib/log'
import type { EnergizerApp } from './types'
import type { LeaderboardEntryRow } from '../../lib/db-row-types'
import { requireSessionAccess } from '../sessions/shared'

export function registerEnergizerLeaderboardRoutes(app: EnergizerApp): void {
  app.get('/sessions/:sessionId/leaderboard', async (c) => {
    const trace_id = c.get('trace_id')
    const sessionId = c.req.param('sessionId')
    const user = c.get('user')

    try {
      // SEC (#537): the leaderboard exposes per-user scores — host-only. Verify
      // session ownership before reading cross-tenant leaderboard data.
      const session = await requireSessionAccess(c.env.DB, sessionId, user.sub, { requireOwner: true })
      if (!session) {
        return c.json(
          { ok: false, error: { code: 'not_found', message: 'Session not found or access denied' }, trace_id },
          404,
        )
      }
      const result = await c.env.DB.prepare(
        `SELECT user_id, rank, score FROM leaderboard_entries
         WHERE session_id = ?1 ORDER BY rank ASC LIMIT 100`,
      )
        .bind(sessionId)
        .all<Pick<LeaderboardEntryRow, "user_id"|"rank"|"score">>()

      return c.json(
        { ok: true, data: { entries: result.results ?? [], updated_at: Date.now() }, trace_id },
        200,
      )
    } catch (err) {
      safeLogContext(err, { traceId: trace_id, route: c.req.path, errorClass: err instanceof Error ? err.name : 'UnknownError', statusCode: 500 })
      const { message } = sanitizeError(err, c.env.ENV, 500)
      return c.json({ ok: false, error: { code: 'internal', message }, trace_id }, 500)
    }
  })
}
