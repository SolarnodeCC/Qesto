// SLACK-01 — Integration routes for Slack (ADR-0008 IntegrationProvider pattern).
//
// Endpoints (all under /api/integrations/slack):
//   GET    /connect              — redirect to Slack OAuth consent (auth required)
//   GET    /callback             — exchange code, persist token
//   GET    /status               — returns { connected, channel?, teamName? } (auth required)
//   PATCH  /preferences          — SLACK-02 event filters (auth required)
//   POST   /disconnect           — delete token + config (auth required)
//   POST   /test                 — post a test message to the configured channel (auth required)
//   GET    /scale                — webhook throughput snapshot (auth required)
//
// Persistence (INTEGRATIONS_KV):
//   integration:config:{teamId}:slack — { channelId, channelName, teamName }

import type { Hono } from 'hono'
import { authMiddleware } from '../../middleware/auth'
import { createEncryptedTokenStore } from '../../lib/integrations/token-store'
import { readKvJson, writeKvJson } from '../../lib/kv'
import { INTEGRATION_TOKEN_TTL_SECONDS } from '../../lib/constants'
import { logEvent } from '../../lib/log'
import type { Env } from '../../types'
import {
  type SlackIntegrationConfig,
  type Vars,
  STATE_TTL_SECONDS,
  slackConfigKey,
  signState,
  verifyState,
  getSlackProvider,
  integrationsDisabled,
  emitIntegrationConnected,
  resolvePrimaryTeamId,
} from './shared'

export function mountSlackRoutes(app: Hono<{ Bindings: Env; Variables: Vars }>) {
  // GET /api/integrations/slack/connect — redirect to Slack OAuth
  app.get('/slack/connect', authMiddleware, async (c) => {
    if (integrationsDisabled(c.env)) {
      return c.json(
        { ok: false, error: { code: 'integrations_disabled', message: 'Integrations are not enabled' }, trace_id: c.get('trace_id') },
        503,
      )
    }
    const provider = getSlackProvider(c.env)
    if (!provider) {
      return c.json(
        { ok: false, error: { code: 'slack_not_configured', message: 'Slack OAuth credentials missing' }, trace_id: c.get('trace_id') },
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
    const url = provider.getAuthUrl(state, '')
    return c.redirect(url, 302)
  })

  // GET /api/integrations/slack/callback — exchange code, persist token
  app.get('/slack/callback', async (c) => {
    if (integrationsDisabled(c.env)) {
      return c.redirect(`${c.env.PAGES_URL}/integrations?error=integrations_disabled`, 302)
    }
    const provider = getSlackProvider(c.env)
    if (!provider) {
      return c.redirect(`${c.env.PAGES_URL}/integrations?error=slack_not_configured`, 302)
    }
    const code = c.req.query('code')
    const state = c.req.query('state')
    const slackErr = c.req.query('error')
    if (slackErr) {
      return c.redirect(`${c.env.PAGES_URL}/integrations?error=${encodeURIComponent(slackErr)}`, 302)
    }
    if (!code || !state) {
      return c.redirect(`${c.env.PAGES_URL}/integrations?error=invalid_callback`, 302)
    }
    const verified = await verifyState(state, c.env.JWT_SECRET)
    if (!verified) {
      return c.redirect(`${c.env.PAGES_URL}/integrations?error=invalid_state`, 302)
    }
    try {
      const { token, teamName, channelId, channelName } = await provider.exchangeCodeWithMetadata(code)
      const store = createEncryptedTokenStore(c.env.INTEGRATIONS_KV!, c.env)
      await store.storeToken(verified.teamId, 'slack', token)
      // Persist channel binding (separate KV record so we don't need to read the
      // encrypted token blob just to render UI).
      if (channelId) {
        const config: SlackIntegrationConfig = {
          channelId,
          channelName: channelName ?? channelId,
          ...(teamName ? { teamName } : {}),
          connectedAt: Date.now(),
          connectedBy: verified.userId,
        }
        await writeKvJson(c.env.INTEGRATIONS_KV!, slackConfigKey(verified.teamId), config, {
          expirationTtl: INTEGRATION_TOKEN_TTL_SECONDS,
        })
      }
      await emitIntegrationConnected(c.env, verified.userId, verified.teamId, 'slack')
      logEvent({
          event: 'slack.connected',
          teamId: verified.teamId,
          userId: verified.userId,
          channelId: channelId ?? null,
        })
      return c.redirect(`${c.env.PAGES_URL}/teams/${verified.teamId}/settings?connected=slack`, 302)
    } catch (err) {
      logEvent({
          event: 'slack.callback.error',
          teamId: verified.teamId,
          error: String(err),
        })
      return c.redirect(`${c.env.PAGES_URL}/integrations?error=oauth_failed`, 302)
    }
  })

  // GET /api/integrations/slack/status
  app.get('/slack/status', authMiddleware, async (c) => {
    if (integrationsDisabled(c.env)) {
      return c.json({ ok: true, data: { connected: false }, trace_id: c.get('trace_id') })
    }
    const user = c.get('user')
    const teamId = c.req.query('teamId') ?? (await resolvePrimaryTeamId(c.env, user.sub))
    if (!teamId) {
      return c.json({ ok: true, data: { connected: false }, trace_id: c.get('trace_id') })
    }
    const store = createEncryptedTokenStore(c.env.INTEGRATIONS_KV!, c.env)
    const token = await store.getToken(teamId, 'slack')
    const config = await readKvJson<SlackIntegrationConfig>(c.env.INTEGRATIONS_KV!, slackConfigKey(teamId))
    return c.json({
      ok: true,
      data: {
        connected: token !== null,
        ...(config?.channelName ? { channel: config.channelName } : {}),
        ...(config?.teamName ? { teamName: config.teamName } : {}),
        notifyOnClose: config?.notifyOnClose !== false,
        notifyOnEnergizer: config?.notifyOnEnergizer === true,
      },
      trace_id: c.get('trace_id'),
    })
  })

  // PATCH /api/integrations/slack/preferences — SLACK-02 event filters
  app.patch('/slack/preferences', authMiddleware, async (c) => {
    if (integrationsDisabled(c.env)) {
      return c.json(
        { ok: false, error: { code: 'integrations_disabled', message: 'Integrations are not enabled' }, trace_id: c.get('trace_id') },
        503,
      )
    }
    const user = c.get('user')
    const body = (await c.req.json().catch(() => ({}))) as {
      teamId?: string
      notifyOnClose?: boolean
      notifyOnEnergizer?: boolean
    }
    const teamId = body.teamId ?? (await resolvePrimaryTeamId(c.env, user.sub))
    if (!teamId) {
      return c.json(
        { ok: false, error: { code: 'team_required', message: 'teamId required' }, trace_id: c.get('trace_id') },
        400,
      )
    }
    const config = await readKvJson<SlackIntegrationConfig>(c.env.INTEGRATIONS_KV!, slackConfigKey(teamId))
    if (!config) {
      return c.json(
        { ok: false, error: { code: 'not_connected', message: 'Slack is not connected for this team' }, trace_id: c.get('trace_id') },
        409,
      )
    }
    const next: SlackIntegrationConfig = {
      ...config,
      ...(body.notifyOnClose !== undefined ? { notifyOnClose: body.notifyOnClose } : {}),
      ...(body.notifyOnEnergizer !== undefined ? { notifyOnEnergizer: body.notifyOnEnergizer } : {}),
    }
    await writeKvJson(c.env.INTEGRATIONS_KV!, slackConfigKey(teamId), next, {
      expirationTtl: INTEGRATION_TOKEN_TTL_SECONDS,
    })
    return c.json({
      ok: true,
      data: {
        notifyOnClose: next.notifyOnClose !== false,
        notifyOnEnergizer: next.notifyOnEnergizer === true,
      },
      trace_id: c.get('trace_id'),
    })
  })

  // POST /api/integrations/slack/disconnect
  app.post('/slack/disconnect', authMiddleware, async (c) => {
    if (integrationsDisabled(c.env)) {
      return c.json({ ok: true, data: { disconnected: false }, trace_id: c.get('trace_id') })
    }
    const user = c.get('user')
    const body = await c.req.json().catch(() => ({})) as { teamId?: string }
    const teamId = body.teamId ?? (await resolvePrimaryTeamId(c.env, user.sub))
    if (!teamId) {
      return c.json(
        { ok: false, error: { code: 'team_required', message: 'teamId required' }, trace_id: c.get('trace_id') },
        400,
      )
    }
    const store = createEncryptedTokenStore(c.env.INTEGRATIONS_KV!, c.env)
    await store.revokeToken(teamId, 'slack')
    await c.env.INTEGRATIONS_KV!.delete(slackConfigKey(teamId))
    return c.json({ ok: true, data: { disconnected: true }, trace_id: c.get('trace_id') })
  })

  // POST /api/integrations/slack/test — quick verification that the bot can post
  app.post('/slack/test', authMiddleware, async (c) => {
    if (integrationsDisabled(c.env)) {
      return c.json(
        { ok: false, error: { code: 'integrations_disabled', message: 'Integrations are not enabled' }, trace_id: c.get('trace_id') },
        503,
      )
    }
    const provider = getSlackProvider(c.env)
    if (!provider) {
      return c.json(
        { ok: false, error: { code: 'slack_not_configured', message: 'Slack OAuth credentials missing' }, trace_id: c.get('trace_id') },
        503,
      )
    }
    const user = c.get('user')
    const body = await c.req.json().catch(() => ({})) as { teamId?: string }
    const teamId = body.teamId ?? (await resolvePrimaryTeamId(c.env, user.sub))
    if (!teamId) {
      return c.json(
        { ok: false, error: { code: 'team_required', message: 'teamId required' }, trace_id: c.get('trace_id') },
        400,
      )
    }
    const store = createEncryptedTokenStore(c.env.INTEGRATIONS_KV!, c.env)
    const token = await store.getToken(teamId, 'slack')
    const config = await readKvJson<SlackIntegrationConfig>(c.env.INTEGRATIONS_KV!, slackConfigKey(teamId))
    if (!token || !config) {
      return c.json(
        { ok: false, error: { code: 'not_connected', message: 'Slack is not connected for this team' }, trace_id: c.get('trace_id') },
        409,
      )
    }
    try {
      await provider.send(
        {
          sessionId: 'test',
          sessionTitle: 'Qesto Slack integration test',
          questions: [],
          consent_posture: 'full',
          timestamp: Date.now(),
        },
        {
          teamId,
          service: 'slack',
          channel: config.channelId,
          accessToken: token.access_token,
        },
      )
      return c.json({ ok: true, data: { sent: true }, trace_id: c.get('trace_id') })
    } catch (err) {
      return c.json(
        { ok: false, error: { code: 'slack_send_failed', message: String(err) }, trace_id: c.get('trace_id') },
        502,
      )
    }
  })

  // SLACK-SCALE-01 — webhook throughput snapshot for enterprise scale proof (S73)
  app.get('/slack/scale', authMiddleware, async (c) => {
    const teamId = c.req.query('teamId') ?? (await resolvePrimaryTeamId(c.env, c.get('user').sub))
    const counters = c.env.METRICS_KV
      ? await readKvJson<{ eventsPerMinute: number; peak24h: number }>(c.env.METRICS_KV, `slack:scale:${teamId ?? 'global'}`)
      : null
    return c.json({
      ok: true,
      data: {
        teamId: teamId ?? null,
        eventsPerMinute: counters?.eventsPerMinute ?? 0,
        peak24h: counters?.peak24h ?? 0,
        capacityTarget: 5000,
        status: (counters?.eventsPerMinute ?? 0) < 5000 ? 'within_capacity' : 'review',
      },
      trace_id: c.get('trace_id'),
    })
  })
}

// ─── Background helper used by sessions.ts on session close ──────────────────

/**
 * Send a session-summary Slack notification on session close.
 * Safe to run via c.executionCtx.waitUntil — caller catches errors.
 */
export async function notifySlackSessionClosed(
  env: Env,
  sessionId: string,
  sessionTitle: string,
  teamId: string | null,
  counts: Record<string, number>,
  total: number,
): Promise<void> {
  if (!teamId) return
  if (env.INTEGRATION_ENABLED !== 'true' || !env.INTEGRATIONS_KV) return
  const provider = getSlackProvider(env)
  if (!provider) return

  const store = createEncryptedTokenStore(env.INTEGRATIONS_KV, env)
  const token = await store.getToken(teamId, 'slack')
  if (!token) return
  const config = await readKvJson<SlackIntegrationConfig>(env.INTEGRATIONS_KV, slackConfigKey(teamId))
  if (!config) return
  if (config.notifyOnClose === false) return

  // Build a minimal SessionResults payload — we deliberately avoid extra D1
  // round-trips on the close hot path. Vote tallies come from the DO snapshot.
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
      service: 'slack',
      channel: config.channelId,
      accessToken: token.access_token,
    },
  )
}
