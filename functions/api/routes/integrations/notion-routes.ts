// NOTION-01 — OAuth routes (skeleton status until full flow ships).
//
// Endpoints (all under /api/integrations/notion):
//   GET    /status               — connection status (auth required)
//   GET    /connect              — redirect to Notion OAuth (auth required)
//   GET    /callback             — exchange code, persist token

import { Hono } from 'hono'
import { authMiddleware } from '../../middleware/auth'
import { createEncryptedTokenStore } from '../../lib/integrations/token-store'
import { getNotionProvider } from '../../lib/integrations/providers/notion'
import { writeKvJson } from '../../lib/kv'
import { INTEGRATION_TOKEN_TTL_SECONDS } from '../../lib/constants'
import type { Env } from '../../types'
import {
  type Vars,
  STATE_TTL_SECONDS,
  signState,
  verifyState,
  integrationsDisabled,
  resolvePrimaryTeamId,
} from './shared'

export function mountNotionRoutes(app: Hono<{ Bindings: Env; Variables: Vars }>) {
  app.get('/notion/status', authMiddleware, async (c) => {
    return c.json({ ok: true, data: { connected: false, phase: 'skeleton' }, trace_id: c.get('trace_id') })
  })

  app.get('/notion/connect', authMiddleware, async (c) => {
    const provider = getNotionProvider(c.env)
    if (!provider) {
      return c.json(
        { ok: false, error: { code: 'notion_not_configured', message: 'Notion OAuth not configured' }, trace_id: c.get('trace_id') },
        503,
      )
    }
    const user = c.get('user')
    const teamId = c.req.query('teamId') ?? (await resolvePrimaryTeamId(c.env, user.sub))
    if (!teamId) {
      return c.json({ ok: false, error: { code: 'team_required', message: 'teamId required' }, trace_id: c.get('trace_id') }, 400)
    }
    const exp = Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS
    const state = await signState({ teamId, userId: user.sub, exp }, c.env.JWT_SECRET)
    return c.redirect(provider.getAuthUrl(state, ''), 302)
  })

  app.get('/notion/callback', async (c) => {
    if (integrationsDisabled(c.env)) {
      return c.redirect(`${c.env.PAGES_URL}/integrations?error=integrations_disabled`, 302)
    }
    const provider = getNotionProvider(c.env)
    if (!provider) {
      return c.redirect(`${c.env.PAGES_URL}/integrations?error=notion_not_configured`, 302)
    }
    const code = c.req.query('code')
    const state = c.req.query('state')
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
      await store.storeToken(verified.teamId, 'notion', token)
      await writeKvJson(
        c.env.INTEGRATIONS_KV!,
        `integration:config:${verified.teamId}:notion`,
        { connectedAt: Date.now(), connectedBy: verified.userId },
        { expirationTtl: INTEGRATION_TOKEN_TTL_SECONDS },
      )
      return c.redirect(`${c.env.PAGES_URL}/teams/${verified.teamId}/settings?connected=notion`, 302)
    } catch (err) {
      console.error(JSON.stringify({ event: 'notion.callback.error', error: String(err) }))
      return c.redirect(`${c.env.PAGES_URL}/integrations?error=notion_oauth_failed`, 302)
    }
  })
}
