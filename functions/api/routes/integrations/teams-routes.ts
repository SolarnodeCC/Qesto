// TEAMS-01: Microsoft Teams routes (mirrors Slack endpoints).
//
// Endpoints (all under /api/integrations/teams):
//   GET    /connect              — redirect to Microsoft OAuth (PKCE) (auth required)
//   GET    /callback             — exchange code, persist token (auth required)
//   GET    /status               — connection status (auth required)
//   POST   /disconnect           — delete token + config (auth required)
//   POST   /config               — host picks the delivery channel (auth required)

import { Hono } from 'hono'
import { authMiddleware } from '../../middleware/auth'
import { createEncryptedTokenStore } from '../../lib/integrations/token-store'
import { generatePKCEPair } from '../../lib/integrations/oauth'
import type { ProviderConfig } from '../../lib/integrations/types'
import { readKvJson, writeKvJson } from '../../lib/kv'
import { INTEGRATION_TOKEN_TTL_SECONDS } from '../../lib/constants'
import { logEvent } from '../../lib/log'
import type { Env } from '../../types'
import {
  type Vars,
  type TeamsIntegrationConfig,
  teamsConfigKey,
  teamsPkceKey,
  STATE_TTL_SECONDS,
  signState,
  verifyState,
  getTeamsProvider,
  integrationsDisabled,
  emitIntegrationConnected,
  resolvePrimaryTeamId,
} from './shared'

export function mountTeamsRoutes(app: Hono<{ Bindings: Env; Variables: Vars }>) {
  // GET /api/integrations/teams/connect — redirect to Microsoft OAuth (PKCE)
  app.get('/teams/connect', authMiddleware, async (c) => {
    if (integrationsDisabled(c.env)) {
      return c.json(
        { ok: false, error: { code: 'integrations_disabled', message: 'Integrations are not enabled' }, trace_id: c.get('trace_id') },
        503,
      )
    }
    const provider = getTeamsProvider(c.env)
    if (!provider) {
      return c.json(
        { ok: false, error: { code: 'teams_not_configured', message: 'Microsoft OAuth credentials missing' }, trace_id: c.get('trace_id') },
        503,
      )
    }
    const user = c.get('user')
    const teamId = c.req.query('teamId') ?? (await resolvePrimaryTeamId(c.env, user.sub))
    if (!teamId) {
      return c.json(
        { ok: false, error: { code: 'team_required', message: 'A teamId query parameter or primary team is required' }, trace_id: c.get('trace_id') },
        400,
      )
    }
    const exp = Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS
    const state = await signState({ teamId, userId: user.sub, exp }, c.env.JWT_SECRET)
    // PKCE: stash the verifier in KV keyed by `state`. The callback will read
    // it back, then immediately delete it (single-use, TTL-bounded).
    const { codeVerifier, codeChallenge } = await generatePKCEPair()
    await c.env.INTEGRATIONS_KV!.put(teamsPkceKey(state), codeVerifier, {
      expirationTtl: STATE_TTL_SECONDS,
    })
    const url = provider.getAuthUrl(state, codeChallenge)
    return c.redirect(url, 302)
  })

  // GET /api/integrations/teams/callback — exchange code, persist token
  app.get('/teams/callback', async (c) => {
    if (integrationsDisabled(c.env)) {
      return c.redirect(`${c.env.PAGES_URL}/integrations?error=integrations_disabled`, 302)
    }
    const provider = getTeamsProvider(c.env)
    if (!provider) {
      return c.redirect(`${c.env.PAGES_URL}/integrations?error=teams_not_configured`, 302)
    }
    const code = c.req.query('code')
    const state = c.req.query('state')
    const msErr = c.req.query('error')
    if (msErr) {
      return c.redirect(`${c.env.PAGES_URL}/integrations?error=${encodeURIComponent(msErr)}`, 302)
    }
    if (!code || !state) {
      return c.redirect(`${c.env.PAGES_URL}/integrations?error=invalid_callback`, 302)
    }
    const verified = await verifyState(state, c.env.JWT_SECRET)
    if (!verified) {
      return c.redirect(`${c.env.PAGES_URL}/integrations?error=invalid_state`, 302)
    }
    const pkceKey = teamsPkceKey(state)
    const codeVerifier = await c.env.INTEGRATIONS_KV!.get(pkceKey)
    if (!codeVerifier) {
      return c.redirect(`${c.env.PAGES_URL}/integrations?error=pkce_expired`, 302)
    }
    // One-shot: drop the verifier immediately so a replay can't reuse it.
    await c.env.INTEGRATIONS_KV!.delete(pkceKey)
    try {
      const token = await provider.exchangeCode(code, codeVerifier)
      const store = createEncryptedTokenStore(c.env.INTEGRATIONS_KV!, c.env)
      await store.storeToken(verified.teamId, 'teams', token)
      await emitIntegrationConnected(c.env, verified.userId, verified.teamId, 'teams')
      logEvent({
          event: 'teams.connected',
          teamId: verified.teamId,
          userId: verified.userId,
        })
      return c.redirect(`${c.env.PAGES_URL}/teams/${verified.teamId}/settings?connected=teams&configure=1`, 302)
    } catch (err) {
      logEvent({
          event: 'teams.callback.error',
          teamId: verified.teamId,
          error: String(err),
        })
      return c.redirect(`${c.env.PAGES_URL}/integrations?error=oauth_failed`, 302)
    }
  })

  // GET /api/integrations/teams/status
  app.get('/teams/status', authMiddleware, async (c) => {
    if (integrationsDisabled(c.env)) {
      return c.json({ ok: true, data: { connected: false }, trace_id: c.get('trace_id') })
    }
    const user = c.get('user')
    const teamId = c.req.query('teamId') ?? (await resolvePrimaryTeamId(c.env, user.sub))
    if (!teamId) {
      return c.json({ ok: true, data: { connected: false }, trace_id: c.get('trace_id') })
    }
    const store = createEncryptedTokenStore(c.env.INTEGRATIONS_KV!, c.env)
    const token = await store.getToken(teamId, 'teams')
    const config = await readKvJson<TeamsIntegrationConfig>(
      c.env.INTEGRATIONS_KV!,
      teamsConfigKey(teamId),
    )
    return c.json({
      ok: true,
      data: {
        connected: token !== null,
        ...(config?.channelName ? { channelName: config.channelName } : {}),
        ...(config?.groupId ? { groupName: config.groupId } : {}),
      },
      trace_id: c.get('trace_id'),
    })
  })

  // POST /api/integrations/teams/disconnect
  app.post('/teams/disconnect', authMiddleware, async (c) => {
    if (integrationsDisabled(c.env)) {
      return c.json({ ok: true, data: { disconnected: false }, trace_id: c.get('trace_id') })
    }
    const user = c.get('user')
    const body = (await c.req.json().catch(() => ({}))) as { teamId?: string }
    const teamId = body.teamId ?? (await resolvePrimaryTeamId(c.env, user.sub))
    if (!teamId) {
      return c.json(
        { ok: false, error: { code: 'team_required', message: 'teamId required' }, trace_id: c.get('trace_id') },
        400,
      )
    }
    const store = createEncryptedTokenStore(c.env.INTEGRATIONS_KV!, c.env)
    await store.revokeToken(teamId, 'teams')
    await c.env.INTEGRATIONS_KV!.delete(teamsConfigKey(teamId))
    return c.json({ ok: true, data: { disconnected: true }, trace_id: c.get('trace_id') })
  })

  // POST /api/integrations/teams/config — host picks the delivery channel
  app.post('/teams/config', authMiddleware, async (c) => {
    if (integrationsDisabled(c.env)) {
      return c.json(
        { ok: false, error: { code: 'integrations_disabled', message: 'Integrations are not enabled' }, trace_id: c.get('trace_id') },
        503,
      )
    }
    const user = c.get('user')
    const body = (await c.req.json().catch(() => null)) as
      | { teamId?: string; groupId?: string; channelId?: string; channelName?: string }
      | null
    if (!body || typeof body.groupId !== 'string' || typeof body.channelId !== 'string') {
      return c.json(
        { ok: false, error: { code: 'invalid_body', message: 'groupId and channelId are required' }, trace_id: c.get('trace_id') },
        400,
      )
    }
    const teamId = body.teamId ?? (await resolvePrimaryTeamId(c.env, user.sub))
    if (!teamId) {
      return c.json(
        { ok: false, error: { code: 'team_required', message: 'teamId required' }, trace_id: c.get('trace_id') },
        400,
      )
    }
    // Must have an OAuth token before we can store a delivery target.
    const store = createEncryptedTokenStore(c.env.INTEGRATIONS_KV!, c.env)
    const token = await store.getToken(teamId, 'teams')
    if (!token) {
      return c.json(
        { ok: false, error: { code: 'not_connected', message: 'Teams is not connected for this team' }, trace_id: c.get('trace_id') },
        409,
      )
    }
    const tenantId = c.env.MICROSOFT_TENANT_ID || 'common'
    const config: TeamsIntegrationConfig = {
      groupId: body.groupId,
      channelId: body.channelId,
      channelName: body.channelName ?? body.channelId,
      tenantId,
      connectedAt: Date.now(),
      connectedBy: user.sub,
    }
    await writeKvJson(c.env.INTEGRATIONS_KV!, teamsConfigKey(teamId), config, {
      expirationTtl: INTEGRATION_TOKEN_TTL_SECONDS,
    })
    return c.json({ ok: true, data: { configured: true }, trace_id: c.get('trace_id') })
  })
}

/**
 * TEAMS-01: Send a session-summary Adaptive Card to Microsoft Teams on close.
 * Safe to run via c.executionCtx.waitUntil — caller catches errors.
 *
 * Skips silently if:
 *   - integrations are disabled / no KV bound
 *   - no Microsoft OAuth credentials configured
 *   - no token stored for this team
 *   - no channel config selected (host hasn't completed setup)
 */
export async function notifyTeamsSessionClosed(
  env: Env,
  sessionId: string,
  sessionTitle: string,
  teamId: string | null,
  counts: Record<string, number>,
  total: number,
): Promise<void> {
  if (!teamId) return
  if (env.INTEGRATION_ENABLED !== 'true' || !env.INTEGRATIONS_KV) return
  const provider = getTeamsProvider(env)
  if (!provider) return

  const store = createEncryptedTokenStore(env.INTEGRATIONS_KV, env)
  const token = await store.getToken(teamId, 'teams')
  if (!token) return
  const config = await readKvJson<TeamsIntegrationConfig>(
    env.INTEGRATIONS_KV,
    teamsConfigKey(teamId),
  )
  if (!config) return

  const optionEntries = Object.entries(counts).map(([id, votes]) => ({ id, label: id, votes }))
  const questions = optionEntries.length > 0
    ? [
        {
          id: 'summary',
          prompt: `Final tally (${total} vote${total === 1 ? '' : 's'})`,
          options: optionEntries,
        },
      ]
    : []
  await provider.send(
    {
      sessionId,
      sessionTitle,
      questions,
      consent_posture: 'full',
      timestamp: Date.now(),
    },
    {
      teamId,
      // ProviderConfig.service is typed to the v2.2 enum; cast to satisfy the
      // narrow union without widening the shared type for one provider.
      service: 'slack' as ProviderConfig['service'],
      groupId: config.groupId,
      channelId: config.channelId,
      accessToken: token.access_token,
    },
  )
}
