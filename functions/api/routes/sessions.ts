// DRAFT-API for sessions (CLAUDE.md hard rule 5 — REST for DRAFT state only;
// LIVE state flows through the SessionRoom DO).
//
// Routes:
//   POST   /api/sessions                           create a DRAFT session
//   GET    /api/sessions                           list caller's sessions
//   GET    /api/sessions/:id                       fetch one session (with questions)
//   PATCH  /api/sessions/:id                       update title and/or replace question at position 0
//   POST   /api/sessions/:id/questions             append a question (does not replace others)
//   PATCH  /api/sessions/:id/questions/:questionId update a specific question in place
//   PUT    /api/sessions/:id/questions/reorder     reorder all questions
//   POST   /api/sessions/:id/questions/generate    AI-draft questions (not auto-persisted)

import { Hono } from 'hono'
import { ulid } from '../lib/ulid'
import { generateJoinCode } from '../lib/code'
import { IdempotencyInFlightError, withIdempotency } from '../lib/idempotency'
import { deriveVoterIdentity } from '../lib/voter'
import { writeEvent } from '../lib/observability'
import { authMiddleware, SESSION_COOKIE, type AuthVariables } from '../middleware/auth'
import { planMiddleware, type PlanVariables } from '../middleware/plan'
import { verifyJwt } from '../lib/jwt'
import { incrementSessionQuota } from '../lib/quota'
import {
  CreateSessionSchema,
  GenerateQuestionsSchema,
  PatchSessionSchema,
  ReorderQuestionsSchema,
  AddQuestionSchema,
  autoPopulateOptions,
  type PollQuestionInput,
} from '../lib/validation'
import {
  WizardAIError,
  WizardValidationError,
  generateQuestions,
} from '../lib/ai-wizard'
import { extractThemes } from '../lib/ai-insights'
import {
  toInsightsInput,
  type SessionBundle,
  type QuestionBreakdown,
} from '../lib/session-bundle'
import { rateLimit } from '../lib/rate-limit'
import { sanitizeError } from '../lib/error-handler'
import type { LiveQuestion } from '../realtime'
import type { Env, PollOption, Question, Session } from '../types'

type Vars = AuthVariables & PlanVariables
// SessionRow mirrors the D1 row shape. Analytics-only column `team_id` (OBS-001)
// is present on the row and surfaced on Session as an optional field.
type SessionRow = Session & { team_id: string | null }

// Apply schema columns that may be missing on older D1 databases (pre-migration 0008).
// Runs once per worker cold-start; subsequent calls are no-ops after the columns exist.
let _schemaPatchDone = false
async function patchSchemaIfNeeded(db: D1Database): Promise<void> {
  if (_schemaPatchDone) return
  _schemaPatchDone = true
  await db.prepare(`ALTER TABLE sessions ADD COLUMN vote_policy TEXT NOT NULL DEFAULT 'once' CHECK (vote_policy IN ('once','multi','react'))`).run().catch(() => {})
  await db.prepare(`ALTER TABLE sessions ADD COLUMN session_mode TEXT NOT NULL DEFAULT 'reflection' CHECK (session_mode IN ('reflection','fun'))`).run().catch(() => {})
  // OBS-001: analytics segmentation column. Nullable — individual (no-team) sessions remain valid.
  await db.prepare(`ALTER TABLE sessions ADD COLUMN team_id TEXT DEFAULT NULL`).run().catch(() => {})
}

type QuestionRow = {
  id: string
  session_id: string
  position: number
  kind: Question['kind']
  prompt: string
  options_json: string
  created_at: number
}

function rowToQuestion(row: QuestionRow): Question {
  let parsed: PollOption[] = []
  try {
    parsed = JSON.parse(row.options_json) as PollOption[]
  } catch (parseErr) {
    console.warn(`[sessions] failed to parse options for question ${row.id}:`, parseErr)
  }
  return {
    id: row.id,
    session_id: row.session_id,
    position: row.position,
    kind: row.kind,
    prompt: row.prompt,
    options: parsed,
    created_at: row.created_at,
  }
}

async function fetchSession(db: D1Database, id: string, ownerId: string): Promise<Session | null> {
  const row = await db
    .prepare(
      `SELECT id, owner_id, code, title, status, anonymity, vote_policy, session_mode,
              created_at, started_at, closed_at, archived_at, team_id
         FROM sessions
        WHERE id = ?1 AND owner_id = ?2`,
    )
    .bind(id, ownerId)
    .first<SessionRow>()
  return row ?? null
}

async function fetchQuestions(db: D1Database, sessionId: string): Promise<Question[]> {
  const { results } = await db
    .prepare(
      `SELECT id, session_id, position, kind, prompt, options_json, created_at
         FROM questions
        WHERE session_id = ?1
        ORDER BY position ASC`,
    )
    .bind(sessionId)
    .all<QuestionRow>()
  return (results ?? []).map(rowToQuestion)
}

async function upsertPollQuestion(
  db: D1Database,
  sessionId: string,
  input: PollQuestionInput,
): Promise<Question> {
  // Replace only position 0, leaving questions at other positions intact.
  await db.prepare(`DELETE FROM questions WHERE session_id = ?1 AND position = 0`).bind(sessionId).run()
  const id = ulid()
  const now = Date.now()
  const optionsJson = JSON.stringify(input.options)
  await db
    .prepare(
      `INSERT INTO questions (id, session_id, position, kind, prompt, options_json, created_at)
       VALUES (?1, ?2, 0, ?3, ?4, ?5, ?6)`,
    )
    .bind(id, sessionId, input.kind, input.prompt, optionsJson, now)
    .run()
  return {
    id,
    session_id: sessionId,
    position: 0,
    kind: input.kind,
    prompt: input.prompt,
    options: input.options,
    created_at: now,
  }
}

async function fetchSessionByCode(db: D1Database, code: string): Promise<Session | null> {
  const row = await db
    .prepare(
      `SELECT id, owner_id, code, title, status, anonymity, vote_policy, session_mode,
              created_at, started_at, closed_at, archived_at, team_id
         FROM sessions
        WHERE code = ?1`,
    )
    .bind(code)
    .first<SessionRow>()
  return row ?? null
}

function questionToLive(q: Question): LiveQuestion {
  return { id: q.id, kind: q.kind, prompt: q.prompt, options: q.options }
}

async function doStub(env: Env, sessionId: string): Promise<DurableObjectStub> {
  const id = env.SESSION_ROOM.idFromName(sessionId)
  return env.SESSION_ROOM.get(id)
}

async function postDO(env: Env, sessionId: string, path: string, body: unknown): Promise<Response> {
  const stub = await doStub(env, sessionId)
  return stub.fetch(`https://do.internal${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// Best-effort background insight generation triggered on session close.
// Runs via waitUntil so it never delays the close response.
// Only fires for team-plan users; skips if insights are already cached.
async function precomputeInsights(
  env: Env,
  sessionId: string,
  sessionTitle: string,
  ownerId: string,
): Promise<void> {
  const MODEL = '@cf/mistral/mistral-7b-instruct-v0.2'
  const cacheKey = `insights:${sessionId}`

  const userRow = await env.DB.prepare(`SELECT plan FROM users WHERE id = ?1`)
    .bind(ownerId)
    .first<{ plan: string }>()
  if (userRow?.plan !== 'team') return

  // Skip if already cached (e.g. user manually triggered analyze before closing)
  const existing = await env.DECISIONS_KV.get(cacheKey)
  if (existing) return

  // Collect open-ended responses
  const openRows = await env.DB.prepare(
    `SELECT v.option_id AS text
       FROM votes v
       JOIN questions q ON q.id = v.question_id
      WHERE v.session_id = ?1 AND q.kind = 'open'
      ORDER BY v.submitted_at ASC
      LIMIT 500`,
  )
    .bind(sessionId)
    .all<{ text: string }>()
  const openResponses = (openRows.results ?? []).map((r) => r.text).filter(Boolean)

  // Collect poll/ranking/consent breakdowns
  const qRows = await env.DB.prepare(
    `SELECT id, prompt, kind, options_json
       FROM questions
      WHERE session_id = ?1
        AND kind IN ('poll', 'ranking', 'consent')
      ORDER BY position`,
  )
    .bind(sessionId)
    .all<{ id: string; prompt: string; kind: string; options_json: string }>()

  const pollBreakdown: QuestionBreakdown[] = []
  for (const q of qRows.results ?? []) {
    const voteRows = await env.DB.prepare(
      `SELECT option_id, COUNT(*) AS votes FROM votes WHERE question_id = ?1 GROUP BY option_id`,
    )
      .bind(q.id)
      .all<{ option_id: string; votes: number }>()

    let options: { id: string; label: string }[] = []
    try {
      options = JSON.parse(q.options_json) as { id: string; label: string }[]
    } catch {
      options = []
    }

    pollBreakdown.push({
      questionId: q.id,
      prompt: q.prompt,
      kind: q.kind as QuestionBreakdown['kind'],
      options: options.map((o) => ({
        label: o.label,
        votes: voteRows.results?.find((v) => v.option_id === o.id)?.votes ?? 0,
      })),
    })
  }

  const bundle: SessionBundle = {
    sessionId,
    sessionTitle,
    closedAt: Date.now(),
    openResponses,
    pollBreakdown,
    similarSessionTitles: [], // skip Vectorize in background job to reduce latency
  }

  const input = toInsightsInput(bundle)
  if (input.openResponses.length === 0 && !input.pollBreakdown?.length) return

  const result = await extractThemes(env.AI, input, MODEL)
  const themes = result.themes.map((t) => t.theme)

  const payload = {
    session_id: sessionId,
    generated_at: Date.now(),
    model: MODEL,
    themes,
    follow_ups: [] as string[],
  }

  await env.DECISIONS_KV.put(cacheKey, JSON.stringify(payload), { expirationTtl: 3600 })
  console.log(
    JSON.stringify({ event: 'insights.precompute.ok', sessionId, theme_count: themes.length }),
  )
}

export function mountSessionRoutes(parent: Hono<{ Bindings: Env; Variables: Vars }>) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()
  const pub = new Hono<{ Bindings: Env; Variables: Vars }>()

  // Public endpoints (no auth): voter join-by-code lookup + WebSocket upgrade.
  pub.get('/by-code/:code', async (c) => {
    const code = c.req.param('code').toUpperCase()
    const traceId = c.get('trace_id')
    if (!/^[0-9A-Z]{6}$/.test(code)) {
      console.log(JSON.stringify({ ts: new Date().toISOString(), level: 'warn', event: 'join.bad_code', trace_id: traceId }))
      return c.json(
        { ok: false, error: { code: 'bad_code', message: 'Invalid join code' }, trace_id: traceId },
        400,
      )
    }
    const session = await fetchSessionByCode(c.env.DB, code)
    if (!session || session.status === 'archived' || session.status === 'closed') {
      // Log enumeration attempts for security monitoring
      console.log(JSON.stringify({ ts: new Date().toISOString(), level: 'warn', event: 'join.not_found', trace_id: traceId }))
      return c.json(
        { ok: false, error: { code: 'not_found', message: 'No active session for that code' }, trace_id: traceId },
        404,
      )
    }
    console.log(JSON.stringify({ ts: new Date().toISOString(), level: 'info', event: 'join.success', session_id: session.id, status: session.status, trace_id: traceId }))
    return c.json({
      ok: true,
      data: { id: session.id, title: session.title, code: session.code, status: session.status as 'draft' | 'live' },
      trace_id: traceId,
    })
  })

  pub.get('/:id/ws', async (c) => {
    if (c.req.header('upgrade')?.toLowerCase() !== 'websocket') {
      return c.json(
        { ok: false, error: { code: 'bad_request', message: 'Expected WebSocket upgrade' }, trace_id: c.get('trace_id') },
        400,
      )
    }
    const id = c.req.param('id')
    const session = await c.env.DB
      .prepare(
        `SELECT id, owner_id, code, title, status, anonymity, vote_policy, session_mode,
                created_at, started_at, closed_at, archived_at, team_id
           FROM sessions
          WHERE id = ?1`,
      )
      .bind(id)
      .first<SessionRow>()
    if (!session) {
      return c.json(
        { ok: false, error: { code: 'not_found', message: 'Session not found' }, trace_id: c.get('trace_id') },
        404,
      )
    }
    if (session.status !== 'live') {
      return c.json(
        { ok: false, error: { code: 'not_live', message: 'Session is not LIVE' }, trace_id: c.get('trace_id') },
        409,
      )
    }

    // Presenter detection: JWT in subprotocol OR qesto_session cookie.
    let role: 'presenter' | 'voter' = 'voter'
    const subprotoHeader = c.req.header('sec-websocket-protocol') ?? ''
    const bearerToken = subprotoHeader
      .split(',')
      .map((s) => s.trim())
      .find((s) => s.startsWith('qesto.bearer.'))
      ?.replace('qesto.bearer.', '')
    const cookieHeader = c.req.header('cookie') ?? ''
    const cookieToken = cookieHeader
      .split(';')
      .map((s) => s.trim())
      .find((s) => s.startsWith(`${SESSION_COOKIE}=`))
      ?.substring(SESSION_COOKIE.length + 1)
    const token = bearerToken ?? cookieToken
    let presenterUserId: string | null = null
    if (token) {
      const claims = await verifyJwt(token, c.env.JWT_SECRET)
      if (claims && claims.sub === session.owner_id) {
        role = 'presenter'
        presenterUserId = claims.sub
      }
    }

    const identity = await deriveVoterIdentity(c.req.raw)
    const voterId = role === 'presenter' && presenterUserId ? `host_${presenterUserId}` : identity.voterId

    const stub = await doStub(c.env, id)
    const upgraded = await stub.fetch('https://do.internal/ws', {
      headers: {
        upgrade: 'websocket',
        'x-qesto-role': role,
        'x-qesto-voter': voterId,
        'x-qesto-ip-hash': identity.ipHash,
      },
    })
    // Respond with a fixed subprotocol identifier. Browsers require the 101
    // response to echo *one* of the offered subprotocols, but we must NEVER
    // reflect `qesto.bearer.<JWT>` back — that would leak the bearer token in
    // response headers (visible to proxies, browser devtools, logs).
    // Instead, advertise a stable protocol name that the client offers
    // alongside the bearer token: `qesto-v1`.
    if (upgraded.status === 101) {
      const offered = subprotoHeader
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      const hasV1 = offered.includes('qesto-v1')
      const hasBearer = offered.some((p) => p.startsWith('qesto.bearer.'))
      if (hasV1 || hasBearer) {
        const headers = new Headers(upgraded.headers)
        headers.set('sec-websocket-protocol', 'qesto-v1')
        return new Response(upgraded.body, {
          status: 101,
          headers,
          webSocket: (upgraded as unknown as { webSocket?: WebSocket }).webSocket,
        } as ResponseInit)
      }
    }
    return upgraded
  })

  parent.route('/api/sessions', pub)

  app.use('*', authMiddleware)
  app.use('*', planMiddleware)

  // POST /api/sessions — create DRAFT
  app.post('/', async (c) => {
    const body = (await c.req.json().catch(() => null)) as unknown
    const parsed = CreateSessionSchema.safeParse(body)
    if (!parsed.success) {
      return c.json(
        {
          ok: false,
          error: { code: 'validation', message: 'Invalid session payload', details: parsed.error.flatten() },
          trace_id: c.get('trace_id'),
        },
        400,
      )
    }

    const user = c.get('user')
    const plan = c.get('plan')
    const quotas = c.get('planQuotas')
    const idemKey = c.req.header('idempotency-key') ?? undefined

    // Check quota before proceeding (BILL-04)
    const { allowed, remaining } = await incrementSessionQuota(
      c.env.SESSIONS_KV,
      user.sub,
      quotas.maxSessionsPerMonth,
    )
    if (!allowed) {
      return c.json(
        {
          ok: false,
          error: {
            code: 'quota_exceeded',
            message: `Session quota exceeded for your ${plan} plan this month`,
            details: {
              plan,
              limit: quotas.maxSessionsPerMonth,
              upgrade_url: '/billing/upgrade',
            },
          },
          trace_id: c.get('trace_id'),
        },
        429,
      )
    }

    let result: { status: number; body: { ok: true; data: { session: Session; questions: Question[] } }; replayed: boolean }
    try {
      result = await withIdempotency(
        c.env.ACTIONS_KV,
        user.sub,
        idemKey,
        async () => {
          const id = ulid()
          const code = generateJoinCode()
          const now = Date.now()
          // OBS-001: attribute new session to the user's first team (if any).
          // TEAMS_KV key `user-teams:{userId}` stores `string[]` of teamIds.
          // Null is valid — individual (team-less) sessions remain supported.
          let teamId: string | null = null
          try {
            const raw = await c.env.TEAMS_KV.get(`user-teams:${user.sub}`)
            if (raw) {
              const ids = JSON.parse(raw) as string[]
              teamId = Array.isArray(ids) && ids.length > 0 ? ids[0] : null
            }
          } catch {
            // KV lookup is best-effort analytics attribution — never blocks session creation.
            teamId = null
          }
          await c.env.DB.prepare(
            `INSERT INTO sessions (id, owner_id, code, title, status, anonymity, vote_policy, session_mode, created_at, team_id)
             VALUES (?1, ?2, ?3, ?4, 'draft', 'full', 'once', 'reflection', ?5, ?6)`,
          )
            .bind(id, user.sub, code, parsed.data.title, now, teamId)
            .run()
          const session: Session = {
            id,
            owner_id: user.sub,
            code,
            title: parsed.data.title,
            status: 'draft',
            anonymity: 'full',
            vote_policy: 'once',
            session_mode: 'reflection',
            created_at: now,
            started_at: null,
            closed_at: null,
            archived_at: null,
            team_id: teamId,
          }
          return {
            status: 201,
            body: { ok: true as const, data: { session, questions: [] as Question[], quota_remaining: remaining } },
          }
        },
      )
    } catch (err) {
      if (err instanceof IdempotencyInFlightError) {
        return c.json(
          {
            ok: false,
            error: {
              code: 'idem_in_flight',
              message: 'A previous request with this Idempotency-Key is still in flight. Retry shortly.',
            },
            trace_id: c.get('trace_id'),
          },
          409,
        )
      }
      throw err
    }

    if (result.replayed) c.header('idempotent-replay', 'true')
    return c.json({ ...result.body, trace_id: c.get('trace_id') }, result.status as 201 | 200)
  })

  // GET /api/sessions — list caller's sessions (DRAFT + LIVE + CLOSED, not ARCHIVED)
  app.get('/', async (c) => {
    const user = c.get('user')
    await patchSchemaIfNeeded(c.env.DB)
    const { results } = await c.env.DB
      .prepare(
        `SELECT id, owner_id, code, title, status, anonymity, vote_policy, session_mode,
                created_at, started_at, closed_at, archived_at, team_id
           FROM sessions
          WHERE owner_id = ?1 AND status != 'archived'
          ORDER BY created_at DESC
          LIMIT 100`,
      )
      .bind(user.sub)
      .all<SessionRow>()
    return c.json({ ok: true, data: { sessions: results ?? [] }, trace_id: c.get('trace_id') })
  })

  // GET /api/sessions/:id
  app.get('/:id', async (c) => {
    const user = c.get('user')
    const session = await fetchSession(c.env.DB, c.req.param('id'), user.sub)
    if (!session) {
      return c.json(
        { ok: false, error: { code: 'not_found', message: 'Session not found' }, trace_id: c.get('trace_id') },
        404,
      )
    }
    const questions = await fetchQuestions(c.env.DB, session.id)
    return c.json({ ok: true, data: { session, questions }, trace_id: c.get('trace_id') })
  })

  // PATCH /api/sessions/:id — DRAFT-only write
  app.patch('/:id', async (c) => {
    const user = c.get('user')
    const id = c.req.param('id')
    const body = (await c.req.json().catch(() => null)) as unknown
    const parsed = PatchSessionSchema.safeParse(body)
    if (!parsed.success) {
      return c.json(
        {
          ok: false,
          error: { code: 'validation', message: 'Invalid patch payload', details: parsed.error.flatten() },
          trace_id: c.get('trace_id'),
        },
        400,
      )
    }

    const session = await fetchSession(c.env.DB, id, user.sub)
    if (!session) {
      return c.json(
        { ok: false, error: { code: 'not_found', message: 'Session not found' }, trace_id: c.get('trace_id') },
        404,
      )
    }
    if (session.status !== 'draft') {
      return c.json(
        {
          ok: false,
          error: { code: 'conflict', message: 'Only DRAFT sessions can be edited via REST' },
          trace_id: c.get('trace_id'),
        },
        409,
      )
    }

    if (parsed.data.title !== undefined) {
      await c.env.DB
        .prepare(`UPDATE sessions SET title = ?1 WHERE id = ?2 AND owner_id = ?3`)
        .bind(parsed.data.title, id, user.sub)
        .run()
      session.title = parsed.data.title
    }
    if (parsed.data.anonymity !== undefined) {
      await c.env.DB
        .prepare(`UPDATE sessions SET anonymity = ?1 WHERE id = ?2 AND owner_id = ?3`)
        .bind(parsed.data.anonymity, id, user.sub)
        .run()
      session.anonymity = parsed.data.anonymity
    }
    if (parsed.data.vote_policy !== undefined) {
      await c.env.DB
        .prepare(`UPDATE sessions SET vote_policy = ?1 WHERE id = ?2 AND owner_id = ?3`)
        .bind(parsed.data.vote_policy, id, user.sub)
        .run()
      session.vote_policy = parsed.data.vote_policy
    }
    if (parsed.data.session_mode !== undefined) {
      await c.env.DB
        .prepare(`UPDATE sessions SET session_mode = ?1 WHERE id = ?2 AND owner_id = ?3`)
        .bind(parsed.data.session_mode, id, user.sub)
        .run()
      session.session_mode = parsed.data.session_mode
    }
    let questions = await fetchQuestions(c.env.DB, id)
    if (parsed.data.question) {
      const q = await upsertPollQuestion(c.env.DB, id, parsed.data.question)
      questions = [q]
    }

    return c.json({ ok: true, data: { session, questions }, trace_id: c.get('trace_id') })
  })

  // POST /api/sessions/:id/start — DRAFT → LIVE
  app.post('/:id/start', async (c) => {
    const user = c.get('user')
    const id = c.req.param('id')
    const session = await fetchSession(c.env.DB, id, user.sub)
    if (!session) {
      return c.json(
        { ok: false, error: { code: 'not_found', message: 'Session not found' }, trace_id: c.get('trace_id') },
        404,
      )
    }
    if (session.status !== 'draft') {
      return c.json(
        {
          ok: false,
          error: { code: 'conflict', message: 'Only DRAFT sessions can be started' },
          trace_id: c.get('trace_id'),
        },
        409,
      )
    }
    const questions = await fetchQuestions(c.env.DB, id)
    if (questions.length === 0) {
      return c.json(
        {
          ok: false,
          error: { code: 'no_question', message: 'Session has no question yet' },
          trace_id: c.get('trace_id'),
        },
        409,
      )
    }
    const now = Date.now()
    const liveQ = questionToLive(questions[0])
    const traceId = c.get('trace_id')
    const logCtx = { trace_id: traceId, session_id: id, user_id: user.sub }

    console.log(JSON.stringify({ ts: new Date().toISOString(), level: 'info', event: 'session.start.attempt', ...logCtx }))

    // Conditional UPDATE: only transitions from draft → live.
    // `meta.changes === 0` means a concurrent request already won this write.
    const result = await c.env.DB
      .prepare(
        `UPDATE sessions SET status = 'live', started_at = ?1
         WHERE id = ?2 AND owner_id = ?3 AND status = 'draft'`,
      )
      .bind(now, id, user.sub)
      .run()

    if (result.meta.changes === 0) {
      // A concurrent request already transitioned the session. Re-read it and
      // return success without a redundant DO /init call.
      const current = await fetchSession(c.env.DB, id, user.sub)
      console.log(JSON.stringify({ ts: new Date().toISOString(), level: 'info', event: 'session.start.concurrent_win', ...logCtx }))
      if (current?.status === 'live') {
        return c.json({ ok: true, data: { session: current, question: liveQ }, trace_id: traceId })
      }
      return c.json(
        { ok: false, error: { code: 'conflict', message: 'Session could not be started' }, trace_id: traceId },
        409,
      )
    }
    session.status = 'live'
    session.started_at = now

    const doRes = await postDO(c.env, id, '/init', {
      sessionId: session.id,
      ownerId: session.owner_id,
      code: session.code,
      title: session.title,
      question: liveQ,
      questions: questions.map(questionToLive),
      votePolicy: session.vote_policy,
      sessionMode: session.session_mode,
      plan: c.get('plan'),
    })
    if (doRes.status !== 200) {
      // Defence-in-depth: if DO returns already_initialised (409), another
      // concurrent start won the DO race. DB is already live — no rollback.
      if (doRes.status === 409) {
        try {
          const doBody = (await doRes.json()) as { ok?: boolean; error?: { code?: string } }
          if (doBody?.error?.code === 'already_initialised') {
            console.log(JSON.stringify({ ts: new Date().toISOString(), level: 'info', event: 'session.start.do_idempotent', ...logCtx }))
            return c.json({ ok: true, data: { session, question: liveQ }, trace_id: traceId })
          }
        } catch { /* fall through to rollback */ }
      }
      // All other DO errors: roll back DB so the session stays startable.
      console.log(JSON.stringify({ ts: new Date().toISOString(), level: 'warn', event: 'session.start.do_failure', ...logCtx, do_status: doRes.status }))
      try {
        await c.env.DB
          .prepare(`UPDATE sessions SET status = 'draft', started_at = NULL WHERE id = ?1`)
          .bind(id)
          .run()
      } catch (rbErr) {
        // Rollback failed — DB may be stuck live while DO is not initialised.
        // Operator must use RUNBOOK_SESSION_RECONCILE.md to recover.
        console.log(JSON.stringify({ ts: new Date().toISOString(), level: 'error', event: 'session.start.rollback_failed', ...logCtx, err: String(rbErr) }))
      }
      return c.json(
        {
          ok: false,
          error: { code: 'do_init_failed', message: `DurableObject refused init (${doRes.status})` },
          trace_id: traceId,
        },
        500,
      )
    }
    console.log(JSON.stringify({ ts: new Date().toISOString(), level: 'info', event: 'session.start.success', ...logCtx }))
    writeEvent(c.env.METRICS_AE, {
      name: 'session.started',
      sessionId: id,
      userId: user.sub,
      ...(session.team_id ? { teamId: session.team_id } : {}),
      plan: c.get('plan'),
      traceId,
    })

    // OBS-003: emit `first_session_started` iff this is the user's first non-draft session.
    // The draft→live UPDATE above already committed, so count includes this session (==1).
    try {
      const sessionCount = await c.env.DB
        .prepare(`SELECT COUNT(*) as n FROM sessions WHERE owner_id = ?1 AND status != 'draft'`)
        .bind(user.sub)
        .first<{ n: number }>()
      if ((sessionCount?.n ?? 0) === 1) {
        writeEvent(c.env.METRICS_AE, {
          name: 'first_session_started',
          userId: user.sub,
          ...(session.team_id ? { teamId: session.team_id } : {}),
          plan: c.get('plan'),
          traceId,
        })
      }
    } catch {
      // Best-effort analytics — never fail the start response.
    }

    return c.json({
      ok: true,
      data: { session, question: liveQ },
      trace_id: traceId,
    })
  })

  // POST /api/sessions/:id/close — LIVE → CLOSED, persist totals.
  app.post('/:id/close', async (c) => {
    const user = c.get('user')
    const id = c.req.param('id')
    const session = await fetchSession(c.env.DB, id, user.sub)
    if (!session) {
      return c.json(
        { ok: false, error: { code: 'not_found', message: 'Session not found' }, trace_id: c.get('trace_id') },
        404,
      )
    }
    if (session.status !== 'live') {
      return c.json(
        {
          ok: false,
          error: { code: 'conflict', message: 'Only LIVE sessions can be closed' },
          trace_id: c.get('trace_id'),
        },
        409,
      )
    }
    const stub = await doStub(c.env, id)
    const doRes = await stub.fetch('https://do.internal/close', { method: 'POST' })
    const parsed = (await doRes.json().catch(() => null)) as
      | {
          ok: true
          data: {
            counts: Record<string, number>
            total: number
            votes: Array<{ voterId: string; optionId: string }>
            questionId: string | null
          }
        }
      | null
    const counts = parsed?.ok ? parsed.data.counts : {}
    const total = parsed?.ok ? parsed.data.total : 0
    const voteList = parsed?.ok ? parsed.data.votes : []
    const questionId = parsed?.ok ? parsed.data.questionId : null

    // Persist per-voter rows to D1. UNIQUE(question_id, voter_id) guards
    // against replay.
    if (questionId && voteList.length > 0) {
      const stmt = c.env.DB.prepare(
        `INSERT OR IGNORE INTO votes (id, session_id, question_id, voter_id, option_id, submitted_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
      )
      const ts = Date.now()
      const batch = voteList.map((v) =>
        stmt.bind(ulid(), id, questionId, v.voterId, v.optionId, ts),
      )
      await c.env.DB.batch(batch)
    }

    const closedAt = Date.now()
    await c.env.DB
      .prepare(`UPDATE sessions SET status = 'closed', closed_at = ?1 WHERE id = ?2 AND owner_id = ?3`)
      .bind(closedAt, id, user.sub)
      .run()
    session.status = 'closed'
    session.closed_at = closedAt

    const durationMs = session.started_at ? closedAt - session.started_at : 0
    writeEvent(c.env.METRICS_AE, {
      name: 'session.closed',
      sessionId: id,
      userId: user.sub,
      ...(session.team_id ? { teamId: session.team_id } : {}),
      plan: c.get('plan'),
      durationMs,
      count: total,
      traceId: c.get('trace_id'),
    })

    // Background insight pre-computation: fires after response is sent, never
    // delays the close. Only runs for team-plan users; skips if already cached.
    // Hono throws "This context has no ExecutionContext" when no ctx is passed
    // (e.g. in tests), so we guard with try/catch rather than optional chaining.
    try {
      c.executionCtx.waitUntil(
        precomputeInsights(c.env, id, session.title, user.sub).catch((err) => {
          console.log(
            JSON.stringify({
              event: 'insights.precompute.error',
              sessionId: id,
              error: String(err),
            }),
          )
        }),
      )
    } catch {
      // No ExecutionContext available (test environment) — skip background work.
    }

    return c.json({
      ok: true,
      data: { session, results: { counts, total } },
      trace_id: c.get('trace_id'),
    })
  })

  // GET /api/sessions/:id/results — aggregate persisted totals (CLOSED) or the
  // live DO snapshot (LIVE). DRAFT sessions have no results to show.
  app.get('/:id/results', async (c) => {
    const user = c.get('user')
    const id = c.req.param('id')
    const session = await fetchSession(c.env.DB, id, user.sub)
    if (!session) {
      return c.json(
        { ok: false, error: { code: 'not_found', message: 'Session not found' }, trace_id: c.get('trace_id') },
        404,
      )
    }
    if (session.status === 'draft') {
      return c.json(
        {
          ok: false,
          error: { code: 'conflict', message: 'Draft sessions have no results yet' },
          trace_id: c.get('trace_id'),
        },
        409,
      )
    }
    const questions = await fetchQuestions(c.env.DB, id)
    const question = questions[0] ?? null

    if (session.status === 'live') {
      // Live: pull current snapshot from the DO.
      const stub = await doStub(c.env, id)
      const snap = await stub.fetch('https://do.internal/state')
      const body = (await snap.json().catch(() => null)) as
        | { ok: true; data: { counts: Record<string, number>; voterCount: number } }
        | null
      const counts = body?.ok ? body.data.counts : {}
      const total = Object.values(counts).reduce((a, b) => a + b, 0)
      return c.json({
        ok: true,
        data: { session, question, results: { counts, total, source: 'live' as const } },
        trace_id: c.get('trace_id'),
      })
    }

    // Closed: aggregate from D1 votes table.
    const { results } = await c.env.DB
      .prepare(
        `SELECT option_id, COUNT(*) AS n
           FROM votes
          WHERE session_id = ?1
          GROUP BY option_id`,
      )
      .bind(id)
      .all<{ option_id: string; n: number }>()
    const counts: Record<string, number> = {}
    let total = 0
    for (const row of results ?? []) {
      counts[row.option_id] = row.n
      total += row.n
    }
    return c.json({
      ok: true,
      data: { session, question, results: { counts, total, source: 'persisted' as const } },
      trace_id: c.get('trace_id'),
    })
  })

  // ──────────────────────────────────────────────────────────────────────────
  // WIZ-AI-01/02: POST /api/sessions/:id/questions/generate
  // Uses Workers AI (Llama-3.3) to draft 3–5 questions from a prompt. The
  // caller must own a DRAFT session (matches the editing model). Draft
  // questions are *not* auto-persisted — the frontend surfaces them in a
  // review step so the host can tweak labels before save.
  // Rate-limited per-user: 20 generations / hour.
  // ──────────────────────────────────────────────────────────────────────────
  app.post('/:id/questions/generate', async (c) => {
    const user = c.get('user')
    const id = c.req.param('id')

    const rl = await rateLimit(c.env.ACTIONS_KV, user.sub, {
      max: 20,
      windowSeconds: 3600,
      prefix: 'ai-wizard',
    })
    if (!rl.allowed) {
      return c.json(
        {
          ok: false,
          error: {
            code: 'rate_limited',
            message: 'Too many AI generations. Try again in an hour.',
            details: { reset_at: rl.resetAt, limit: 20 },
          },
          trace_id: c.get('trace_id'),
        },
        429,
      )
    }

    const session = await fetchSession(c.env.DB, id, user.sub)
    if (!session) {
      return c.json(
        { ok: false, error: { code: 'not_found', message: 'Session not found' }, trace_id: c.get('trace_id') },
        404,
      )
    }
    if (session.status !== 'draft') {
      return c.json(
        {
          ok: false,
          error: { code: 'conflict', message: 'Only DRAFT sessions can generate questions' },
          trace_id: c.get('trace_id'),
        },
        409,
      )
    }

    const body = (await c.req.json().catch(() => null)) as unknown
    const parsed = GenerateQuestionsSchema.safeParse(body)
    if (!parsed.success) {
      return c.json(
        {
          ok: false,
          error: { code: 'validation', message: 'Invalid generation payload', details: parsed.error.flatten() },
          trace_id: c.get('trace_id'),
        },
        400,
      )
    }

    try {
      const language = c.req.header('accept-language') ?? 'en'
      const result = await generateQuestions(c.env.AI, { ...parsed.data, language })
      return c.json({
        ok: true,
        data: { questions: result.questions, confidence: result.confidence },
        trace_id: c.get('trace_id'),
      })
    } catch (err) {
      if (err instanceof WizardValidationError) {
        return c.json(
          {
            ok: false,
            error: {
              code: 'ai_output_invalid',
              message: 'AI returned an output that failed validation',
              details: err.details,
            },
            trace_id: c.get('trace_id'),
          },
          502,
        )
      }
      if (err instanceof WizardAIError) {
        const sanitized = sanitizeError(err, c.env.ENV, 500)
        return c.json(
          {
            ok: false,
            error: { ...sanitized, code: 'ai_failed' },
            trace_id: c.get('trace_id'),
          },
          500,
        )
      }
      throw err
    }
  })

  // ──────────────────────────────────────────────────────────────────────────
  // LAUNCHPAD-02: POST /api/sessions/:id/questions
  // Appends a new question to a DRAFT session without replacing existing ones.
  // ──────────────────────────────────────────────────────────────────────────
  app.post('/:id/questions', async (c) => {
    const user = c.get('user')
    const id = c.req.param('id')

    const session = await fetchSession(c.env.DB, id, user.sub)
    if (!session) {
      return c.json(
        { ok: false, error: { code: 'not_found', message: 'Session not found' }, trace_id: c.get('trace_id') },
        404,
      )
    }
    if (session.status !== 'draft') {
      return c.json(
        { ok: false, error: { code: 'conflict', message: 'Only DRAFT sessions can be edited via REST' }, trace_id: c.get('trace_id') },
        409,
      )
    }

    const body = await c.req.json().catch(() => null)
    const parsed = AddQuestionSchema.safeParse(body)
    if (!parsed.success) {
      return c.json(
        { ok: false, error: { code: 'validation', message: 'Invalid question payload', details: parsed.error.flatten() }, trace_id: c.get('trace_id') },
        400,
      )
    }

    const existing = await fetchQuestions(c.env.DB, id)
    const nextPosition = existing.length
    const qid = ulid()
    const now = Date.now()
    const rawOptions = autoPopulateOptions(parsed.data.kind, parsed.data.options)
    const options = rawOptions.map((o) => ({ id: o.id ?? ulid(), label: o.label }))
    const optionsJson = JSON.stringify(options)

    await c.env.DB
      .prepare(
        `INSERT INTO questions (id, session_id, position, kind, prompt, options_json, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
      )
      .bind(qid, id, nextPosition, parsed.data.kind, parsed.data.prompt, optionsJson, now)
      .run()

    const questions = await fetchQuestions(c.env.DB, id)
    return c.json({ ok: true, data: { session, questions }, trace_id: c.get('trace_id') }, 201)
  })

  // ──────────────────────────────────────────────────────────────────────────
  // LAUNCHPAD-01: PUT /api/sessions/:id/questions/reorder
  // Idempotent reorder of the DRAFT session's questions. Accepts a full list
  // of existing question ids; validates that the set matches exactly (no
  // additions, no deletions) and then rewrites `position` in a single D1
  // batch. Repeating the same call is a no-op.
  // ──────────────────────────────────────────────────────────────────────────
  app.put('/:id/questions/reorder', async (c) => {
    const user = c.get('user')
    const id = c.req.param('id')

    const session = await fetchSession(c.env.DB, id, user.sub)
    if (!session) {
      return c.json(
        { ok: false, error: { code: 'not_found', message: 'Session not found' }, trace_id: c.get('trace_id') },
        404,
      )
    }
    if (session.status !== 'draft') {
      return c.json(
        {
          ok: false,
          error: { code: 'conflict', message: 'Only DRAFT sessions can be reordered' },
          trace_id: c.get('trace_id'),
        },
        409,
      )
    }

    const body = (await c.req.json().catch(() => null)) as unknown
    const parsed = ReorderQuestionsSchema.safeParse(body)
    if (!parsed.success) {
      return c.json(
        {
          ok: false,
          error: { code: 'validation', message: 'Invalid reorder payload', details: parsed.error.flatten() },
          trace_id: c.get('trace_id'),
        },
        400,
      )
    }

    const existing = await fetchQuestions(c.env.DB, id)
    const existingIds = new Set(existing.map((q) => q.id))
    const inputIds = parsed.data.questionIds
    // Dedup and exact-set check.
    const dedup = new Set(inputIds)
    if (dedup.size !== inputIds.length) {
      return c.json(
        {
          ok: false,
          error: { code: 'validation', message: 'questionIds contains duplicates' },
          trace_id: c.get('trace_id'),
        },
        400,
      )
    }
    if (dedup.size !== existingIds.size || inputIds.some((qid) => !existingIds.has(qid))) {
      return c.json(
        {
          ok: false,
          error: {
            code: 'validation',
            message: 'questionIds must match the current set of question ids exactly',
            details: {
              expected: [...existingIds],
              received: inputIds,
            },
          },
          trace_id: c.get('trace_id'),
        },
        400,
      )
    }

    // Two-phase update: shift all positions to a high offset, then set final.
    // Avoids tripping UNIQUE(session_id, position) during reassignment.
    const OFFSET = 10_000
    const shiftBatch = existing.map((q, idx) =>
      c.env.DB
        .prepare(`UPDATE questions SET position = ?1 WHERE id = ?2 AND session_id = ?3`)
        .bind(OFFSET + idx, q.id, id),
    )
    const finalBatch = inputIds.map((qid, idx) =>
      c.env.DB
        .prepare(`UPDATE questions SET position = ?1 WHERE id = ?2 AND session_id = ?3`)
        .bind(idx, qid, id),
    )
    await c.env.DB.batch([...shiftBatch, ...finalBatch])

    const questions = await fetchQuestions(c.env.DB, id)
    return c.json({
      ok: true,
      data: { session, questions },
      trace_id: c.get('trace_id'),
    })
  })

  // PATCH /api/sessions/:id/questions/:questionId — Update a question in place
  // Updates kind/prompt/options without touching other questions or positions.
  app.patch('/:id/questions/:questionId', async (c) => {
    const user = c.get('user')
    const id = c.req.param('id')
    const questionId = c.req.param('questionId')

    const session = await fetchSession(c.env.DB, id, user.sub)
    if (!session) {
      return c.json(
        { ok: false, error: { code: 'not_found', message: 'Session not found' }, trace_id: c.get('trace_id') },
        404,
      )
    }
    if (session.status !== 'draft') {
      return c.json(
        { ok: false, error: { code: 'conflict', message: 'Only DRAFT sessions can be edited via REST' }, trace_id: c.get('trace_id') },
        409,
      )
    }

    const body = await c.req.json().catch(() => null)
    const parsed = AddQuestionSchema.safeParse(body)
    if (!parsed.success) {
      return c.json(
        { ok: false, error: { code: 'validation', message: 'Invalid question payload', details: parsed.error.flatten() }, trace_id: c.get('trace_id') },
        400,
      )
    }

    const rawOptions = autoPopulateOptions(parsed.data.kind, parsed.data.options)
    const options = rawOptions.map((o) => ({ id: o.id ?? ulid(), label: o.label }))
    const result = await c.env.DB
      .prepare(`UPDATE questions SET kind = ?1, prompt = ?2, options_json = ?3 WHERE id = ?4 AND session_id = ?5`)
      .bind(parsed.data.kind, parsed.data.prompt, JSON.stringify(options), questionId, id)
      .run()

    if (result.meta.changes === 0) {
      return c.json(
        { ok: false, error: { code: 'not_found', message: 'Question not found' }, trace_id: c.get('trace_id') },
        404,
      )
    }

    const questions = await fetchQuestions(c.env.DB, id)
    return c.json({ ok: true, data: { session, questions }, trace_id: c.get('trace_id') })
  })

  // DELETE /api/sessions/:id — hard-delete a session the caller owns
  app.delete('/:id', async (c) => {
    const user = c.get('user')
    const id = c.req.param('id')
    const session = await fetchSession(c.env.DB, id, user.sub)
    if (!session) {
      return c.json(
        { ok: false, error: { code: 'not_found', message: 'Session not found' }, trace_id: c.get('trace_id') },
        404,
      )
    }
    await c.env.DB.prepare(`DELETE FROM votes WHERE session_id = ?1`).bind(id).run()
    await c.env.DB.prepare(`DELETE FROM questions WHERE session_id = ?1`).bind(id).run()
    await c.env.DB.prepare(`DELETE FROM sessions WHERE id = ?1 AND owner_id = ?2`).bind(id, user.sub).run()
    return c.json({ ok: true, trace_id: c.get('trace_id') })
  })

  // POST /api/sessions/:id/duplicate — create a DRAFT copy with same title + questions
  app.post('/:id/duplicate', async (c) => {
    const user = c.get('user')
    const id = c.req.param('id')
    const quotas = c.get('planQuotas')

    const session = await fetchSession(c.env.DB, id, user.sub)
    if (!session) {
      return c.json(
        { ok: false, error: { code: 'not_found', message: 'Session not found' }, trace_id: c.get('trace_id') },
        404,
      )
    }

    const { allowed } = await incrementSessionQuota(c.env.SESSIONS_KV, user.sub, quotas.maxSessionsPerMonth)
    if (!allowed) {
      return c.json(
        { ok: false, error: { code: 'quota_exceeded', message: 'Session quota exceeded' }, trace_id: c.get('trace_id') },
        429,
      )
    }

    const newId = ulid()
    const code = generateJoinCode()
    const now = Date.now()
    const title = `Copy of ${session.title}`

    await c.env.DB
      .prepare(
        `INSERT INTO sessions (id, owner_id, code, title, status, anonymity, created_at)
         VALUES (?1, ?2, ?3, ?4, 'draft', ?5, ?6)`,
      )
      .bind(newId, user.sub, code, title, session.anonymity, now)
      .run()

    const questions = await fetchQuestions(c.env.DB, id)
    for (const q of questions) {
      const qid = ulid()
      await c.env.DB
        .prepare(
          `INSERT INTO questions (id, session_id, position, kind, prompt, options_json, created_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
        )
        .bind(qid, newId, q.position, q.kind, q.prompt, JSON.stringify(q.options), now)
        .run()
    }

    const newSession: Session = {
      id: newId,
      owner_id: user.sub,
      code,
      title,
      status: 'draft',
      anonymity: session.anonymity,
      vote_policy: session.vote_policy,
      session_mode: session.session_mode,
      created_at: now,
      started_at: null,
      closed_at: null,
      archived_at: null,
    }
    const newQuestions = await fetchQuestions(c.env.DB, newId)
    return c.json(
      { ok: true, data: { session: newSession, questions: newQuestions }, trace_id: c.get('trace_id') },
      201,
    )
  })

  // GET /api/sessions/:id/export.csv — download session results as CSV
  app.get('/:id/export.csv', async (c) => {
    const user = c.get('user')
    const id = c.req.param('id')
    const session = await fetchSession(c.env.DB, id, user.sub)
    if (!session) {
      return c.json(
        { ok: false, error: { code: 'not_found', message: 'Session not found' }, trace_id: c.get('trace_id') },
        404,
      )
    }

    const questions = await fetchQuestions(c.env.DB, id)
    const rows: string[] = ['Question,Option,Votes']

    for (const q of questions) {
      const { results: voteRows } = await c.env.DB
        .prepare(`SELECT option_id, COUNT(*) AS n FROM votes WHERE question_id = ?1 GROUP BY option_id`)
        .bind(q.id)
        .all<{ option_id: string; n: number }>()

      const voteCounts: Record<string, number> = {}
      for (const row of voteRows ?? []) {
        voteCounts[row.option_id] = row.n
      }

      if (q.options.length > 0) {
        for (const opt of q.options) {
          const prompt = q.prompt.replace(/"/g, '""')
          const label = opt.label.replace(/"/g, '""')
          rows.push(`"${prompt}","${label}",${voteCounts[opt.id] ?? 0}`)
        }
      } else {
        const prompt = q.prompt.replace(/"/g, '""')
        const total = Object.values(voteCounts).reduce((a, b) => a + b, 0)
        rows.push(`"${prompt}","(open answer)",${total}`)
      }
    }

    const csv = rows.join('\n')
    const filename = `${session.title.replace(/[^a-z0-9]/gi, '-')}-${session.code}.csv`
    return new Response(csv, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="${filename}"`,
      },
    })
  })

  parent.route('/api/sessions', app)
}
