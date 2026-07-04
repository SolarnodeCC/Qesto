/**
 * Mention Monitor — cron polling of LinkedIn/Reddit/YouTube official APIs for
 * brand mentions. Each platform runs in its own try/catch so one outage never
 * blocks the others. Dedupe is via the `(platform, source_id)` unique index
 * on `mentions` (INSERT OR IGNORE) — no separate in-memory dedupe needed.
 * Cron: every 3h (wrangler.toml [triggers]).
 */

import { z } from 'zod'
import { ulid } from '../ulid'
import { decodeKvJson } from '../boundary-decode'
import { createEncryptedTokenStore } from '../integrations/token-store'
import { logCronRun } from './cron-log'
import { MARKETING_TEAM_SCOPE, MENTION_RETENTION_MS, type MarketingPlatform } from './constants'
import type { NormalizedMention } from './mention-types'
import * as reddit from './reddit'
import * as youtube from './youtube'

const JOB = 'mention-monitor'

export interface MentionMonitorEnv {
  REDDIT_CLIENT_ID?: string
  REDDIT_CLIENT_SECRET?: string
  YOUTUBE_CLIENT_ID?: string
  YOUTUBE_CLIENT_SECRET?: string
  OAUTH_TOKEN_MEK?: string
  ENV?: string
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

interface MonitorStateRow {
  cursor: string | null
}

async function pollPlatform(
  env: MentionMonitorEnv,
  db: D1Database,
  kv: KVNamespace,
  platform: MarketingPlatform,
  nowMs: number,
): Promise<{ fetched: number; inserted: number }> {
  if (platform === 'linkedin') {
    // LinkedIn's mention-search surface needs broader scopes than the
    // org-posting app currently requests; left as a no-op until that's granted.
    return { fetched: 0, inserted: 0 }
  }

  const store = createEncryptedTokenStore(kv, env)
  const service = platform === 'reddit' ? reddit.REDDIT_SERVICE : youtube.YOUTUBE_SERVICE
  const stored = await store.getStoredToken(MARKETING_TEAM_SCOPE, service)
  if (!stored) throw new Error(`not connected — run the OAuth flow at /${platform}-auth`)

  let accessToken = stored.access_token
  const needsRefresh = stored.expires_at !== undefined && stored.expires_at - nowMs < 7 * 24 * 60 * 60 * 1000
  if (needsRefresh && stored.refresh_token) {
    if (platform === 'reddit' && env.REDDIT_CLIENT_ID && env.REDDIT_CLIENT_SECRET) {
      const refreshed = await reddit.refreshAccessToken(
        { REDDIT_CLIENT_ID: env.REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET: env.REDDIT_CLIENT_SECRET },
        stored.refresh_token,
      )
      if (!refreshed.refresh_token) refreshed.refresh_token = stored.refresh_token
      await store.storeToken(MARKETING_TEAM_SCOPE, service, refreshed)
      accessToken = refreshed.access_token
    } else if (platform === 'youtube' && env.YOUTUBE_CLIENT_ID && env.YOUTUBE_CLIENT_SECRET) {
      const refreshed = await youtube.refreshAccessToken(
        { YOUTUBE_CLIENT_ID: env.YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET: env.YOUTUBE_CLIENT_SECRET },
        stored.refresh_token,
      )
      if (!refreshed.refresh_token) refreshed.refresh_token = stored.refresh_token
      await store.storeToken(MARKETING_TEAM_SCOPE, service, refreshed)
      accessToken = refreshed.access_token
    }
  }

  const stateRow = await db
    .prepare(`SELECT cursor FROM monitor_state WHERE platform = ?1`)
    .bind(platform)
    .first<MonitorStateRow>()
  const cursor = stateRow?.cursor ?? null

  let result: { mentions: NormalizedMention[]; nextCursor: string | null }
  if (platform === 'reddit') {
    const queriesRaw = await kv.get(reddit.KV_REDDIT_QUERIES)
    // Validate the KV-stored query list at the boundary (HLT-031, #686); fall
    // back to defaults on missing/malformed data.
    const queries = decodeKvJson(queriesRaw, z.array(z.string())) ?? reddit.DEFAULT_REDDIT_QUERIES
    result = await reddit.fetchMentions(accessToken, queries, cursor)
  } else {
    const queriesRaw = await kv.get(youtube.KV_YOUTUBE_QUERIES)
    const queries = decodeKvJson(queriesRaw, z.array(z.string())) ?? youtube.DEFAULT_YOUTUBE_QUERIES
    result = await youtube.fetchMentions(accessToken, queries, cursor)
  }

  let inserted = 0
  for (const m of result.mentions) {
    const res = await db
      .prepare(
        `INSERT OR IGNORE INTO mentions (id, platform, source_id, author, body, url, reviewed, fetched_at, posted_at, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, ?7, ?8, ?7)`,
      )
      .bind(ulid(), platform, m.source_id, m.author, m.body, m.url, nowMs, m.posted_at)
      .run()
    if (res.meta.changes && res.meta.changes > 0) inserted++
  }

  await db
    .prepare(
      `INSERT INTO monitor_state (platform, cursor, last_polled_at, last_error, updated_at)
       VALUES (?1, ?2, ?3, NULL, ?3)
       ON CONFLICT(platform) DO UPDATE SET cursor = ?2, last_polled_at = ?3, last_error = NULL, updated_at = ?3`,
    )
    .bind(platform, result.nextCursor, nowMs)
    .run()

  return { fetched: result.mentions.length, inserted }
}

export async function cleanupExpiredMentions(db: D1Database, nowMs: number = Date.now()): Promise<number> {
  const cutoff = nowMs - MENTION_RETENTION_MS
  const res = await db.prepare(`DELETE FROM mentions WHERE fetched_at < ?1`).bind(cutoff).run()
  return res.meta.changes ?? 0
}

export async function runMentionMonitor(
  env: MentionMonitorEnv,
  db: D1Database,
  kv: KVNamespace,
  nowMs: number = Date.now(),
): Promise<void> {
  const platforms: MarketingPlatform[] = ['linkedin', 'reddit', 'youtube']
  const summaries: string[] = []
  let anyFailed = false

  for (const platform of platforms) {
    try {
      const { fetched, inserted } = await pollPlatform(env, db, kv, platform, nowMs)
      summaries.push(`${platform}: fetched=${fetched} inserted=${inserted}`)
    } catch (err) {
      anyFailed = true
      const msg = errMsg(err)
      summaries.push(`${platform}: ERROR ${msg}`)
      console.error(`[${JOB}] ${platform} poll failed: ${msg}`)
      try {
        await db
          .prepare(
            `INSERT INTO monitor_state (platform, cursor, last_polled_at, last_error, updated_at)
             VALUES (?1, NULL, ?2, ?3, ?2)
             ON CONFLICT(platform) DO UPDATE SET last_error = ?3, updated_at = ?2`,
          )
          .bind(platform, nowMs, msg.slice(0, 500))
          .run()
      } catch {
        /* best-effort */
      }
    }
  }

  let deleted = 0
  try {
    deleted = await cleanupExpiredMentions(db, nowMs)
  } catch (err) {
    summaries.push(`retention-cleanup: ERROR ${errMsg(err)}`)
  }

  await logCronRun(db, JOB, anyFailed ? 'failure' : 'success', `${summaries.join(' | ')} | retention_deleted=${deleted}`, nowMs)
}
