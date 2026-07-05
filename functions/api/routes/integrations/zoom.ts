// ZOOM-01 — OAuth skeleton (full flow when ZOOM_CLIENT_ID + ZOOM_CLIENT_SECRET configured).
//
// Endpoints (all under /api/integrations/zoom):
//   GET /connect   — redirect to Zoom OAuth (auth required)
//   GET /status    — returns { connected, connectedAt? } (auth required)
//   GET /callback  — exchange code, persist token

import type { Hono } from 'hono'
import { authMiddleware } from '../../middleware/auth'
import { createEncryptedTokenStore } from '../../lib/integrations/token-store'
import { getZoomProvider } from '../../lib/integrations/providers/zoom'
import { readKvJson, writeKvJson } from '../../lib/kv'
import { writeEvent } from '../../lib/observability'
import { INTEGRATION_TOKEN_TTL_SECONDS } from '../../lib/constants'
import type { Env } from '../../types'
import {
  type ZoomIntegrationConfig,
  type Vars,
  STATE_TTL_SECONDS,
  zoomConfigKey,
  signState,
  verifyState,
  integrationsDisabled,
  resolvePrimaryTeamId,
} from './shared'

export function mountZoomRoutes(app: Hono<{ Bindings: Env; Variables: Vars }>) {
  app.get('/zoom/connect', authMiddleware, async (c) => {
    const provider = getZoomProvider(c.env)
    if (!provider) {
      return c.json(
        {
          ok: false,
          error: { code: 'zoom_not_configured', message: 'Zoom OAuth credentials are not configured' },
          trace_id: c.get('trace_id'),
        },
        503,
      )
    }
    const user = c.get('user')
    const teamId = c.req.query('teamId') ?? (await resolvePrimaryTeamId(c.env, user.sub))
    if (!teamId) {
      return c.json(
        { ok: false, error: { code: 'team_required', message: 'teamId required' }, trace_id: c.get('trace_id') },
        400,
      )
    }
    const exp = Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS
    const state = await signState({ teamId, userId: user.sub, exp }, c.env.JWT_SECRET)
    return c.redirect(provider.getAuthUrl(state, ''), 302)
  })

  app.get('/zoom/status', authMiddleware, async (c) => {
    const user = c.get('user')
    const teamId = c.req.query('teamId') ?? (await resolvePrimaryTeamId(c.env, user.sub))
    if (!teamId || !c.env.INTEGRATIONS_KV) {
      return c.json({ ok: true, data: { connected: false }, trace_id: c.get('trace_id') })
    }
    const store = createEncryptedTokenStore(c.env.INTEGRATIONS_KV, c.env)
    const token = await store.getToken(teamId, 'zoom')
    const config = await readKvJson<ZoomIntegrationConfig>(c.env.INTEGRATIONS_KV, zoomConfigKey(teamId))
    return c.json({
      ok: true,
      data: { connected: token !== null, ...(config ? { connectedAt: config.connectedAt } : {}) },
      trace_id: c.get('trace_id'),
    })
  })

  app.get('/zoom/callback', async (c) => {
    if (integrationsDisabled(c.env)) {
      return c.redirect(`${c.env.PAGES_URL}/integrations?error=integrations_disabled`, 302)
    }
    const provider = getZoomProvider(c.env)
    if (!provider) {
      return c.redirect(`${c.env.PAGES_URL}/integrations?error=zoom_not_configured`, 302)
    }
    const code = c.req.query('code')
    const state = c.req.query('state')
    const oauthErr = c.req.query('error')
    if (oauthErr) {
      return c.redirect(`${c.env.PAGES_URL}/integrations?error=${encodeURIComponent(oauthErr)}`, 302)
    }
    if (!code || !state) {
      return c.redirect(`${c.env.PAGES_URL}/integrations?error=invalid_callback`, 302)
    }
    const verified = await verifyState(state, c.env.JWT_SECRET)
    if (!verified) {
      return c.redirect(`${c.env.PAGES_URL}/integrations?error=invalid_state`, 302)
    }
    try {
      const token = await provider.exchangeCode(code, '')
      const store = createEncryptedTokenStore(c.env.INTEGRATIONS_KV!, c.env)
      await store.storeToken(verified.teamId, 'zoom', token)
      const config: ZoomIntegrationConfig = {
        connectedAt: Date.now(),
        connectedBy: verified.userId,
        notifyOnClose: true,
      }
      await writeKvJson(c.env.INTEGRATIONS_KV!, zoomConfigKey(verified.teamId), config, {
        expirationTtl: INTEGRATION_TOKEN_TTL_SECONDS,
      })
      writeEvent(c.env.METRICS_AE, {
        name: 'integration.connected',
        userId: verified.userId,
        teamId: verified.teamId,
        detail: 'zoom',
      })
      return c.redirect(`${c.env.PAGES_URL}/teams/${verified.teamId}/settings?connected=zoom`, 302)
    } catch (err) {
      console.error(JSON.stringify({ event: 'zoom.callback.error', error: String(err) }))
      return c.redirect(`${c.env.PAGES_URL}/integrations?error=zoom_oauth_failed`, 302)
    }
  })
}
