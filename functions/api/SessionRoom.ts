// SessionRoom — Durable Object hosting LIVE session state (ADR-0001).
// Refactored per TD-01: REST / live / alarm / persistence logic lives in
// ./lib/session-room-*.ts. This class owns only the DO lifecycle (fetch,
// hibernation callbacks, alarm) and the shared in-memory caches, exposing
// itself as a SessionRoomContext to the extracted modules.
// See TECH_DEBT_AUDIT_2026-05.md TD-01.

import { CLOSE_NORMAL, CLOSE_POLICY_VIOLATION, isLiveProtocolSupported } from './realtime'
import type { Env } from './types'
import { writeEvent } from './lib/observability'
import { parseClientMessage, type ValidClientMessage } from './lib/protocol-schemas'
import { RateLimiter } from './lib/session-room-rate-limiter'
import { EnergizerHandler } from './lib/session-room-energizer-handler'
import { TownhallHandler } from './lib/session-room-townhall-handler'
import { RetroHandler } from './lib/session-room-retro-handler'
import { IdeateHandler } from './lib/session-room-ideate-handler'
import { DeliberateHandler } from './lib/session-room-deliberate-handler'
import { CaptionsHandler, type CaptionBroadcastPayload } from './lib/session-room-captions-handler'
import { ReactionsHandler } from './lib/session-room-reactions-handler'
import { XrAvatarHandler } from './lib/session-room-xr-handler'
import { logEvent } from './lib/log'
import { K_META, K_VOTERS } from './lib/session-room-storage-keys'
import {
  type Meta,
  type Votes,
  type Attachment,
  normaliseVotes,
  BROADCAST_DEBOUNCE_MS,
  FLUSH_INTERVAL_MS,
} from './lib/session-room-types'
import { errorMessage } from './lib/session-room-messages'
import { buildClientWsHandlers, type ClientWsHandler } from './lib/session-room-router'
import { flushVotesToD1AndKV, maybeSnapshot, maybeHydrate } from './lib/session-room-persistence'
import {
  createSessionRoomState,
  toHandlerContext,
  type SessionRoomContext,
  type SessionRoomState,
} from './lib/session-room-context'
import {
  handleInit,
  handleClose,
  handleTransitionToLive,
  handleState,
  handleCopilotSnapshot,
} from './lib/session-room-rest'
import { handleUpgrade } from './lib/session-room-ws-upgrade'
import {
  handleVote,
  handlePresenterAdvance,
  handlePresenterBack,
  handleAddQuestion,
} from './lib/session-room-vote-flow'
import {
  handlePresenterPauseResume,
  handleApproveResponse,
  handleRejectResponse,
  sendInit,
  broadcastParticipants,
} from './lib/session-room-presenter-init'
import { runAlarm } from './lib/session-room-alarm'

// ── DurableObject ───────────────────────────────────────────────────────────

export class SessionRoom implements DurableObject, SessionRoomContext {
  readonly ctx: DurableObjectState
  readonly env: Env
  readonly state: SessionRoomState = createSessionRoomState()
  readonly rateLimiter: RateLimiter
  readonly energizerHandler: EnergizerHandler
  readonly townhallHandler: TownhallHandler
  readonly retroHandler: RetroHandler
  readonly ideateHandler: IdeateHandler
  readonly deliberateHandler: DeliberateHandler
  readonly captionsHandler: CaptionsHandler
  readonly reactionsHandler: ReactionsHandler
  readonly xrAvatarHandler: XrAvatarHandler

  // Tracks the in-flight voters load so a rejection can be retried (EH-03).
  private _votersInitPromise: Promise<void> | null = null
  private readonly clientWsHandlers: Record<ValidClientMessage['type'], ClientWsHandler>

  constructor(ctx: DurableObjectState, env: Env) {
    this.ctx = ctx
    this.env = env

    const handlerCtx = toHandlerContext(ctx)
    this.rateLimiter = new RateLimiter(ctx.storage)
    this.energizerHandler = new EnergizerHandler(handlerCtx, env, this.scheduleAlarm.bind(this))
    this.townhallHandler = new TownhallHandler(handlerCtx, env)
    this.retroHandler = new RetroHandler(handlerCtx)
    this.ideateHandler = new IdeateHandler(handlerCtx, env, this.scheduleAlarm.bind(this))
    this.deliberateHandler = new DeliberateHandler(handlerCtx, env)
    this.captionsHandler = new CaptionsHandler(handlerCtx)
    this.reactionsHandler = new ReactionsHandler(handlerCtx, env)
    this.xrAvatarHandler = new XrAvatarHandler(handlerCtx, env)

    this.clientWsHandlers = buildClientWsHandlers({
      handleVote: (ws, att, data) => handleVote(this, ws, att, data),
      handlePresenterAdvance: (ws, att) => handlePresenterAdvance(this, ws, att),
      handlePresenterBack: (ws, att) => handlePresenterBack(this, ws, att),
      handleAddQuestion: (ws, att, data) => handleAddQuestion(this, ws, att, data),
      sendInit: (ws, att) => sendInit(this, ws, att),
      handlePresenterPauseResume: (ws, att, paused) => handlePresenterPauseResume(this, ws, att, paused),
      handleApproveResponse: (ws, att, data) => handleApproveResponse(this, ws, att, data),
      handleRejectResponse: (ws, att, data) => handleRejectResponse(this, ws, att, data),
      energizerHandler: this.energizerHandler,
      townhallHandler: this.townhallHandler,
      retroHandler: this.retroHandler,
      ideateHandler: this.ideateHandler,
      deliberateHandler: this.deliberateHandler,
      captionsHandler: this.captionsHandler,
      reactionsHandler: this.reactionsHandler,
      xrAvatarHandler: this.xrAvatarHandler,
    })
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url)
    if (url.pathname === '/init' && req.method === 'POST') return handleInit(this, req)
    if (url.pathname === '/close' && req.method === 'POST') return handleClose(this)
    if (url.pathname === '/transition-to-live' && req.method === 'POST') return handleTransitionToLive(this)
    if (url.pathname === '/state' && req.method === 'GET') return handleState(this)
    if (url.pathname === '/copilot/snapshot' && req.method === 'GET') return handleCopilotSnapshot(this)
    // CAPTIONS (ADR-0051 §3): the stateless ingest route reads the distinct active
    // caption-locale set to bound MT fan-out, then pushes assembled segments here
    // for broadcast. No audio/transcript is persisted — this only fans out text.
    if (url.pathname === '/captions/active-locales' && req.method === 'GET') {
      const state = await this.captionsHandler.getState()
      return new Response(
        JSON.stringify({
          active: state?.active === true,
          sourceLocale: state?.sourceLocale ?? null,
          locales: this.captionsHandler.activeLocales(),
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    }
    if (url.pathname === '/captions/broadcast' && req.method === 'POST') {
      const payload = (await req.json()) as CaptionBroadcastPayload
      this.captionsHandler.broadcast(payload)
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }
    // COPILOT-CHECKPOINT-01 (ADR-0056): the facilitator approved an L2 plan step;
    // fan it out to the room. Aggregate `summary` only — never per-voter data.
    if (url.pathname === '/copilot/checkpoint' && req.method === 'POST') {
      const payload = (await req.json()) as { stepId: string; tool: string; summary: string }
      const frame = JSON.stringify({
        type: 'copilot_checkpoint',
        data: { stepId: payload.stepId, tool: payload.tool, summary: payload.summary },
        timestamp: Date.now(),
      })
      let delivered = 0
      for (const ws of this.ctx.getWebSockets()) {
        try {
          ws.send(frame)
          delivered++
        } catch {
          /* socket closed mid-broadcast — ignore */
        }
      }
      return new Response(JSON.stringify({ ok: true, delivered }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }
    if (url.pathname === '/ws' && req.headers.get('upgrade') === 'websocket') {
      return handleUpgrade(this, req)
    }
    return new Response(
      JSON.stringify({ ok: false, error: { code: 'not_found', message: 'Unknown DO route' } }),
      { status: 404, headers: { 'content-type': 'application/json' } },
    )
  }

  // Returns the in-memory voters map, loading from storage exactly once.
  // Two concurrent callers both waiting on the same storage read will share
  // the same Votes object reference, so synchronous mutations made after the
  // await are immediately visible to the second caller — eliminating the
  // concurrent-write race in handleVote.
  async ensureVoters(): Promise<Votes> {
    if (this.state._voters !== null) return this.state._voters
    if (!this._votersInitPromise) {
      // Capture the in-flight promise locally so an awaiter watching this
      // exact load sees the rejection, but the cached field is reset to
      // allow the next caller to retry instead of replaying the same failure.
      this._votersInitPromise = this.ctx.storage
        .get<Record<string, string | string[]>>(K_VOTERS)
        .then(raw => { this.state._voters = normaliseVotes(raw) })
        .catch(err => {
          this.state._voters = null
          this._votersInitPromise = null
          throw err
        })
    }
    await this._votersInitPromise
    return this.state._voters!
  }

  resetVoters(voters: Votes): void {
    this.state._voters = voters
    this._votersInitPromise = null
  }

  // ── Hibernation callbacks ─────────────────────────────────────────────────
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    try {
      const text = typeof message === 'string' ? message : new TextDecoder().decode(message)
      const parsed = parseClientMessage(text)
      if (!parsed) {
        ws.send(errorMessage('bad_message', 'Invalid or malformed message'))
        return
      }
      if (parsed.v !== undefined && !isLiveProtocolSupported(parsed.v, this.env)) {
        ws.send(errorMessage('unsupported_protocol', `Unsupported LIVE protocol version: ${parsed.v}`))
        return
      }
      const att = ws.deserializeAttachment()
      if (!att) {
        ws.close(CLOSE_POLICY_VIOLATION, 'missing attachment')
        return
      }

      const handler = this.clientWsHandlers[parsed.type]
      if (!handler) {
        ws.send(errorMessage('unknown_type', `Unknown type: ${parsed.type}`))
        return
      }
      await handler(ws, att, parsed)
    } catch (err) {
      logEvent({
        event: 'do.ws_message_fault',
        errorClass: err instanceof Error ? err.name : 'UnknownError',
        errorMessage: err instanceof Error ? err.message : String(err),
      })
      const meta = await this.ctx.storage.get<Meta>(K_META).catch(() => null)
      writeEvent(this.env.METRICS_AE, {
        name: 'do.storage_fault',
        sessionId: meta?.sessionId,
        teamId: meta?.teamId,
        plan: meta?.plan ?? 'free',
      })
      try {
        ws.send(errorMessage('internal', 'Message processing failed'))
      } catch {
        /* socket already closed */
      }
    }
  }

  async webSocketClose(ws: WebSocket, _code: number, _reason: string, _wasClean: boolean): Promise<void> {
    const att = ws.deserializeAttachment() as Attachment | null
    // XR (ADR-0066 R2): drop the socket's transient avatar pose on disconnect.
    // Avatar state is in-DO-only and must not survive the connection.
    this.xrAvatarHandler.forget(ws)
    try {
      ws.close(CLOSE_NORMAL, 'bye')
    } catch {
      /* already closed */
    }
    if (att?.role === 'voter') {
      const meta = await this.ctx.storage.get<Meta>(K_META)
      writeEvent(this.env.METRICS_AE, {
        name: 'ws.voter_disconnected',
        sessionId: meta?.sessionId,
        teamId: meta?.teamId,
        plan: meta?.plan ?? 'free',
        count: this.ctx.getWebSockets('role:voter').length,
      })
    }
    await broadcastParticipants(this)
  }

  async webSocketError(ws: WebSocket, _err: unknown): Promise<void> {
    try {
      ws.close(CLOSE_POLICY_VIOLATION, 'error')
    } catch {
      /* ignore */
    }
  }

  async alarm(): Promise<void> {
    await runAlarm(this)
  }

  // ── Scheduling helpers ────────────────────────────────────────────────────
  // Sets the DO alarm to `targetMs` only if it would fire sooner than any
  // alarm already scheduled (keeps fun-mode timer intact when votes arrive).
  async scheduleAlarm(targetMs: number): Promise<void> {
    const existing = await this.ctx.storage.getAlarm()
    if (existing === null || targetMs < existing) {
      await this.ctx.storage.setAlarm(targetMs)
    }
  }

  // Phase 2.2: Schedule a flush to fire after FLUSH_INTERVAL_MS if not already scheduled.
  scheduleFlush(): void {
    if (this.state.flushScheduled) return
    this.state.flushScheduled = true
    const flushAt = this.state.lastFlushAt + FLUSH_INTERVAL_MS
    void this.scheduleAlarm(flushAt).catch(() => {
      // Alarm scheduling failed; reset flag so next vote attempts to reschedule.
      this.state.flushScheduled = false
    })
  }

  async scheduleResultsBroadcast(): Promise<void> {
    this.state.resultsDirty = true
    await this.scheduleAlarm(Date.now() + BROADCAST_DEBOUNCE_MS)
  }

  // ── Persistence delegation (Phase 2.2 / 2.3, ADR-042) ─────────────────────
  flushVotes(): Promise<void> {
    return flushVotesToD1AndKV(this.ctx.storage, this.env, this.state)
  }

  snapshot(): Promise<void> {
    return maybeSnapshot(this.ctx.storage, this.env, this.state)
  }

  hydrate(): Promise<void> {
    return maybeHydrate(this.ctx.storage, this.env, this.state)
  }

  // ── Response helpers ──────────────────────────────────────────────────────
  jsonOk(data: unknown): Response {
    return new Response(JSON.stringify({ ok: true, data }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }

  jsonError(status: number, code: string, message: string): Response {
    return new Response(JSON.stringify({ ok: false, error: { code, message } }), {
      status,
      headers: { 'content-type': 'application/json' },
    })
  }
}
