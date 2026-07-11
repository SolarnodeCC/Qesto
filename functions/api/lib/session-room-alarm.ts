/**
 * session-room-alarm.ts
 * SessionRoom alarm handler: debounced results flush, R2 snapshot cadence,
 * ideate clustering, sentiment-analysis retry, energizer timeout, and fun-mode
 * question countdown. Extracted from SessionRoom.ts as part of the TD-01
 * decomposition. See TECH_DEBT_AUDIT_2026-05.md TD-01.
 */

import type { LiveQuestion } from '../realtime'
import type { PlanTier } from '../types'
import { writeEvent } from './observability'
import { analyzeOpenResponseSentiment } from './ai/sentiment'
import { sentimentContextFromMeta } from './ai/session-context'
import { serverMessage, now } from './session-room-messages'
import {
  K_META,
  K_QUESTION,
  K_COUNTS,
  K_SENTIMENT_MOOD,
  K_SENTIMENT_LAST,
  K_SENTIMENT_RETRY_QUEUE,
  K_SENTIMENT_RETRY_COUNT,
} from './session-room-storage-keys'
import {
  type Meta,
  type Counts,
  SENTIMENT_RETRY_DELAY_MS,
  FLUSH_INTERVAL_MS,
  SNAPSHOT_INTERVAL_MS,
} from './session-room-types'
import type { SessionRoomContext } from './session-room-context'

// ── Alarm = flush debounced results + fun-mode question timer ────────────
export async function runAlarm(self: SessionRoomContext): Promise<void> {
  const nowMs = now()

  // Phase 2.2: Flush votes if interval elapsed or on explicit flush request.
  if (self.state.flushScheduled && nowMs >= self.state.lastFlushAt + FLUSH_INTERVAL_MS) {
    await self.flushVotes()
  }

  // Phase 2.3: Snapshot DO state periodically to R2 for recovery.
  if (nowMs >= self.state.lastSnapshotAt + SNAPSHOT_INTERVAL_MS) {
    await self.snapshot()
    self.state.lastSnapshotAt = nowMs
  }

  await self.ideateHandler.runPendingCluster(nowMs)

  if (self.state.resultsDirty) {
    self.state.resultsDirty = false
    const counts = self.state._counts ?? (await self.ctx.storage.get<Counts>(K_COUNTS)) ?? {}
    const total = Object.values(counts).reduce((a, b) => a + b, 0)
    const msg = serverMessage({
      type: 'results',
      data: { counts, total },
      timestamp: nowMs,
    })
    for (const ws of self.ctx.getWebSockets()) {
      try { ws.send(msg) } catch { /* ignore */ }
    }
  }

  await processSentimentRetry(self, nowMs)

  // Energizer: flush any debounced answer broadcast, then timeout auto-complete
  // — both delegated to EnergizerHandler.
  await self.energizerHandler.flushPendingBroadcast()
  await self.energizerHandler.handleAlarmTimeout(nowMs)

  // Fun-mode: broadcast question_timeout when the countdown expires.
  const meta = await self.ctx.storage.get<Meta>(K_META)
  if (meta?.sessionMode === 'fun' && meta.questionExpiresAt) {
    if (meta.questionExpiresAt <= nowMs) {
      const question = await self.ctx.storage.get<LiveQuestion>(K_QUESTION)
      if (question) {
        const msg = serverMessage({
          type: 'question_timeout',
          data: { questionId: question.id },
          timestamp: nowMs,
        })
        for (const ws of self.ctx.getWebSockets()) {
          try { ws.send(msg) } catch { /* ignore */ }
        }
      }
      // Clear the expiry so it only fires once.
      delete meta.questionExpiresAt
      await self.ctx.storage.put(K_META, meta)
    } else {
      // Reschedule for the remaining time (results alarm may have fired early).
      await self.ctx.storage.setAlarm(meta.questionExpiresAt)
    }
  }
}

// Sentiment analysis retry: if a retry job is queued and due, process it.
async function processSentimentRetry(self: SessionRoomContext, nowMs: number): Promise<void> {
  const sentimentRetry = await self.ctx.storage.get<{
    responses: string[]
    sessionId: string
    teamId?: string
    plan?: PlanTier
    attempt: number
    enqueuedAt: number
  }>(K_SENTIMENT_RETRY_QUEUE)
  if (!sentimentRetry || sentimentRetry.enqueuedAt + SENTIMENT_RETRY_DELAY_MS > nowMs) return

  const meta = await self.ctx.storage.get<Meta>(K_META)
  if (!meta) return

  const ctx = sentimentContextFromMeta({
    sessionId: meta.sessionId,
    teamId: meta.teamId,
    plan: meta.plan,
    anonymity: meta.anonymity,
  })
  const result = await analyzeOpenResponseSentiment(self.env, ctx, sentimentRetry.responses)
  if (result.ok) {
    // Success: clear retry queue and update sentiment
    await self.ctx.storage.put(K_SENTIMENT_LAST, nowMs)
    await self.ctx.storage.put(K_SENTIMENT_MOOD, result)
    await self.ctx.storage.delete(K_SENTIMENT_RETRY_QUEUE)
    await self.ctx.storage.delete(K_SENTIMENT_RETRY_COUNT)
    writeEvent(self.env.METRICS_AE, {
      name: 'ai.sentiment_analysis',
      sessionId: meta.sessionId,
      teamId: meta.teamId,
      plan: meta.plan ?? 'free',
      count: result.sampleSize,
      detail: result.mood,
    })
    const msg = serverMessage({
      type: 'sentiment_signal',
      data: { mood: result.mood, sampleSize: result.sampleSize },
      timestamp: nowMs,
    })
    for (const ws of self.ctx.getWebSockets('role:presenter')) {
      try { ws.send(msg) } catch { /* ignore */ }
    }
    return
  }

  // circuit_breaker or exhausted transient failure: stop retrying.
  await self.ctx.storage.delete(K_SENTIMENT_RETRY_QUEUE)
  await self.ctx.storage.delete(K_SENTIMENT_RETRY_COUNT)
  writeEvent(self.env.METRICS_AE, {
    name: 'ai.sentiment_retry_exhausted',
    sessionId: meta.sessionId,
    teamId: meta.teamId,
    plan: meta.plan ?? 'free',
    detail: result.reason === 'circuit_breaker' ? 'circuit_breaker' : result.reason,
  })
}
