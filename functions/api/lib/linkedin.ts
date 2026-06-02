/**
 * Shared LinkedIn auto-posting helpers (MKTG).
 *
 * Used by both the one-time OAuth Pages Function (functions/linkedin-auth.ts)
 * and the standalone cron Worker (workers/linkedin-scheduler/). Zero new deps —
 * hand-rolled `fetch` matching the Slack/Zoom/SAML integrations, plus the
 * in-repo `zod` for response validation.
 *
 * Tokens are persisted encrypted via EncryptedTokenStore under the pseudo-team
 * `LINKEDIN_TEAM_SCOPE` / service `LINKEDIN_SERVICE`. Non-secret URNs, topics,
 * rotation index and language live as plain LINKEDIN_KV keys.
 */

import { z } from 'zod'
import type { TokenResponse } from './integrations/types'

// ── Endpoints & scopes ──────────────────────────────────────────────────────
export const LINKEDIN_AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization'
export const LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken'
export const LINKEDIN_API_BASE = 'https://api.linkedin.com'
// Scopes granted by the "Community Management API" + "Sign In with LinkedIn
// using OpenID Connect" products. Org scopes post as / read the company page;
// OIDC (openid/profile) authenticates the member and exposes the person id.
export const LINKEDIN_SCOPES = [
  'w_organization_social',
  'r_organization_social',
  'rw_organization_admin',
  'openid',
  'profile',
] as const

// Single global org token → fixed pseudo-team id for EncryptedTokenStore.
export const LINKEDIN_TEAM_SCOPE = 'qesto-org'
export const LINKEDIN_SERVICE = 'linkedin'

// ── KV keys (non-secret metadata) ───────────────────────────────────────────
export const KV_ORG_URN = 'linkedin:org_urn'
export const KV_PERSON_URN = 'linkedin:person_urn'
export const KV_TOPICS = 'linkedin:topics'
export const KV_TOPIC_INDEX = 'linkedin:topic_index'
export const KV_LANGUAGE = 'linkedin:language'
export const oauthStateKey = (nonce: string): string => `linkedin:oauth_state:${nonce}`

// ── Defaults & limits ───────────────────────────────────────────────────────
export const DEFAULT_TOPICS = ['team engagement', 'remote meetings', 'quiz tools for HR']
export const DEFAULT_LANGUAGE = 'en'
export const MAX_POST_LENGTH = 700
/** Refresh proactively when the access token expires within this window. */
export const REFRESH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

/** Map an ISO-639-1 code (from linkedin:language) to an English language name for the prompt. */
const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  nl: 'Dutch',
  es: 'Spanish',
  de: 'German',
  fr: 'French',
}
export function languageName(code: string): string {
  return LANGUAGE_NAMES[code.toLowerCase()] ?? code
}

export interface LinkedInOAuthCreds {
  LINKEDIN_CLIENT_ID?: string
  LINKEDIN_CLIENT_SECRET?: string
  LINKEDIN_REDIRECT_URI?: string
}

// ── Token exchange / refresh ────────────────────────────────────────────────
const LinkedInTokenSchema = z.object({
  access_token: z.string(),
  expires_in: z.number().optional(),
  refresh_token: z.string().optional(),
  refresh_token_expires_in: z.number().optional(),
  scope: z.string().optional(),
  token_type: z.string().optional(),
})

function toTokenResponse(parsed: z.infer<typeof LinkedInTokenSchema>): TokenResponse {
  const out: TokenResponse = { access_token: parsed.access_token }
  if (parsed.refresh_token) out.refresh_token = parsed.refresh_token
  if (parsed.expires_in) out.expires_in = parsed.expires_in
  if (parsed.token_type) out.token_type = parsed.token_type
  if (parsed.scope) out.scope = parsed.scope
  return out
}

async function postTokenEndpoint(body: URLSearchParams): Promise<TokenResponse> {
  const res = await fetch(LINKEDIN_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`LinkedIn token endpoint HTTP ${res.status}: ${text.slice(0, 300)}`)
  }
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error('LinkedIn token endpoint returned non-JSON')
  }
  const parsed = LinkedInTokenSchema.safeParse(json)
  if (!parsed.success) throw new Error('LinkedIn token response failed validation')
  return toTokenResponse(parsed.data)
}

export function buildAuthorizeUrl(clientId: string, redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: LINKEDIN_SCOPES.join(' '),
  })
  return `${LINKEDIN_AUTH_URL}?${params.toString()}`
}

export function exchangeAuthorizationCode(
  creds: Required<LinkedInOAuthCreds>,
  code: string,
): Promise<TokenResponse> {
  return postTokenEndpoint(
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: creds.LINKEDIN_CLIENT_ID,
      client_secret: creds.LINKEDIN_CLIENT_SECRET,
      redirect_uri: creds.LINKEDIN_REDIRECT_URI,
    }),
  )
}

export function refreshAccessToken(
  creds: { LINKEDIN_CLIENT_ID: string; LINKEDIN_CLIENT_SECRET: string },
  refreshToken: string,
): Promise<TokenResponse> {
  return postTokenEndpoint(
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: creds.LINKEDIN_CLIENT_ID,
      client_secret: creds.LINKEDIN_CLIENT_SECRET,
    }),
  )
}

// ── Profile / org resolution ────────────────────────────────────────────────
/**
 * Fetch the authenticated member's person URN via the OpenID Connect
 * `/v2/userinfo` endpoint (needs the `openid`/`profile` scopes). The `sub`
 * claim is the member id. Optional — posting only needs the org URN.
 */
export async function fetchPersonUrn(accessToken: string): Promise<string | null> {
  const res = await fetch(`${LINKEDIN_API_BASE}/v2/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return null
  const json = (await res.json().catch(() => null)) as { sub?: string } | null
  return json?.sub ? `urn:li:person:${json.sub}` : null
}

/**
 * Best-effort org URN via organizationalEntityAcls (needs a broader org-admin
 * scope than the two requested). Returns null if the scope can't read it — the
 * caller then falls back to LINKEDIN_ORG_URN. Picks the first ADMINISTRATOR ACL.
 */
export async function fetchOrgUrn(accessToken: string): Promise<string | null> {
  const url =
    `${LINKEDIN_API_BASE}/v2/organizationalEntityAcls` +
    `?q=roleAssignee&role=ADMINISTRATOR&projection=(elements*(organizationalTarget))`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, 'X-Restli-Protocol-Version': '2.0.0' },
  })
  if (!res.ok) return null
  const json = (await res.json().catch(() => null)) as
    | { elements?: Array<{ organizationalTarget?: string }> }
    | null
  return json?.elements?.[0]?.organizationalTarget ?? null
}

// ── Post generation & publishing ────────────────────────────────────────────
export function buildPostPrompt(topic: string, language: string): { system: string; user: string } {
  const lang = languageName(language)
  return {
    system:
      `You are the social media voice of Qesto, a real-time interactive session platform ` +
      `(live polls, quizzes, rankings) for teams. Write a single LinkedIn post in ${lang}. ` +
      `Be warm, concrete and professional, no hashtags spam (1-3 relevant hashtags max), ` +
      `no markdown, no quotes around the text. Keep it under ${MAX_POST_LENGTH} characters.`,
    user: `Write today's LinkedIn post about: ${topic}.`,
  }
}

/** Trim AI output to a safe LinkedIn length without cutting mid-word where avoidable. */
export function clampPost(text: string): string {
  const clean = text.trim()
  if (clean.length <= MAX_POST_LENGTH) return clean
  const slice = clean.slice(0, MAX_POST_LENGTH)
  const lastSpace = slice.lastIndexOf(' ')
  return (lastSpace > MAX_POST_LENGTH - 80 ? slice.slice(0, lastSpace) : slice).trim()
}

/**
 * Publish an org UGC post. Returns { ok, status, detail }. On non-2xx the caller
 * logs status='error' and does NOT retry (next cron handles the next slot).
 */
export async function publishUgcPost(
  accessToken: string,
  orgUrn: string,
  text: string,
): Promise<{ ok: boolean; status: number; detail: string }> {
  const res = await fetch(`${LINKEDIN_API_BASE}/v2/ugcPosts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify({
      author: orgUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    }),
  })
  const detail = await res.text().catch(() => '')
  return { ok: res.ok, status: res.status, detail: detail.slice(0, 500) }
}
