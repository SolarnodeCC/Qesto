// DRAFT-API for sessions (CLAUDE.md hard rule 5 — REST for DRAFT state only;
// LIVE state flows through the SessionRoom DO in Phase 3).
//
// Routes:
//   POST   /api/sessions            create a DRAFT session
//   GET    /api/sessions            list caller's sessions
//   GET    /api/sessions/:id        fetch one session (with questions)
//   PATCH  /api/sessions/:id        update title and/or (single) poll question
//
// v1 constrains each session to at most one question (position = 0) because
// the UI surfaces a single-question wizard. The DB schema already supports
// multiple via (session_id, position) UNIQUE; Phase 2+ can add more.

import { Hono } from 'hono'
import { ulid } from '../lib/ulid'
import { generateJoinCode } from '../lib/code'
import { IdempotencyInFlightError, withIdempotency } from '../lib/idempotency'
import { deriveVoterIdentity } from '../lib/voter'
import { authMiddleware, SESSION_COOKIE, type AuthVariables } from '../middleware/auth'
import { planMiddleware, type PlanVariables } from '../middleware/plan'
import { verifyJwt } from '../lib/jwt'
import {
  CreateSessionSchema,
  PatchSessionSchema,
  type PollQuestionInput,
} from '../lib/validation'
import type { LiveQuestion } from '../realtime'
import type { Env, PollOption, Question, Session } from '../types'

type Vars = AuthVariables & PlanVariables
type SessionRow = Omit<Session, 'owner_id'> & { owner_id: string }

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
  const parsed = JSON.parse(row.options_json) as PollOption[]
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
      `SELECT id, owner_id, code, title, status, anonymity,
              created_at, started_at, closed_at, archived_at
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
  // v1 behaviour: single question at position 0. Replace on every PATCH.
  await db.prepare(`DELETE FROM questions WHERE session_id = ?1`).bind(sessionId).run()
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
      `SELECT id, owner_id, code, title, status, anonymity,
              created_at, started_at, closed_at, archived_at
         FROM sessions
        WHERE code = ?1`,
    )
    .bind(code)
    .first<SessionRow>()
  return row ?? null
}

function questionToLive(q: Question): LiveQuestion {
  return { id: q.id, kind: 'poll', prompt: q.prompt, options: q.options }
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

export function mountSessionRoutes(parent: Hono<{ Bindings: Env; Variables: Vars }>) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()
  const pub = new Hono<{ Bindings: Env; Variables: Vars }>()

  // Public endpoints (no auth): voter join-by-code lookup + WebSocket upgrade.
  pub.get('/by-code/:code', async (c) => {
    const code = c.req.param('code').toUpperCase()
    if (!/^[0-9A-Z]{6}$/.test(code)) {
      return c.json(
        { ok: false, error: { code: 'bad_code', message: 'Invalid join code' }, trace_id: c.get('trace_id') },
        400,
      )
    }
    const session = await fetchSessionByCode(c.env.DB, code)
    if (!session || session.status !== 'live') {
      return c.json(
        { ok: false, error: { code: 'not_found', message: 'No live session for that code' }, trace_id: c.get('trace_id') },
        404,
      )
    }
    return c.json({
      ok: true,
      data: { id: session.id, title: session.title, code: session.code },
      trace_id: c.get('trace_id'),
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
        `SELECT id, owner_id, code, title, status, anonymity,
                created_at, started_at, closed_at, archived_at
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
    const idemKey = c.req.header('idempotency-key') ?? undefined

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
          await c.env.DB.prepare(
            `INSERT INTO sessions (id, owner_id, code, title, status, anonymity, created_at)
             VALUES (?1, ?2, ?3, ?4, 'draft', 'anonymous', ?5)`,
          )
            .bind(id, user.sub, code, parsed.data.title, now)
            .run()
          const session: Session = {
            id,
            owner_id: user.sub,
            code,
            title: parsed.data.title,
            status: 'draft',
            anonymity: 'anonymous',
            created_at: now,
            started_at: null,
            closed_at: null,
            archived_at: null,
          }
          return {
            status: 201,
            body: { ok: true as const, data: { session, questions: [] as Question[] } },
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
    const { results } = await c.env.DB
      .prepare(
        `SELECT id, owner_id, code, title, status, anonymity,
                created_at, started_at, closed_at, archived_at
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
    if (questions.length === 0 || questions[0].kind !== 'poll') {
      return c.json(
        {
          ok: false,
          error: { code: 'no_question', message: 'Session has no poll question yet' },
          trace_id: c.get('trace_id'),
        },
        409,
      )
    }
    const now = Date.now()
    await c.env.DB
      .prepare(
        `UPDATE sessions SET status = 'live', started_at = ?1 WHERE id = ?2 AND owner_id = ?3`,
      )
      .bind(now, id, user.sub)
      .run()
    session.status = 'live'
    session.started_at = now

    const liveQ = questionToLive(questions[0])
    const doRes = await postDO(c.env, id, '/init', {
      sessionId: session.id,
      ownerId: session.owner_id,
      code: session.code,
      title: session.title,
      question: liveQ,
    })
    if (doRes.status !== 200) {
      // Best-effort rollback — DO rejected init.
      await c.env.DB
        .prepare(`UPDATE sessions SET status = 'draft', started_at = NULL WHERE id = ?1`)
        .bind(id)
        .run()
      return c.json(
        {
          ok: false,
          error: { code: 'do_init_failed', message: `DurableObject refused init (${doRes.status})` },
          trace_id: c.get('trace_id'),
        },
        500,
      )
    }
    return c.json({
      ok: true,
      data: { session, question: liveQ },
      trace_id: c.get('trace_id'),
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

  parent.route('/api/sessions', app)
}
