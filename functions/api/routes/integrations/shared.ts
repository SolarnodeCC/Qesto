// CODE-SPLIT — shared helpers for provider-specific integration route modules.
//
// State token: a compact base64(JSON) blob signed with HMAC-SHA256 over JWT_SECRET.
// We carry `{ teamId, userId, exp }` and verify on the callback. We avoid the JWT
// library to keep payload minimal (no need for `iat`, `iss`, etc).
//
// Persistence (INTEGRATIONS_KV):
//   integration:config:{teamId}:slack — { channelId, channelName, teamName }

import type { AuthVariables } from '../../middleware/auth'
import type { PlanVariables } from '../../middleware/plan'
import type { AdminVariables } from '../../middleware/admin'
import type { RbacVariables } from '../../middleware/rbac'
import { validateData, OAuthStatePayloadSchema } from '../../lib/protocol-schemas'
import { SlackProvider } from '../../lib/integrations/providers/slack'
import { readKvText } from '../../lib/kv'
import { TeamsProvider } from '../../lib/integrations/providers/teams'
import { writeEvent } from '../../lib/observability'
import { base64UrlEncode, base64UrlDecode, timingSafeEqual, hmacSign } from '../../lib/shared/crypto'
import type { Env, PlanTier } from '../../types'

// Match the Vars shape used in app.ts so these sub-routers compose cleanly.
export type Vars = AuthVariables & PlanVariables & Partial<AdminVariables> & Partial<RbacVariables>

export const STATE_TTL_SECONDS = 600 // 10 minutes; OAuth round-trips should be quick

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

export interface StatePayload {
  teamId: string
  userId: string
  exp: number
}

export async function signState(payload: StatePayload, secret: string): Promise<string> {
  const body = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)))
  const sig = await hmacSign(secret, body)
  return `${body}.${sig}`
}

export async function verifyState(state: string, secret: string): Promise<StatePayload | null> {
  const parts = state.split('.')
  if (parts.length !== 2) return null
  const [body, sig] = parts
  const expected = await hmacSign(secret, body)
  if (!timingSafeEqual(sig, expected)) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(new TextDecoder().decode(base64UrlDecode(body)))
  } catch {
    return null
  }
  const p = validateData(parsed, OAuthStatePayloadSchema)
  if (!p) return null
  if (p.exp < Math.floor(Date.now() / 1000)) return null
  return p
}

// ─── Provider factories ───────────────────────────────────────────────────────

function buildRedirectUri(env: Env): string {
  // Worker URL governs callback origin (mirrors auth/oauth.ts behavior).
  const base = (env.API_URL ?? env.PAGES_URL).replace(/\/$/, '')
  return `${base}/api/integrations/slack/callback`
}

export function getSlackProvider(env: Env): SlackProvider | null {
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

export function getTeamsProvider(env: Env): TeamsProvider | null {
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

export function integrationsDisabled(env: Env): boolean {
  return env.INTEGRATION_ENABLED !== 'true' || !env.INTEGRATIONS_KV
}

export async function emitIntegrationConnected(
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

export async function resolvePrimaryTeamId(env: Env, userId: string): Promise<string | null> {
  // Prefer query-param-supplied teamId if the route handler validated membership.
  // For SLACK-01 we look up the user's first team from `user-teams:{userId}`.
  const raw = await readKvText(env.TEAMS_KV, `user-teams:${userId}`)
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
