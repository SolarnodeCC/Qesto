/**
 * API-V2-ROUTES-REALTIME — integrator realtime contract (Sprint 48).
 */
import { Hono } from 'hono'
import type { AuthVariables } from '../middleware/auth'
import type { PlanVariables } from '../middleware/plan'
import type { AdminVariables } from '../middleware/admin'
import type { RbacVariables } from '../middleware/rbac'
import { publicApiKeyMiddleware, type ApiKeyVars } from '../middleware/public-api-auth'
import {
  fetchSessionForTeam,
  fetchSessionRowBasic,
  fetchSessionResultsData,
  createDraftSessionForTeam,
} from '../repositories/sessionRepository'
import { errorResponse } from '../lib/error-handler'
import { ulid } from '../lib/ulid'
import { generateJoinCode } from '../lib/code'
import { deprecationHeaders } from '../lib/deprecation'
import type { Env } from '../types'

type PublicApiV2Vars = AuthVariables & PlanVariables & Partial<AdminVariables> & Partial<RbacVariables>

export function mountPublicApiV2Routes(parent: Hono<{ Bindings: Env; Variables: PublicApiV2Vars }>) {
  const app = new Hono<{ Bindings: Env; Variables: ApiKeyVars }>()
  // v2 is deprecated in favour of v3, with a longer runway than v1.
  app.use('*', deprecationHeaders({ sunset: 'Wed, 30 Jun 2027 23:59:59 GMT', successor: '/api/v3' }))
  app.use('*', publicApiKeyMiddleware)

  app.post('/sessions', async (c) => {
    const { teamId, createdBy } = c.get('apiKey')
    const body = (await c.req.json().catch(() => ({}))) as { title?: string }
    const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim().slice(0, 200) : 'API session'
    const id = ulid()
    const code = generateJoinCode()
    const { createdAt } = await createDraftSessionForTeam(c.env.DB, {
      id,
      teamId,
      ownerId: createdBy,
      title,
      code,
    })
    return c.json(
      {
        ok: true,
        data: { id, code, title, status: 'draft', teamId, createdAt },
      },
      201,
    )
  })

  app.get('/sessions/:id/results', async (c) => {
    const { teamId } = c.get('apiKey')
    const sessionId = c.req.param('id')
    const session = await fetchSessionRowBasic(c.env.DB, sessionId)
    if (!session || session.team_id !== teamId) {
      return errorResponse(c, 404, 'not_found', 'Session not found')
    }
    const { questions, voteCounts } = await fetchSessionResultsData(c.env.DB, sessionId)
    // v2 contract: the field is named `votes` (v1/v3 call it `vote_counts`).
    // Kept as-is — renaming would break existing v2 integrators.
    return c.json({
      ok: true,
      data: { session, questions, votes: voteCounts },
    })
  })

  app.get('/sessions/:id/realtime', async (c) => {
    const { teamId } = c.get('apiKey')
    const sessionId = c.req.param('id')
    const session = await fetchSessionForTeam(c.env.DB, sessionId, teamId)
    if (!session) {
      return errorResponse(c, 404, 'not_found', 'Session not found')
    }
    if (session.status !== 'live' && session.status !== 'energizing') {
      return errorResponse(c, 409, 'session_not_live', 'Session is not live')
    }
    const base = (c.env.API_URL ?? c.env.PAGES_URL ?? '').replace(/\/$/, '')
    const wsBase = base.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:')
    return c.json({
      ok: true,
      data: {
        protocolVersion: c.env.REALTIME_V2_DEFAULT === 'true' ? 2 : 1,
        supportedVersions: [1, 2],
        websocketUrl: `${wsBase}/api/sessions/${encodeURIComponent(sessionId)}/ws`,
        events: ['init', 'question', 'results', 'participants', 'session_closed'],
        note: 'Connect with standard browser WebSocket; voter fingerprint via ?fp= query param.',
      },
    })
  })

  parent.route('/api/v2', app)
}
