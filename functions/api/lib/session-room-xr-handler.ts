/**
 * session-room-xr-handler.ts — XR-AVATAR-01 (ADR-0066).
 *
 * Privacy-safe spatial avatar sync sub-channel on the SessionRoom DO. Additive
 * on protocol v3, NO version bump (captions/townhall precedent). Fully gated:
 *
 *   - OFF unless BETA_XR_ENABLED is 'true' (beta kill-switch).
 *   - NEVER active in zero_knowledge sessions — avatar presence is a presence
 *     signal incompatible with ZK unlinkability (ADR-0010), so it is dropped
 *     regardless of the flag. Guard ordering mirrors the vote-flow ZK precedent
 *     (lib/session-room-vote-admission.ts, handleVote): flag first, then ZK.
 *
 * Transient state only: avatar poses live in an in-memory Map keyed by the
 * socket. NOTHING is written to D1/KV or the session snapshot, and entries are
 * dropped on disconnect (`forget`). The ephemeral avatar id `a` is minted
 * per-socket and is NOT voterId and carries no name (R2).
 *
 * Fan-out is a fixed ~12.5 Hz batch tick (within the 10–15 Hz target), never one
 * broadcast per inbound frame, protecting the single-threaded event loop (R1).
 * Each batch carries a monotonic scene `rev` (townhall-style delta).
 *
 * The AE latency event (`xr.avatar_sync_latency`) carries aggregate timing +
 * batch count only — never avatarId / voterId / coordinates (R2, D6).
 */
import { serverMsgV3 } from './session-room-messages'
import type { DurableContextLike } from './session-room-context'
import { flagOff } from './flags'
import { writeEvent } from './observability'
import { K_META } from './session-room-storage-keys'
import type { Env } from '../types'
import type { Attachment, Meta } from './session-room-types'

/** Fan-out cadence: 80ms ≈ 12.5 Hz (within the ADR's 10–15 Hz target). */
export const XR_TICK_MS = 80

type AvatarPose = {
  /** Ephemeral per-socket avatar id (NOT voterId, NOT a name). */
  a: string
  p: [number, number, number]
  q: [number, number, number, number]
  /** Sender clock (ms) of the most recent pose — for aggregate latency only. */
  receivedAt: number
}

export class XrAvatarHandler {
  /** Transient, in-DO-only pose state keyed by the socket. Never persisted. */
  private readonly poses = new Map<WebSocket, AvatarPose>()
  /** Monotonic scene revision (townhall-style). */
  private rev = 0
  /** True while a batch tick is pending — coalesces inbound frames into one tick. */
  private tickScheduled = false
  private nextAvatarSeq = 0

  constructor(
    private readonly ctx: DurableContextLike,
    private readonly env: Env,
  ) {}

  /**
   * Inbound `xr_avatar_sync`. Guard ORDER is load-bearing (ADR-0066 R3):
   * flag-off → return, then ZK → return, BEFORE recording or broadcasting.
   */
  async handleSync(
    ws: WebSocket,
    _att: Attachment,
    data: { p: [number, number, number]; q: [number, number, number, number] },
  ): Promise<void> {
    if (flagOff(this.env, 'BETA_XR_ENABLED')) return
    const meta = await this.ctx.storage.get<Meta>(K_META)
    if (!meta) return
    if (meta.anonymity === 'zero_knowledge') return

    const existing = this.poses.get(ws)
    const a = existing?.a ?? this.mintAvatarId()
    this.poses.set(ws, { a, p: data.p, q: data.q, receivedAt: Date.now() })

    this.scheduleTick()
  }

  /** Drop a socket's transient pose on disconnect (no persistence to unwind). */
  forget(ws: WebSocket): void {
    this.poses.delete(ws)
  }

  /** Schedule a single batched fan-out tick if none is pending. */
  private scheduleTick(): void {
    if (this.tickScheduled) return
    this.tickScheduled = true
    setTimeout(() => {
      this.tickScheduled = false
      try {
        this.flushTick()
      } catch {
        /* tick is best-effort; never break the session loop */
      }
    }, XR_TICK_MS)
  }

  /**
   * Emit one merged `xr_avatar_sync` to all connected sockets with a monotonic
   * `rev`, then fire the aggregate AE latency event. Public so tests can drive
   * the batch deterministically without waiting on the timer.
   */
  flushTick(): void {
    this.pruneClosed()
    if (this.poses.size === 0) return

    const now = Date.now()
    const avatars: Array<{ a: string; p: [number, number, number]; q: [number, number, number, number] }> = []
    let oldestReceivedAt = now
    for (const pose of this.poses.values()) {
      avatars.push({ a: pose.a, p: pose.p, q: pose.q })
      if (pose.receivedAt < oldestReceivedAt) oldestReceivedAt = pose.receivedAt
    }

    this.rev += 1
    const payload = serverMsgV3({
      type: 'xr_avatar_sync',
      data: { avatars, rev: this.rev },
      timestamp: now,
    })
    for (const socket of this.ctx.getWebSockets()) {
      try {
        socket.send(payload)
      } catch {
        /* stale socket — ignore */
      }
    }

    // AE: aggregate latency + batch count ONLY. No avatarId / voterId / coords.
    void this.emitLatency(now - oldestReceivedAt, avatars.length)
  }

  private async emitLatency(durationMs: number, count: number): Promise<void> {
    if (!this.env.METRICS_AE) return
    const meta = await this.ctx.storage.get<Meta>(K_META).catch(() => undefined)
    writeEvent(this.env.METRICS_AE, {
      name: 'xr.avatar_sync_latency',
      sessionId: meta?.sessionId,
      teamId: meta?.teamId,
      durationMs,
      count,
    })
  }

  /** Drop poses whose socket has closed (defence-in-depth alongside `forget`). */
  private pruneClosed(): void {
    const live = new Set(this.ctx.getWebSockets())
    for (const ws of [...this.poses.keys()]) {
      if (!live.has(ws)) this.poses.delete(ws)
    }
  }

  private mintAvatarId(): string {
    // Per-socket ephemeral id; non-correlatable across sessions. Random + a
    // monotonic suffix to avoid collisions within a single room lifetime.
    this.nextAvatarSeq += 1
    const rand =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID().slice(0, 8)
        : Math.random().toString(36).slice(2, 10)
    return `xa_${rand}${this.nextAvatarSeq.toString(36)}`
  }

  // ── Test/inspection helpers (no persistence) ───────────────────────────────
  /** Current active avatar count (transient). Used for tests + init headcount. */
  activeAvatarCount(): number {
    this.pruneClosed()
    return this.poses.size
  }
}
