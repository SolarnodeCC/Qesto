/**
 * session-room-vote-flow.ts
 * Vote admission/mutation flow, presenter navigation (advance/back), copilot
 * question injection, and open-response sentiment analysis for SessionRoom.
 * Extracted from session-room-live-handlers.ts to keep files under 500 LOC.
 */

import {
  CLOSE_POLICY_VIOLATION,
  type LiveQuestion,
} from '../realtime'
import type { QuestionKind } from '../types'
import { writeEvent } from './observability'
import { applyVoteMutation, evaluateVoteAdmission } from './session-room-vote'
import { analyzeOpenResponseSentiment, SENTIMENT_COOLDOWN_MS } from './ai/sentiment'
import { sentimentContextFromMeta } from './ai/session-context'
import { flagOff } from './flags'
import { serverMessage, errorMessage, now } from './session-room-messages'
import {
  K_META,
  K_QUESTION,
  K_QUESTIONS,
  K_QUESTION_INDEX,
  K_PENDING_RESPONSES,
  K_COUNTS,
  K_VOTERS,
  K_ACTIVE_ENERGIZER,
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
import { canControlSession } from './session-room-presenter-init'

type PendingResponse = { id: string; voterId: string; text: string; submittedAt: number }

async function rejectIfEnergizingPhase(
  self: SessionRoomContext,
  ws: WebSocket,
): Promise<boolean> {
  const status = (await self.ctx.storage.get<string>(K_STATUS)) ?? 'live'
  if (status !== 'energizing') return false
  ws.send(errorMessage('energizing', 'Questions are not open yet — complete energizers first'))
  return true
}

// ── Presenter navigation ──────────────────────────────────────────────────
export async function handlePresenterAdvance(self: SessionRoomContext, ws: WebSocket, att: Attachment): Promise<void> {
  if (await rejectIfEnergizingPhase(self, ws)) return
  if (att.role !== 'presenter') {
    ws.send(errorMessage('forbidden', 'Only presenter can advance'))
    return
  }
  if (!canControlSession(att)) {
    ws.send(errorMessage('forbidden', 'Presenter role cannot advance this session'))
    return
  }
  const allQs = (await self.ctx.storage.get<LiveQuestion[]>(K_QUESTIONS)) ?? []
  const curIdx = (await self.ctx.storage.get<number>(K_QUESTION_INDEX)) ?? 0
  const nextIdx = curIdx + 1
  if (nextIdx >= allQs.length) {
    const doneMsg = serverMessage({ type: 'all_done', data: {}, timestamp: now() })
    for (const socket of self.ctx.getWebSockets()) {
      try { socket.send(doneMsg) } catch { /* ignore */ }
    }
    return
  }
  const nextQ = allQs[nextIdx]
  await self.ctx.storage.put(K_QUESTION_INDEX, nextIdx)
  await self.ctx.storage.put(K_QUESTION, nextQ)
  await self.ctx.storage.put(K_COUNTS, {} as Counts)
  await self.ctx.storage.put(K_VOTERS, {} as Votes)
  await self.ctx.storage.delete(K_ACTIVE_ENERGIZER)
  await self.ctx.storage.delete(K_SENTIMENT_MOOD)
  await self.ctx.storage.delete(K_SENTIMENT_LAST)
  self.resetVoters({})
  // VOTE-CORRUPTION (#538): clearing K_COUNTS in storage is not enough — the
  // in-memory tally cache (state._counts) survives navigation and would carry
  // the previous question's counts into the next question's first vote (and get
  // re-flushed to D1). Reset it atomically with the storage wipe.
  self.state._counts = {}
  const advanceMsg = serverMessage({
    type: 'question',
    data: { question: nextQ, index: nextIdx, total: allQs.length },
    timestamp: now(),
  })
  for (const socket of self.ctx.getWebSockets()) {
    try { socket.send(advanceMsg) } catch { /* ignore closed socket */ }
  }
}

export async function handlePresenterBack(self: SessionRoomContext, ws: WebSocket, att: Attachment): Promise<void> {
  if (await rejectIfEnergizingPhase(self, ws)) return
  if (att.role !== 'presenter') {
    ws.send(errorMessage('forbidden', 'Only presenter can go back'))
    return
  }
  if (!canControlSession(att)) {
    ws.send(errorMessage('forbidden', 'Presenter role cannot go back in this session'))
    return
  }
  const allQs = (await self.ctx.storage.get<LiveQuestion[]>(K_QUESTIONS)) ?? []
  const curIdx = (await self.ctx.storage.get<number>(K_QUESTION_INDEX)) ?? 0
  const prevIdx = curIdx - 1
  if (prevIdx < 0) {
    ws.send(errorMessage('noop', 'Already at first question'))
    return
  }
  const prevQ = allQs[prevIdx]
  await self.ctx.storage.put(K_QUESTION_INDEX, prevIdx)
  await self.ctx.storage.put(K_QUESTION, prevQ)
  await self.ctx.storage.put(K_COUNTS, {} as Counts)
  await self.ctx.storage.put(K_VOTERS, {} as Votes)
  self.resetVoters({})
  // VOTE-CORRUPTION (#538): also clear the in-memory tally cache — see
  // handlePresenterAdvance above.
  self.state._counts = {}
  const backMsg = serverMessage({
    type: 'question',
    data: { question: prevQ, index: prevIdx, total: allQs.length },
    timestamp: now(),
  })
  for (const socket of self.ctx.getWebSockets()) {
    try { socket.send(backMsg) } catch { /* ignore closed socket */ }
  }
}

// ── COPILOT-06: presenter injects a copilot-drafted question (ADR-0046) ────
// Additive on protocol v1 (ADR-0005): appends to the live question set so the
// presenter can advance to it. Best-effort D1 persistence keeps exports/recaps
// consistent; the live append is authoritative either way.
export async function handleAddQuestion(
  self: SessionRoomContext,
  ws: WebSocket,
  att: Attachment,
  data: { question: { kind: QuestionKind; prompt: string; options: { label: string }[] } },
): Promise<void> {
  if (!canControlSession(att)) {
    ws.send(errorMessage('forbidden', 'Presenter role cannot modify this session'))
    return
  }

  const q = data.question
  const newQuestion: LiveQuestion = {
    id: crypto.randomUUID(),
    kind: q.kind,
    prompt: q.prompt,
    options: q.options.map((o) => ({ id: crypto.randomUUID(), label: o.label })),
  }

  const allQs = (await self.ctx.storage.get<LiveQuestion[]>(K_QUESTIONS)) ?? []
  allQs.push(newQuestion)
  await self.ctx.storage.put(K_QUESTIONS, allQs)
  const position = allQs.length - 1

  const meta = await self.ctx.storage.get<Meta>(K_META)
  if (meta?.sessionId) {
    try {
      await self.env.DB.prepare(
        `INSERT INTO questions (id, session_id, position, kind, prompt, options_json, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
      )
        .bind(newQuestion.id, meta.sessionId, position, newQuestion.kind, newQuestion.prompt, JSON.stringify(newQuestion.options), now())
        .run()
    } catch {
      /* live state already updated; D1 persistence is best-effort */
    }
  }
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
  const applied = applyVoteMutation(voters, {
    questionKind: question.kind,
    votePolicy,
    voterId: att.voterId,
    optionId,
  })
  if (!applied.ok) {
    ws.send(errorMessage(applied.code, applied.message))
    return
  }
  const { countKey, countDecKey } = applied

  // Phase 2.2: Load and update counts in memory, buffer for later D1 flush.
  // Counts cache is maintained in-memory and synced to storage during flush.
  if (!self.state._counts) {
    self.state._counts = (await self.ctx.storage.get<Counts>(K_COUNTS)) ?? {}
  }
  const counts = self.state._counts
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
