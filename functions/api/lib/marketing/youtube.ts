/**
 * Hand-rolled Google OAuth2 + YouTube Data API v3 client, matching
 * linkedin.ts's shape. Used for two things:
 *   1. Mention Monitor — fetch comments/search results mentioning Qesto.
 *   2. Publisher — push generated title/description/tags onto an
 *      already-uploaded video via `videos.update` (the owner supplies the
 *      video ID; this repo does not upload video bytes).
 *
 * Tokens persisted via EncryptedTokenStore under the fixed pseudo-team
 * `MARKETING_TEAM_SCOPE` / service `YOUTUBE_SERVICE`.
 */

import type { TokenResponse } from '../integrations/types'
import type { NormalizedMention } from './mention-types'
import type { YouTubeMetadata } from './tone'

export const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
export const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3'
export const YOUTUBE_SCOPES = [
  'https://www.googleapis.com/auth/youtube.force-ssl',
  'https://www.googleapis.com/auth/youtube.readonly',
] as const
export const YOUTUBE_SERVICE = 'youtube'

export const KV_YOUTUBE_QUERIES = 'mktg:youtube:queries'
export const DEFAULT_YOUTUBE_QUERIES = ['Qesto']
export const oauthStateKey = (nonce: string): string => `mktg:youtube:oauth_state:${nonce}`

export interface YouTubeOAuthCreds {
  YOUTUBE_CLIENT_ID?: string
  YOUTUBE_CLIENT_SECRET?: string
  YOUTUBE_REDIRECT_URI?: string
}

async function postTokenEndpoint(body: URLSearchParams): Promise<TokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Google token endpoint HTTP ${res.status}: ${text.slice(0, 300)}`)
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error('Google token endpoint returned non-JSON')
  }
  const obj = json as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; token_type?: string }
  if (!obj.access_token) throw new Error('Google token response missing access_token')
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
    access_type: 'offline', // required to receive a refresh_token
    prompt: 'consent', // force refresh_token on every connect, not just the first
    scope: YOUTUBE_SCOPES.join(' '),
  })
  return `${GOOGLE_AUTH_URL}?${params.toString()}`
}

export function exchangeAuthorizationCode(creds: Required<YouTubeOAuthCreds>, code: string): Promise<TokenResponse> {
  return postTokenEndpoint(
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: creds.YOUTUBE_CLIENT_ID,
      client_secret: creds.YOUTUBE_CLIENT_SECRET,
      redirect_uri: creds.YOUTUBE_REDIRECT_URI,
    }),
  )
}

export function refreshAccessToken(
  creds: { YOUTUBE_CLIENT_ID: string; YOUTUBE_CLIENT_SECRET: string },
  refreshToken: string,
): Promise<TokenResponse> {
  return postTokenEndpoint(
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: creds.YOUTUBE_CLIENT_ID,
      client_secret: creds.YOUTUBE_CLIENT_SECRET,
    }),
  )
}

interface YouTubeSearchItem {
  id?: { videoId?: string; kind?: string }
  snippet?: { channelTitle?: string; description?: string; title?: string; publishedAt?: string }
}

/** Search YouTube for recent videos mentioning the query terms. `cursor` is YouTube's pageToken. */
export async function fetchMentions(
  accessToken: string,
  queries: string[],
  cursor: string | null,
): Promise<{ mentions: NormalizedMention[]; nextCursor: string | null }> {
  const params = new URLSearchParams({
    part: 'snippet',
    q: queries.join('|'),
    type: 'video',
    order: 'date',
    maxResults: '25',
  })
  if (cursor) params.set('pageToken', cursor)

  const res = await fetch(`${YOUTUBE_API_BASE}/search?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`YouTube search HTTP ${res.status}`)
  const json = (await res.json()) as { items?: YouTubeSearchItem[]; nextPageToken?: string }

  const mentions: NormalizedMention[] = (json.items ?? [])
    .filter((i) => i.id?.videoId)
    .map((i) => ({
      source_id: i.id!.videoId!,
      author: i.snippet?.channelTitle ?? null,
      body: (i.snippet?.title || i.snippet?.description || '').slice(0, 4000),
      url: `https://www.youtube.com/watch?v=${i.id!.videoId}`,
      posted_at: i.snippet?.publishedAt ? Date.parse(i.snippet.publishedAt) : null,
    }))

  return { mentions, nextCursor: json.nextPageToken ?? null }
}

/** Push generated metadata onto an already-uploaded video (videos.update, part=snippet). */
export async function publishMetadata(
  accessToken: string,
  videoId: string,
  metadata: YouTubeMetadata,
  categoryId = '22', // "People & Blogs" — YouTube requires a categoryId on update
): Promise<{ ok: boolean; status: number; detail: string }> {
  const res = await fetch(`${YOUTUBE_API_BASE}/videos?part=snippet`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: videoId,
      snippet: {
        title: metadata.title.slice(0, 100),
        description: metadata.description.slice(0, 5000),
        tags: metadata.tags.slice(0, 30),
        categoryId,
      },
    }),
  })
  const detail = await res.text().catch(() => '')
  return { ok: res.ok, status: res.status, detail: detail.slice(0, 500) }
}
