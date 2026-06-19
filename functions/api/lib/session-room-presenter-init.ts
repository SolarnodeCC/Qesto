/**
 * session-room-presenter-init.ts
 * Init snapshot, presenter pause/resume, response moderation, participant
 * broadcast, and the shared presenter-permission helper for SessionRoom.
 * Extracted from session-room-live-handlers.ts to keep files under 500 LOC.
 */

import {
  LIVE_PROTOCOL_VERSION,
  liveProtocolFeatures,
  TOWNHALL_FEATURE,
  IDEATE_FEATURE,
  REACTIONS_FEATURE,
  XR_FEATURE,
  type LiveProtocolVersion,
  type LiveEnergizerState,
  type LiveQuestion,
  type LiveSessionSummary,
} from '../realtime'
import { getFlag } from './flags'
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
  K_STATUS,
} from './session-room-storage-keys'
import { type Meta, type Counts, type Attachment } from './session-room-types'
import type { SessionRoomContext } from './session-room-context'
import { planAllowsLiveReactions } from './session-room-reactions-handler'

type PendingResponse = { id: string; voterId: string; text: string; submittedAt: number }

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
  const doStatus = (await self.ctx.storage.get<string>(K_STATUS)) ?? 'live'
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
    status: doStatus === 'closed' ? 'closed' : doStatus === 'energizing' ? 'energizing' : 'live',
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
  if (
    planAllowsLiveReactions(meta.plan) &&
    (question?.kind === 'reaction' || meta.votePolicy === 'react')
  ) {
    features = [...features, REACTIONS_FEATURE]
  }
  // XR (ADR-0066 D3): advertise 'xr' only when the beta flag is on AND the session
  // is NOT zero_knowledge. ZK sessions never advertise it (avatar presence is
  // incompatible with ZK unlinkability — R3). The launcher keys off this string.
  if (getFlag(self.env, 'BETA_XR_ENABLED') && meta.anonymity !== 'zero_knowledge') {
    features = [...features, XR_FEATURE]
  }
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
        question: doStatus === 'energizing' ? null : question,
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

// ── Pause / resume ─────────────────────────────────────────────────────────
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
