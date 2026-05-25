/**
 * API-V2-ROUTES-REALTIME — integrator realtime contract (Sprint 48).
 * Returns WebSocket upgrade URL; connection uses existing SessionRoom protocol.
 */
import { Hono } from 'hono'
import type { AuthVariables } from '../middleware/auth'
import type { PlanVariables } from '../middleware/plan'
import type { AdminVariables } from '../middleware/admin'
import type { RbacVariables } from '../middleware/rbac'
import { publicApiKeyMiddleware, type ApiKeyVars } from '../middleware/public-api-auth'
import { fetchSessionForTeam } from '../repositories/sessionRepository'
import { ulid } from '../lib/ulid'
import { generateJoinCode } from '../lib/code'
import type { Env } from '../types'

type PublicApiV2Vars = AuthVariables & PlanVariables & Partial<AdminVariables> & Partial<RbacVariables>

export function mountPublicApiV2Routes(parent: Hono<{ Bindings: Env; Variables: PublicApiV2Vars }>) {
  const app = new Hono<{ Bindings: Env; Variables: ApiKeyVars }>()
  app.use('*', publicApiKeyMiddleware)

  app.post('/sessions', async (c) => {
    const { teamId, createdBy } = c.get('apiKey')
    const body = (await c.req.json().catch(() => ({}))) as { title?: string }
    const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim().slice(0, 200) : 'API session'
    const id = ulid()
    const code = generateJoinCode()
    const now = Date.now()
    await c.env.DB.prepare(
      `INSERT INTO sessions (id, owner_id, code, title, status, anonymity, vote_policy, session_mode, created_at, team_id)
       VALUES (?1, ?2, ?3, ?4, 'draft', 'full', 'once', 'reflection', ?5, ?6)`,
    )
      .bind(id, createdBy, code, title, now, teamId)
      .run()
    return c.json(
      {
        ok: true,
        data: { id, code, title, status: 'draft', teamId, createdAt: now },
      },
      201,
    )
  })

  app.get('/sessions/:id/results', async (c) => {
    const { teamId } = c.get('apiKey')
    const sessionId = c.req.param('id')
    const session = await c.env.DB.prepare(`SELECT id, team_id, title, status FROM sessions WHERE id = ?1`)
      .bind(sessionId)
      .first<{ id: string; team_id: string | null; title: string; status: string }>()
    if (!session || session.team_id !== teamId) {
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
      data: { session, questions: questions.results ?? [], votes: votes.results ?? [] },
    })
  })

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
