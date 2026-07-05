// SALESFORCE-01 — OAuth skeleton (full flow when SALESFORCE_CLIENT_ID + secret configured).
//
// Endpoints (all under /api/integrations/salesforce):
//   GET /status    — returns { connected, instanceUrl? } (auth required)
//   GET /callback  — exchange code, persist token (+ instance_url)
//   GET /connect   — redirect to Salesforce OAuth (auth required)

import type { Hono } from 'hono'
import { authMiddleware } from '../../middleware/auth'
import { errorResponse } from '../../lib/error-handler'
import { createEncryptedTokenStore } from '../../lib/integrations/token-store'
import { getSalesforceProvider } from '../../lib/integrations/providers/salesforce'
import { readKvJson, writeKvJson } from '../../lib/kv'
import { INTEGRATION_TOKEN_TTL_SECONDS } from '../../lib/constants'
import type { Env } from '../../types'
import type { TokenResponse } from '../../lib/integrations/types'
import {
  type SalesforceIntegrationConfig,
  type Vars,
  STATE_TTL_SECONDS,
  salesforceConfigKey,
  signState,
  verifyState,
  integrationsDisabled,
  resolvePrimaryTeamId,
} from './shared'

export function mountSalesforceRoutes(app: Hono<{ Bindings: Env; Variables: Vars }>) {
  app.get('/salesforce/status', authMiddleware, async (c) => {
    const user = c.get('user')
    const teamId = c.req.query('teamId') ?? (await resolvePrimaryTeamId(c.env, user.sub))
    if (!teamId || !c.env.INTEGRATIONS_KV) {
      return c.json({ ok: true, data: { connected: false }, trace_id: c.get('trace_id') })
    }
    const store = createEncryptedTokenStore(c.env.INTEGRATIONS_KV, c.env)
    const token = await store.getToken(teamId, 'salesforce')
    const config = await readKvJson<SalesforceIntegrationConfig>(
      c.env.INTEGRATIONS_KV,
      salesforceConfigKey(teamId),
    )
    return c.json({
      ok: true,
      data: {
        connected: token !== null,
        ...(config?.instanceUrl ? { instanceUrl: config.instanceUrl } : {}),
      },
      trace_id: c.get('trace_id'),
    })
  })

  app.get('/salesforce/callback', async (c) => {
    if (integrationsDisabled(c.env)) {
      return c.redirect(`${c.env.PAGES_URL}/integrations?error=integrations_disabled`, 302)
    }
    const provider = getSalesforceProvider(c.env)
    if (!provider) {
      return c.redirect(`${c.env.PAGES_URL}/integrations?error=salesforce_not_configured`, 302)
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
      const token = (await provider.exchangeCode(code, '')) as TokenResponse & { instance_url?: string }
      const store = createEncryptedTokenStore(c.env.INTEGRATIONS_KV!, c.env)
      await store.storeToken(verified.teamId, 'salesforce', token)
      if (!token.instance_url) {
        return c.redirect(`${c.env.PAGES_URL}/integrations?error=salesforce_missing_instance`, 302)
      }
      const config: SalesforceIntegrationConfig = {
        instanceUrl: token.instance_url,
        connectedAt: Date.now(),
        connectedBy: verified.userId,
        notifyOnClose: true,
      }
      await writeKvJson(c.env.INTEGRATIONS_KV!, salesforceConfigKey(verified.teamId), config, {
        expirationTtl: INTEGRATION_TOKEN_TTL_SECONDS,
      })
      return c.redirect(`${c.env.PAGES_URL}/teams/${verified.teamId}/settings?connected=salesforce`, 302)
    } catch (err) {
      console.error(JSON.stringify({ event: 'salesforce.callback.error', error: String(err) }))
      return c.redirect(`${c.env.PAGES_URL}/integrations?error=salesforce_oauth_failed`, 302)
    }
  })

  app.get('/salesforce/connect', authMiddleware, async (c) => {
    const provider = getSalesforceProvider(c.env)
    if (!provider) {
      return c.json(
        { ok: false, error: { code: 'salesforce_not_configured', message: 'Salesforce OAuth not configured' }, trace_id: c.get('trace_id') },
        503,
      )
    }
    const user = c.get('user')
    const teamId = c.req.query('teamId') ?? (await resolvePrimaryTeamId(c.env, user.sub))
    if (!teamId) {
      return errorResponse(c, 400, 'team_required', 'teamId required')
    }
    const exp = Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS
    const state = await signState({ teamId, userId: user.sub, exp }, c.env.JWT_SECRET)
    return c.redirect(provider.getAuthUrl(state, ''), 302)
  })
}
