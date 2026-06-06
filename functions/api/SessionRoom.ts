// SessionRoom — Durable Object hosting LIVE session state (ADR-0001).
// Refactored per TD-01: collaborators extracted to separate modules.
// See TECH_DEBT_AUDIT_2026-05.md TD-01.

import {
  CLOSE_NORMAL,
  CLOSE_POLICY_VIOLATION,
  LIVE_PROTOCOL_VERSION,
  LIVE_PROTOCOL_VERSION_V2,
  isLiveProtocolSupported,
  liveProtocolFeatures,
  TOWNHALL_FEATURE,
  IDEATE_FEATURE,
  townhallEnabled,
  type LiveProtocolVersion,
  type LiveEnergizerState,
  type LiveQuestion,
  type LiveSessionSummary,
  type ServerMessage,
} from './realtime'
import type { Env, VotePolicy, SessionMode, PlanTier, Anonymity, TownhallModeration, QuestionKind } from './types'
import { PLAN_QUOTAS } from './types'
import { writeEvent } from './lib/observability'
import { applyVoteMutation, evaluateVoteAdmission } from './lib/session-room-vote'
import { TOWNHALL_KEYS } from './lib/session-room-townhall'
import { parseClientMessage, type ValidClientMessage } from './lib/protocol-schemas'
import { analyzeOpenResponseSentiment, SENTIMENT_COOLDOWN_MS } from './lib/ai/sentiment'
import { sentimentContextFromMeta } from './lib/ai/session-context'
import { RateLimiter } from './lib/session-room-rate-limiter'
import { EnergizerHandler } from './lib/session-room-energizer-handler'
import { TownhallHandler } from './lib/session-room-townhall-handler'
import { RetroHandler } from './lib/session-room-retro-handler'
import { IdeateHandler } from './lib/session-room-ideate-handler'
import { logEvent } from './lib/log'
import { flagOff } from './lib/flags'

// ── Persisted state keys (ctx.storage) ──────────────────────────────────────
const K_META = 'meta'
const K_QUESTION = 'question'
const K_QUESTIONS = 'questions'
const K_QUESTION_INDEX = 'question_index'
/** ENTERPRISE-POLISH §1c: pending open responses awaiting presenter approval. */
const K_PENDING_RESPONSES = 'pending_responses'
const K_COUNTS = 'counts'
const K_VOTERS = 'voters'
const K_STATUS = 'status'
const K_ACTIVE_ENERGIZER = 'active_energizer'
const K_SENTIMENT_MOOD = 'sentiment:mood'
const K_SENTIMENT_LAST = 'sentiment:last'
const K_SENTIMENT_RETRY_QUEUE = 'sentiment:retry_queue'
const K_SENTIMENT_RETRY_COUNT = 'sentiment:retry_count'
const SENTIMENT_RETRY_DELAY_MS = 5_000
const SENTIMENT_MAX_RETRIES = 1

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
  /** TOWNHALL (ADR-0044): moderation model for townhall-mode sessions. */
  townhallModeration?: TownhallModeration
  /** RETRO (ADR-0048): dot-vote limit for action items. */
  retroDotVoteLimit?: number
  /**
   * Leaderboard display mode (ENTERPRISE-POLISH s4b).
   * - 'names'   : show voterId / display name (default)
   * - 'aliases' : replace identities with deterministic per-session pseudonyms
   * - 'hidden'  : suppress leaderboard from participant view entirely
   */
  leaderboardDisplay?: 'names' | 'aliases' | 'hidden'
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
  /** OBS-COLO-01 — edge colo at WebSocket connect time. */
  colo?: string
  /** Protocol version negotiated at WebSocket connect time. */
  protocolVersion?: number
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

type BufferedVote = {
  sessionId: string
  questionId: string
  voterId: string
  optionId: string
  submittedAt: number
}

export class SessionRoom implements DurableObject {
  private readonly ctx: DurableObjectState
  private readonly env: Env
  private resultsDirty = false
  private _voters: Votes | null = null
  private _votersInitPromise: Promise<void> | null = null
  private readonly clientWsHandlers: Record<ValidClientMessage['type'], ClientWsHandler>

  // ── Phase 2.2: Vote buffering (ADR-042) ──────────────────────────────────
  private voteBuffer: BufferedVote[] = []
  private lastFlushAt: number = Date.now()
  private flushScheduled = false
  private readonly FLUSH_INTERVAL_MS = 5000 // 5 seconds
  private readonly FLUSH_THRESHOLD = 1000 // 1000 votes
  private _counts: Counts | null = null // In-memory vote count cache during buffering

  // ── Phase 2.3: R2 snapshots (ADR-042) ────────────────────────────────────
  private lastSnapshotAt: number = Date.now()
  private readonly SNAPSHOT_INTERVAL_MS = 30_000 // 30 seconds

  // ── Collaborators (TD-01 refactor) ────────────────────────────────────────
  private readonly rateLimiter: RateLimiter
  private readonly energizerHandler: EnergizerHandler
  private readonly townhallHandler: TownhallHandler
  private readonly retroHandler: RetroHandler
  private readonly ideateHandler: IdeateHandler

  constructor(ctx: DurableObjectState, env: Env) {
    this.ctx = ctx
    this.env = env

    this.rateLimiter = new RateLimiter(ctx.storage)
    this.energizerHandler = new EnergizerHandler(ctx as any, env, this.scheduleAlarm.bind(this))
    this.townhallHandler = new TownhallHandler(ctx as any, env)
    this.retroHandler = new RetroHandler(ctx as any)
    this.ideateHandler = new IdeateHandler(ctx as any, env, this.scheduleAlarm.bind(this))

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
      add_question: async (ws, att, msg) => {
        if (msg.type !== 'add_question') return
        await this.handleAddQuestion(ws, att, msg.data)
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
        await this.energizerHandler.handleActivate(ws, att, msg.data.energizer as LiveEnergizerState)
      },
      energizer_answer: async (ws, att, msg) => {
        if (msg.type !== 'energizer_answer') return
        await this.energizerHandler.handleAnswer(ws, att, msg.data)
      },
      energizer_advance: async (ws, att, msg) => {
        if (msg.type !== 'energizer_advance') return
        await this.energizerHandler.handleAdvance(ws, att, msg.data)
      },
      // TOWNHALL (ADR-0044). Board state machine: see lib/session-room-townhall-handler.ts.
      townhall_submit: async (ws, att, msg) => {
        if (msg.type !== 'townhall_submit') return
        await this.townhallHandler.handleSubmit(ws, att, { body: msg.data.body, displayName: msg.data.displayName })
      },
      townhall_upvote: async (ws, att, msg) => {
        if (msg.type !== 'townhall_upvote') return
        await this.townhallHandler.handleUpvote(ws, att, msg.data)
      },
      townhall_moderate: async (ws, att, msg) => {
        if (msg.type !== 'townhall_moderate') return
        await this.townhallHandler.handleModerate(ws, att, { itemId: msg.data.itemId, action: msg.data.action, groupParentId: msg.data.groupParentId })
      },
      retro_submit: async (ws, att, msg) => {
        if (msg.type !== 'retro_submit') return
        await this.retroHandler.handleSubmit(ws, att, { column: msg.data.column, body: msg.data.body })
      },
      retro_upvote: async (ws, att, msg) => {
        if (msg.type !== 'retro_upvote') return
        await this.retroHandler.handleUpvote(ws, att, { itemId: msg.data.itemId })
      },
      ideate_submit: async (ws, att, msg) => {
        if (msg.type !== 'ideate_submit') return
        await this.ideateHandler.handleSubmit(ws, att, { body: msg.data.body })
      },
      ideate_upvote: async (ws, att, msg) => {
        if (msg.type !== 'ideate_upvote') return
        await this.ideateHandler.handleUpvote(ws, att, { itemId: msg.data.itemId })
      },
      ideate_reveal: async (ws, att, msg) => {
        if (msg.type !== 'ideate_reveal') return
        await this.ideateHandler.handleReveal(ws, att)
      },
      ideate_dismiss: async (ws, att, msg) => {
        if (msg.type !== 'ideate_dismiss') return
        await this.ideateHandler.handleDismiss(ws, att, { itemId: msg.data.itemId })
      },
      ideate_merge: async (ws, att, msg) => {
        if (msg.type !== 'ideate_merge') return
        await this.ideateHandler.handleMerge(ws, att, {
          targetId: msg.data.targetId,
          sourceId: msg.data.sourceId,
        })
      },
      // ENTERPRISE-POLISH §1c — response moderation for open questions.
      approve_response: async (ws, att, msg) => {
        if (msg.type !== 'approve_response') return
        await this.handleApproveResponse(ws, att, msg.data)
      },
      reject_response: async (ws, att, msg) => {
        if (msg.type !== 'reject_response') return
        await this.handleRejectResponse(ws, att, msg.data)
      },
    }
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url)
    if (url.pathname === '/init' && req.method === 'POST') return this.handleInit(req)
    if (url.pathname === '/close' && req.method === 'POST') return this.handleClose()
    if (url.pathname === '/transition-to-live' && req.method === 'POST') return this.handleTransitionToLive()
    if (url.pathname === '/state' && req.method === 'GET') return this.handleState()
    if (url.pathname === '/copilot/snapshot' && req.method === 'GET') return this.handleCopilotSnapshot()
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
    // Parse body once and reuse it.
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
        }
      | null

    const status = (await this.ctx.storage.get<string>(K_STATUS)) ?? null

    // Phase 2.3: If DO was evicted mid-session, attempt to hydrate from R2 snapshot.
    if (status === null && body?.sessionId) {
      // Temporarily set meta for hydration to work.
      const tempMeta: Meta = { sessionId: body.sessionId, ownerId: '', code: '', title: '', startedAt: 0, votePolicy: 'once', sessionMode: 'reflection' }
      await this.ctx.storage.put(K_META, tempMeta)
      await this.maybeHydrate()
    }

    if (status === 'live' || status === 'closed') {
      return this.jsonError(409, 'already_initialised', 'Session already initialised')
    }
    if (!body || !body.sessionId || !body.ownerId || !body.code || !body.title) {
      return this.jsonError(400, 'bad_request', 'Missing init fields')
    }
    const nowMs = now()
    const sessionMode: SessionMode = body.sessionMode ?? 'reflection'
    const isTownhall = sessionMode === 'townhall' && townhallEnabled(this.env)
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
    await this.ctx.storage.put(K_META, meta)
    if (isRetro) {
      await this.retroHandler.seedBoard(body.retroDotVoteLimit ?? 3, body.retroCarriedActions ?? [])
    }
    if (isIdeate) {
      await this.ideateHandler.seedBoard(body.ideateDotVoteLimit ?? 5, body.ideateClusterDebounceMs ?? 3000)
    }
    if (isTownhall) {
      // Seed an empty persistent board. Items/upvoters are point-addressable keys
      // written on demand; the index + spotlight + rev are the board's spine.
      await this.ctx.storage.put(TOWNHALL_KEYS.index, [] as string[])
      await this.ctx.storage.put(TOWNHALL_KEYS.spotlight, null)
      await this.ctx.storage.put(TOWNHALL_KEYS.rev, 0)
    }
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
    // Phase 2.2: Flush any remaining buffered votes before closing.
    await this.flushVotesToD1AndKV()

    const status = (await this.ctx.storage.get<string>(K_STATUS)) ?? null
    if (status !== 'live' && status !== 'energizing') {
      return this.jsonError(409, 'not_live', 'Session is not active')
    }
    // Use cached counts if available, otherwise load from storage.
    const counts = this._counts ?? (await this.ctx.storage.get<Counts>(K_COUNTS)) ?? {}
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

    // Phase 2.3: Take final snapshot before session closes.
    await this.maybeSnapshot()
    // TOWNHALL (ADR-0044): persist the board to D1 on close — the export + GDPR-erasure tier.
    const meta = await this.ctx.storage.get<Meta>(K_META)
    if (meta?.townhallModeration) {
      try {
        await this.townhallHandler.persistBoard(meta.sessionId, now())
      } catch (err) {
        logEvent({ event: 'townhall.persist_failed', sessionId: meta.sessionId, err: String(err) })
      }
    }
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
    let retroActionItems: string[] = []
    let retroStats: { wentWell: number; didntGoWell: number; actions: number; totalCards: number } | undefined
    if (meta?.sessionMode === 'retro') {
      try {
        retroActionItems = await this.retroHandler.collectActionItemsForWorkspace()
        retroStats = await this.retroHandler.collectStatsForTrend()
      } catch (err) {
        logEvent({ event: 'retro.collect_actions_failed', sessionId: meta.sessionId, err: String(err) })
      }
    }
    return this.jsonOk({ counts, total, votes: voteList, questionId, retroActionItems, retroStats })
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

  // ── /copilot/snapshot (COPILOT-01, ADR-0046) ──────────────────────────────
  // Aggregate, PII-free read of the live room for the facilitator copilot.
  // Inference happens off the DO in the Pages Function; this only exposes state
  // the DO already holds. Sentiment mood is omitted in zero-knowledge sessions.
  private async handleCopilotSnapshot(): Promise<Response> {
    const meta = await this.ctx.storage.get<Meta>(K_META)
    const question = await this.ctx.storage.get<LiveQuestion>(K_QUESTION)
    const counts = (await this.ctx.storage.get<Counts>(K_COUNTS)) ?? {}
    const voters = await this.ensureVoters()
    const status = (await this.ctx.storage.get<string>(K_STATUS)) ?? 'uninitialised'
    const isZeroKnowledge = meta?.anonymity === 'zero_knowledge'
    const mood = isZeroKnowledge
      ? null
      : (await this.ctx.storage.get<{ mood: 'positive' | 'neutral' | 'concerning'; sampleSize: number }>(K_SENTIMENT_MOOD)) ?? null

    const voterCount = Object.keys(voters).length
    const responseCount = Object.values(counts).reduce((sum, n) => sum + (typeof n === 'number' ? n : 0), 0)

    return this.jsonOk({
      status,
      currentQuestion: question
        ? { id: question.id, kind: question.kind, prompt: question.prompt, optionCount: question.options?.length ?? 0 }
        : null,
      responseCount,
      voterCount,
      participationRate: voterCount > 0 ? Math.min(1, responseCount / voterCount) : 0,
      connections: this.ctx.getWebSockets().length,
      mood,
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
      const maxPerMin = parseInt(this.env.WS_CONNECT_PER_IP_PER_MIN ?? '15', 10) || 15
      const rateLimitExceeded = await this.rateLimiter.checkIpRateLimit(ipHash, maxPerMin)
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
    if (attachment.protocolVersion === LIVE_PROTOCOL_VERSION_V2) {
      const meta = await this.ctx.storage.get<Meta>(K_META)
      writeEvent(this.env.METRICS_AE, {
        name: 'realtime.v2_negotiated',
        sessionId: meta?.sessionId,
        teamId: meta?.teamId,
        detail: attachment.colo ? `colo:${attachment.colo}` : 'v2',
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

    // Phase 2.2: Flush votes if interval elapsed or on explicit flush request.
    if (this.flushScheduled && nowMs >= this.lastFlushAt + this.FLUSH_INTERVAL_MS) {
      await this.flushVotesToD1AndKV()
    }

    // Phase 2.3: Snapshot DO state periodically to R2 for recovery.
    if (nowMs >= this.lastSnapshotAt + this.SNAPSHOT_INTERVAL_MS) {
      await this.maybeSnapshot()
      this.lastSnapshotAt = nowMs
    }

    await this.ideateHandler.runPendingCluster(nowMs)

    if (this.resultsDirty) {
      this.resultsDirty = false
      const counts = this._counts ?? (await this.ctx.storage.get<Counts>(K_COUNTS)) ?? {}
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

    // Sentiment analysis retry: if a retry job is queued, process it
    const sentimentRetry = await this.ctx.storage.get<{
      responses: string[]
      sessionId: string
      teamId?: string
      plan?: PlanTier
      attempt: number
      enqueuedAt: number
    }>(K_SENTIMENT_RETRY_QUEUE)
    if (sentimentRetry && sentimentRetry.enqueuedAt + SENTIMENT_RETRY_DELAY_MS <= nowMs) {
      const meta = await this.ctx.storage.get<Meta>(K_META)
      if (meta) {
        const ctx = sentimentContextFromMeta({
          sessionId: meta.sessionId,
          teamId: meta.teamId,
          plan: meta.plan,
          anonymity: meta.anonymity,
        })
        const result = await analyzeOpenResponseSentiment(this.env, ctx, sentimentRetry.responses)
        if (result.ok) {
          // Success: clear retry queue and update sentiment
          await this.ctx.storage.put(K_SENTIMENT_LAST, nowMs)
          await this.ctx.storage.put(K_SENTIMENT_MOOD, result)
          await this.ctx.storage.delete(K_SENTIMENT_RETRY_QUEUE)
          await this.ctx.storage.delete(K_SENTIMENT_RETRY_COUNT)
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
            timestamp: nowMs,
          })
          for (const ws of this.ctx.getWebSockets('role:presenter')) {
            try { ws.send(msg) } catch { /* ignore */ }
          }
        } else if (result.reason === 'circuit_breaker') {
          // Don't retry if circuit breaker is open
          await this.ctx.storage.delete(K_SENTIMENT_RETRY_QUEUE)
          await this.ctx.storage.delete(K_SENTIMENT_RETRY_COUNT)
          writeEvent(this.env.METRICS_AE, {
            name: 'ai.sentiment_retry_exhausted',
            sessionId: meta.sessionId,
            teamId: meta.teamId,
            plan: meta.plan ?? 'free',
            detail: 'circuit_breaker',
          })
        } else {
          // Transient failure: don't retry further (max retries exhausted)
          await this.ctx.storage.delete(K_SENTIMENT_RETRY_QUEUE)
          await this.ctx.storage.delete(K_SENTIMENT_RETRY_COUNT)
          writeEvent(this.env.METRICS_AE, {
            name: 'ai.sentiment_retry_exhausted',
            sessionId: meta.sessionId,
            teamId: meta.teamId,
            plan: meta.plan ?? 'free',
            detail: result.reason,
          })
        }
      }
    }

    // Energizer timeout: auto-complete — delegated to EnergizerHandler
    await this.energizerHandler.handleAlarmTimeout(nowMs)

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

  // ── COPILOT-06: presenter injects a copilot-drafted question (ADR-0046) ────
  // Additive on protocol v1 (ADR-0005): appends to the live question set so the
  // presenter can advance to it. Best-effort D1 persistence keeps exports/recaps
  // consistent; the live append is authoritative either way.
  private async handleAddQuestion(
    ws: WebSocket,
    att: Attachment,
    data: { question: { kind: QuestionKind; prompt: string; options: { label: string }[] } },
  ): Promise<void> {
    if (!this.canControlSession(att)) {
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

    const allQs = (await this.ctx.storage.get<LiveQuestion[]>(K_QUESTIONS)) ?? []
    allQs.push(newQuestion)
    await this.ctx.storage.put(K_QUESTIONS, allQs)
    const position = allQs.length - 1

    const meta = await this.ctx.storage.get<Meta>(K_META)
    if (meta?.sessionId) {
      try {
        await this.env.DB.prepare(
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

  private async handleVote(
    ws: WebSocket,
    att: Attachment,
    data: { questionId?: string; optionId?: string },
  ): Promise<void> {
    const t0 = Date.now()
    const meta = await this.ctx.storage.get<Meta>(K_META)
    const question = await this.ctx.storage.get<LiveQuestion>(K_QUESTION)

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
      writeEvent(this.env.METRICS_AE, {
        name: 'ws.token_bucket_contention',
        sessionId: meta?.sessionId,
        count: this.ctx.getWebSockets().length,
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

    // Phase 2.2: Load and update counts in memory, buffer for later D1 flush.
    // Counts cache is maintained in-memory and synced to storage during flush.
    if (!this._counts) {
      this._counts = (await this.ctx.storage.get<Counts>(K_COUNTS)) ?? {}
    }
    if (countKey) this._counts[countKey] = (this._counts[countKey] ?? 0) + 1
    if (countDecKey) this._counts[countDecKey] = Math.max(0, (this._counts[countDecKey] ?? 1) - 1)

    // ENTERPRISE-POLISH §1c: buffer open responses when moderation is enabled.
    if (question.kind === 'open' && question.moderated) {
      // Revert the mutation applied above — the response goes to pending, not live.
      delete voters[att.voterId]
      if (countKey) this._counts[countKey] = Math.max(0, (this._counts[countKey] ?? 1) - 1)
      type PendingResponse = { id: string; voterId: string; text: string; submittedAt: number }
      const pending = (await this.ctx.storage.get<PendingResponse[]>(K_PENDING_RESPONSES)) ?? []
      pending.push({ id: crypto.randomUUID(), voterId: att.voterId, text: optionId, submittedAt: Date.now() })
      await this.ctx.storage.put(K_PENDING_RESPONSES, pending)
      // Notify presenter only — voter gets a 'pending_moderation' ack.
      ws.send(JSON.stringify({ type: 'response_pending_moderation', data: { questionId: question.id } }))
      const pendingMsg = JSON.stringify({ type: 'pending_responses_updated', data: { count: pending.length } })
      for (const presWs of this.ctx.getWebSockets('role:presenter')) {
        try { presWs.send(pendingMsg) } catch { /* ignore */ }
      }
      return
    }

    // Phase 2.2: Buffer the vote for periodic D1 flush instead of immediate write.
    // Voters map is kept in-memory for real-time broadcasts; KV write is deferred.
    this.voteBuffer.push({
      sessionId: meta?.sessionId ?? '',
      questionId: question.id,
      voterId: att.voterId,
      optionId,
      submittedAt: Date.now(),
    })

    // Schedule flush if threshold reached or interval elapsed.
    if (this.voteBuffer.length >= this.FLUSH_THRESHOLD) {
      await this.flushVotesToD1AndKV()
    } else if (!this.flushScheduled) {
      this.scheduleFlush()
    }

    await this.scheduleResultsBroadcast()

    // OBS-VOTE-01: count = connected WebSocket participants at vote time,
    // enabling latency-vs-session-scale correlation in Analytics Engine.
    writeEvent(this.env.METRICS_AE, {
      name: 'ws.vote_submitted',
      sessionId: meta?.sessionId,
      teamId: meta?.teamId,
      plan: meta?.plan ?? 'free',
      durationMs: Date.now() - t0,
      count: this.ctx.getWebSockets().length,
      detail: att.colo ? `colo:${att.colo}` : undefined,
    })

    if (question.kind === 'open' && meta) {
      void this.maybeAnalyzeSentiment(meta, question.id, voters).catch(() => {})
    }
  }

  private async maybeAnalyzeSentiment(meta: Meta, _questionId: string, voters: Votes): Promise<void> {
    if (flagOff(this.env, 'SENTIMENT_ENABLED')) return
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
    if (!result.ok) {
      // Log failure and queue retry if not circuit breaker
      writeEvent(this.env.METRICS_AE, {
        name: 'ai.sentiment_analysis_failed',
        sessionId: meta.sessionId,
        teamId: meta.teamId,
        plan: meta.plan ?? 'free',
        count: result.sampleSize,
        detail: result.reason,
      })

      // Queue retry unless circuit breaker is open
      if (result.reason !== 'circuit_breaker') {
        const retryCount = (await this.ctx.storage.get<number>(K_SENTIMENT_RETRY_COUNT)) ?? 0
        if (retryCount < SENTIMENT_MAX_RETRIES) {
          await this.ctx.storage.put(K_SENTIMENT_RETRY_QUEUE, {
            responses,
            sessionId: meta.sessionId,
            teamId: meta.teamId,
            plan: meta.plan,
            attempt: retryCount + 1,
            enqueuedAt: Date.now(),
          })
          await this.ctx.storage.put(K_SENTIMENT_RETRY_COUNT, retryCount + 1)
          await this.scheduleAlarm(Date.now() + SENTIMENT_RETRY_DELAY_MS)
        }
      }
      return
    }

    await this.ctx.storage.put(K_SENTIMENT_LAST, Date.now())
    await this.ctx.storage.put(K_SENTIMENT_MOOD, result)
    await this.ctx.storage.delete(K_SENTIMENT_RETRY_QUEUE)
    await this.ctx.storage.delete(K_SENTIMENT_RETRY_COUNT)

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

  // Phase 2.2: Schedule a flush to fire after FLUSH_INTERVAL_MS if not already scheduled.
  private scheduleFlush(): void {
    if (this.flushScheduled) return
    this.flushScheduled = true
    const flushAt = this.lastFlushAt + this.FLUSH_INTERVAL_MS
    void this.scheduleAlarm(flushAt).catch(() => {
      // Alarm scheduling failed; reset flag so next vote attempts to reschedule.
      this.flushScheduled = false
    })
  }

  // Phase 2.2: Flush buffered votes to D1 (batch insert) and update KV cache.
  // Called when buffer threshold reached or flush interval fires.
  private async flushVotesToD1AndKV(): Promise<void> {
    if (this.voteBuffer.length === 0) {
      this.flushScheduled = false
      return
    }

    const meta = await this.ctx.storage.get<Meta>(K_META)
    if (!meta) return // Session not initialized

    const startMs = Date.now()
    try {
      // Batch insert votes into D1 (via API handler or direct DB call if available).
      const stmt = this.env.DB.prepare(
        'INSERT INTO votes (id, session_id, question_id, voter_id, option_id, submitted_at) VALUES (?, ?, ?, ?, ?, ?)',
      )

      const batch = this.voteBuffer.map((v) => [
        crypto.randomUUID(), // id
        v.sessionId,
        v.questionId,
        v.voterId,
        v.optionId,
        v.submittedAt,
      ])

      // Execute batch insert. If unique constraint violation (re-voted), ignore.
      for (const row of batch) {
        try {
          await (stmt as any).bind(...row).run()
        } catch (err) {
          // Silently ignore unique constraint violations; vote already recorded.
          if (!(err instanceof Error && err.message.includes('UNIQUE constraint failed'))) {
            throw err
          }
        }
      }

      // Sync in-memory voters and counts to DO storage (for recovery).
      if (this._voters) {
        await this.ctx.storage.put(K_VOTERS, this._voters)
      }
      if (this._counts) {
        await this.ctx.storage.put(K_COUNTS, this._counts)
      }

      // Update KV cache with latest vote state.
      if (!this.env.SESSIONS_KV) {
        logEvent({
          event: 'do.kv_unavailable',
          sessionId: meta?.sessionId,
          detail: 'SESSIONS_KV',
        })
      } else if (this._voters) {
        await this.env.SESSIONS_KV.put(
          `votes:${meta.sessionId}`,
          JSON.stringify({ voters: this._voters, counts: this._counts, flushedAt: Date.now() }),
          { expirationTtl: 3600 }, // 1 hour TTL
        )
      }

      // Phase 2.2: Emit observability event for buffer flush
      const durationMs = Date.now() - startMs
      writeEvent(this.env.METRICS_AE, {
        name: 'do.vote_buffer_flush',
        sessionId: meta.sessionId,
        teamId: meta.teamId ?? undefined,
        durationMs,
        count: batch.length,
        detail: 'batch_insert_to_d1',
      })

      this.voteBuffer = []
      this.lastFlushAt = Date.now()
      this.flushScheduled = false
    } catch (err) {
      logEvent({
        event: 'do.flush_votes_failed',
        sessionId: meta.sessionId,
        errorClass: err instanceof Error ? err.name : 'UnknownError',
        errorMessage: err instanceof Error ? err.message : String(err),
      })
      // On flush failure, votes stay in buffer for next attempt.
      this.flushScheduled = false
    }
  }

  // Phase 2.3: Periodically snapshot DO state to R2 for recovery after eviction.
  // Snapshots meta, questions, counts, and current question state.
  private async maybeSnapshot(): Promise<void> {
    if (!this.env.R2_SESSIONS) return // R2 not bound

    const meta = await this.ctx.storage.get<Meta>(K_META)
    if (!meta) return

    try {
      const snapshot = {
        sessionId: meta.sessionId,
        meta,
        questions: (await this.ctx.storage.get<LiveQuestion[]>(K_QUESTIONS)) ?? [],
        questionIndex: (await this.ctx.storage.get<number>(K_QUESTION_INDEX)) ?? 0,
        currentQuestion: await this.ctx.storage.get<LiveQuestion>(K_QUESTION),
        counts: this._counts ?? (await this.ctx.storage.get<Counts>(K_COUNTS)) ?? {},
        voters: (await this.ctx.storage.get<Votes>(K_VOTERS)) ?? {},
        pendingResponses: (await this.ctx.storage.get<any[]>(K_PENDING_RESPONSES)) ?? [],
        activeEnergizer: (await this.ctx.storage.get<LiveEnergizerState>(K_ACTIVE_ENERGIZER)) ?? null,
        status: await this.ctx.storage.get<string>(K_STATUS),
        snapshotAt: Date.now(),
      }

      const key = `sessions/${meta.sessionId}/snapshot.json`
      await this.env.R2_SESSIONS.put(key, JSON.stringify(snapshot), {
        customMetadata: {
          sessionId: meta.sessionId,
          snapshotAt: String(Date.now()),
        },
      })
    } catch (err) {
      logEvent({
        event: 'do.snapshot_failed',
        sessionId: meta?.sessionId,
        errorClass: err instanceof Error ? err.name : 'UnknownError',
        errorMessage: err instanceof Error ? err.message : String(err),
      })
      // Snapshot failures are non-blocking; recovery is best-effort.
    }
  }

  // Phase 2.3: Attempt to hydrate DO state from R2 snapshot after eviction.
  private async maybeHydrate(): Promise<void> {
    if (!this.env.R2_SESSIONS) return // R2 not bound

    const meta = await this.ctx.storage.get<Meta>(K_META)
    if (!meta) return // No session to hydrate

    try {
      const key = `sessions/${meta.sessionId}/snapshot.json`
      const obj = await this.env.R2_SESSIONS.get(key)
      if (!obj) return // No snapshot found

      const snapshot = JSON.parse(await obj.text()) as {
        questions?: LiveQuestion[]
        questionIndex?: number
        currentQuestion?: LiveQuestion
        counts?: Counts
        voters?: Votes
        pendingResponses?: any[]
        activeEnergizer?: LiveEnergizerState | null
        status?: string
      }

      // Restore state from snapshot.
      if (snapshot.questions) await this.ctx.storage.put(K_QUESTIONS, snapshot.questions)
      if (snapshot.questionIndex !== undefined) await this.ctx.storage.put(K_QUESTION_INDEX, snapshot.questionIndex)
      if (snapshot.currentQuestion) await this.ctx.storage.put(K_QUESTION, snapshot.currentQuestion)
      if (snapshot.counts) {
        await this.ctx.storage.put(K_COUNTS, snapshot.counts)
        this._counts = snapshot.counts
      }
      if (snapshot.voters) {
        await this.ctx.storage.put(K_VOTERS, snapshot.voters)
        this._voters = snapshot.voters
      }
      if (snapshot.pendingResponses?.length) {
        await this.ctx.storage.put(K_PENDING_RESPONSES, snapshot.pendingResponses)
      }
      if (snapshot.activeEnergizer) {
        await this.ctx.storage.put(K_ACTIVE_ENERGIZER, snapshot.activeEnergizer)
      }
      if (snapshot.status) await this.ctx.storage.put(K_STATUS, snapshot.status)

      logEvent({
        event: 'do.snapshot_hydrated',
        sessionId: meta.sessionId,
      })

      // Phase 2.3: Emit observability event for successful recovery
      writeEvent(this.env.METRICS_AE, {
        name: 'do.recovery_from_snapshot',
        sessionId: meta.sessionId,
        count: Object.keys(snapshot.voters ?? {}).length, // votes recovered
        detail: 'recovery_success',
      })
    } catch (err) {
      logEvent({
        event: 'do.hydrate_failed',
        sessionId: meta?.sessionId,
        errorClass: err instanceof Error ? err.name : 'UnknownError',
        errorMessage: err instanceof Error ? err.message : String(err),
      })
      // Hydration failures are non-blocking; session continues with fresh state.
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
    // Phase 2.2: Prefer in-memory cache for eventual consistency during buffering
    const counts = this._counts ?? (await this.ctx.storage.get<Counts>(K_COUNTS)) ?? {}
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
      this.ctx.getWebSockets('role:presenter').some((s) => s !== ws)
      // Also true on first reconnect after hibernation (no open sockets yet):
      // we rely on ownerId match as the signal in that case too.
      || (att.role === 'presenter' && meta.ownerId === att.voterId &&
          this.ctx.getWebSockets('role:presenter').length === 0 &&
          (await this.ctx.storage.get<number>('presenter_first_connected')) !== undefined)

    // Record that a presenter has connected at least once
    if (att.role === 'presenter' && meta.ownerId === att.voterId) {
      await this.ctx.storage.put('presenter_first_connected', Date.now(), { allowConcurrency: true })
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
          participants: this.ctx.getWebSockets().length,
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
    if (isTownhall) await this.townhallHandler.sendSnapshot(ws, att, meta.townhallModeration!)
    if (meta.sessionMode === 'retro') await this.retroHandler.sendSnapshot(ws, att)
    if (meta.sessionMode === 'ideate') await this.ideateHandler.sendSnapshot(ws, att)
  }

  private async setPaused(paused: boolean): Promise<void> {
    const meta = await this.ctx.storage.get<Meta>(K_META)
    if (!meta) return
    await this.ctx.storage.put(K_META, { ...meta, paused })
    const type = paused ? 'session_paused' : 'session_resumed'
    const msg = serverMessage({ type, data: {}, timestamp: now() })
    for (const ws of this.ctx.getWebSockets()) {
      try { ws.send(msg) } catch { /* closed socket */ }
    }
  }


  // ── Response moderation handlers (ENTERPRISE-POLISH §1c) ──────────────────

  private async handleApproveResponse(
    ws: WebSocket,
    att: Attachment,
    data: { questionId: string; responseId: string },
  ): Promise<void> {
    if (att.role !== 'presenter') {
      ws.send(errorMessage('forbidden', 'Only presenter can approve responses'))
      return
    }
    type PendingResponse = { id: string; voterId: string; text: string; submittedAt: number }
    const question = await this.ctx.storage.get<LiveQuestion>(K_QUESTION)
    if (!question || question.id !== data.questionId) {
      ws.send(errorMessage('out_of_date', 'Question has changed'))
      return
    }
    const pending = (await this.ctx.storage.get<PendingResponse[]>(K_PENDING_RESPONSES)) ?? []
    const response = pending.find((r) => r.id === data.responseId)
    if (!response) {
      ws.send(errorMessage('not_found', 'Response not found in moderation queue'))
      return
    }
    // Apply to live voters
    const voters = await this.ensureVoters()
    voters[response.voterId] = [response.text]
    const counts = (await this.ctx.storage.get<Counts>(K_COUNTS)) ?? {}
    counts[response.text] = (counts[response.text] ?? 0) + 1
    // Remove from pending
    const nextPending = pending.filter((r) => r.id !== data.responseId)
    await this.ctx.storage.put(K_VOTERS, voters)
    await this.ctx.storage.put(K_COUNTS, counts)
    await this.ctx.storage.put(K_PENDING_RESPONSES, nextPending)
    await this.scheduleResultsBroadcast()
    // Notify presenter of updated queue size
    ws.send(JSON.stringify({ type: 'pending_responses_updated', data: { count: nextPending.length } }))
  }

  private async handleRejectResponse(
    ws: WebSocket,
    att: Attachment,
    data: { questionId: string; responseId: string },
  ): Promise<void> {
    if (att.role !== 'presenter') {
      ws.send(errorMessage('forbidden', 'Only presenter can reject responses'))
      return
    }
    type PendingResponse = { id: string; voterId: string; text: string; submittedAt: number }
    const pending = (await this.ctx.storage.get<PendingResponse[]>(K_PENDING_RESPONSES)) ?? []
    const nextPending = pending.filter((r) => r.id !== data.responseId)
    if (nextPending.length === pending.length) {
      ws.send(errorMessage('not_found', 'Response not found in moderation queue'))
      return
    }
    await this.ctx.storage.put(K_PENDING_RESPONSES, nextPending)
    ws.send(JSON.stringify({ type: 'pending_responses_updated', data: { count: nextPending.length } }))
  }


  private canControlSession(att: Attachment): boolean {
    if (att.role !== 'presenter') return false
    return att.permissions === undefined || att.permissions.includes('session:launch') || att.permissions.includes('session:close')
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
