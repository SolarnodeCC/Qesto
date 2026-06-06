/**
 * session-room-live-handlers.ts
 * WebSocket-layer handlers for SessionRoom: connection upgrade, voting,
 * presenter navigation, init snapshot, sentiment analysis, pause/resume,
 * response moderation, and participant broadcast. Extracted from SessionRoom.ts
 * as part of the TD-01 decomposition. See TECH_DEBT_AUDIT_2026-05.md TD-01.
 */

import {
  CLOSE_POLICY_VIOLATION,
  LIVE_PROTOCOL_VERSION,
  LIVE_PROTOCOL_VERSION_V2,
  liveProtocolFeatures,
  TOWNHALL_FEATURE,
  IDEATE_FEATURE,
  type LiveProtocolVersion,
  type LiveEnergizerState,
  type LiveQuestion,
  type LiveSessionSummary,
} from '../realtime'
import type { PlanTier, QuestionKind } from '../types'
import { PLAN_QUOTAS } from '../types'
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
} from './session-room-storage-keys'
import {
  type Meta,
  type Counts,
  type Votes,
  type Attachment,
  SENTIMENT_RETRY_DELAY_MS,
  SENTIMENT_MAX_RETRIES,
  PER_IP_CONCURRENT_CAP,
  VOTE_BUCKET_CAPACITY,
  VOTE_BUCKET_REFILL_PER_SEC,
  FLUSH_THRESHOLD,
} from './session-room-types'
import type { SessionRoomContext } from './session-room-context'

type PendingResponse = { id: string; voterId: string; text: string; submittedAt: number }

// ── /ws (WebSocket upgrade) ───────────────────────────────────────────────
export async function handleUpgrade(self: SessionRoomContext, req: Request): Promise<Response> {
  const status = (await self.ctx.storage.get<string>('status')) ?? null
  if (status !== 'live') {
    return new Response('Session not LIVE', { status: 409 })
  }
  const role = (req.headers.get('x-qesto-role') as 'presenter' | 'voter' | null) ?? 'voter'
  const voterId = req.headers.get('x-qesto-voter') ?? ''
  const ipHash = req.headers.get('x-qesto-ip-hash') ?? ''
  const permissionsHeader = req.headers.get('x-qesto-permissions')
  if (!voterId || !ipHash) {
    return new Response('Missing voter headers', { status: 400 })
  }

  // Per-IP concurrent connection cap (S5).
  if (role === 'voter') {
    const existing = self.ctx.getWebSockets(`ip:${ipHash}`)
    if (existing.length >= PER_IP_CONCURRENT_CAP) {
      return new Response('Too many connections from this IP', { status: 429 })
    }

    // Per-session participant capacity cap (plan-gated). Counts existing
    // voter sockets (tag role:voter) and rejects new joins at the limit.
    const meta = await self.ctx.storage.get<Meta>(K_META)
    const plan: PlanTier = meta?.plan ?? 'free'
    const maxParticipants = PLAN_QUOTAS[plan].maxParticipantsPerSession
    const currentVoters = self.ctx.getWebSockets('role:voter').length
    if (currentVoters >= maxParticipants) {
      writeEvent(self.env.METRICS_AE, {
        name: 'ws.capacity_exceeded',
        sessionId: meta?.sessionId,
        plan,
        count: currentVoters,
      })
      return new Response('Session capacity reached', { status: 429 })
    }

    // Per-IP per-minute rate limiting (SEC-01).
    const maxPerMin = parseInt(self.env.WS_CONNECT_PER_IP_PER_MIN ?? '15', 10) || 15
    const rateLimitExceeded = await self.rateLimiter.checkIpRateLimit(ipHash, maxPerMin)
    if (rateLimitExceeded) {
      return new Response('Rate limit exceeded for this IP', { status: 429 })
    }
  }

  const pair = new WebSocketPair()
  const [client, server] = Object.values(pair) as [WebSocket, WebSocket]

  const coloHeader = req.headers.get('x-qesto-colo')?.trim() || undefined
  const protocolVersionHeader = req.headers.get('x-qesto-protocol-version')?.trim()
  const protocolVersion = protocolVersionHeader ? parseInt(protocolVersionHeader, 10) : undefined
  const attachment: Attachment = {
    role,
    voterId,
    ipHash,
    bucket: { tokens: VOTE_BUCKET_CAPACITY, lastAt: now() },
    ...(coloHeader ? { colo: coloHeader } : {}),
    ...(protocolVersion ? { protocolVersion } : {}),
    ...(role === 'presenter' && permissionsHeader !== null
      ? { permissions: permissionsHeader.split(',').map((p) => p.trim()).filter(Boolean) }
      : {}),
  }
  server.serializeAttachment(attachment)
  self.ctx.acceptWebSocket(server, [`ip:${ipHash}`, `voter:${voterId}`, `role:${role}`])

  // Send init snapshot immediately.
  await sendInit(self, server, attachment)
  await broadcastParticipants(self)

  if (role === 'voter') {
    const meta = await self.ctx.storage.get<Meta>(K_META)
    const voterCount = self.ctx.getWebSockets('role:voter').length
    writeEvent(self.env.METRICS_AE, {
      name: 'ws.voter_joined',
      sessionId: meta?.sessionId,
      teamId: meta?.teamId,
      plan: meta?.plan ?? 'free',
      count: voterCount,
    })
  }
  if (attachment.protocolVersion === LIVE_PROTOCOL_VERSION_V2) {
    const meta = await self.ctx.storage.get<Meta>(K_META)
    writeEvent(self.env.METRICS_AE, {
      name: 'realtime.v2_negotiated',
      sessionId: meta?.sessionId,
      teamId: meta?.teamId,
      detail: attachment.colo ? `colo:${attachment.colo}` : 'v2',
    })
  }

  return new Response(null, { status: 101, webSocket: client })
}

// ── Presenter navigation ──────────────────────────────────────────────────
export async function handlePresenterAdvance(self: SessionRoomContext, ws: WebSocket, att: Attachment): Promise<void> {
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

export async function handlePresenterPauseResume(
  self: SessionRoomContext,
  ws: WebSocket,
  att: Attachment,
  paused: boolean,
): Promise<void> {
  if (att.role !== 'presenter') {
    ws.send(errorMessage('forbidden', paused ? 'Only presenter can pause' : 'Only presenter can resume'))
    return
  }
  if (!canControlSession(att)) {
    ws.send(
      errorMessage('forbidden', paused ? 'Presenter role cannot pause this session' : 'Presenter role cannot resume this session'),
    )
    return
  }
  await setPaused(self, paused)
}

// ── Voting ──────────────────────────────────────────────────────────────────
export async function handleVote(
  self: SessionRoomContext,
  ws: WebSocket,
  att: Attachment,
  data: { questionId?: string; optionId?: string },
): Promise<void> {
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

// ── Init snapshot ─────────────────────────────────────────────────────────
export async function sendInit(self: SessionRoomContext, ws: WebSocket, att: Attachment): Promise<void> {
  const meta = await self.ctx.storage.get<Meta>(K_META)
  if (!meta) {
    ws.send(errorMessage('not_initialised', 'Session has not been initialised'))
    return
  }
  const question = (await self.ctx.storage.get<LiveQuestion>(K_QUESTION)) ?? null
  const allQs = (await self.ctx.storage.get<LiveQuestion[]>(K_QUESTIONS)) ?? []
  const questionIndex = (await self.ctx.storage.get<number>(K_QUESTION_INDEX)) ?? 0
  // Phase 2.2: Prefer in-memory cache for eventual consistency during buffering
  const counts = self.state._counts ?? (await self.ctx.storage.get<Counts>(K_COUNTS)) ?? {}
  const energizer = (await self.ctx.storage.get<LiveEnergizerState>(K_ACTIVE_ENERGIZER)) ?? null
  const sentiment =
    att.role === 'presenter'
      ? ((await self.ctx.storage.get<{ mood: 'positive' | 'neutral' | 'concerning'; sampleSize: number }>(
          K_SENTIMENT_MOOD,
        )) ?? null)
      : null
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  const session: LiveSessionSummary = {
    id: meta.sessionId,
    code: meta.code,
    title: meta.title,
    status: 'live',
    votePolicy: meta.votePolicy,
    sessionMode: meta.sessionMode,
    ...(meta.anonymity ? { anonymity: meta.anonymity } : {}),
  }
  const pv = (att.protocolVersion ?? LIVE_PROTOCOL_VERSION) as unknown as LiveProtocolVersion
  const isTownhall = !!meta.townhallModeration
  const isIdeate = meta.sessionMode === 'ideate'
  let features = liveProtocolFeatures(pv)
  if (isTownhall) features = [...features, TOWNHALL_FEATURE]
  if (isIdeate) features = [...features, IDEATE_FEATURE]
  // ENTERPRISE-POLISH s2a: detect presenter reconnect.
  // If this is a presenter and at least one other presenter WS is already open
  // (or the session was started by this user), flag the init so the frontend
  // can auto-route back to the run screen.
  const isPresenterReconnect =
    att.role === 'presenter' &&
    meta.ownerId === att.voterId &&
    self.ctx.getWebSockets('role:presenter').some((s) => s !== ws)
    // Also true on first reconnect after hibernation (no open sockets yet):
    // we rely on ownerId match as the signal in that case too.
    || (att.role === 'presenter' && meta.ownerId === att.voterId &&
        self.ctx.getWebSockets('role:presenter').length === 0 &&
        (await self.ctx.storage.get<number>('presenter_first_connected')) !== undefined)

  // Record that a presenter has connected at least once
  if (att.role === 'presenter' && meta.ownerId === att.voterId) {
    await self.ctx.storage.put('presenter_first_connected', Date.now(), { allowConcurrency: true })
  }

  ws.send(
    serverMessage({
      type: 'init',
      data: {
        session,
        role: att.role,
        voterId: att.voterId,
        protocolVersion: pv,
        features,
        question,
        questionIndex,
        questionTotal: allQs.length,
        results: { counts, total },
        participants: self.ctx.getWebSockets().length,
        energizer,
        expiresAt: meta.questionExpiresAt ?? null,
        sentiment,
        ...(isPresenterReconnect ? { presenterReconnect: true } : {}),
      },
      timestamp: now(),
    }),
  )
  // TOWNHALL (ADR-0044): the board is a separate persistent surface — follow `init`
  // with a full `townhall_state` snapshot scoped to this connection's role.
  if (isTownhall) await self.townhallHandler.sendSnapshot(ws, att, meta.townhallModeration!)
  if (meta.sessionMode === 'retro') await self.retroHandler.sendSnapshot(ws, att)
  if (meta.sessionMode === 'ideate') await self.ideateHandler.sendSnapshot(ws, att)
}

export async function setPaused(self: SessionRoomContext, paused: boolean): Promise<void> {
  const meta = await self.ctx.storage.get<Meta>(K_META)
  if (!meta) return
  await self.ctx.storage.put(K_META, { ...meta, paused })
  const type = paused ? 'session_paused' : 'session_resumed'
  const msg = serverMessage({ type, data: {}, timestamp: now() })
  for (const ws of self.ctx.getWebSockets()) {
    try { ws.send(msg) } catch { /* closed socket */ }
  }
}

// ── Response moderation handlers (ENTERPRISE-POLISH §1c) ──────────────────
export async function handleApproveResponse(
  self: SessionRoomContext,
  ws: WebSocket,
  att: Attachment,
  data: { questionId: string; responseId: string },
): Promise<void> {
  if (att.role !== 'presenter') {
    ws.send(errorMessage('forbidden', 'Only presenter can approve responses'))
    return
  }
  const question = await self.ctx.storage.get<LiveQuestion>(K_QUESTION)
  if (!question || question.id !== data.questionId) {
    ws.send(errorMessage('out_of_date', 'Question has changed'))
    return
  }
  const pending = (await self.ctx.storage.get<PendingResponse[]>(K_PENDING_RESPONSES)) ?? []
  const response = pending.find((r) => r.id === data.responseId)
  if (!response) {
    ws.send(errorMessage('not_found', 'Response not found in moderation queue'))
    return
  }
  // Apply to live voters
  const voters = await self.ensureVoters()
  voters[response.voterId] = [response.text]
  const counts = (await self.ctx.storage.get<Counts>(K_COUNTS)) ?? {}
  counts[response.text] = (counts[response.text] ?? 0) + 1
  // Remove from pending
  const nextPending = pending.filter((r) => r.id !== data.responseId)
  await self.ctx.storage.put(K_VOTERS, voters)
  await self.ctx.storage.put(K_COUNTS, counts)
  await self.ctx.storage.put(K_PENDING_RESPONSES, nextPending)
  await self.scheduleResultsBroadcast()
  // Notify presenter of updated queue size
  ws.send(JSON.stringify({ type: 'pending_responses_updated', data: { count: nextPending.length } }))
}

export async function handleRejectResponse(
  self: SessionRoomContext,
  ws: WebSocket,
  att: Attachment,
  data: { questionId: string; responseId: string },
): Promise<void> {
  if (att.role !== 'presenter') {
    ws.send(errorMessage('forbidden', 'Only presenter can reject responses'))
    return
  }
  const pending = (await self.ctx.storage.get<PendingResponse[]>(K_PENDING_RESPONSES)) ?? []
  const nextPending = pending.filter((r) => r.id !== data.responseId)
  if (nextPending.length === pending.length) {
    ws.send(errorMessage('not_found', 'Response not found in moderation queue'))
    return
  }
  await self.ctx.storage.put(K_PENDING_RESPONSES, nextPending)
  ws.send(JSON.stringify({ type: 'pending_responses_updated', data: { count: nextPending.length } }))
}

export function canControlSession(att: Attachment): boolean {
  if (att.role !== 'presenter') return false
  return att.permissions === undefined || att.permissions.includes('session:launch') || att.permissions.includes('session:close')
}

export async function broadcastParticipants(self: SessionRoomContext): Promise<void> {
  const count = self.ctx.getWebSockets().length
  const msg = serverMessage({
    type: 'participants',
    data: { count },
    timestamp: now(),
  })
  for (const ws of self.ctx.getWebSockets()) {
    try { ws.send(msg) } catch { /* ignore */ }
  }
}
