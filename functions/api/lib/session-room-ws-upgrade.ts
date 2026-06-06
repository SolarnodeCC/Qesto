/**
 * session-room-ws-upgrade.ts
 * WebSocket connection upgrade for SessionRoom: LIVE-state guard, per-IP and
 * per-session capacity/rate limits, attachment setup, and init/participant
 * broadcast on join. Extracted from session-room-live-handlers.ts to keep
 * files under 500 LOC.
 */

import { LIVE_PROTOCOL_VERSION_V2 } from '../realtime'
import type { PlanTier } from '../types'
import { PLAN_QUOTAS } from '../types'
import { writeEvent } from './observability'
import { now } from './session-room-messages'
import { K_META } from './session-room-storage-keys'
import {
  type Meta,
  type Attachment,
  PER_IP_CONCURRENT_CAP,
  VOTE_BUCKET_CAPACITY,
} from './session-room-types'
import type { SessionRoomContext } from './session-room-context'
import { sendInit, broadcastParticipants } from './session-room-presenter-init'

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
