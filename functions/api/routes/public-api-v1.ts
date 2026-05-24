/**
 * API-PUBLIC-V1-ROUTES — integrator REST surface (read-only v1).
 */
import { Hono } from 'hono'
import type { Context, Next } from 'hono'
import type { AuthVariables } from '../middleware/auth'
import type { PlanVariables } from '../middleware/plan'
import type { AdminVariables } from '../middleware/admin'
import type { RbacVariables } from '../middleware/rbac'
import { readKvJson } from '../lib/kv'
import {
  ApiKeyRecordSchema,
  apiKeyHashIndexKey,
  apiKeyKvKey,
  hashApiKey,
  type ApiKeyRecord,
} from '../lib/api-keys'
import type { Env } from '../types'

type ApiKeyVars = { apiKey: ApiKeyRecord }

async function apiKeyMiddleware(c: Context<{ Bindings: Env; Variables: ApiKeyVars }>, next: Next) {
  const auth = c.req.header('authorization')
  if (!auth?.startsWith('Bearer ')) {
    return c.json({ ok: false, error: { code: 'unauthenticated', message: 'Bearer API key required' } }, 401)
  }
  const raw = auth.slice(7).trim()
  if (!c.env.INTEGRATIONS_KV) {
    return c.json({ ok: false, error: { code: 'unavailable', message: 'API keys not configured' } }, 503)
  }
  const hash = await hashApiKey(raw)
  const keyId = await c.env.INTEGRATIONS_KV.get(apiKeyHashIndexKey(hash))
  if (!keyId) {
    return c.json({ ok: false, error: { code: 'unauthenticated', message: 'Invalid API key' } }, 401)
  }
  const record = await readKvJson<ApiKeyRecord>(c.env.INTEGRATIONS_KV, apiKeyKvKey(keyId))
  const parsed = record ? ApiKeyRecordSchema.safeParse(record) : null
  if (!parsed?.success) {
    return c.json({ ok: false, error: { code: 'unauthenticated', message: 'Invalid API key' } }, 401)
  }
  c.set('apiKey', parsed.data)
  await next()
}

type PublicApiVars = AuthVariables & PlanVariables & Partial<AdminVariables> & Partial<RbacVariables>

export function mountPublicApiV1Routes(parent: Hono<{ Bindings: Env; Variables: PublicApiVars }>) {
  const app = new Hono<{ Bindings: Env; Variables: ApiKeyVars }>()
  app.use('*', apiKeyMiddleware)

  app.get('/sessions', async (c) => {
    const { teamId } = c.get('apiKey')
    const rows = await c.env.DB.prepare(
      `SELECT id, title, status, code, created_at, closed_at FROM sessions WHERE team_id = ?1 ORDER BY created_at DESC LIMIT 100`,
    )
      .bind(teamId)
      .all()
    return c.json({ ok: true, data: { sessions: rows.results ?? [] } })
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
      data: { session, questions: questions.results ?? [], vote_counts: votes.results ?? [] },
    })
  })

  parent.route('/api/v1', app)
}
