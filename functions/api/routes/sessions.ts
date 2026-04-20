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
import { withIdempotency } from '../lib/idempotency'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import { planMiddleware, type PlanVariables } from '../middleware/plan'
import {
  CreateSessionSchema,
  PatchSessionSchema,
  type PollQuestionInput,
} from '../lib/validation'
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

export function mountSessionRoutes(parent: Hono<{ Bindings: Env; Variables: Vars }>) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()

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

    const { status, body: payload, replayed } = await withIdempotency(
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
          body: { ok: true, data: { session, questions: [] as Question[] } },
        }
      },
    )

    if (replayed) c.header('idempotent-replay', 'true')
    return c.json({ ...payload, trace_id: c.get('trace_id') }, status as 201 | 200)
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

  parent.route('/api/sessions', app)
}
