/**
 * Publisher — takes an approved `content_items` row and pushes it live.
 * LinkedIn: posts the body via the existing `publishUgcPost` (linkedin.ts).
 * YouTube: pushes generated metadata onto an already-uploaded video via
 * `videos.update` — requires `youtube_video_id` to already be set on the row
 * (the owner pastes the uploaded video's id before approving/publishing).
 */

import { createEncryptedTokenStore } from '../integrations/token-store'
import { MARKETING_TEAM_SCOPE } from './constants'
import {
  LINKEDIN_SERVICE,
  KV_ORG_URN,
  REFRESH_WINDOW_MS,
  publishUgcPost,
  refreshAccessToken as refreshLinkedInToken,
} from '../linkedin'
import * as youtube from './youtube'
import type { YouTubeMetadata } from './tone'
import { z } from 'zod'
import { decodeKvJson } from '../boundary-decode'

// Validate the stored YouTube metadata JSON at the boundary (HLT-031, #686)
// instead of `JSON.parse(row.metadata) as YouTubeMetadata`.
const YouTubeMetadataSchema = z.object({
  title: z.string(),
  description: z.string(),
  tags: z.array(z.string()),
}) satisfies z.ZodType<YouTubeMetadata>

export interface PublisherEnv {
  LINKEDIN_CLIENT_ID?: string
  LINKEDIN_CLIENT_SECRET?: string
  YOUTUBE_CLIENT_ID?: string
  YOUTUBE_CLIENT_SECRET?: string
  OAUTH_TOKEN_MEK?: string
  ENV?: string
  /** Non-secret org URN (linkedin-auth.ts writes it here, NOT to the encrypted token kv). */
  LINKEDIN_KV?: KVNamespace
}

interface ContentItemRow {
  id: string
  platform: 'linkedin' | 'youtube'
  status: string
  body: string | null
  metadata: string
  youtube_video_id: string | null
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export type PublishResult =
  | { ok: true; platformPostId: string }
  | { ok: false; reason: string }

async function markPublished(db: D1Database, id: string, platformPostId: string, nowMs: number): Promise<void> {
  await db
    .prepare(
      `UPDATE content_items SET status = 'published', platform_post_id = ?1, published_at = ?2, updated_at = ?2 WHERE id = ?3`,
    )
    .bind(platformPostId, nowMs, id)
    .run()
}

async function markFailed(db: D1Database, id: string, reason: string, nowMs: number): Promise<void> {
  await db
    .prepare(`UPDATE content_items SET status = 'failed', failure_reason = ?1, updated_at = ?2 WHERE id = ?3`)
    .bind(reason.slice(0, 1000), nowMs, id)
    .run()
}

export async function publishContentItem(
  env: PublisherEnv,
  db: D1Database,
  kv: KVNamespace,
  contentItemId: string,
  nowMs: number = Date.now(),
): Promise<PublishResult> {
  const row = await db
    .prepare(`SELECT id, platform, status, body, metadata, youtube_video_id FROM content_items WHERE id = ?1`)
    .bind(contentItemId)
    .first<ContentItemRow>()
  if (!row) return { ok: false, reason: 'content item not found' }
  if (row.status !== 'approved') return { ok: false, reason: `content item must be approved (status=${row.status})` }

  const store = createEncryptedTokenStore(kv, env)

  if (row.platform === 'linkedin') {
    if (!row.body) {
      const reason = 'missing body'
      await markFailed(db, row.id, reason, nowMs)
      return { ok: false, reason }
    }
    try {
      const stored = await store.getStoredToken(MARKETING_TEAM_SCOPE, LINKEDIN_SERVICE)
      if (!stored) throw new Error('LinkedIn not connected — run /linkedin-auth')

      let accessToken = stored.access_token
      const needsRefresh = stored.expires_at !== undefined && stored.expires_at - nowMs < REFRESH_WINDOW_MS
      if (needsRefresh) {
        if (!stored.refresh_token || !env.LINKEDIN_CLIENT_ID || !env.LINKEDIN_CLIENT_SECRET) {
          throw new Error('token refresh required but refresh_token or client credentials missing')
        }
        const refreshed = await refreshLinkedInToken(
          { LINKEDIN_CLIENT_ID: env.LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET: env.LINKEDIN_CLIENT_SECRET },
          stored.refresh_token,
        )
        if (!refreshed.refresh_token) refreshed.refresh_token = stored.refresh_token
        await store.storeToken(MARKETING_TEAM_SCOPE, LINKEDIN_SERVICE, refreshed)
        accessToken = refreshed.access_token
      }

      const orgUrn = await env.LINKEDIN_KV?.get(KV_ORG_URN)
      if (!orgUrn) throw new Error('no linkedin:org_urn configured (set on LINKEDIN_KV via /linkedin-auth)')

      const res = await publishUgcPost(accessToken, orgUrn, row.body)
      if (!res.ok) throw new Error(`LinkedIn ugcPosts HTTP ${res.status}: ${res.detail}`)

      // ugcPosts doesn't return the URN in the body by default; the x-restli id
      // header carries it in practice, but we don't depend on it — use a
      // synthetic marker so platform_post_id is always non-null on success.
      await markPublished(db, row.id, `linkedin:published:${nowMs}`, nowMs)
      return { ok: true, platformPostId: `linkedin:published:${nowMs}` }
    } catch (err) {
      const reason = errMsg(err)
      await markFailed(db, row.id, reason, nowMs)
      return { ok: false, reason }
    }
  }

  // YouTube
  if (!row.youtube_video_id) {
    const reason = 'youtube_video_id is required — paste the uploaded video ID before publishing'
    await markFailed(db, row.id, reason, nowMs)
    return { ok: false, reason }
  }

  try {
    const stored = await store.getStoredToken(MARKETING_TEAM_SCOPE, youtube.YOUTUBE_SERVICE)
    if (!stored) throw new Error('YouTube not connected — run /youtube-auth')

    let accessToken = stored.access_token
    const needsRefresh = stored.expires_at !== undefined && stored.expires_at - nowMs < REFRESH_WINDOW_MS
    if (needsRefresh) {
      if (!stored.refresh_token || !env.YOUTUBE_CLIENT_ID || !env.YOUTUBE_CLIENT_SECRET) {
        throw new Error('token refresh required but refresh_token or client credentials missing')
      }
      const refreshed = await youtube.refreshAccessToken(
        { YOUTUBE_CLIENT_ID: env.YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET: env.YOUTUBE_CLIENT_SECRET },
        stored.refresh_token,
      )
      if (!refreshed.refresh_token) refreshed.refresh_token = stored.refresh_token
      await store.storeToken(MARKETING_TEAM_SCOPE, youtube.YOUTUBE_SERVICE, refreshed)
      accessToken = refreshed.access_token
    }

    const metadata = decodeKvJson(row.metadata, YouTubeMetadataSchema)
    if (!metadata) throw new Error(`Malformed YouTube metadata for queue row ${row.id}`)
    const res = await youtube.publishMetadata(accessToken, row.youtube_video_id, metadata)
    if (!res.ok) throw new Error(`YouTube videos.update HTTP ${res.status}: ${res.detail}`)

    await markPublished(db, row.id, row.youtube_video_id, nowMs)
    return { ok: true, platformPostId: row.youtube_video_id }
  } catch (err) {
    const reason = errMsg(err)
    await markFailed(db, row.id, reason, nowMs)
    return { ok: false, reason }
  }
}
