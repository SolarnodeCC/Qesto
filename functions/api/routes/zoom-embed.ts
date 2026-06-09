/**
 * ZOOM-EMBED-01 / ZOOM-SYNC-01 — in-meeting embed config (S72).
 */
import { Hono } from 'hono'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import { readKvJson } from '../lib/kv'
import { zoomConfigKey, type ZoomIntegrationConfig } from './integrations'
import { createEncryptedTokenStore } from '../lib/integrations/token-store'
import type { Env } from '../types'
import type { ParentApp } from './parent-app'

export function mountZoomEmbedRoutes(parent: ParentApp) {
  const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>()
  app.use('*', authMiddleware)

  app.get('/sessions/:sessionId/embed', async (c) => {
    const sessionId = c.req.param('sessionId')
    const row = await c.env.DB.prepare(`SELECT id, owner_id, title, code FROM sessions WHERE id = ?1`)
      .bind(sessionId)
      .first<{ id: string; owner_id: string; title: string; code: string }>()
    if (!row) {
      return c.json(
        { ok: false, error: { code: 'not_found', message: 'Session not found' }, trace_id: c.get('trace_id') },
        404,
      )
    }
    if (row.owner_id !== c.get('user').sub) {
      return c.json(
        { ok: false, error: { code: 'forbidden', message: 'Not session owner' }, trace_id: c.get('trace_id') },
        403,
      )
    }

    const teamId = c.req.query('teamId')
    let zoomConnected = false
    let syncState: 'disconnected' | 'connected' | 'syncing' = 'disconnected'
    if (teamId && c.env.INTEGRATIONS_KV) {
      const store = createEncryptedTokenStore(c.env.INTEGRATIONS_KV, c.env)
      zoomConnected = (await store.getToken(teamId, 'zoom')) !== null
      const config = await readKvJson<ZoomIntegrationConfig>(c.env.INTEGRATIONS_KV, zoomConfigKey(teamId))
      syncState = zoomConnected ? (config?.notifyOnClose ? 'connected' : 'syncing') : 'disconnected'
    }

    const pagesUrl = c.env.PAGES_URL?.replace(/\/$/, '') ?? ''
    return c.json({
      ok: true,
      data: {
        sessionId,
        sessionCode: row.code,
        title: row.title,
        zoomConnected,
        syncState,
        embedUrl: zoomConnected
          ? `${pagesUrl}/sessions/${sessionId}/zoom-embed?code=${encodeURIComponent(row.code)}`
          : null,
        oauthPath: teamId ? `/api/integrations/zoom/connect?teamId=${encodeURIComponent(teamId)}` : null,
      },
      trace_id: c.get('trace_id'),
    })
  })

  parent.route('/api/integrations/zoom', app)
}
