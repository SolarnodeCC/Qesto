/**
 * session-room-vote-admission.ts
 * Vote admission + mutation flow for SessionRoom LIVE voting, plus the
 * open-response sentiment trigger that runs off the vote path. Pure decision
 * rules live in session-room-vote.ts; this module owns the DO side effects.
 * Renamed from session-room-vote-flow.ts (audit 2026-07-08: the old name hid
 * that presenter navigation and copilot injection also lived here — those now
 * sit in session-room-presenter-actions.ts).
 */

import {
  CLOSE_POLICY_VIOLATION,
  type LiveQuestion,
} from '../realtime'
import { writeEvent } from './observability'
import { applyVoteMutation, evaluateVoteAdmission } from './session-room-vote'
import { analyzeOpenResponseSentiment, SENTIMENT_COOLDOWN_MS } from './ai/sentiment'
import { sentimentContextFromMeta } from './ai/session-context'
import { flagOff } from './flags'
import { serverMessage, errorMessage, now } from './session-room-messages'
import {
  K_META,
  K_QUESTION,
  K_PENDING_RESPONSES,
  K_COUNTS,
  K_SENTIMENT_MOOD,
  K_SENTIMENT_LAST,
  K_SENTIMENT_RETRY_QUEUE,
  K_SENTIMENT_RETRY_COUNT,
  K_STATUS,
} from './session-room-storage-keys'
import {
  type Meta,
  type Counts,
  type Votes,
  type Attachment,
  SENTIMENT_RETRY_DELAY_MS,
  SENTIMENT_MAX_RETRIES,
  VOTE_BUCKET_CAPACITY,
  VOTE_BUCKET_REFILL_PER_SEC,
  FLUSH_THRESHOLD,
} from './session-room-types'
import type { SessionRoomContext } from './session-room-context'

type PendingResponse = { id: string; voterId: string; text: string; submittedAt: number }

/** Gate shared with presenter navigation: questions/votes are closed during ENERGIZING. */
export async function rejectIfEnergizingPhase(
  self: SessionRoomContext,
  ws: WebSocket,
): Promise<boolean> {
  const status = (await self.ctx.storage.get<string>(K_STATUS)) ?? 'live'
  if (status !== 'energizing') return false
  ws.send(errorMessage('energizing', 'Questions are not open yet — complete energizers first'))
  return true
}

// ── Voting ──────────────────────────────────────────────────────────────────
export async function handleVote(
  self: SessionRoomContext,
  ws: WebSocket,
  att: Attachment,
  data: { questionId?: string; optionId?: string },
): Promise<void> {
  if (await rejectIfEnergizingPhase(self, ws)) return
  const t0 = Date.now()
  const meta = await self.ctx.storage.get<Meta>(K_META)
  const question = await self.ctx.storage.get<LiveQuestion>(K_QUESTION)

  // Pure admission guard (token-bucket → paused → timer → question → option).
  // The DO owns the side effects; the decision logic lives in session-room-vote.
  const admission = evaluateVoteAdmission({
    bucket: att.bucket,
    bucketCapacity: VOTE_BUCKET_CAPACITY,
    bucketRefillPerSec: VOTE_BUCKET_REFILL_PER_SEC,
    paused: meta?.paused,
    questionExpiresAt: meta?.questionExpiresAt,
    nowMs: now(),
    question: question ?? undefined,
    data,
  })
  att.bucket = admission.bucket
  if (!admission.ok && admission.close) {
    // Token-bucket flood — emit contention metric and drop the connection.
    writeEvent(self.env.METRICS_AE, {
      name: 'ws.token_bucket_contention',
      sessionId: meta?.sessionId,
      count: self.ctx.getWebSockets().length,
    })
    ws.send(errorMessage(admission.code, admission.message))
    ws.close(CLOSE_POLICY_VIOLATION, 'vote flood')
    return
  }
  // Persist the consumed token bucket (matches historical serialize point).
  ws.serializeAttachment(att)
  if (!admission.ok) {
    ws.send(errorMessage(admission.code, admission.message))
    return
  }
  const optionId = admission.optionId
  // Redundant but gives TS the narrowing: admission.ok guarantees an active question.
  if (!question) return

  const votePolicy = meta?.votePolicy ?? 'once'

  // Load voters via shared in-memory reference. The mutation below contains
  // no await inside applyVoteMutation, so concurrent vote messages from the
  // same voter serialise naturally.
  const voters = await self.ensureVoters()

  // Phase 2.2: Load counts in memory first so the mutation can enforce the
  // per-question cardinality cap (#581). Counts cache is synced to storage on flush.
  if (!self.state._counts) {
    self.state._counts = (await self.ctx.storage.get<Counts>(K_COUNTS)) ?? {}
  }
  const counts = self.state._counts

  const applied = applyVoteMutation(voters, {
    questionKind: question.kind,
    votePolicy,
    voterId: att.voterId,
    optionId,
    counts,
  })
  if (!applied.ok) {
    ws.send(errorMessage(applied.code, applied.message))
    return
  }
  const { countKey, countDecKey } = applied

  if (countKey) counts[countKey] = (counts[countKey] ?? 0) + 1
  if (countDecKey) counts[countDecKey] = Math.max(0, (counts[countDecKey] ?? 1) - 1)

  // ENTERPRISE-POLISH §1c: buffer open responses when moderation is enabled.
  if (question.kind === 'open' && question.moderated) {
    // Revert the mutation applied above — the response goes to pending, not live.
    delete voters[att.voterId]
    if (countKey) counts[countKey] = Math.max(0, (counts[countKey] ?? 1) - 1)
    const pending = (await self.ctx.storage.get<PendingResponse[]>(K_PENDING_RESPONSES)) ?? []
    pending.push({ id: crypto.randomUUID(), voterId: att.voterId, text: optionId, submittedAt: Date.now() })
    await self.ctx.storage.put(K_PENDING_RESPONSES, pending)
    // Notify presenter only — voter gets a 'pending_moderation' ack.
    ws.send(JSON.stringify({ type: 'response_pending_moderation', data: { questionId: question.id } }))
    const pendingMsg = JSON.stringify({ type: 'pending_responses_updated', data: { count: pending.length } })
    for (const presWs of self.ctx.getWebSockets('role:presenter')) {
      try { presWs.send(pendingMsg) } catch { /* ignore */ }
    }
    return
  }

  // Phase 2.2: Buffer the vote for periodic D1 flush instead of immediate write.
  // Voters map is kept in-memory for real-time broadcasts; KV write is deferred.
  self.state.voteBuffer.push({
    sessionId: meta?.sessionId ?? '',
    questionId: question.id,
    voterId: att.voterId,
    optionId,
    submittedAt: Date.now(),
    // vote_policy='multi' change-your-answer: countDecKey is the option this
    // vote replaces. Carry it so the flush removes the stale persisted row
    // (otherwise the wider UNIQUE key would keep both → double-count).
    ...(countDecKey ? { supersedesOptionId: countDecKey } : {}),
  })

  // Schedule flush if threshold reached or interval elapsed.
  if (self.state.voteBuffer.length >= FLUSH_THRESHOLD) {
    await self.flushVotes()
  } else if (!self.state.flushScheduled) {
    self.scheduleFlush()
  }

  await self.scheduleResultsBroadcast()

  // OBS-VOTE-01: count = connected WebSocket participants at vote time,
  // enabling latency-vs-session-scale correlation in Analytics Engine.
  writeEvent(self.env.METRICS_AE, {
    name: 'ws.vote_submitted',
    sessionId: meta?.sessionId,
    teamId: meta?.teamId,
    plan: meta?.plan ?? 'free',
    durationMs: Date.now() - t0,
    count: self.ctx.getWebSockets().length,
    detail: att.colo ? `colo:${att.colo}` : undefined,
  })

  if (question.kind === 'open' && meta) {
    void maybeAnalyzeSentiment(self, meta, question.id, voters).catch(() => {})
  }
}

export async function maybeAnalyzeSentiment(
  self: SessionRoomContext,
  meta: Meta,
  _questionId: string,
  voters: Votes,
): Promise<void> {
  if (flagOff(self.env, 'SENTIMENT_ENABLED')) return
  if (meta.anonymity === 'zero_knowledge') return

  const last = (await self.ctx.storage.get<number>(K_SENTIMENT_LAST)) ?? 0
  if (Date.now() - last < SENTIMENT_COOLDOWN_MS) return

  const responses: string[] = []
  for (const texts of Object.values(voters)) {
    for (const t of texts) {
      if (typeof t === 'string' && t.trim()) responses.push(t.trim())
    }
  }
  if (responses.length < 5) return

  const ctx = sentimentContextFromMeta({
    sessionId: meta.sessionId,
    teamId: meta.teamId,
    plan: meta.plan,
    anonymity: meta.anonymity,
  })
  const result = await analyzeOpenResponseSentiment(self.env, ctx, responses)
  if (!result.ok) {
    // Log failure and queue retry if not circuit breaker
    writeEvent(self.env.METRICS_AE, {
      name: 'ai.sentiment_analysis_failed',
      sessionId: meta.sessionId,
      teamId: meta.teamId,
      plan: meta.plan ?? 'free',
      count: result.sampleSize,
      detail: result.reason,
    })

    // Queue retry unless circuit breaker is open
    if (result.reason !== 'circuit_breaker') {
      const retryCount = (await self.ctx.storage.get<number>(K_SENTIMENT_RETRY_COUNT)) ?? 0
      if (retryCount < SENTIMENT_MAX_RETRIES) {
        await self.ctx.storage.put(K_SENTIMENT_RETRY_QUEUE, {
          responses,
          sessionId: meta.sessionId,
          teamId: meta.teamId,
          plan: meta.plan,
          attempt: retryCount + 1,
          enqueuedAt: Date.now(),
        })
        await self.ctx.storage.put(K_SENTIMENT_RETRY_COUNT, retryCount + 1)
        await self.scheduleAlarm(Date.now() + SENTIMENT_RETRY_DELAY_MS)
      }
    }
    return
  }

  await self.ctx.storage.put(K_SENTIMENT_LAST, Date.now())
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
    timestamp: now(),
  })
  for (const ws of self.ctx.getWebSockets('role:presenter')) {
    try { ws.send(msg) } catch { /* ignore */ }
  }
}
