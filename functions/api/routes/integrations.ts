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
//   integration:token:{teamId}:slack  — encrypted (TODO v2.3) access token (EncryptedTokenStore)
//   integration:config:{teamId}:slack — { channelId, channelName, teamName }

import { Hono } from 'hono'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import type { PlanVariables } from '../middleware/plan'
import type { AdminVariables } from '../middleware/admin'
import type { RbacVariables } from '../middleware/rbac'
import { EncryptedTokenStore } from '../lib/integrations/token-store'
import { SlackProvider } from '../lib/integrations/providers/slack'
import { readKvJson, writeKvJson } from '../lib/kv'
import type { Env } from '../types'

// Match the Vars shape used in app.ts so this sub-router composes cleanly.
type Vars = AuthVariables & PlanVariables & Partial<AdminVariables> & Partial<RbacVariables>

const STATE_TTL_SECONDS = 600 // 10 minutes; OAuth round-trips should be quick

export interface SlackIntegrationConfig {
  channelId: string
  channelName: string
  teamName?: string
  connectedAt: number
  connectedBy: string
}

// ─── Slack-config KV key helpers ──────────────────────────────────────────────

export function slackConfigKey(teamId: string): string {
  return `integration:config:${teamId}:slack`
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

function integrationsDisabled(env: Env): boolean {
  return env.INTEGRATION_ENABLED !== '1' || !env.INTEGRATIONS_KV
}

// ─── Caller team resolution ───────────────────────────────────────────────────

async function resolvePrimaryTeamId(env: Env, userId: string): Promise<string | null> {
  // Prefer query-param-supplied teamId if the route handler validated membership.
  // For SLACK-01 we look up the user's first team from `user-teams:{userId}`.
  const raw = await env.TEAMS_KV.get(`user-teams:${userId}`)
  if (!raw) return null
  try {
    const ids = JSON.parse(raw) as unknown
    if (!Array.isArray(ids) || ids.length === 0) return null
    const first = ids[0]
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
      const store = new EncryptedTokenStore(c.env.INTEGRATIONS_KV!)
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
      console.log(
        JSON.stringify({
          event: 'slack.connected',
          teamId: verified.teamId,
          userId: verified.userId,
          channelId: channelId ?? null,
        }),
      )
      return c.redirect(`${c.env.PAGES_URL}/integrations?connected=slack`, 302)
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
    const store = new EncryptedTokenStore(c.env.INTEGRATIONS_KV!)
    const token = await store.getToken(teamId, 'slack')
    const config = await readKvJson<SlackIntegrationConfig>(c.env.INTEGRATIONS_KV!, slackConfigKey(teamId))
    return c.json({
      ok: true,
      data: {
        connected: token !== null,
        ...(config?.channelName ? { channel: config.channelName } : {}),
        ...(config?.teamName ? { teamName: config.teamName } : {}),
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
    const store = new EncryptedTokenStore(c.env.INTEGRATIONS_KV!)
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
    const store = new EncryptedTokenStore(c.env.INTEGRATIONS_KV!)
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

  const store = new EncryptedTokenStore(env.INTEGRATIONS_KV)
  const token = await store.getToken(teamId, 'slack')
  if (!token) return
  const config = await readKvJson<SlackIntegrationConfig>(env.INTEGRATIONS_KV, slackConfigKey(teamId))
  if (!config) return

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
