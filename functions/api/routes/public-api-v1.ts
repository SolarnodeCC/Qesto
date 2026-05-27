/**
 * API-PUBLIC-V1-ROUTES — integrator REST surface (read-only v1).
 */
import { Hono } from 'hono'
import type { AuthVariables } from '../middleware/auth'
import type { PlanVariables } from '../middleware/plan'
import type { AdminVariables } from '../middleware/admin'
import type { RbacVariables } from '../middleware/rbac'
import { publicApiKeyMiddleware, type ApiKeyVars } from '../middleware/public-api-auth'
import { listSessionsForTeam, fetchSessionForTeam } from '../repositories/sessionRepository'
import { writeEvent } from '../lib/observability'
import type { Env } from '../types'

type PublicApiVars = AuthVariables & PlanVariables & Partial<AdminVariables> & Partial<RbacVariables>

export function mountPublicApiV1Routes(parent: Hono<{ Bindings: Env; Variables: PublicApiVars }>) {
  const app = new Hono<{ Bindings: Env; Variables: ApiKeyVars }>()
  app.use('*', publicApiKeyMiddleware)
  app.use('*', async (c, next) => {
    c.header('Deprecation', 'true')
    c.header('Sunset', '2027-12-31')
    c.header('Link', '</api/v3/openapi.json>; rel="successor-version"')
    writeEvent(c.env.METRICS_AE, { name: 'platform.v1_deprecated_call', detail: c.req.path })
    await next()
  })

  app.get('/sessions', async (c) => {
    const sessions = await listSessionsForTeam(c.env.DB, c.get('apiKey').teamId)
    return c.json({ ok: true, data: { sessions } })
  })

  app.get('/sessions/:id/results', async (c) => {
    const { teamId } = c.get('apiKey')
    const sessionId = c.req.param('id')
    const session = await fetchSessionForTeam(c.env.DB, sessionId, teamId)
    if (!session) {
      return c.json({ ok: false, error: { code: 'not_found', message: 'Session not found' } }, 404)
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
