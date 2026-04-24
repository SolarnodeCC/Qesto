// SessionRoom — Durable Object hosting LIVE session state (ADR-0001).
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
  type ClientMessage,
  type LiveQuestion,
  type LiveSessionSummary,
  type ServerMessage,
} from './realtime'
import type { Env, VotePolicy, SessionMode } from './types'

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

// Fun-mode: 60 s per question before auto-advance signal.
const FUN_MODE_QUESTION_MS = 60_000

type Meta = {
  sessionId: string
  ownerId: string
  code: string
  title: string
  startedAt: number
  votePolicy: VotePolicy
  sessionMode: SessionMode
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
// Legacy rows persisted before this change are `Record<string, string>`. Any
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

// Kinds for which one voter may submit multiple accepted values. `word_cloud`
// is in here because each submitted phrase counts as an independent entry.
const MULTI_VOTE_KINDS = new Set(['multi_select', 'upvote', 'word_cloud'])

// `word_cloud` and `open` accept any text as the "optionId". Other kinds
// must reference a preconfigured option.
function isFreeTextKind(kind: LiveQuestion['kind']): boolean {
  return kind === 'word_cloud' || kind === 'open'
}

// ── Per-connection attachment stored on each WebSocket ──────────────────────
type Attachment = {
  role: 'presenter' | 'voter'
  voterId: string
  ipHash: string
  bucket: { tokens: number; lastAt: number }
}

const PER_IP_CONCURRENT_CAP = 5
const VOTE_BUCKET_CAPACITY = 10
const VOTE_BUCKET_REFILL_PER_SEC = 1

const BROADCAST_DEBOUNCE_MS = 100

// ── Message helpers ─────────────────────────────────────────────────────────
function serverMessage(msg: ServerMessage): string {
  return JSON.stringify(msg)
}

function now(): number {
  return Date.now()
}

function errorMessage(code: string, message: string): string {
  return serverMessage({ type: 'error', data: { code, message }, timestamp: now() })
}

// ── DurableObject ───────────────────────────────────────────────────────────
export class SessionRoom implements DurableObject {
  private readonly ctx: DurableObjectState
  private readonly env: Env
  private resultsDirty = false

  constructor(ctx: DurableObjectState, env: Env) {
    this.ctx = ctx
    this.env = env
    void this.env // retained for Phase 4 D1 persistence; see file header.
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url)
    if (url.pathname === '/init' && req.method === 'POST') return this.handleInit(req)
    if (url.pathname === '/close' && req.method === 'POST') return this.handleClose()
    if (url.pathname === '/state' && req.method === 'GET') return this.handleState()
    if (url.pathname === '/ws' && req.headers.get('upgrade') === 'websocket') {
      return this.handleUpgrade(req)
    }
    return new Response(
      JSON.stringify({ ok: false, error: { code: 'not_found', message: 'Unknown DO route' } }),
      { status: 404, headers: { 'content-type': 'application/json' } },
    )
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
          code?: string
          title?: string
          question?: LiveQuestion | null
          questions?: LiveQuestion[]
          votePolicy?: VotePolicy
          sessionMode?: SessionMode
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
      code: body.code,
      title: body.title,
      startedAt: nowMs,
      votePolicy: body.votePolicy ?? 'once',
      sessionMode,
      ...(sessionMode === 'fun' ? { questionExpiresAt: nowMs + FUN_MODE_QUESTION_MS } : {}),
    }
    await this.ctx.storage.put(K_META, meta)
    await this.ctx.storage.put(K_STATUS, 'live')
    await this.ctx.storage.put(K_COUNTS, {} as Counts)
    await this.ctx.storage.put(K_VOTERS, {} as Votes)
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
    if (status !== 'live') {
      return this.jsonError(409, 'not_live', 'Session is not LIVE')
    }
    const counts = (await this.ctx.storage.get<Counts>(K_COUNTS)) ?? {}
    const votes = normaliseVotes(
      await this.ctx.storage.get<Record<string, string | string[]>>(K_VOTERS),
    )
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
    // all rows will persist. See docs/ARCHITECTURE.md.
    const voteList = Object.entries(votes).flatMap(([voterId, optionIds]) =>
      optionIds.map((optionId) => ({ voterId, optionId })),
    )
    return this.jsonOk({ counts, total, votes: voteList, questionId })
  }

  // ── /state (debug/test) ───────────────────────────────────────────────────
  private async handleState(): Promise<Response> {
    const meta = await this.ctx.storage.get<Meta>(K_META)
    const question = await this.ctx.storage.get<LiveQuestion>(K_QUESTION)
    const counts = (await this.ctx.storage.get<Counts>(K_COUNTS)) ?? {}
    const voters = normaliseVotes(
      await this.ctx.storage.get<Record<string, string | string[]>>(K_VOTERS),
    )
    const status = (await this.ctx.storage.get<string>(K_STATUS)) ?? 'uninitialised'
    return this.jsonOk({
      meta: meta ?? null,
      question: question ?? null,
      counts,
      voterCount: Object.keys(voters).length,
      connections: this.ctx.getWebSockets().length,
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
    if (!voterId || !ipHash) {
      return new Response('Missing voter headers', { status: 400 })
    }

    // Per-IP concurrent connection cap (S5).
    if (role === 'voter') {
      const existing = this.ctx.getWebSockets(`ip:${ipHash}`)
      if (existing.length >= PER_IP_CONCURRENT_CAP) {
        return new Response('Too many connections from this IP', { status: 429 })
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
    }
    server.serializeAttachment(attachment)
    this.ctx.acceptWebSocket(server, [`ip:${ipHash}`, `voter:${voterId}`, `role:${role}`])

    // Send init snapshot immediately.
    await this.sendInit(server, attachment)
    await this.broadcastParticipants()

    return new Response(null, { status: 101, webSocket: client })
  }

  // ── Hibernation callbacks ─────────────────────────────────────────────────
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const text = typeof message === 'string' ? message : new TextDecoder().decode(message)
    let parsed: ClientMessage | null = null
    try {
      parsed = JSON.parse(text) as ClientMessage
    } catch {
      ws.send(errorMessage('bad_json', 'Message is not valid JSON'))
      return
    }
    if (!parsed || typeof parsed.type !== 'string') {
      ws.send(errorMessage('bad_message', 'Missing type'))
      return
    }
    const att = ws.deserializeAttachment() as Attachment | null
    if (!att) {
      ws.close(CLOSE_POLICY_VIOLATION, 'missing attachment')
      return
    }

    switch (parsed.type) {
      case 'vote':
        await this.handleVote(ws, att, parsed.data)
        break
      case 'advance': {
        if (att.role !== 'presenter') {
          ws.send(errorMessage('forbidden', 'Only presenter can advance'))
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
        const advanceMsg = serverMessage({ type: 'question', data: { question: nextQ }, timestamp: now() })
        for (const socket of this.ctx.getWebSockets()) {
          try { socket.send(advanceMsg) } catch { /* ignore closed socket */ }
        }
        break
      }
      case 'back': {
        if (att.role !== 'presenter') {
          ws.send(errorMessage('forbidden', 'Only presenter can go back'))
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
        const backMsg = serverMessage({ type: 'question', data: { question: prevQ }, timestamp: now() })
        for (const socket of this.ctx.getWebSockets()) {
          try { socket.send(backMsg) } catch { /* ignore closed socket */ }
        }
        break
      }
      case 'request_state':
        await this.sendInit(ws, att)
        break
      case 'pause':
        if (att.role !== 'presenter') {
          ws.send(errorMessage('forbidden', 'Only presenter can pause'))
          return
        }
        await this.setPaused(true)
        break
      case 'resume':
        if (att.role !== 'presenter') {
          ws.send(errorMessage('forbidden', 'Only presenter can resume'))
          return
        }
        await this.setPaused(false)
        break
      default:
        ws.send(errorMessage('unknown_type', `Unknown type: ${(parsed as { type?: string }).type}`))
    }
  }

  async webSocketClose(ws: WebSocket, _code: number, _reason: string, _wasClean: boolean): Promise<void> {
    try {
      ws.close(CLOSE_NORMAL, 'bye')
    } catch {
      /* already closed */
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
  private async handleVote(
    ws: WebSocket,
    att: Attachment,
    data: { questionId?: string; optionId?: string },
  ): Promise<void> {
    // Token-bucket rate limit (S5).
    const nowMs = now()
    const elapsed = (nowMs - att.bucket.lastAt) / 1000
    const refilled = Math.min(VOTE_BUCKET_CAPACITY, att.bucket.tokens + elapsed * VOTE_BUCKET_REFILL_PER_SEC)
    if (refilled < 1) {
      ws.send(errorMessage('rate_limited', 'Slow down'))
      ws.close(CLOSE_POLICY_VIOLATION, 'vote flood')
      return
    }
    att.bucket = { tokens: refilled - 1, lastAt: nowMs }
    ws.serializeAttachment(att)

    const meta = await this.ctx.storage.get<Meta>(K_META)
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
    if (!isFreeTextKind(question.kind) && !question.options.some((o) => o.id === optionId)) {
      ws.send(errorMessage('bad_option', 'Unknown option'))
      return
    }

    const votePolicy = meta?.votePolicy ?? 'once'

    const voters = normaliseVotes(
      await this.ctx.storage.get<Record<string, string | string[]>>(K_VOTERS),
    )
    const counts = (await this.ctx.storage.get<Counts>(K_COUNTS)) ?? {}

    if (MULTI_VOTE_KINDS.has(question.kind)) {
      // multi_select / upvote / word_cloud: voter may submit several entries.
      // Reject an exact duplicate selection (same optionId already sent by
      // this voter) but otherwise append to the array.
      const previous = voters[att.voterId] ?? []
      if (previous.includes(optionId)) {
        ws.send(errorMessage('duplicate', 'You already selected this option'))
        return
      }
      voters[att.voterId] = [...previous, optionId]
      counts[optionId] = (counts[optionId] ?? 0) + 1
    } else if (votePolicy === 'once') {
      // Reject duplicate — one vote per voter, immutable.
      if ((voters[att.voterId]?.length ?? 0) > 0) {
        ws.send(errorMessage('duplicate', 'You already voted on this question'))
        return
      }
      voters[att.voterId] = [optionId]
      counts[optionId] = (counts[optionId] ?? 0) + 1
    } else if (votePolicy === 'multi') {
      // Allow vote change — decrement old choice, increment new choice.
      const previous = voters[att.voterId]?.[0]
      if (previous === optionId) {
        ws.send(errorMessage('duplicate', 'You already selected this option'))
        return
      }
      if (previous) {
        counts[previous] = Math.max(0, (counts[previous] ?? 1) - 1)
      }
      voters[att.voterId] = [optionId]
      counts[optionId] = (counts[optionId] ?? 0) + 1
    } else {
      // react: accumulate reactions, no deduplication per voter.
      counts[optionId] = (counts[optionId] ?? 0) + 1
      // Store last reaction per voter (for D1 persistence on close).
      voters[att.voterId] = [optionId]
    }

    await this.ctx.storage.put(K_VOTERS, voters)
    await this.ctx.storage.put(K_COUNTS, counts)

    await this.scheduleResultsBroadcast()
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
    const counts = (await this.ctx.storage.get<Counts>(K_COUNTS)) ?? {}
    const total = Object.values(counts).reduce((a, b) => a + b, 0)
    const session: LiveSessionSummary = {
      id: meta.sessionId,
      code: meta.code,
      title: meta.title,
      status: 'live',
      votePolicy: meta.votePolicy,
      sessionMode: meta.sessionMode,
    }
    ws.send(
      serverMessage({
        type: 'init',
        data: {
          session,
          role: att.role,
          voterId: att.voterId,
          question,
          results: { counts, total },
          participants: this.ctx.getWebSockets().length,
          expiresAt: meta.questionExpiresAt ?? null,
        },
        timestamp: now(),
      }),
    )
  }

  private async checkIpRateLimit(ipHash: string): Promise<boolean> {
    // Per-IP per-minute rate limiting (SEC-01): max 5 connections per minute.
    const limits = (await this.ctx.storage.get<Record<string, number[]>>(K_IP_RATE_LIMIT)) ?? {}
    const nowMs = now()
    const windowMs = 60 * 1000 // 1 minute window
    const cutoffMs = nowMs - windowMs

    // Get timestamps for this IP
    const timestamps = limits[ipHash] ?? []
    // Remove old timestamps outside the window
    const recentTimestamps = timestamps.filter((ts) => ts > cutoffMs)

    // Check if limit exceeded
    const limitExceeded = recentTimestamps.length >= 5

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
