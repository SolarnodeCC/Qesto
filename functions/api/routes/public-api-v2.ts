/**
 * API-V2-ROUTES-REALTIME — integrator realtime contract (Sprint 48).
 */
import { Hono } from 'hono'
import type { AuthVariables } from '../middleware/auth'
import type { PlanVariables } from '../middleware/plan'
import type { AdminVariables } from '../middleware/admin'
import type { RbacVariables } from '../middleware/rbac'
import { publicApiKeyMiddleware, type ApiKeyVars } from '../middleware/public-api-auth'
import { fetchSessionForTeam } from '../repositories/sessionRepository'
import type { Env } from '../types'

type PublicApiV2Vars = AuthVariables & PlanVariables & Partial<AdminVariables> & Partial<RbacVariables>

export function mountPublicApiV2Routes(parent: Hono<{ Bindings: Env; Variables: PublicApiV2Vars }>) {
  const app = new Hono<{ Bindings: Env; Variables: ApiKeyVars }>()
  app.use('*', publicApiKeyMiddleware)

  app.get('/sessions/:id/realtime', async (c) => {
    const { teamId } = c.get('apiKey')
    const sessionId = c.req.param('id')
    const session = await fetchSessionForTeam(c.env.DB, sessionId, teamId)
    if (!session) {
      return c.json({ ok: false, error: { code: 'not_found', message: 'Session not found' } }, 404)
    }
    if (session.status !== 'live' && session.status !== 'energizing') {
      return c.json({ ok: false, error: { code: 'session_not_live', message: 'Session is not live' } }, 409)
    }
    const base = (c.env.API_URL ?? c.env.PAGES_URL ?? '').replace(/\/$/, '')
    const wsBase = base.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:')
    return c.json({
      ok: true,
      data: {
        protocolVersion: 1,
        websocketUrl: `${wsBase}/api/sessions/${encodeURIComponent(sessionId)}/ws`,
        events: ['init', 'question', 'results', 'participants', 'session_closed'],
        note: 'Connect with standard browser WebSocket; voter fingerprint via ?fp= query param.',
      },
    })
  })

  parent.route('/api/v2', app)
}
