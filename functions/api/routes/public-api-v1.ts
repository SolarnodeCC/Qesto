/**
 * API-PUBLIC-V1-ROUTES — integrator REST surface (read-only v1).
 */
import { Hono } from 'hono'
import { errorResponse } from '../lib/error-handler'
import { parsePageQuery } from '../lib/pagination'
import type { AuthVariables } from '../middleware/auth'
import type { PlanVariables } from '../middleware/plan'
import type { AdminVariables } from '../middleware/admin'
import type { RbacVariables } from '../middleware/rbac'
import { publicApiKeyMiddleware, type ApiKeyVars } from '../middleware/public-api-auth'
import {
  listSessionsForTeamPage,
  fetchSessionForTeam,
  fetchSessionResultsData,
} from '../repositories/sessionRepository'
import { deprecationHeaders } from '../lib/deprecation'
import type { Env } from '../types'

type PublicApiVars = AuthVariables & PlanVariables & Partial<AdminVariables> & Partial<RbacVariables>

export function mountPublicApiV1Routes(parent: Hono<{ Bindings: Env; Variables: PublicApiVars }>) {
  const app = new Hono<{ Bindings: Env; Variables: ApiKeyVars }>()
  // v1 is deprecated in favour of v3. Signal retirement to integrators.
  app.use('*', deprecationHeaders({ sunset: 'Thu, 31 Dec 2026 23:59:59 GMT', successor: '/api/v3' }))
  app.use('*', publicApiKeyMiddleware)

  app.get('/sessions', async (c) => {
    // DD-14: keyset pages. Default 100 keeps the pre-pagination response size
    // for integrators that never send a cursor; nextCursor fetches the rest.
    const q = parsePageQuery(c.req.query(), 100)
    if (!q.ok) return c.json({ ok: false, error: { code: 'bad_request', message: q.error } }, 400)
    const { items, nextCursor } = await listSessionsForTeamPage(c.env.DB, c.get('apiKey').teamId, q.page)
    return c.json({ ok: true, data: { sessions: items, nextCursor } })
  })

  app.get('/sessions/:id/results', async (c) => {
    const { teamId } = c.get('apiKey')
    const sessionId = c.req.param('id')
    const session = await fetchSessionForTeam(c.env.DB, sessionId, teamId)
    if (!session) {
      return errorResponse(c, 404, 'not_found', 'Session not found')
    }
    const { questions, voteCounts } = await fetchSessionResultsData(c.env.DB, sessionId)
    return c.json({
      ok: true,
      data: { session, questions, vote_counts: voteCounts },
    })
  })

  parent.route('/api/v1', app)
}
