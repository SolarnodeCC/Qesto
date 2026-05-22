// SessionRoom — Durable Object hosting LIVE session state (ADR-0001).
//
// WS4: LIVE vote semantics live in `lib/session-room-vote.ts` (`applyVoteMutation`);
// REST session state gates live in `lib/session-lifecycle.ts`.
//
// Lifecycle:
//   1. `POST /init`  — Hono route calls this once when a session transitions
//                      DRAFT → LIVE. Seeds meta + question + empty counts.
//   2. `GET  /ws`    — WebSocket Upgrade. Subprotocol `qesto.bearer.<JWT>`
//                      identifies the presenter; voters connect without a
//                      subprotocol and get an anon voterId via headers.
//   3. `POST /close` — Finalises, broadcasts `session_closed`, closes all
//                      sockets, returns final counts for D1 persistence.
//   4. `GET  /state` — Debug/test snapshot.
//
// Message dispatch is driven by hibernation callbacks (`webSocketMessage`,
// `webSocketClose`) so the DO can sleep between bursts without losing state.
// Broadcasts are debounced 100 ms via `ctx.storage.setAlarm` (GAM-001).
//
// Rate limits (S5): per-IP connect cap (5 concurrent) and per-voter vote
// token bucket (10 tokens, 1/s refill). Flood beyond thresholds → policy
// violation close (1008).

import {
  CLOSE_NORMAL,
  CLOSE_POLICY_VIOLATION,
  LIVE_PROTOCOL_VERSION,
  type LiveEnergizerState,
  type LiveQuestion,
  type LiveSessionSummary,
  type ServerMessage,
} from './realtime'
import type { Env, VotePolicy, SessionMode, PlanTier, Anonymity } from './types'
import { PLAN_QUOTAS } from './types'
import { writeEvent } from './lib/observability'
import { analyzeOpenResponseSentiment, SENTIMENT_COOLDOWN_MS } from './lib/ai/sentiment'
import { sentimentContextFromMeta } from './lib/ai/session-context'
import { applyVoteMutation, isFreeTextQuestionKind } from './lib/session-room-vote'
import { parseClientMessage, type ValidClientMessage } from './lib/validators'

// Tell tsc the env binding exists on the DO class — Phase 4+ will reach for
// `this.env.DB` inside `close()` to persist totals. Kept as a typed field now
// so new code doesn't need to rewire the constructor signature.

// ── Persisted state keys (ctx.storage) ──────────────────────────────────────
const K_META = 'meta'
const K_QUESTION = 'question'
const K_QUESTIONS = 'questions'
const K_QUESTION_INDEX = 'question_index'
const K_COUNTS = 'counts'
const K_VOTERS = 'voters'
const K_STATUS = 'status'
const K_IP_RATE_LIMIT = 'ip_rate_limit' // Maps ipHash → timestamps[] for per-minute rate limiting
const K_ACTIVE_ENERGIZER = 'active_energizer'
const K_SENTIMENT_MOOD = 'sentiment:mood'
const K_SENTIMENT_LAST = 'sentiment:last'

// Fun-mode: 60 s per question before auto-advance signal.
const FUN_MODE_QUESTION_MS = 60_000

type Meta = {
  sessionId: string
  ownerId: string
  teamId?: string
  code: string
  title: string
  startedAt: number
  votePolicy: VotePolicy
  sessionMode: SessionMode
  anonymity?: Anonymity
  /** Owner's plan tier — used to enforce per-session voter capacity. */
  plan?: PlanTier
  /** Unix ms when the current question expires in fun mode. */
  questionExpiresAt?: number
  /** When true, vote messages are rejected until the presenter resumes. */
  paused?: boolean
}

type Counts = Record<string, number>
// Per-voter vote history: voterId → optionId[]. The array holds every selection
// that voter has made for the active question. For kinds that enforce a single
// choice (poll, likert, slider, ranking, consent, open) the array length stays
// at 1; for multi_select / upvote / word_cloud it may grow with each send.
// Counts are derived, but kept as a denormalised cache so broadcasts don't
// recompute every tick.
//
// read path that touches this shape must call `normaliseVotes()` to coerce
// a stored string into a single-element array.
type Votes = Record<string, string[]>

function normaliseVotes(raw: Record<string, string | string[]> | undefined): Votes {
  const out: Votes = {}
  if (!raw) return out
  for (const [voterId, value] of Object.entries(raw)) {
    out[voterId] = Array.isArray(value) ? value : [value]
  }
  return out
}

// ── Per-connection attachment stored on each WebSocket ──────────────────────
type Attachment = {
  role: 'presenter' | 'voter'
  voterId: string
  ipHash: string
  bucket: { tokens: number; lastAt: number }
  permissions?: string[]
}

const PER_IP_CONCURRENT_CAP = 10  // Increased from 5 to support shared IPs better
const VOTE_BUCKET_CAPACITY = 10
const VOTE_BUCKET_REFILL_PER_SEC = 1

const BROADCAST_DEBOUNCE_MS = 100

// ── Message helpers ─────────────────────────────────────────────────────────
function serverMessage(msg: ServerMessage): string {
  return JSON.stringify({ v: LIVE_PROTOCOL_VERSION, ...msg })
}

function now(): number {
  return Date.now()
}

function errorMessage(code: string, message: string): string {
  return serverMessage({ type: 'error', data: { code, message }, timestamp: now() })
}

// ── DurableObject ───────────────────────────────────────────────────────────
type ClientWsHandler = (ws: WebSocket, att: Attachment, msg: ValidClientMessage) => Promise<void>

export class SessionRoom implements DurableObject {
  private readonly ctx: DurableObjectState
  private readonly env: Env
  private resultsDirty = false
  private _voters: Votes | null = null
  private _votersInitPromise: Promise<void> | null = null
  private readonly clientWsHandlers: Record<ValidClientMessage['type'], ClientWsHandler>

  constructor(ctx: DurableObjectState, env: Env) {
    this.ctx = ctx
    this.env = env
    void this.env // retained for Phase 4 D1 persistence; see file header.

    this.clientWsHandlers = {
      vote: async (ws, att, msg) => {
        if (msg.type !== 'vote') return
        await this.handleVote(ws, att, msg.data)
      },
      advance: async (ws, att, _msg) => {
        await this.handlePresenterAdvance(ws, att)
      },
      back: async (ws, att, _msg) => {
        await this.handlePresenterBack(ws, att)
      },
      request_state: async (ws, att, _msg) => {
        await this.sendInit(ws, att)
      },
      pause: async (ws, att, _msg) => {
        await this.handlePresenterPauseResume(ws, att, true)
      },
      resume: async (ws, att, _msg) => {
        await this.handlePresenterPauseResume(ws, att, false)
      },
      energizer_activate: async (ws, att, msg) => {
        if (msg.type !== 'energizer_activate') return
        await this.handleEnergizerActivate(ws, att, msg.data.energizer as LiveEnergizerState)
      },
      energizer_answer: async (ws, att, msg) => {
        if (msg.type !== 'energizer_answer') return
        await this.handleEnergizerAnswer(ws, att, msg.data)
      },
      energizer_advance: async (ws, att, msg) => {
        if (msg.type !== 'energizer_advance') return
        await this.handleEnergizerAdvance(ws, att, msg.data)
      },
    }
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url)
    if (url.pathname === '/init' && req.method === 'POST') return this.handleInit(req)
    if (url.pathname === '/close' && req.method === 'POST') return this.handleClose()
    if (url.pathname === '/transition-to-live' && req.method === 'POST') return this.handleTransitionToLive()
    if (url.pathname === '/state' && req.method === 'GET') return this.handleState()
    if (url.pathname === '/ws' && req.headers.get('upgrade') === 'websocket') {
      return this.handleUpgrade(req)
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
  private async ensureVoters(): Promise<Votes> {
    if (this._voters !== null) return this._voters
    if (!this._votersInitPromise) {
      // Capture the in-flight promise locally so an awaiter watching this
      // exact load sees the rejection, but the cached field is reset to
      // allow the next caller to retry instead of replaying the same failure.
      this._votersInitPromise = this.ctx.storage
        .get<Record<string, string | string[]>>(K_VOTERS)
        .then(raw => { this._voters = normaliseVotes(raw) })
        .catch(err => {
          this._voters = null
          this._votersInitPromise = null
          throw err
        })
    }
    await this._votersInitPromise
    return this._voters!
  }

  // ── /init ─────────────────────────────────────────────────────────────────
  private async handleInit(req: Request): Promise<Response> {
    const status = (await this.ctx.storage.get<string>(K_STATUS)) ?? null
    if (status === 'live' || status === 'closed') {
      return this.jsonError(409, 'already_initialised', 'Session already initialised')
    }
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
        }
      | null
    if (!body || !body.sessionId || !body.ownerId || !body.code || !body.title) {
      return this.jsonError(400, 'bad_request', 'Missing init fields')
    }
    const nowMs = now()
    const sessionMode: SessionMode = body.sessionMode ?? 'reflection'
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
      ...(sessionMode === 'fun' ? { questionExpiresAt: nowMs + FUN_MODE_QUESTION_MS } : {}),
    }
    await this.ctx.storage.put(K_META, meta)
    await this.ctx.storage.put(K_STATUS, 'live')
    await this.ctx.storage.put(K_COUNTS, {} as Counts)
    await this.ctx.storage.put(K_VOTERS, {} as Votes)
    await this.ctx.storage.delete(K_ACTIVE_ENERGIZER)
    this._voters = {}
    this._votersInitPromise = null
    const allQuestions: LiveQuestion[] = body.questions ?? (body.question ? [body.question] : [])
    await this.ctx.storage.put(K_QUESTIONS, allQuestions)
    await this.ctx.storage.put(K_QUESTION_INDEX, 0)
    if (allQuestions.length > 0) await this.ctx.storage.put(K_QUESTION, allQuestions[0])
    if (sessionMode === 'fun' && meta.questionExpiresAt) {
      await this.scheduleAlarm(meta.questionExpiresAt)
    }
    return this.jsonOk({ initialised: true })
  }

  // ── /close ────────────────────────────────────────────────────────────────
  private async handleClose(): Promise<Response> {
    const status = (await this.ctx.storage.get<string>(K_STATUS)) ?? null
    if (status !== 'live' && status !== 'energizing') {
      return this.jsonError(409, 'not_live', 'Session is not active')
    }
    const counts = (await this.ctx.storage.get<Counts>(K_COUNTS)) ?? {}
    const votes = await this.ensureVoters()
    const total = Object.values(counts).reduce((a, b) => a + b, 0)
    const msg = serverMessage({
      type: 'session_closed',
      data: { counts, total },
      timestamp: now(),
    })
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(msg)
        ws.close(CLOSE_NORMAL, 'session closed')
      } catch {
        /* ignore */
      }
    }
    await this.ctx.storage.put(K_STATUS, 'closed')
    const questionId = (await this.ctx.storage.get<LiveQuestion>(K_QUESTION))?.id ?? null
    // Flatten voterId → optionId[] into one row per (voter, optionId) so the
    // D1 schema (UNIQUE(question_id, voter_id) … wait, actually the caller
    // uses INSERT OR IGNORE so duplicate voter rows collapse). For kinds
    // where one voter can legitimately submit multiple entries (multi_select,
    // upvote, word_cloud) each entry is emitted separately; the caller must
    // relax the UNIQUE constraint at the schema level for those kinds before
    // all rows will persist. See knowledge-base/architecture/ARCHITECTURE.md.
    const voteList = Object.entries(votes).flatMap(([voterId, optionIds]) =>
      optionIds.map((optionId) => ({ voterId, optionId })),
    )
    return this.jsonOk({ counts, total, votes: voteList, questionId })
  }

  // ── /transition-to-live ────────────────────────────────────────────────────
  // Transitions session from ENERGIZING to LIVE. Broadcast update to all clients.
  private async handleTransitionToLive(): Promise<Response> {
    const status = (await this.ctx.storage.get<string>(K_STATUS)) ?? null
    if (status !== 'live') {
      // Already live or not initialized, nothing to do
      return this.jsonOk({ transitioned: false })
    }
    // Broadcast the transition to all connected clients
    const msg = serverMessage({
      type: 'session_energizing_complete',
      data: {},
      timestamp: now(),
    })
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(msg)
      } catch {
        /* ignore */
      }
    }
    return this.jsonOk({ transitioned: true })
  }

  // ── /state (debug/test) ───────────────────────────────────────────────────
  private async handleState(): Promise<Response> {
    const meta = await this.ctx.storage.get<Meta>(K_META)
    const question = await this.ctx.storage.get<LiveQuestion>(K_QUESTION)
    const counts = (await this.ctx.storage.get<Counts>(K_COUNTS)) ?? {}
    const voters = await this.ensureVoters()
    const status = (await this.ctx.storage.get<string>(K_STATUS)) ?? 'uninitialised'
    const energizer = (await this.ctx.storage.get<LiveEnergizerState>(K_ACTIVE_ENERGIZER)) ?? null
    return this.jsonOk({
      meta: meta ?? null,
      question: question ?? null,
      counts,
      voterCount: Object.keys(voters).length,
      connections: this.ctx.getWebSockets().length,
      energizer,
      status,
    })
  }

  // ── /ws (WebSocket upgrade) ───────────────────────────────────────────────
  private async handleUpgrade(req: Request): Promise<Response> {
    const status = (await this.ctx.storage.get<string>(K_STATUS)) ?? null
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
      const existing = this.ctx.getWebSockets(`ip:${ipHash}`)
      if (existing.length >= PER_IP_CONCURRENT_CAP) {
        return new Response('Too many connections from this IP', { status: 429 })
      }

      // Per-session participant capacity cap (plan-gated). Counts existing
      // voter sockets (tag role:voter) and rejects new joins at the limit.
      const meta = await this.ctx.storage.get<Meta>(K_META)
      const plan: PlanTier = meta?.plan ?? 'free'
      const maxParticipants = PLAN_QUOTAS[plan].maxParticipantsPerSession
      const currentVoters = this.ctx.getWebSockets('role:voter').length
      if (currentVoters >= maxParticipants) {
        writeEvent(this.env.METRICS_AE, {
          name: 'ws.capacity_exceeded',
          sessionId: meta?.sessionId,
          plan,
          count: currentVoters,
        })
        return new Response('Session capacity reached', { status: 429 })
      }

      // Per-IP per-minute rate limiting (SEC-01).
      const rateLimitExceeded = await this.checkIpRateLimit(ipHash)
      if (rateLimitExceeded) {
        return new Response('Rate limit exceeded for this IP', { status: 429 })
      }
    }

    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket]

    const attachment: Attachment = {
      role,
      voterId,
      ipHash,
      bucket: { tokens: VOTE_BUCKET_CAPACITY, lastAt: now() },
      ...(role === 'presenter' && permissionsHeader !== null
        ? { permissions: permissionsHeader.split(',').map((p) => p.trim()).filter(Boolean) }
        : {}),
    }
    server.serializeAttachment(attachment)
    this.ctx.acceptWebSocket(server, [`ip:${ipHash}`, `voter:${voterId}`, `role:${role}`])

    // Send init snapshot immediately.
    await this.sendInit(server, attachment)
    await this.broadcastParticipants()

    if (role === 'voter') {
      const meta = await this.ctx.storage.get<Meta>(K_META)
      const voterCount = this.ctx.getWebSockets('role:voter').length
      writeEvent(this.env.METRICS_AE, {
        name: 'ws.voter_joined',
        sessionId: meta?.sessionId,
        teamId: meta?.teamId,
        plan: meta?.plan ?? 'free',
        count: voterCount,
      })
    }

    return new Response(null, { status: 101, webSocket: client })
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
      if (parsed.v !== undefined && parsed.v !== LIVE_PROTOCOL_VERSION) {
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
      console.log(
        JSON.stringify({
          event: 'do.ws_message_fault',
          errorClass: err instanceof Error ? err.name : 'UnknownError',
          errorMessage: err instanceof Error ? err.message : String(err),
        }),
      )
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
    await this.broadcastParticipants()
  }

  async webSocketError(ws: WebSocket, _err: unknown): Promise<void> {
    try {
      ws.close(CLOSE_POLICY_VIOLATION, 'error')
    } catch {
      /* ignore */
    }
  }

  // ── Alarm = flush debounced results + fun-mode question timer ────────────
  async alarm(): Promise<void> {
    const nowMs = now()

    if (this.resultsDirty) {
      this.resultsDirty = false
      const counts = (await this.ctx.storage.get<Counts>(K_COUNTS)) ?? {}
      const total = Object.values(counts).reduce((a, b) => a + b, 0)
      const msg = serverMessage({
        type: 'results',
        data: { counts, total },
        timestamp: nowMs,
      })
      for (const ws of this.ctx.getWebSockets()) {
        try { ws.send(msg) } catch { /* ignore */ }
      }
    }

    // Fun-mode: broadcast question_timeout when the countdown expires.
    const meta = await this.ctx.storage.get<Meta>(K_META)
    if (meta?.sessionMode === 'fun' && meta.questionExpiresAt) {
      if (meta.questionExpiresAt <= nowMs) {
        const question = await this.ctx.storage.get<LiveQuestion>(K_QUESTION)
        if (question) {
          const msg = serverMessage({
            type: 'question_timeout',
            data: { questionId: question.id },
            timestamp: nowMs,
          })
          for (const ws of this.ctx.getWebSockets()) {
            try { ws.send(msg) } catch { /* ignore */ }
          }
        }
        // Clear the expiry so it only fires once.
        delete meta.questionExpiresAt
        await this.ctx.storage.put(K_META, meta)
      } else {
        // Reschedule for the remaining time (results alarm may have fired early).
        await this.ctx.storage.setAlarm(meta.questionExpiresAt)
      }
    }
  }

  // ── Handlers ──────────────────────────────────────────────────────────────
  private async handlePresenterAdvance(ws: WebSocket, att: Attachment): Promise<void> {
    if (att.role !== 'presenter') {
      ws.send(errorMessage('forbidden', 'Only presenter can advance'))
      return
    }
    if (!this.canControlSession(att)) {
      ws.send(errorMessage('forbidden', 'Presenter role cannot advance this session'))
      return
    }
    const allQs = (await this.ctx.storage.get<LiveQuestion[]>(K_QUESTIONS)) ?? []
    const curIdx = (await this.ctx.storage.get<number>(K_QUESTION_INDEX)) ?? 0
    const nextIdx = curIdx + 1
    if (nextIdx >= allQs.length) {
      const doneMsg = serverMessage({ type: 'all_done', data: {}, timestamp: now() })
      for (const socket of this.ctx.getWebSockets()) {
        try { socket.send(doneMsg) } catch { /* ignore */ }
      }
      return
    }
    const nextQ = allQs[nextIdx]
    await this.ctx.storage.put(K_QUESTION_INDEX, nextIdx)
    await this.ctx.storage.put(K_QUESTION, nextQ)
    await this.ctx.storage.put(K_COUNTS, {} as Counts)
    await this.ctx.storage.put(K_VOTERS, {} as Votes)
    await this.ctx.storage.delete(K_ACTIVE_ENERGIZER)
    await this.ctx.storage.delete(K_SENTIMENT_MOOD)
    await this.ctx.storage.delete(K_SENTIMENT_LAST)
    this._voters = {}
    this._votersInitPromise = null
    const advanceMsg = serverMessage({
      type: 'question',
      data: { question: nextQ, index: nextIdx, total: allQs.length },
      timestamp: now(),
    })
    for (const socket of this.ctx.getWebSockets()) {
      try { socket.send(advanceMsg) } catch { /* ignore closed socket */ }
    }
  }

  private async handlePresenterBack(ws: WebSocket, att: Attachment): Promise<void> {
    if (att.role !== 'presenter') {
      ws.send(errorMessage('forbidden', 'Only presenter can go back'))
      return
    }
    if (!this.canControlSession(att)) {
      ws.send(errorMessage('forbidden', 'Presenter role cannot go back in this session'))
      return
    }
    const allQs = (await this.ctx.storage.get<LiveQuestion[]>(K_QUESTIONS)) ?? []
    const curIdx = (await this.ctx.storage.get<number>(K_QUESTION_INDEX)) ?? 0
    const prevIdx = curIdx - 1
    if (prevIdx < 0) {
      ws.send(errorMessage('noop', 'Already at first question'))
      return
    }
    const prevQ = allQs[prevIdx]
    await this.ctx.storage.put(K_QUESTION_INDEX, prevIdx)
    await this.ctx.storage.put(K_QUESTION, prevQ)
    await this.ctx.storage.put(K_COUNTS, {} as Counts)
    await this.ctx.storage.put(K_VOTERS, {} as Votes)
    this._voters = {}
    this._votersInitPromise = null
    const backMsg = serverMessage({
      type: 'question',
      data: { question: prevQ, index: prevIdx, total: allQs.length },
      timestamp: now(),
    })
    for (const socket of this.ctx.getWebSockets()) {
      try { socket.send(backMsg) } catch { /* ignore closed socket */ }
    }
  }

  private async handlePresenterPauseResume(ws: WebSocket, att: Attachment, paused: boolean): Promise<void> {
    if (att.role !== 'presenter') {
      ws.send(
        errorMessage('forbidden', paused ? 'Only presenter can pause' : 'Only presenter can resume'),
      )
      return
    }
    if (!this.canControlSession(att)) {
      ws.send(errorMessage('forbidden', paused ? 'Presenter role cannot pause this session' : 'Presenter role cannot resume this session'))
      return
    }
    await this.setPaused(paused)
  }

  private async handleEnergizerActivate(
    ws: WebSocket,
    att: Attachment,
    energizer: LiveEnergizerState,
  ): Promise<void> {
    if (att.role !== 'presenter') {
      ws.send(errorMessage('forbidden', 'Only presenter can activate energizers'))
      await this.emitEnergizerMetric('ws.energizer_activation_denied', energizer?.id, 0)
      await this.recordEnergizerAudit('ws.energizer_activation_denied', att, energizer, { reason: 'role' })
      return
    }
    if (!this.canActivateEnergizer(att)) {
      ws.send(errorMessage('forbidden', 'Presenter role cannot activate energizers'))
      await this.emitEnergizerMetric('ws.energizer_activation_denied', energizer?.id, 0)
      await this.recordEnergizerAudit('ws.energizer_activation_denied', att, energizer, { reason: 'permission' })
      return
    }
    if (this.env.LIVE_ENERGIZERS_ENABLED !== 'true') {
      ws.send(errorMessage('feature_disabled', 'LIVE energizers are not enabled'))
      await this.emitEnergizerMetric('ws.energizer_activation_denied', energizer?.id, 0)
      await this.recordEnergizerAudit('ws.energizer_activation_denied', att, energizer, { reason: 'feature_disabled' })
      return
    }
    if (!isValidLiveEnergizer(energizer)) {
      ws.send(errorMessage('bad_energizer', 'Invalid energizer payload'))
      return
    }
    const active = withScoreArtifacts(initialiseLiveEnergizer(energizer))
    await this.ctx.storage.put(K_ACTIVE_ENERGIZER, active)
    await this.emitEnergizerMetric('ws.energizer_activated', active.id, active.leaderboard?.length ?? 0)
    await this.recordEnergizerAudit('ws.energizer_activated', att, active)
    await this.broadcastEnergizer(active)
  }

  private async handleEnergizerAnswer(
    ws: WebSocket,
    att: Attachment,
    data: { energizerId?: string; value?: string },
  ): Promise<void> {
    if (this.env.LIVE_ENERGIZERS_ENABLED !== 'true') {
      ws.send(errorMessage('feature_disabled', 'LIVE energizers are not enabled'))
      return
    }
    if (att.role !== 'voter') {
      ws.send(errorMessage('forbidden', 'Only participants can answer energizers'))
      return
    }
    const active = (await this.ctx.storage.get<LiveEnergizerState>(K_ACTIVE_ENERGIZER)) ?? null
    if (!active || active.status !== 'active') {
      ws.send(errorMessage('no_energizer', 'No energizer is active'))
      return
    }
    if (!data?.energizerId || data.energizerId !== active.id) {
      ws.send(errorMessage('stale_energizer', 'Answer for a different energizer'))
      return
    }
    if (active.kind === 'team_quiz') {
      await this.handleTeamQuizAnswer(ws, att, active, data.value)
      return
    }
    if (active.kind !== 'quick_finger') {
      ws.send(errorMessage('unsupported_energizer', 'This energizer does not accept live answers yet'))
      return
    }
    const value = typeof data.value === 'string' ? data.value.trim() : ''
    const options = active.options ?? []
    if (!value || (options.length > 0 && !options.includes(value))) {
      ws.send(errorMessage('bad_energizer_answer', 'Unknown answer option'))
      return
    }
    const existing = active.answers ?? []
    if (existing.some((answer) => answer.voterId === att.voterId)) {
      ws.send(errorMessage('duplicate_energizer_answer', 'You already answered this energizer'))
      return
    }

    const startedAt = active.startedAt ?? now()
    const correctValue = typeof active.correctIndex === 'number' ? options[active.correctIndex] : undefined
    const answered: LiveEnergizerState = withScoreArtifacts({
      ...active,
      startedAt,
      answers: rankQuickFingerAnswers([
        ...existing,
        {
          voterId: att.voterId,
          value,
          correct: correctValue === undefined ? true : value === correctValue,
          speedMs: Math.max(0, now() - startedAt),
          rank: 0,
        },
      ]),
    })
    await this.ctx.storage.put(K_ACTIVE_ENERGIZER, answered)
    await this.emitEnergizerMetric('ws.energizer_answered', answered.id, answered.answers?.length ?? 0)
    await this.recordEnergizerAudit('ws.energizer_answered', att, answered, { answer_count: answered.answers?.length ?? 0 })
    await this.broadcastEnergizer(answered)
  }

  private async handleTeamQuizAnswer(
    ws: WebSocket,
    att: Attachment,
    active: LiveEnergizerState,
    rawValue: unknown,
  ): Promise<void> {
    const currentIndex = active.currentIndex ?? 0
    const question = active.questions?.[currentIndex]
    if (!question) {
      ws.send(errorMessage('no_quiz_question', 'No quiz question is active'))
      return
    }
    const value = typeof rawValue === 'string' ? rawValue.trim() : ''
    if (!value || !question.options.includes(value)) {
      ws.send(errorMessage('bad_energizer_answer', 'Unknown answer option'))
      return
    }
    const submissions = active.submissions ?? []
    if (submissions.some((submission) => submission.voterId === att.voterId && submission.questionIndex === currentIndex)) {
      ws.send(errorMessage('duplicate_energizer_answer', 'You already answered this quiz question'))
      return
    }

    const answered: LiveEnergizerState = withScoreArtifacts({
      ...active,
      submissions: [
        ...submissions,
        {
          voterId: att.voterId,
          questionIndex: currentIndex,
          value,
          correct: value === question.options[question.correctIndex],
        },
      ],
    })
    await this.ctx.storage.put(K_ACTIVE_ENERGIZER, answered)
    await this.emitEnergizerMetric('ws.energizer_answered', answered.id, answered.submissions?.length ?? 0)
    await this.recordEnergizerAudit('ws.energizer_answered', att, answered, { answer_count: answered.submissions?.length ?? 0 })
    await this.broadcastEnergizer(answered)
  }

  private async handleEnergizerAdvance(
    ws: WebSocket,
    att: Attachment,
    data: { energizerId?: string },
  ): Promise<void> {
    if (att.role !== 'presenter') {
      ws.send(errorMessage('forbidden', 'Only presenter can advance energizers'))
      await this.emitEnergizerMetric('ws.energizer_advance_denied', data?.energizerId, 0)
      return
    }
    if (!this.canActivateEnergizer(att)) {
      ws.send(errorMessage('forbidden', 'Presenter role cannot advance energizers'))
      await this.emitEnergizerMetric('ws.energizer_advance_denied', data?.energizerId, 0)
      await this.recordEnergizerAudit('ws.energizer_advance_denied', att, data?.energizerId ? { id: data.energizerId } : {}, { reason: 'permission' })
      return
    }
    if (this.env.LIVE_ENERGIZERS_ENABLED !== 'true') {
      ws.send(errorMessage('feature_disabled', 'LIVE energizers are not enabled'))
      await this.emitEnergizerMetric('ws.energizer_advance_denied', data?.energizerId, 0)
      await this.recordEnergizerAudit('ws.energizer_advance_denied', att, data?.energizerId ? { id: data.energizerId } : {}, { reason: 'feature_disabled' })
      return
    }
    const active = (await this.ctx.storage.get<LiveEnergizerState>(K_ACTIVE_ENERGIZER)) ?? null
    if (!active || active.status !== 'active') {
      ws.send(errorMessage('no_energizer', 'No energizer is active'))
      return
    }
    if (active.kind !== 'team_quiz') {
      ws.send(errorMessage('unsupported_energizer', 'Only Team Quiz supports energizer advance'))
      return
    }
    if (!data?.energizerId || data.energizerId !== active.id) {
      ws.send(errorMessage('stale_energizer', 'Advance for a different energizer'))
      return
    }
    const currentIndex = active.currentIndex ?? 0
    const total = active.questions?.length ?? 0
    const next: LiveEnergizerState =
      currentIndex + 1 >= total
        ? withScoreArtifacts({ ...active, status: 'completed', currentIndex })
        : withScoreArtifacts({ ...active, currentIndex: currentIndex + 1 })
    await this.ctx.storage.put(K_ACTIVE_ENERGIZER, next)
    await this.emitEnergizerMetric(
      next.status === 'completed' ? 'ws.energizer_completed' : 'ws.energizer_advanced',
      next.id,
      next.leaderboard?.length ?? 0,
    )
    await this.recordEnergizerAudit(
      next.status === 'completed' ? 'ws.energizer_completed' : 'ws.energizer_advanced',
      att,
      next,
      { current_index: next.currentIndex ?? 0 },
    )
    await this.broadcastEnergizer(next)
  }

  private async handleVote(
    ws: WebSocket,
    att: Attachment,
    data: { questionId?: string; optionId?: string },
  ): Promise<void> {
    const t0 = Date.now()
    const meta = await this.ctx.storage.get<Meta>(K_META)
    // Token-bucket rate limit (S5).
    const nowMs = now()
    const elapsed = (nowMs - att.bucket.lastAt) / 1000
    const refilled = Math.min(VOTE_BUCKET_CAPACITY, att.bucket.tokens + elapsed * VOTE_BUCKET_REFILL_PER_SEC)
    if (refilled < 1) {
      writeEvent(this.env.METRICS_AE, {
        name: 'ws.token_bucket_contention',
        sessionId: meta?.sessionId,
        count: this.ctx.getWebSockets().length,
      })
      ws.send(errorMessage('rate_limited', 'Slow down'))
      ws.close(CLOSE_POLICY_VIOLATION, 'vote flood')
      return
    }
    att.bucket = { tokens: refilled - 1, lastAt: nowMs }
    ws.serializeAttachment(att)

    if (meta?.paused) {
      ws.send(errorMessage('paused', 'Voting is paused'))
      return
    }

    const question = await this.ctx.storage.get<LiveQuestion>(K_QUESTION)
    if (!question) {
      ws.send(errorMessage('no_question', 'No question is active'))
      return
    }
    if (!data || data.questionId !== question.id) {
      ws.send(errorMessage('stale', 'Vote for a different question'))
      return
    }
    const optionId = data.optionId
    if (!optionId) {
      ws.send(errorMessage('bad_option', 'Missing optionId'))
      return
    }
    // For free-text kinds (word_cloud) the `optionId` is the submitted phrase,
    // so we accept any non-empty string. Other kinds must reference a
    // preconfigured option.
    if (!isFreeTextQuestionKind(question.kind) && !question.options.some((o) => o.id === optionId)) {
      ws.send(errorMessage('bad_option', 'Unknown option'))
      return
    }

    const votePolicy = meta?.votePolicy ?? 'once'

    // Load voters via shared in-memory reference. The mutation below contains
    // no await inside applyVoteMutation, so concurrent vote messages from the
    // same voter serialise naturally.
    const voters = await this.ensureVoters()
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

    // Load and update counts after the voter decision is finalised (safe to
    // await here — the duplicate check above has already mutated voters).
    const counts = (await this.ctx.storage.get<Counts>(K_COUNTS)) ?? {}
    if (countKey) counts[countKey] = (counts[countKey] ?? 0) + 1
    if (countDecKey) counts[countDecKey] = Math.max(0, (counts[countDecKey] ?? 1) - 1)

    await this.ctx.storage.put(K_VOTERS, voters)
    await this.ctx.storage.put(K_COUNTS, counts)

    await this.scheduleResultsBroadcast()

    writeEvent(this.env.METRICS_AE, {
      name: 'ws.vote_submitted',
      sessionId: meta?.sessionId,
      teamId: meta?.teamId,
      plan: meta?.plan ?? 'free',
      durationMs: Date.now() - t0,
    })

    if (question.kind === 'open' && meta) {
      void this.maybeAnalyzeSentiment(meta, question.id, voters).catch(() => {})
    }
  }

  private async maybeAnalyzeSentiment(meta: Meta, questionId: string, voters: Votes): Promise<void> {
    if (this.env.SENTIMENT_ENABLED !== 'true') return
    if (meta.anonymity === 'zero_knowledge') return

    const last = (await this.ctx.storage.get<number>(K_SENTIMENT_LAST)) ?? 0
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
    const result = await analyzeOpenResponseSentiment(this.env, ctx, responses)
    if (!result) return

    await this.ctx.storage.put(K_SENTIMENT_LAST, Date.now())
    await this.ctx.storage.put(K_SENTIMENT_MOOD, result)

    writeEvent(this.env.METRICS_AE, {
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
    for (const ws of this.ctx.getWebSockets('role:presenter')) {
      try {
        ws.send(msg)
      } catch {
        /* ignore */
      }
    }
  }

  private async scheduleResultsBroadcast(): Promise<void> {
    this.resultsDirty = true
    await this.scheduleAlarm(Date.now() + BROADCAST_DEBOUNCE_MS)
  }

  // Sets the DO alarm to `targetMs` only if it would fire sooner than any
  // alarm already scheduled (keeps fun-mode timer intact when votes arrive).
  private async scheduleAlarm(targetMs: number): Promise<void> {
    const existing = await this.ctx.storage.getAlarm()
    if (existing === null || targetMs < existing) {
      await this.ctx.storage.setAlarm(targetMs)
    }
  }

  private async sendInit(ws: WebSocket, att: Attachment): Promise<void> {
    const meta = await this.ctx.storage.get<Meta>(K_META)
    if (!meta) {
      ws.send(errorMessage('not_initialised', 'Session has not been initialised'))
      return
    }
    const question = (await this.ctx.storage.get<LiveQuestion>(K_QUESTION)) ?? null
    const allQs = (await this.ctx.storage.get<LiveQuestion[]>(K_QUESTIONS)) ?? []
    const questionIndex = (await this.ctx.storage.get<number>(K_QUESTION_INDEX)) ?? 0
    const counts = (await this.ctx.storage.get<Counts>(K_COUNTS)) ?? {}
    const energizer = (await this.ctx.storage.get<LiveEnergizerState>(K_ACTIVE_ENERGIZER)) ?? null
    const sentiment =
      att.role === 'presenter'
        ? ((await this.ctx.storage.get<{ mood: 'positive' | 'neutral' | 'concerning'; sampleSize: number }>(
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
    ws.send(
      serverMessage({
        type: 'init',
        data: {
          session,
          role: att.role,
          voterId: att.voterId,
          question,
          questionIndex,
          questionTotal: allQs.length,
          results: { counts, total },
          participants: this.ctx.getWebSockets().length,
          energizer,
          expiresAt: meta.questionExpiresAt ?? null,
          sentiment,
        },
        timestamp: now(),
      }),
    )
  }

  private async checkIpRateLimit(ipHash: string): Promise<boolean> {
    // Per-IP per-minute rate limiting (SEC-01): max 15 connections per minute (supports exponential backoff retries).
    const limits = (await this.ctx.storage.get<Record<string, number[]>>(K_IP_RATE_LIMIT)) ?? {}
    const nowMs = now()
    const windowMs = 60 * 1000 // 1 minute window
    const cutoffMs = nowMs - windowMs

    // Get timestamps for this IP
    const timestamps = limits[ipHash] ?? []
    // Remove old timestamps outside the window
    const recentTimestamps = timestamps.filter((ts) => ts > cutoffMs)

    const maxPerMin = Number.parseInt(this.env.WS_CONNECT_PER_IP_PER_MIN ?? '15', 10) || 15
    const limitExceeded = recentTimestamps.length >= maxPerMin

    if (!limitExceeded) {
      // Record this connection attempt
      recentTimestamps.push(nowMs)
      limits[ipHash] = recentTimestamps
      await this.ctx.storage.put(K_IP_RATE_LIMIT, limits)
    }

    return limitExceeded
  }

  private async setPaused(paused: boolean): Promise<void> {
    const meta = await this.ctx.storage.get<Meta>(K_META)
    if (!meta) return
    await this.ctx.storage.put(K_META, { ...meta, paused })
    const type = paused ? 'session_paused' : 'session_resumed'
    const msg = serverMessage({ type, data: {}, timestamp: now() })
    for (const ws of this.ctx.getWebSockets()) {
      try { ws.send(msg) } catch { /* stale socket */ }
    }
  }

  private async broadcastEnergizer(energizer: LiveEnergizerState | null): Promise<void> {
    const msg = serverMessage({
      type: 'energizer_state',
      data: { energizer },
      timestamp: now(),
    })
    for (const ws of this.ctx.getWebSockets()) {
      try { ws.send(msg) } catch { /* stale socket */ }
    }
  }

  private canActivateEnergizer(att: Attachment): boolean {
    if (att.role !== 'presenter') return false
    return att.permissions === undefined || att.permissions.includes('energizer:activate')
  }

  private canControlSession(att: Attachment): boolean {
    if (att.role !== 'presenter') return false
    return att.permissions === undefined || att.permissions.includes('session:launch') || att.permissions.includes('session:close')
  }

  private async emitEnergizerMetric(
    name:
      | 'ws.energizer_activated'
      | 'ws.energizer_activation_denied'
      | 'ws.energizer_advance_denied'
      | 'ws.energizer_answered'
      | 'ws.energizer_advanced'
      | 'ws.energizer_completed',
    energizerId: string | undefined,
    count: number,
  ): Promise<void> {
    const meta = await this.ctx.storage.get<Meta>(K_META)
    writeEvent(this.env.METRICS_AE, {
      name,
      sessionId: meta?.sessionId,
      teamId: meta?.teamId,
      plan: meta?.plan ?? 'free',
      count,
      traceId: energizerId,
    })
  }

  private async recordEnergizerAudit(
    action:
      | 'ws.energizer_activated'
      | 'ws.energizer_activation_denied'
      | 'ws.energizer_advance_denied'
      | 'ws.energizer_answered'
      | 'ws.energizer_advanced'
      | 'ws.energizer_completed',
    att: Attachment,
    energizer: Pick<LiveEnergizerState, 'id' | 'kind' | 'status'> | { id?: string; kind?: string; status?: string } | null | undefined,
    extra: Record<string, number | string | boolean | null> = {},
  ): Promise<void> {
    if (!this.env.DB || !energizer?.id) return
    try {
      await this.env.DB.prepare(
        `INSERT INTO audit_events
         (id, ts, actor_id, actor_ip, action, subject_type, subject_id, before_snapshot, after_snapshot, trace_id, idempotency_key)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
         ON CONFLICT DO NOTHING`,
      )
        .bind(
          crypto.randomUUID(),
          now(),
          att.voterId,
          att.ipHash,
          action,
          'energizer',
          energizer.id,
          '{}',
          JSON.stringify({
            kind: energizer.kind ?? null,
            status: energizer.status ?? null,
            ...extra,
          }),
          `${action}:${energizer.id}:${now()}`,
          null,
        )
        .run()
    } catch {
      // Audit evidence is best-effort from the realtime path; never break LIVE traffic.
    }
  }

  private async broadcastParticipants(): Promise<void> {
    const count = this.ctx.getWebSockets().length
    const msg = serverMessage({
      type: 'participants',
      data: { count },
      timestamp: now(),
    })
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(msg)
      } catch {
        /* ignore */
      }
    }
  }

  // ── Response helpers ──────────────────────────────────────────────────────
  private jsonOk(data: unknown): Response {
    return new Response(JSON.stringify({ ok: true, data }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }

  private jsonError(status: number, code: string, message: string): Response {
    return new Response(JSON.stringify({ ok: false, error: { code, message } }), {
      status,
      headers: { 'content-type': 'application/json' },
    })
  }
}

function isValidLiveEnergizer(value: unknown): value is LiveEnergizerState {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<LiveEnergizerState>
  const baseValid =
    typeof candidate.id === 'string' &&
    candidate.id.length > 0 &&
    typeof candidate.title === 'string' &&
    candidate.title.length > 0 &&
    ['quick_finger', 'team_quiz', 'emoji_poll', 'word_cloud'].includes(candidate.kind ?? '') &&
    (candidate.status === undefined || candidate.status === 'active' || candidate.status === 'completed')
  if (!baseValid) return false
  if (candidate.kind === 'team_quiz') {
    if (!Array.isArray(candidate.questions) || candidate.questions.length === 0) return false
    return candidate.questions.every((question) => {
      if (!question || typeof question !== 'object') return false
      const q = question as Partial<NonNullable<LiveEnergizerState['questions']>[number]>
      return (
        typeof q.prompt === 'string' &&
        q.prompt.trim().length > 0 &&
        Array.isArray(q.options) &&
        q.options.length >= 2 &&
        q.options.every((option) => typeof option === 'string' && option.trim().length > 0) &&
        typeof q.correctIndex === 'number' &&
        Number.isInteger(q.correctIndex) &&
        q.correctIndex >= 0 &&
        q.correctIndex < q.options.length
      )
    })
  }
  if (candidate.kind !== 'quick_finger') return true
  if (candidate.options !== undefined) {
    if (!Array.isArray(candidate.options) || candidate.options.some((option) => typeof option !== 'string' || option.trim().length === 0)) {
      return false
    }
  }
  if (candidate.correctIndex !== undefined) {
    if (typeof candidate.correctIndex !== 'number' || !Number.isInteger(candidate.correctIndex)) return false
    if (!candidate.options || candidate.correctIndex < 0 || candidate.correctIndex >= candidate.options.length) return false
  }
  return true
}

function initialiseLiveEnergizer(energizer: LiveEnergizerState): LiveEnergizerState {
  if (energizer.kind === 'team_quiz') {
    return {
      ...energizer,
      status: 'active',
      startedAt: energizer.startedAt ?? now(),
      currentIndex: 0,
      submissions: [],
      scores: [],
      leaderboard: [],
      badges: {},
    }
  }
  return {
    ...energizer,
    status: 'active',
    startedAt: energizer.startedAt ?? now(),
    answers: [],
    leaderboard: [],
    badges: {},
  }
}

function rankQuickFingerAnswers(answers: NonNullable<LiveEnergizerState['answers']>): NonNullable<LiveEnergizerState['answers']> {
  const correct = answers
    .filter((answer) => answer.correct)
    .sort((a, b) => a.speedMs - b.speedMs)
    .map((answer, index) => ({ ...answer, rank: index + 1 }))
  const incorrect = answers
    .filter((answer) => !answer.correct)
    .sort((a, b) => a.speedMs - b.speedMs)
    .map((answer) => ({ ...answer, rank: 0 }))
  return [...correct, ...incorrect]
}

function rankTeamQuizScores(submissions: NonNullable<LiveEnergizerState['submissions']>): NonNullable<LiveEnergizerState['scores']> {
  const totals = new Map<string, number>()
  for (const submission of submissions) {
    totals.set(submission.voterId, (totals.get(submission.voterId) ?? 0) + (submission.correct ? 1 : 0))
  }
  return [...totals.entries()]
    .map(([voterId, score]) => ({ voterId, score, rank: 0 }))
    .sort((a, b) => b.score - a.score || a.voterId.localeCompare(b.voterId))
    .map((score, index) => ({ ...score, rank: index + 1 }))
}

function withScoreArtifacts(energizer: LiveEnergizerState): LiveEnergizerState {
  if (energizer.kind === 'quick_finger') {
    return withQuickFingerScoreArtifacts(energizer)
  }
  if (energizer.kind === 'team_quiz') {
    return withTeamQuizScoreArtifacts(energizer)
  }
  return energizer
}

function withQuickFingerScoreArtifacts(energizer: LiveEnergizerState): LiveEnergizerState {
  const answers = energizer.answers ?? []
  const startedAt = energizer.startedAt ?? 0
  const totals = new Map<string, number>()
  for (const answer of answers) {
    const speedBonus = answer.rank > 0 ? Math.max(1, 4 - answer.rank) : 0
    totals.set(answer.voterId, (totals.get(answer.voterId) ?? 0) + (answer.correct ? 10 + speedBonus : 0))
  }
  const badges = new Map<string, NonNullable<LiveEnergizerState['badges']>[string]>()
  const firstAnswer = [...answers].sort((a, b) => a.speedMs - b.speedMs)[0]
  if (firstAnswer) addBadge(badges, firstAnswer.voterId, energizer.id, 'first_answer', 'First answer', startedAt)
  for (const answer of answers.filter((entry) => entry.rank > 0 && entry.rank <= 3)) {
    addBadge(badges, answer.voterId, energizer.id, 'speedster', 'Speedster', startedAt)
  }
  return {
    ...energizer,
    badges: Object.fromEntries(badges),
    leaderboard: buildLeaderboard(totals, badges),
  }
}

function withTeamQuizScoreArtifacts(energizer: LiveEnergizerState): LiveEnergizerState {
  const submissions = energizer.submissions ?? []
  const startedAt = energizer.startedAt ?? 0
  const scores = rankTeamQuizScores(submissions)
  const badges = new Map<string, NonNullable<LiveEnergizerState['badges']>[string]>()
  const firstSubmission = submissions[0]
  if (firstSubmission) addBadge(badges, firstSubmission.voterId, energizer.id, 'first_answer', 'First answer', startedAt)
  const byVoter = new Map<string, typeof submissions>()
  for (const submission of submissions) {
    byVoter.set(submission.voterId, [...(byVoter.get(submission.voterId) ?? []), submission])
  }
  const totalQuestions = energizer.questions?.length ?? 0
  for (const [voterId, voterSubmissions] of byVoter) {
    if (voterSubmissions.length >= 2) addBadge(badges, voterId, energizer.id, 'engaged', 'Engaged', startedAt)
    if (
      energizer.status === 'completed' &&
      totalQuestions > 0 &&
      voterSubmissions.length >= totalQuestions &&
      voterSubmissions.every((submission) => submission.correct)
    ) {
      addBadge(badges, voterId, energizer.id, 'perfect_trivia', 'Perfect trivia', startedAt)
    }
  }
  const totals = new Map(scores.map((score) => [score.voterId, score.score]))
  return {
    ...energizer,
    scores,
    badges: Object.fromEntries(badges),
    leaderboard: buildLeaderboard(totals, badges),
  }
}

function addBadge(
  badges: Map<string, NonNullable<LiveEnergizerState['badges']>[string]>,
  voterId: string,
  energizerId: string,
  kind: NonNullable<LiveEnergizerState['badges']>[string][number]['kind'],
  label: string,
  awardedAt: number,
): void {
  const existing = badges.get(voterId) ?? []
  const id = `${energizerId}:${kind}:${voterId}`
  if (existing.some((badge) => badge.id === id)) return
  badges.set(voterId, [...existing, { id, kind, label, awardedAt }])
}

function buildLeaderboard(
  totals: Map<string, number>,
  badges: Map<string, NonNullable<LiveEnergizerState['badges']>[string]>,
): NonNullable<LiveEnergizerState['leaderboard']> {
  return [...totals.entries()]
    .map(([voterId, score]) => ({ voterId, score }))
    .sort((a, b) => b.score - a.score || a.voterId.localeCompare(b.voterId))
    .slice(0, 10)
    .map((entry, index) => ({
      voterId: entry.voterId,
      label: `Player ${index + 1}`,
      score: entry.score,
      rank: index + 1,
      badges: badges.get(entry.voterId) ?? [],
    }))
}
