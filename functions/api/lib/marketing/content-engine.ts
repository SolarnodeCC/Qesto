/**
 * Content Engine — cron-driven AI draft generation for the marketing content
 * pipeline. Tue/Thu/Sat 06:00 UTC (wrangler.toml [triggers]). For every
 * `content_calendar` row due (status='planned', scheduled_for <= now):
 *   1. Build the platform-specific prompt (tone.ts).
 *   2. Generate via Workers AI.
 *   3. Parse + validate the output shape.
 *   4. Insert a `content_items` draft row.
 *   5. Mark the calendar slot 'generated'.
 * Per-item failures are logged and skipped — one bad generation never blocks
 * the rest of the run (no retry; the operator can reschedule the slot).
 */

import { runAI, envWithAI } from '../ai/ai-gateway'
import { ulid } from '../ulid'
import { acquireLock, releaseLock, recordLockRun } from './engine-lock'
import { logCronRun } from './cron-log'
import { buildLinkedInPrompt, buildYouTubePrompt, parseYouTubeResponse } from './tone'
import { clampPost } from '../linkedin'

const JOB = 'content-engine'
const LOCK_TTL_MS = 30 * 60 * 1000

const LINKEDIN_MODEL = '@cf/meta/llama-3.1-8b-instruct'
const YOUTUBE_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast'

interface CalendarRow {
  id: string
  platform: 'linkedin' | 'youtube'
  topic: string
  video_asset_id: string | null
}

interface VideoAssetTitleRow {
  title: string
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export async function runContentEngine(
  db: D1Database,
  ai: Ai,
  kv: KVNamespace,
  nowMs: number = Date.now(),
): Promise<{ generated: number; skipped: number; failed: number }> {
  const got = await acquireLock(kv, JOB, LOCK_TTL_MS)
  if (!got) {
    console.log(`[${JOB}] lock held — skipping this invocation`)
    return { generated: 0, skipped: 0, failed: 0 }
  }

  let generated = 0
  let skipped = 0
  let failed = 0
  const errors: string[] = []

  try {
    const due = await db
      .prepare(
        `SELECT id, platform, topic, video_asset_id FROM content_calendar
         WHERE status = 'planned' AND scheduled_for <= ?1
         ORDER BY scheduled_for ASC`,
      )
      .bind(nowMs)
      .all<CalendarRow>()

    for (const row of due.results ?? []) {
      try {
        if (row.platform === 'linkedin') {
          const { system, user } = buildLinkedInPrompt(row.topic, 'en')
          const result = (await runAI(envWithAI(ai), LINKEDIN_MODEL, {
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: user },
            ],
          })) as { response?: string }
          const body = clampPost(result.response ?? '')
          if (!body) throw new Error('empty AI response')

          await db
            .prepare(
              `INSERT INTO content_items
                 (id, content_calendar_id, platform, status, body, metadata, generated_at, created_at, updated_at)
               VALUES (?1, ?2, 'linkedin', 'draft', ?3, '{}', ?4, ?4, ?4)`,
            )
            .bind(ulid(), row.id, body, nowMs)
            .run()
        } else {
          let videoTitle: string | undefined
          if (row.video_asset_id) {
            const v = await db
              .prepare(`SELECT title FROM video_assets WHERE id = ?1`)
              .bind(row.video_asset_id)
              .first<VideoAssetTitleRow>()
            videoTitle = v?.title
          }
          const { system, user } = buildYouTubePrompt(row.topic, videoTitle)
          const result = (await runAI(envWithAI(ai), YOUTUBE_MODEL, {
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: user },
            ],
          })) as { response?: string }
          const parsed = parseYouTubeResponse(result.response ?? '')
          if (!parsed) throw new Error('malformed YouTube AI response (failed JSON+delimiter parse)')

          await db
            .prepare(
              `INSERT INTO content_items
                 (id, content_calendar_id, platform, status, script, metadata, video_asset_id, generated_at, created_at, updated_at)
               VALUES (?1, ?2, 'youtube', 'draft', ?3, ?4, ?5, ?6, ?6, ?6)`,
            )
            .bind(ulid(), row.id, parsed.script, JSON.stringify(parsed.metadata), row.video_asset_id, nowMs)
            .run()
        }

        await db
          .prepare(`UPDATE content_calendar SET status = 'generated', updated_at = ?1 WHERE id = ?2`)
          .bind(nowMs, row.id)
          .run()
        generated++
      } catch (err) {
        failed++
        const msg = `calendar row ${row.id} (${row.platform} "${row.topic}"): ${errMsg(err)}`
        errors.push(msg)
        console.error(`[${JOB}] ${msg}`)
      }
    }

    skipped = (due.results?.length ?? 0) - generated - failed

    await recordLockRun(db, JOB, failed > 0 && generated === 0 ? 'failure' : 'success', nowMs)
    await logCronRun(
      db,
      JOB,
      failed > 0 && generated === 0 ? 'failure' : 'success',
      `generated=${generated} skipped=${skipped} failed=${failed}${errors.length ? ` errors=${errors.join('; ')}` : ''}`,
      nowMs,
    )
    return { generated, skipped, failed }
  } finally {
    await releaseLock(kv, JOB)
  }
}
