/**
 * Hand-rolled Reddit web-app OAuth2 + mention-search client, matching
 * linkedin.ts's shape (no generic IntegrationProvider, no PKCE — Reddit's
 * "web app" client type uses confidential client_secret + real refresh tokens,
 * which is what the daily proactive-refresh cron needs).
 *
 * Tokens persisted via EncryptedTokenStore under the fixed pseudo-team
 * `MARKETING_TEAM_SCOPE` / service `REDDIT_SERVICE`.
 */

import type { TokenResponse } from '../integrations/types'
import type { NormalizedMention } from './mention-types'

export const REDDIT_AUTH_URL = 'https://www.reddit.com/api/v1/authorize'
export const REDDIT_TOKEN_URL = 'https://www.reddit.com/api/v1/access_token'
export const REDDIT_API_BASE = 'https://oauth.reddit.com'
export const REDDIT_SCOPES = ['identity', 'read'] as const
export const REDDIT_SERVICE = 'reddit'

export const KV_REDDIT_QUERIES = 'mktg:reddit:queries'
export const DEFAULT_REDDIT_QUERIES = ['Qesto']
export const oauthStateKey = (nonce: string): string => `mktg:reddit:oauth_state:${nonce}`

export interface RedditOAuthCreds {
  REDDIT_CLIENT_ID?: string
  REDDIT_CLIENT_SECRET?: string
  REDDIT_REDIRECT_URI?: string
}

const USER_AGENT = 'QestoMarketingBot/1.0 (mention monitor)'

function basicAuthHeader(clientId: string, clientSecret: string): string {
  return `Basic ${btoa(`${clientId}:${clientSecret}`)}`
}

async function postTokenEndpoint(clientId: string, clientSecret: string, body: URLSearchParams): Promise<TokenResponse> {
  const res = await fetch(REDDIT_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: basicAuthHeader(clientId, clientSecret),
      'User-Agent': USER_AGENT,
    },
    body,
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Reddit token endpoint HTTP ${res.status}: ${text.slice(0, 300)}`)
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error('Reddit token endpoint returned non-JSON')
  }
  const obj = json as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; token_type?: string }
  if (!obj.access_token) throw new Error('Reddit token response missing access_token')
  const out: TokenResponse = { access_token: obj.access_token }
  if (obj.refresh_token) out.refresh_token = obj.refresh_token
  if (obj.expires_in) out.expires_in = obj.expires_in
  if (obj.token_type) out.token_type = obj.token_type
  if (obj.scope) out.scope = obj.scope
  return out
}

export function buildAuthorizeUrl(clientId: string, redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    duration: 'permanent', // required to receive a refresh_token
    scope: REDDIT_SCOPES.join(' '),
  })
  return `${REDDIT_AUTH_URL}?${params.toString()}`
}

export function exchangeAuthorizationCode(creds: Required<RedditOAuthCreds>, code: string): Promise<TokenResponse> {
  return postTokenEndpoint(
    creds.REDDIT_CLIENT_ID,
    creds.REDDIT_CLIENT_SECRET,
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: creds.REDDIT_REDIRECT_URI,
    }),
  )
}

export function refreshAccessToken(
  creds: { REDDIT_CLIENT_ID: string; REDDIT_CLIENT_SECRET: string },
  refreshToken: string,
): Promise<TokenResponse> {
  return postTokenEndpoint(
    creds.REDDIT_CLIENT_ID,
    creds.REDDIT_CLIENT_SECRET,
    new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
  )
}

interface RedditSearchChild {
  data: {
    id: string
    author?: string
    selftext?: string
    title?: string
    body?: string
    permalink?: string
    created_utc?: number
  }
}

/**
 * Search Reddit (posts + comments) for the configured query terms. `cursor`
 * (Reddit's `after` token) is opaque and round-tripped by the caller via
 * `monitor_state.cursor`. Returns normalized mentions, newest last.
 */
export async function fetchMentions(
  accessToken: string,
  queries: string[],
  cursor: string | null,
): Promise<{ mentions: NormalizedMention[]; nextCursor: string | null }> {
  const query = queries.join(' OR ')
  const params = new URLSearchParams({ q: query, sort: 'new', limit: '25' })
  if (cursor) params.set('after', cursor)

  const res = await fetch(`${REDDIT_API_BASE}/search?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}`, 'User-Agent': USER_AGENT },
  })
  if (!res.ok) throw new Error(`Reddit search HTTP ${res.status}`)
  const json = (await res.json()) as { data?: { after?: string | null; children?: RedditSearchChild[] } }

  const mentions: NormalizedMention[] = (json.data?.children ?? []).map((c) => ({
    source_id: c.data.id,
    author: c.data.author ?? null,
    body: (c.data.selftext || c.data.body || c.data.title || '').slice(0, 4000),
    url: c.data.permalink ? `https://reddit.com${c.data.permalink}` : null,
    posted_at: c.data.created_utc ? Math.round(c.data.created_utc * 1000) : null,
  }))

  return { mentions, nextCursor: json.data?.after ?? null }
}
