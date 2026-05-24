// SLACK-01 — Integration routes for Slack (ADR-0008 IntegrationProvider pattern).
//
// Endpoints (all under /api/integrations/slack):
//   GET    /connect              — redirect to Slack OAuth consent (auth required)
//   GET    /callback             — exchange code, persist token (auth required)
//   GET    /status               — returns { connected, channel?, teamName? } (auth required)
//   POST   /disconnect           — delete token + config (auth required)
//   POST   /test                 — post a test message to the configured channel (auth required)
//
// State token: a compact base64(JSON) blob signed with HMAC-SHA256 over JWT_SECRET.
// We carry `{ teamId, userId, exp }` and verify on the callback. We avoid the JWT
// library to keep payload minimal (no need for `iat`, `iss`, etc).
//
// Persistence (INTEGRATIONS_KV):

//   integration:config:{teamId}:slack — { channelId, channelName, teamName }

import { Hono } from 'hono'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import type { PlanVariables } from '../middleware/plan'
import type { AdminVariables } from '../middleware/admin'
import type { RbacVariables } from '../middleware/rbac'
import { createEncryptedTokenStore } from '../lib/integrations/token-store'
import { SlackProvider } from '../lib/integrations/providers/slack'
import { TeamsProvider } from '../lib/integrations/providers/teams'
import { getZoomProvider } from '../lib/integrations/providers/zoom'
import { getSalesforceProvider } from '../lib/integrations/providers/salesforce'
import { getNotionProvider } from '../lib/integrations/providers/notion'
import { generatePKCEPair } from '../lib/integrations/oauth'
import type { ProviderConfig, TokenResponse } from '../lib/integrations/types'
import { readKvJson, writeKvJson } from '../lib/kv'
import { writeEvent } from '../lib/observability'
import type { Env, PlanTier } from '../types'

// Match the Vars shape used in app.ts so this sub-router composes cleanly.
type Vars = AuthVariables & PlanVariables & Partial<AdminVariables> & Partial<RbacVariables>

const STATE_TTL_SECONDS = 600 // 10 minutes; OAuth round-trips should be quick

export interface SlackIntegrationConfig {
  channelId: string
  channelName: string
  teamName?: string
  connectedAt: number
  connectedBy: string
  /** SLACK-02: when false, session close does not post to Slack (default true). */
  notifyOnClose?: boolean
  /** SLACK-02: energizer completion notifications (default false). */
  notifyOnEnergizer?: boolean
}

// ─── Slack-config KV key helpers ──────────────────────────────────────────────

export function slackConfigKey(teamId: string): string {
  return `integration:config:${teamId}:slack`
}

// ─── Teams-config KV key helpers ──────────────────────────────────────────────

export interface TeamsIntegrationConfig {
  /** Microsoft Graph `team` resource id == AAD group id backing the team. */
  groupId: string
  /** Channel id within the team (Graph-style, e.g. `19:abc...@thread.tacv2`). */
  channelId: string
  /** Display name shown in the integrations UI. */
  channelName: string
  /** AAD tenant the OAuth token was minted for. */
  tenantId: string
  connectedAt: number
  connectedBy: string
}

export function teamsConfigKey(teamId: string): string {
  return `integration:config:${teamId}:teams`
}

export function zoomConfigKey(teamId: string): string {
  return `integration:config:${teamId}:zoom`
}

export interface ZoomIntegrationConfig {
  connectedAt: number
  connectedBy: string
  zoomUserId?: string
  notifyOnClose?: boolean
}

export function salesforceConfigKey(teamId: string): string {
  return `integration:config:${teamId}:salesforce`
}

export interface SalesforceIntegrationConfig {
  instanceUrl: string
  connectedAt: number
  connectedBy: string
  notifyOnClose?: boolean
}

// PKCE verifiers are stashed in KV between /connect and /callback because
// Workers don't have request-affinity sessions; the state token is the lookup key.
export function teamsPkceKey(state: string): string {
  return `oauth:pkce:${state}`
}

// ─── HMAC-signed OAuth state token ────────────────────────────────────────────

interface StatePayload {
  teamId: string
  userId: string
  exp: number
}

async function hmacSha256(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  return base64UrlEncode(new Uint8Array(mac))
}

function base64UrlEncode(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecode(s: string): Uint8Array {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)
  const bin = atob(padded)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

async function signState(payload: StatePayload, secret: string): Promise<string> {
  const body = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)))
  const sig = await hmacSha256(secret, body)
  return `${body}.${sig}`
}

async function verifyState(state: string, secret: string): Promise<StatePayload | null> {
  const parts = state.split('.')
  if (parts.length !== 2) return null
  const [body, sig] = parts
  const expected = await hmacSha256(secret, body)
  if (!timingSafeEqual(sig, expected)) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(new TextDecoder().decode(base64UrlDecode(body)))
  } catch {
    return null
  }
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    typeof (parsed as StatePayload).teamId !== 'string' ||
    typeof (parsed as StatePayload).userId !== 'string' ||
    typeof (parsed as StatePayload).exp !== 'number'
  ) {
    return null
  }
  const p = parsed as StatePayload
  if (p.exp < Math.floor(Date.now() / 1000)) return null
  return p
}

// ─── Provider factory ─────────────────────────────────────────────────────────

function buildRedirectUri(env: Env): string {
  // Worker URL governs callback origin (mirrors auth/oauth.ts behavior).
  const base = (env.API_URL ?? env.PAGES_URL).replace(/\/$/, '')
  return `${base}/api/integrations/slack/callback`
}

function getSlackProvider(env: Env): SlackProvider | null {
  if (!env.SLACK_CLIENT_ID || !env.SLACK_CLIENT_SECRET) return null
  return new SlackProvider({
    clientId: env.SLACK_CLIENT_ID,
    clientSecret: env.SLACK_CLIENT_SECRET,
    redirectUri: buildRedirectUri(env),
  })
}

function buildTeamsRedirectUri(env: Env): string {
  const base = (env.API_URL ?? env.PAGES_URL).replace(/\/$/, '')
  return `${base}/api/integrations/teams/callback`
}

function getTeamsProvider(env: Env): TeamsProvider | null {
  if (!env.MICROSOFT_CLIENT_ID || !env.MICROSOFT_CLIENT_SECRET) return null
  // `common` lets any work/school tenant consent; admins can lock down by
  // setting MICROSOFT_TENANT_ID to a specific GUID in wrangler.toml.
  const tenantId = env.MICROSOFT_TENANT_ID || 'common'
  return new TeamsProvider({
    clientId: env.MICROSOFT_CLIENT_ID,
    clientSecret: env.MICROSOFT_CLIENT_SECRET,
    redirectUri: buildTeamsRedirectUri(env),
    tenantId,
  })
}

function integrationsDisabled(env: Env): boolean {
  return env.INTEGRATION_ENABLED !== '1' || !env.INTEGRATIONS_KV
}

async function emitIntegrationConnected(
  env: Env,
  userId: string,
  teamId: string,
  integrationType: string,
): Promise<void> {
  const row = await env.DB.prepare(`SELECT plan FROM users WHERE id = ?1`)
    .bind(userId)
    .first<{ plan: PlanTier }>()
  writeEvent(env.METRICS_AE, {
    name: 'integration.connected',
    userId,
    teamId,
    plan: row?.plan,
    detail: integrationType,
  })
}

// ─── Caller team resolution ───────────────────────────────────────────────────

async function resolvePrimaryTeamId(env: Env, userId: string): Promise<string | null> {
  // Prefer query-param-supplied teamId if the route handler validated membership.
  // For SLACK-01 we look up the user's first team from `user-teams:{userId}`.
  const raw = await env.TEAMS_KV.get(`user-teams:${userId}`)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.length === 0) return null
    const first = parsed[0]
    return typeof first === 'string' ? first : null
  } catch {
    return null
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export function mountIntegrationRoutes(parent: Hono<{ Bindings: Env; Variables: Vars }>) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()

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
          expirationTtl: 90 * 24 * 60 * 60,
        })
      }
      await emitIntegrationConnected(c.env, verified.userId, verified.teamId, 'slack')
      console.log(
        JSON.stringify({
          event: 'slack.connected',
          teamId: verified.teamId,
          userId: verified.userId,
          channelId: channelId ?? null,
        }),
      )
      return c.redirect(`${c.env.PAGES_URL}/teams/${verified.teamId}/settings?connected=slack`, 302)
    } catch (err) {
      console.error(
        JSON.stringify({
          event: 'slack.callback.error',
          teamId: verified.teamId,
          error: String(err),
        }),
      )
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
      expirationTtl: 90 * 24 * 60 * 60,
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

  // ───────────────────────────────────────────────────────────────────────────
  // TEAMS-01: Microsoft Teams routes (mirrors Slack endpoints).
  // ───────────────────────────────────────────────────────────────────────────

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
      console.log(
        JSON.stringify({
          event: 'teams.connected',
          teamId: verified.teamId,
          userId: verified.userId,
        }),
      )
      return c.redirect(`${c.env.PAGES_URL}/teams/${verified.teamId}/settings?connected=teams&configure=1`, 302)
    } catch (err) {
      console.error(
        JSON.stringify({
          event: 'teams.callback.error',
          teamId: verified.teamId,
          error: String(err),
        }),
      )
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
      expirationTtl: 90 * 24 * 60 * 60,
    })
    return c.json({ ok: true, data: { configured: true }, trace_id: c.get('trace_id') })
  })

  // ZOOM-01 — OAuth skeleton (full flow when ZOOM_CLIENT_ID + ZOOM_CLIENT_SECRET configured)
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
        expirationTtl: 90 * 24 * 60 * 60,
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
        expirationTtl: 90 * 24 * 60 * 60,
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
      return c.json({ ok: false, error: { code: 'team_required', message: 'teamId required' }, trace_id: c.get('trace_id') }, 400)
    }
    const exp = Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS
    const state = await signState({ teamId, userId: user.sub, exp }, c.env.JWT_SECRET)
    return c.redirect(provider.getAuthUrl(state, ''), 302)
  })

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
        { expirationTtl: 90 * 24 * 60 * 60 },
      )
      return c.redirect(`${c.env.PAGES_URL}/teams/${verified.teamId}/settings?connected=notion`, 302)
    } catch (err) {
      console.error(JSON.stringify({ event: 'notion.callback.error', error: String(err) }))
      return c.redirect(`${c.env.PAGES_URL}/integrations?error=notion_oauth_failed`, 302)
    }
  })


  parent.route('/api/integrations', app)
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
  if (env.INTEGRATION_ENABLED !== '1' || !env.INTEGRATIONS_KV) return
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
  if (env.INTEGRATION_ENABLED !== '1' || !env.INTEGRATIONS_KV) return
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
