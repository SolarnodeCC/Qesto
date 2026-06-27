/**
 * Proactive OAuth token refresh (daily cron) + dashboard snapshot for the
 * three marketing platforms. Mirrors the LinkedIn scheduler's proactive
 * refresh-window logic, generalized across platforms.
 */

import { createEncryptedTokenStore } from '../integrations/token-store'
import { MARKETING_TEAM_SCOPE } from './constants'
import { LINKEDIN_SERVICE, REFRESH_WINDOW_MS, refreshAccessToken as refreshLinkedInToken } from '../linkedin'
import * as reddit from './reddit'
import * as youtube from './youtube'
import { logCronRun } from './cron-log'

const JOB = 'oauth-token-refresh'

export interface TokenRefreshEnv {
  LINKEDIN_CLIENT_ID?: string
  LINKEDIN_CLIENT_SECRET?: string
  REDDIT_CLIENT_ID?: string
  REDDIT_CLIENT_SECRET?: string
  YOUTUBE_CLIENT_ID?: string
  YOUTUBE_CLIENT_SECRET?: string
  OAUTH_TOKEN_MEK?: string
  ENV?: string
}

type Platform = 'linkedin' | 'reddit' | 'youtube'

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

async function upsertStatus(
  db: D1Database,
  platform: Platform,
  connected: boolean,
  expiresAt: number | null,
  lastRefreshedAt: number | null,
  lastRefreshError: string | null,
  nowMs: number,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO oauth_token_status (platform, connected, expires_at, last_refreshed_at, last_refresh_error, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)
       ON CONFLICT(platform) DO UPDATE SET
         connected = ?2, expires_at = ?3, last_refreshed_at = ?4, last_refresh_error = ?5, updated_at = ?6`,
    )
    .bind(platform, connected ? 1 : 0, expiresAt, lastRefreshedAt, lastRefreshError, nowMs)
    .run()
}

export async function refreshAllTokens(
  env: TokenRefreshEnv,
  db: D1Database,
  kv: KVNamespace,
  nowMs: number = Date.now(),
): Promise<void> {
  const store = createEncryptedTokenStore(kv, env)
  const summaries: string[] = []
  let anyFailed = false

  const platforms: Array<{ platform: Platform; service: string }> = [
    { platform: 'linkedin', service: LINKEDIN_SERVICE },
    { platform: 'reddit', service: reddit.REDDIT_SERVICE },
    { platform: 'youtube', service: youtube.YOUTUBE_SERVICE },
  ]

  for (const { platform, service } of platforms) {
    try {
      const stored = await store.getStoredToken(MARKETING_TEAM_SCOPE, service)
      if (!stored) {
        await upsertStatus(db, platform, false, null, null, null, nowMs)
        summaries.push(`${platform}: not connected`)
        continue
      }

      const needsRefresh = stored.expires_at !== undefined && stored.expires_at - nowMs < REFRESH_WINDOW_MS
      if (!needsRefresh) {
        await upsertStatus(db, platform, true, stored.expires_at ?? null, stored.stored_at, null, nowMs)
        summaries.push(`${platform}: ok, expires_at=${stored.expires_at ?? 'n/a'}`)
        continue
      }

      if (!stored.refresh_token) {
        await upsertStatus(db, platform, true, stored.expires_at ?? null, null, 'near expiry, no refresh_token', nowMs)
        summaries.push(`${platform}: near expiry, no refresh_token`)
        anyFailed = true
        continue
      }

      let refreshed
      if (platform === 'linkedin' && env.LINKEDIN_CLIENT_ID && env.LINKEDIN_CLIENT_SECRET) {
        refreshed = await refreshLinkedInToken(
          { LINKEDIN_CLIENT_ID: env.LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET: env.LINKEDIN_CLIENT_SECRET },
          stored.refresh_token,
        )
      } else if (platform === 'reddit' && env.REDDIT_CLIENT_ID && env.REDDIT_CLIENT_SECRET) {
        refreshed = await reddit.refreshAccessToken(
          { REDDIT_CLIENT_ID: env.REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET: env.REDDIT_CLIENT_SECRET },
          stored.refresh_token,
        )
      } else if (platform === 'youtube' && env.YOUTUBE_CLIENT_ID && env.YOUTUBE_CLIENT_SECRET) {
        refreshed = await youtube.refreshAccessToken(
          { YOUTUBE_CLIENT_ID: env.YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET: env.YOUTUBE_CLIENT_SECRET },
          stored.refresh_token,
        )
      } else {
        throw new Error('missing client credentials for refresh')
      }

      if (!refreshed.refresh_token) refreshed.refresh_token = stored.refresh_token
      await store.storeToken(MARKETING_TEAM_SCOPE, service, refreshed)
      const expiresAt = refreshed.expires_in ? nowMs + refreshed.expires_in * 1000 : null
      await upsertStatus(db, platform, true, expiresAt, nowMs, null, nowMs)
      summaries.push(`${platform}: refreshed`)
    } catch (err) {
      anyFailed = true
      const msg = errMsg(err)
      summaries.push(`${platform}: ERROR ${msg}`)
      await upsertStatus(db, platform, true, null, null, msg.slice(0, 500), nowMs).catch(() => undefined)
    }
  }

  await logCronRun(db, JOB, anyFailed ? 'failure' : 'success', summaries.join(' | '), nowMs)
}

export interface TokenStatusSnapshotRow {
  platform: Platform
  connected: number
  expires_at: number | null
  last_refreshed_at: number | null
  last_refresh_error: string | null
  updated_at: number
}

export async function getTokenStatusSnapshot(db: D1Database): Promise<TokenStatusSnapshotRow[]> {
  const res = await db.prepare(`SELECT * FROM oauth_token_status ORDER BY platform`).all<TokenStatusSnapshotRow>()
  return res.results ?? []
}
