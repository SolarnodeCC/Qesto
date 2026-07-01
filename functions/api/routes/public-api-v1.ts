/**
 * API-PUBLIC-V1-ROUTES — integrator REST surface (read-only v1).
 */
import { Hono } from 'hono'
import { errorResponse } from '../lib/error-handler'
import type { AuthVariables } from '../middleware/auth'
import type { PlanVariables } from '../middleware/plan'
import type { AdminVariables } from '../middleware/admin'
import type { RbacVariables } from '../middleware/rbac'
import { publicApiKeyMiddleware, type ApiKeyVars } from '../middleware/public-api-auth'
import { listSessionsForTeam, fetchSessionForTeam } from '../repositories/sessionRepository'
import { deprecationHeaders } from '../lib/deprecation'
import type { Env } from '../types'

type PublicApiVars = AuthVariables & PlanVariables & Partial<AdminVariables> & Partial<RbacVariables>

export function mountPublicApiV1Routes(parent: Hono<{ Bindings: Env; Variables: PublicApiVars }>) {
  const app = new Hono<{ Bindings: Env; Variables: ApiKeyVars }>()
  // v1 is deprecated in favour of v3. Signal retirement to integrators.
  app.use('*', deprecationHeaders({ sunset: 'Thu, 31 Dec 2026 23:59:59 GMT', successor: '/api/v3' }))
  app.use('*', publicApiKeyMiddleware)

  app.get('/sessions', async (c) => {
    const sessions = await listSessionsForTeam(c.env.DB, c.get('apiKey').teamId)
    return c.json({ ok: true, data: { sessions } })
  })

  app.get('/sessions/:id/results', async (c) => {
    const { teamId } = c.get('apiKey')
    const sessionId = c.req.param('id')
    const session = await fetchSessionForTeam(c.env.DB, sessionId, teamId)
    if (!session) {
      return errorResponse(c, 404, 'not_found', 'Session not found')
    }
    const questions = await c.env.DB.prepare(
      `SELECT id, kind, prompt FROM questions WHERE session_id = ?1 ORDER BY position`,
    )
      .bind(sessionId)
      .all()
    const votes = await c.env.DB.prepare(
      `SELECT question_id, option_id, COUNT(*) as count FROM votes WHERE session_id = ?1 GROUP BY question_id, option_id`,
    )
      .bind(sessionId)
      .all()
    return c.json({
      ok: true,
      data: { session, questions: questions.results ?? [], vote_counts: votes.results ?? [] },
    })
  })

  parent.route('/api/v1', app)
}
