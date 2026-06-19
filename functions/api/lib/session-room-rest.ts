/**
 * session-room-rest.ts
 * REST (DO fetch) handlers for SessionRoom: /init, /close, /transition-to-live,
 * /state, /copilot/snapshot. Extracted from SessionRoom.ts as part of the TD-01
 * decomposition. See TECH_DEBT_AUDIT_2026-05.md TD-01.
 */

import { CLOSE_NORMAL, townhallEnabled, type LiveEnergizerState, type LiveQuestion } from '../realtime'
import type { VotePolicy, SessionMode, PlanTier, Anonymity, TownhallModeration } from '../types'
import { logEvent } from './log'
import { TOWNHALL_KEYS } from './session-room-townhall'
import { serverMessage, now } from './session-room-messages'
import {
  K_META,
  K_QUESTION,
  K_QUESTIONS,
  K_QUESTION_INDEX,
  K_COUNTS,
  K_VOTERS,
  K_STATUS,
  K_ACTIVE_ENERGIZER,
  K_SENTIMENT_MOOD,
} from './session-room-storage-keys'
import { type Meta, type Counts, type Votes, FUN_MODE_QUESTION_MS } from './session-room-types'
import type { SessionRoomContext } from './session-room-context'

// ── /init ─────────────────────────────────────────────────────────────────
export async function handleInit(self: SessionRoomContext, req: Request): Promise<Response> {
  const body = (await req.json().catch(() => null)) as
    | {
        sessionId?: string
        ownerId?: string
        teamId?: string
        code?: string
        title?: string
        question?: LiveQuestion | null
        questions?: LiveQuestion[]
        votePolicy?: VotePolicy
        sessionMode?: SessionMode
        anonymity?: Anonymity
        plan?: PlanTier
        townhallModeration?: TownhallModeration
        retroDotVoteLimit?: number
        retroCarriedActions?: string[]
        ideateDotVoteLimit?: number
        ideateClusterDebounceMs?: number
        initialStatus?: 'energizing' | 'live'
      }
    | null

  const status = (await self.ctx.storage.get<string>(K_STATUS)) ?? null

  // Phase 2.3: If DO was evicted mid-session, attempt to hydrate from R2 snapshot.
  if (status === null && body?.sessionId) {
    // Temporarily set meta for hydration to work.
    const tempMeta: Meta = { sessionId: body.sessionId, ownerId: '', code: '', title: '', startedAt: 0, votePolicy: 'once', sessionMode: 'reflection' }
    await self.ctx.storage.put(K_META, tempMeta)
    await self.hydrate()
  }

  const currentStatus = (await self.ctx.storage.get<string>(K_STATUS)) ?? null
  if (currentStatus === 'live' || currentStatus === 'energizing' || currentStatus === 'closed') {
    return self.jsonError(409, 'already_initialised', 'Session already initialised')
  }
  if (!body || !body.sessionId || !body.ownerId || !body.code || !body.title) {
    return self.jsonError(400, 'bad_request', 'Missing init fields')
  }
  const nowMs = now()
  const sessionMode: SessionMode = body.sessionMode ?? 'reflection'
  const isTownhall = sessionMode === 'townhall' && townhallEnabled(self.env)
  const isRetro = sessionMode === 'retro'
  const isIdeate = sessionMode === 'ideate'
  const meta: Meta = {
    sessionId: body.sessionId,
    ownerId: body.ownerId,
    ...(body.teamId ? { teamId: body.teamId } : {}),
    code: body.code,
    title: body.title,
    startedAt: nowMs,
    votePolicy: body.votePolicy ?? 'once',
    sessionMode,
    ...(body.anonymity ? { anonymity: body.anonymity } : {}),
    ...(body.plan ? { plan: body.plan } : {}),
    ...(isTownhall ? { townhallModeration: body.townhallModeration ?? 'pre' } : {}),
    ...(isRetro ? { retroDotVoteLimit: body.retroDotVoteLimit ?? 3 } : {}),
    ...(sessionMode === 'fun' ? { questionExpiresAt: nowMs + FUN_MODE_QUESTION_MS } : {}),
  }
  await self.ctx.storage.put(K_META, meta)
  if (isRetro) {
    await self.retroHandler.seedBoard(body.retroDotVoteLimit ?? 3, body.retroCarriedActions ?? [])
  }
  if (isIdeate) {
    await self.ideateHandler.seedBoard(body.ideateDotVoteLimit ?? 5, body.ideateClusterDebounceMs ?? 3000)
  }
  if (isTownhall) {
    // Seed an empty persistent board. Items/upvoters are point-addressable keys
    // written on demand; the index + spotlight + rev are the board's spine.
    await self.ctx.storage.put(TOWNHALL_KEYS.index, [] as string[])
    await self.ctx.storage.put(TOWNHALL_KEYS.spotlight, null)
    await self.ctx.storage.put(TOWNHALL_KEYS.rev, 0)
  }
  await self.ctx.storage.put(K_STATUS, body.initialStatus === 'energizing' ? 'energizing' : 'live')
  await self.ctx.storage.put(K_COUNTS, {} as Counts)
  await self.ctx.storage.put(K_VOTERS, {} as Votes)
  await self.ctx.storage.delete(K_ACTIVE_ENERGIZER)
  self.resetVoters({})
  const allQuestions: LiveQuestion[] = body.questions ?? (body.question ? [body.question] : [])
  await self.ctx.storage.put(K_QUESTIONS, allQuestions)
  await self.ctx.storage.put(K_QUESTION_INDEX, 0)
  if (body.initialStatus === 'energizing') {
    // Questions are queued in storage but not exposed until transition-to-live.
    await self.ctx.storage.delete(K_QUESTION)
  } else if (allQuestions.length > 0) {
    await self.ctx.storage.put(K_QUESTION, allQuestions[0])
  }
  if (sessionMode === 'fun' && meta.questionExpiresAt) {
    await self.scheduleAlarm(meta.questionExpiresAt)
  }
  return self.jsonOk({ initialised: true })
}

// ── /close ──────────────────────────────────────────────────────────────────
export async function handleClose(self: SessionRoomContext): Promise<Response> {
  // Phase 2.2: Flush any remaining buffered votes before closing.
  await self.flushVotes()

  const status = (await self.ctx.storage.get<string>(K_STATUS)) ?? null
  if (status !== 'live' && status !== 'energizing') {
    return self.jsonError(409, 'not_live', 'Session is not active')
  }
  // Use cached counts if available, otherwise load from storage.
  const counts = self.state._counts ?? (await self.ctx.storage.get<Counts>(K_COUNTS)) ?? {}
  const votes = await self.ensureVoters()
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  const msg = serverMessage({
    type: 'session_closed',
    data: { counts, total },
    timestamp: now(),
  })
  for (const ws of self.ctx.getWebSockets()) {
    try {
      ws.send(msg)
      ws.close(CLOSE_NORMAL, 'session closed')
    } catch {
      /* ignore */
    }
  }
  await self.ctx.storage.put(K_STATUS, 'closed')

  // Phase 2.3: Take final snapshot before session closes.
  await self.snapshot()
  // TOWNHALL (ADR-0044): persist the board to D1 on close — the export + GDPR-erasure tier.
  const meta = await self.ctx.storage.get<Meta>(K_META)
  if (meta?.townhallModeration) {
    try {
      await self.townhallHandler.persistBoard(meta.sessionId, now())
    } catch (err) {
      logEvent({ event: 'townhall.persist_failed', sessionId: meta.sessionId, err: String(err) })
    }
  }
  const questionId = (await self.ctx.storage.get<LiveQuestion>(K_QUESTION))?.id ?? null
  // Flatten voterId → optionId[] into one row per (voter, optionId) so the
  // D1 schema collapses duplicate voter rows via INSERT OR IGNORE. For kinds
  // where one voter can legitimately submit multiple entries (multi_select,
  // upvote, word_cloud) each entry is emitted separately.
  const voteList = Object.entries(votes).flatMap(([voterId, optionIds]) =>
    optionIds.map((optionId) => ({ voterId, optionId })),
  )
  let retroActionItems: string[] = []
  let retroStats: { wentWell: number; didntGoWell: number; actions: number; totalCards: number } | undefined
  if (meta?.sessionMode === 'retro') {
    try {
      retroActionItems = await self.retroHandler.collectActionItemsForWorkspace()
      retroStats = await self.retroHandler.collectStatsForTrend()
    } catch (err) {
      logEvent({ event: 'retro.collect_actions_failed', sessionId: meta.sessionId, err: String(err) })
    }
  }
  return self.jsonOk({ counts, total, votes: voteList, questionId, retroActionItems, retroStats })
}

// ── /transition-to-live ──────────────────────────────────────────────────────
// Transitions session from ENERGIZING to LIVE. Broadcast update to all clients.
export async function handleTransitionToLive(self: SessionRoomContext): Promise<Response> {
  const status = (await self.ctx.storage.get<string>(K_STATUS)) ?? null
  if (status !== 'energizing') {
    return self.jsonOk({ transitioned: false })
  }
  const allQs = (await self.ctx.storage.get<LiveQuestion[]>(K_QUESTIONS)) ?? []
  const firstQ = allQs[0] ?? null
  await self.ctx.storage.put(K_STATUS, 'live')
  await self.ctx.storage.put(K_COUNTS, {} as Counts)
  await self.ctx.storage.put(K_VOTERS, {} as Votes)
  self.state._counts = {}
  self.resetVoters({})
  if (firstQ) {
    await self.ctx.storage.put(K_QUESTION_INDEX, 0)
    await self.ctx.storage.put(K_QUESTION, firstQ)
  }
  const completeMsg = serverMessage({
    type: 'session_energizing_complete',
    data: {},
    timestamp: now(),
  })
  for (const ws of self.ctx.getWebSockets()) {
    try {
      ws.send(completeMsg)
    } catch {
      /* ignore */
    }
  }
  if (firstQ) {
    const questionMsg = serverMessage({
      type: 'question',
      data: { question: firstQ, index: 0, total: allQs.length },
      timestamp: now(),
    })
    for (const ws of self.ctx.getWebSockets()) {
      try {
        ws.send(questionMsg)
      } catch {
        /* ignore */
      }
    }
  }
  return self.jsonOk({ transitioned: true })
}

// ── /state (debug/test) ───────────────────────────────────────────────────
export async function handleState(self: SessionRoomContext): Promise<Response> {
  const meta = await self.ctx.storage.get<Meta>(K_META)
  const question = await self.ctx.storage.get<LiveQuestion>(K_QUESTION)
  const counts = (await self.ctx.storage.get<Counts>(K_COUNTS)) ?? {}
  const voters = await self.ensureVoters()
  const status = (await self.ctx.storage.get<string>(K_STATUS)) ?? 'uninitialised'
  const energizer = (await self.ctx.storage.get<LiveEnergizerState>(K_ACTIVE_ENERGIZER)) ?? null
  return self.jsonOk({
    meta: meta ?? null,
    question: question ?? null,
    counts,
    voterCount: Object.keys(voters).length,
    connections: self.ctx.getWebSockets().length,
    energizer,
    status,
  })
}

// ── /copilot/snapshot (COPILOT-01, ADR-0046) ──────────────────────────────
// Aggregate, PII-free read of the live room for the facilitator copilot.
// Inference happens off the DO in the Pages Function; this only exposes state
// the DO already holds. Sentiment mood is omitted in zero-knowledge sessions.
export async function handleCopilotSnapshot(self: SessionRoomContext): Promise<Response> {
  const meta = await self.ctx.storage.get<Meta>(K_META)
  const question = await self.ctx.storage.get<LiveQuestion>(K_QUESTION)
  const counts = (await self.ctx.storage.get<Counts>(K_COUNTS)) ?? {}
  const voters = await self.ensureVoters()
  const status = (await self.ctx.storage.get<string>(K_STATUS)) ?? 'uninitialised'
  const isZeroKnowledge = meta?.anonymity === 'zero_knowledge'
  const mood = isZeroKnowledge
    ? null
    : (await self.ctx.storage.get<{ mood: 'positive' | 'neutral' | 'concerning'; sampleSize: number }>(K_SENTIMENT_MOOD)) ?? null

  const voterCount = Object.keys(voters).length
  const responseCount = Object.values(counts).reduce((sum, n) => sum + (typeof n === 'number' ? n : 0), 0)
  const optionTallies =
    question?.options?.map((o) => ({
      label: o.label,
      votes: counts[o.id] ?? 0,
    })) ?? []

  return self.jsonOk({
    status,
    currentQuestion: question
      ? { id: question.id, kind: question.kind, prompt: question.prompt, optionCount: question.options?.length ?? 0 }
      : null,
    responseCount,
    voterCount,
    participationRate: voterCount > 0 ? Math.min(1, responseCount / voterCount) : 0,
    connections: self.ctx.getWebSockets().length,
    optionTallies,
    mood,
  })
}
