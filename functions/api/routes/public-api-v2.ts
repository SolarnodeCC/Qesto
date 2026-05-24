/**
 * API-V2-ROUTES-REALTIME — integrator realtime contract (Sprint 48).
 * Returns WebSocket upgrade URL; connection uses existing SessionRoom protocol.
 */
import { Hono } from 'hono'
import type { Context, Next } from 'hono'
import {
  ApiKeyRecordSchema,
  apiKeyHashIndexKey,
  apiKeyKvKey,
  hashApiKey,
  type ApiKeyRecord,
} from '../lib/api-keys'
import { readKvJson } from '../lib/kv'
import type { Env } from '../types'

type ApiKeyVars = { apiKey: ApiKeyRecord }

async function apiKeyMiddleware(c: Context<{ Bindings: Env; Variables: ApiKeyVars }>, next: Next) {
  const auth = c.req.header('authorization')
  if (!auth?.startsWith('Bearer ')) {
    return c.json({ ok: false, error: { code: 'unauthenticated', message: 'Bearer API key required' } }, 401)
  }
  if (!c.env.INTEGRATIONS_KV) {
    return c.json({ ok: false, error: { code: 'unavailable', message: 'API keys not configured' } }, 503)
  }
  const hash = await hashApiKey(auth.slice(7).trim())
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

export function mountPublicApiV2Routes(parent: Hono<{ Bindings: Env }>) {
  const app = new Hono<{ Bindings: Env; Variables: ApiKeyVars }>()
  app.use('*', apiKeyMiddleware)

  app.get('/sessions/:id/realtime', async (c) => {
    const { teamId } = c.get('apiKey')
    const sessionId = c.req.param('id')
    const session = await c.env.DB.prepare(`SELECT id, team_id, status FROM sessions WHERE id = ?1`)
      .bind(sessionId)
      .first<{ id: string; team_id: string | null; status: string }>()
    if (!session || session.team_id !== teamId) {
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
