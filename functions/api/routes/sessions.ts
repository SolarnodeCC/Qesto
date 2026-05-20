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
import { requireFeature } from '../middleware/feature-gate'
import { verifyJwt } from '../lib/jwt'
import { incrementSessionQuota } from '../lib/quota'
import { denyFeature, featureAllowed, questionKindFeature } from '../lib/entitlements'
import { validateBody } from '../lib/validate'
import {
  CreateSessionSchema,
  DuplicateSessionSchema,
  GenerateQuestionsSchema,
  JourneyEventSchema,
  PatchSessionSchema,
  isPatchBodyTitleOnly,
  RefineQuestionsSchema,
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
import { validateKvJson, PollOptionArraySchema, StringArraySchema, CachedQuestionsSchema } from '../lib/validators'
import type { LiveQuestion } from '../realtime'
import type { Env, PlanQuotas, PlanTier, Question, Session } from '../types'
import type { Team } from './teams'
import { effectiveTeamPermissionsForUser, type Permission } from '../lib/authz'
import { readKvJson } from '../lib/kv'
import { teamDocumentKey } from '../lib/kv-keys'
import {
  rejectDraftForResults,
  requireClosedOrArchivedForInsights,
  requireDraft,
  requireEditableTitle,
  requireFound,
  requireLiveForClose,
  requireLiveForWebSocket,
} from '../lib/session-lifecycle'
import { suggestDuplicateTitle } from '../lib/session-title'
import { hardDeleteSession } from '../lib/session-delete'

type Vars = AuthVariables & PlanVariables
// SessionRow mirrors the D1 row shape. Analytics-only column `team_id` (OBS-001)
// is present on the row and surfaced on Session as an optional field.
type SessionRow = Session & { team_id: string | null }
type Sprint19JourneyEvent =
  | 'wizard.opened'
  | 'wizard.completed'
  | 'ai.suggestions_resolved'
  | 'launchpad.opened'
  | 'launchpad.launch_attempt'
  | 'launchpad.launch_success'
  | 'launchpad.launch_failed'
  | 'preflight.checked'
  | 'preflight.failed'

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
  // Sprint 18 prereq: AI provenance + GDPR consent audit trail for wizard generation.
  await db.prepare(`ALTER TABLE sessions ADD COLUMN ai_generated INTEGER NOT NULL DEFAULT 0`).run().catch(() => {})
  await db.prepare(`ALTER TABLE sessions ADD COLUMN ai_consent_at INTEGER`).run().catch(() => {})
  await db.prepare(`ALTER TABLE sessions ADD COLUMN ai_grounding_hash TEXT`).run().catch(() => {})
  await db.prepare(`ALTER TABLE sessions ADD COLUMN ai_accepted_count INTEGER NOT NULL DEFAULT 0`).run().catch(() => {})
  await db.prepare(`ALTER TABLE sessions ADD COLUMN ai_dismissed_count INTEGER NOT NULL DEFAULT 0`).run().catch(() => {})
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS sprint19_events (
      id TEXT PRIMARY KEY,
      event_name TEXT NOT NULL,
      user_id TEXT NOT NULL,
      session_id TEXT,
      team_id TEXT,
      plan TEXT,
      count INTEGER NOT NULL DEFAULT 0,
      value REAL NOT NULL DEFAULT 0,
      duration_ms INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      trace_id TEXT NOT NULL
    )`,
  ).run().catch(() => {})
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_sprint19_events_name_created ON sprint19_events(event_name, created_at)`).run().catch(() => {})
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_sprint19_events_session ON sprint19_events(session_id)`).run().catch(() => {})
}

async function presenterPermissionsForSession(
  env: Env,
  session: SessionRow,
  userId: string,
): Promise<Permission[] | undefined> {
  if (!session.team_id) return undefined
  const team = await readKvJson<Team>(env.TEAMS_KV, teamDocumentKey(session.team_id))
  if (!team) return []
  return effectiveTeamPermissionsForUser(env.DB, team, userId)
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
  const parsed = validateKvJson(row.options_json, PollOptionArraySchema) ?? []
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

function deniedQuestionFeature(plan: PlanTier, quotas: PlanQuotas, kind: Question['kind']) {
  const feature = questionKindFeature(kind)
  if (!feature || featureAllowed(quotas, feature)) return null
  return denyFeature(plan, feature)
}

async function recordSprint19JourneyEvent(
  env: Env,
  event: {
    name: Sprint19JourneyEvent
    userId: string
    sessionId?: string | undefined
    teamId?: string | null | undefined
    plan?: PlanTier | undefined
    count?: number | undefined
    value?: number | undefined
    durationMs?: number | undefined
    traceId: string
  },
): Promise<void> {
  writeEvent(env.METRICS_AE, {
    name: event.name,
    userId: event.userId,
    sessionId: event.sessionId,
    teamId: event.teamId ?? undefined,
    plan: event.plan,
    count: event.count,
    value: event.value,
    durationMs: event.durationMs,
    traceId: event.traceId,
  })
  await env.DB
    .prepare(
      `INSERT INTO sprint19_events
       (id, event_name, user_id, session_id, team_id, plan, count, value, duration_ms, created_at, trace_id)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`,
    )
    .bind(
      ulid(),
      event.name,
      event.userId,
      event.sessionId ?? null,
      event.teamId ?? null,
      event.plan ?? null,
      event.count ?? 0,
      event.value ?? 0,
      event.durationMs ?? 0,
      Date.now(),
      event.traceId,
    )
    .run()
    .catch(() => {
      // Measurement must fail open; missing local migrations should not break the product path.
    })
}

async function fetchSession(db: D1Database, id: string, ownerId: string): Promise<Session | null> {
  const row = await db
    .prepare(
      `SELECT id, owner_id, code, title, status, anonymity, vote_policy, session_mode,
              created_at, started_at, closed_at, archived_at, team_id,
              ai_generated, ai_consent_at, ai_grounding_hash,
              ai_accepted_count, ai_dismissed_count
         FROM sessions
        WHERE id = ?1 AND owner_id = ?2`,
    )
    .bind(id, ownerId)
    .first<SessionRow>()
  return row ?? null
}

async function fetchOwnerSessionTitles(db: D1Database, ownerId: string): Promise<string[]> {
  const { results } = await db
    .prepare(`SELECT title FROM sessions WHERE owner_id = ?1`)
    .bind(ownerId)
    .all<{ title: string }>()
  return (results ?? []).map((r) => r.title)
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
    options = validateKvJson(q.options_json, PollOptionArraySchema) ?? []

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
    const wsGate = requireLiveForWebSocket(session)
    if (!wsGate.ok) {
      return c.json(
        { ok: false, error: { code: wsGate.error.code, message: wsGate.error.message }, trace_id: c.get('trace_id') },
        wsGate.error.status,
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
    let presenterPermissions: Permission[] | undefined
    if (token) {
      const claims = await verifyJwt(token, c.env.JWT_SECRET)
      if (claims) {
        const teamPermissions = await presenterPermissionsForSession(c.env, session, claims.sub)
        const canPresentTeamSession =
          session.team_id !== null &&
          (teamPermissions?.some((permission) =>
            permission === 'session:launch' ||
            permission === 'session:close' ||
            permission === 'energizer:activate'
          ) ?? false)
        if (claims.sub === session.owner_id || canPresentTeamSession) {
          role = 'presenter'
          presenterUserId = claims.sub
          presenterPermissions = teamPermissions
        }
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
        ...(role === 'presenter' && presenterPermissions !== undefined
          ? { 'x-qesto-permissions': presenterPermissions.join(',') }
          : {}),
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

  // POST /api/sessions/journey-events — client-side Sprint 19 journey signals.
  app.post('/journey-events', async (c) => {
    const user = c.get('user')
    const traceId = c.get('trace_id')
    await patchSchemaIfNeeded(c.env.DB)

    const validated = await validateBody(c, JourneyEventSchema)
    if ('error' in validated) return validated.error
    const { data: body } = validated

    let session: Session | null = null
    if (body.sessionId) {
      session = await fetchSession(c.env.DB, body.sessionId, user.sub)
      if (!session) {
        return c.json(
          { ok: false, error: { code: 'not_found', message: 'Session not found' }, trace_id: traceId },
          404,
        )
      }
    }

    await recordSprint19JourneyEvent(c.env, {
      name: body.event as Sprint19JourneyEvent,
      userId: user.sub,
      sessionId: session?.id,
      teamId: session?.team_id,
      plan: c.get('plan'),
      count: body.count,
      value: body.value,
      durationMs: body.durationMs,
      traceId,
    })

    return c.json({ ok: true, data: { recorded: true }, trace_id: traceId })
  })

  // POST /api/sessions — create DRAFT
  app.post('/', async (c) => {
    const validated = await validateBody(c, CreateSessionSchema)
    if ('error' in validated) {
      return validated.error
    }
    const { data: body } = validated

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
              const ids = validateKvJson(raw, StringArraySchema)
              teamId = ids && ids.length > 0 ? ids[0] : null
            }
          } catch {
            // KV lookup is best-effort analytics attribution — never blocks session creation.
            teamId = null
          }
          await c.env.DB.prepare(
            `INSERT INTO sessions (id, owner_id, code, title, status, anonymity, vote_policy, session_mode, created_at, team_id)
             VALUES (?1, ?2, ?3, ?4, 'draft', 'full', 'once', 'reflection', ?5, ?6)`,
          )
            .bind(id, user.sub, code, body.title, now, teamId)
            .run()
          const session: Session = {
            id,
            owner_id: user.sub,
            code,
            title: body.title,
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

  // PATCH /api/sessions/:id — DRAFT full write; closed/archived title-only
  app.patch('/:id', async (c) => {
    const user = c.get('user')
    const plan = c.get('plan')
    const quotas = c.get('planQuotas')
    const id = c.req.param('id')

    const validated = await validateBody(c, PatchSessionSchema)
    if ('error' in validated) {
      return validated.error
    }
    const { data: body } = validated

    const loaded = requireFound(await fetchSession(c.env.DB, id, user.sub))
    if (!loaded.ok) {
      return c.json(
        { ok: false, error: { code: loaded.error.code, message: loaded.error.message }, trace_id: c.get('trace_id') },
        loaded.error.status,
      )
    }

    const titleOnly = isPatchBodyTitleOnly(body)
    let session: Session
    if (titleOnly) {
      const titlePatch = requireEditableTitle(loaded.session)
      if (!titlePatch.ok) {
        return c.json(
          { ok: false, error: { code: titlePatch.error.code, message: titlePatch.error.message }, trace_id: c.get('trace_id') },
          titlePatch.error.status,
        )
      }
      session = titlePatch.session
    } else {
      const draftPatch = requireDraft(loaded.session, 'patch')
      if (!draftPatch.ok) {
        return c.json(
          { ok: false, error: { code: draftPatch.error.code, message: draftPatch.error.message }, trace_id: c.get('trace_id') },
          draftPatch.error.status,
        )
      }
      session = draftPatch.session
    }

    if (body.title !== undefined) {
      await c.env.DB
        .prepare(`UPDATE sessions SET title = ?1 WHERE id = ?2 AND owner_id = ?3`)
        .bind(body.title, id, user.sub)
        .run()
      session.title = body.title
    }

    if (titleOnly) {
      const questions = await fetchQuestions(c.env.DB, id)
      return c.json({ ok: true, data: { session, questions }, trace_id: c.get('trace_id') })
    }

    if (body.anonymity !== undefined) {
      await c.env.DB
        .prepare(`UPDATE sessions SET anonymity = ?1 WHERE id = ?2 AND owner_id = ?3`)
        .bind(body.anonymity, id, user.sub)
        .run()
      session.anonymity = body.anonymity
    }
    if (body.vote_policy !== undefined) {
      await c.env.DB
        .prepare(`UPDATE sessions SET vote_policy = ?1 WHERE id = ?2 AND owner_id = ?3`)
        .bind(body.vote_policy, id, user.sub)
        .run()
      session.vote_policy = body.vote_policy
    }
    if (body.session_mode !== undefined) {
      await c.env.DB
        .prepare(`UPDATE sessions SET session_mode = ?1 WHERE id = ?2 AND owner_id = ?3`)
        .bind(body.session_mode, id, user.sub)
        .run()
      session.session_mode = body.session_mode
    }
    if (body.ai_generated !== undefined) {
      await c.env.DB
        .prepare(`UPDATE sessions SET ai_generated = ?1 WHERE id = ?2 AND owner_id = ?3`)
        .bind(body.ai_generated ? 1 : 0, id, user.sub)
        .run()
      session.ai_generated = body.ai_generated ? 1 : 0
    }
    if (body.ai_consent_at !== undefined) {
      await c.env.DB
        .prepare(`UPDATE sessions SET ai_consent_at = ?1 WHERE id = ?2 AND owner_id = ?3`)
        .bind(body.ai_consent_at, id, user.sub)
        .run()
      session.ai_consent_at = body.ai_consent_at
    }
    if (body.ai_grounding_hash !== undefined) {
      await c.env.DB
        .prepare(`UPDATE sessions SET ai_grounding_hash = ?1 WHERE id = ?2 AND owner_id = ?3`)
        .bind(body.ai_grounding_hash, id, user.sub)
        .run()
      session.ai_grounding_hash = body.ai_grounding_hash
    }
    if (body.ai_accepted_count !== undefined) {
      await c.env.DB
        .prepare(`UPDATE sessions SET ai_accepted_count = ?1 WHERE id = ?2 AND owner_id = ?3`)
        .bind(body.ai_accepted_count, id, user.sub)
        .run()
      session.ai_accepted_count = body.ai_accepted_count
    }
    if (body.ai_dismissed_count !== undefined) {
      await c.env.DB
        .prepare(`UPDATE sessions SET ai_dismissed_count = ?1 WHERE id = ?2 AND owner_id = ?3`)
        .bind(body.ai_dismissed_count, id, user.sub)
        .run()
      session.ai_dismissed_count = body.ai_dismissed_count
    }
    let questions = await fetchQuestions(c.env.DB, id)
    if (body.question) {
      const denied = deniedQuestionFeature(plan, quotas, body.question.kind)
      if (denied) {
        return c.json({ ok: false, error: denied, trace_id: c.get('trace_id') }, 403)
      }
      const q = await upsertPollQuestion(c.env.DB, id, body.question)
      questions = [q]
    }

    return c.json({ ok: true, data: { session, questions }, trace_id: c.get('trace_id') })
  })

  // POST /api/sessions/:id/start — DRAFT → LIVE
  app.post('/:id/start', async (c) => {
    const user = c.get('user')
    const id = c.req.param('id')
    const traceId = c.get('trace_id')
    const startLoaded = requireFound(await fetchSession(c.env.DB, id, user.sub))
    if (!startLoaded.ok) {
      return c.json(
        { ok: false, error: { code: startLoaded.error.code, message: startLoaded.error.message }, trace_id: traceId },
        startLoaded.error.status,
      )
    }
    await recordSprint19JourneyEvent(c.env, {
      name: 'launchpad.launch_attempt',
      userId: user.sub,
      sessionId: id,
      teamId: startLoaded.session.team_id,
      plan: c.get('plan'),
      traceId,
    })
    const draftStart = requireDraft(startLoaded.session, 'start')
    if (!draftStart.ok) {
      await recordSprint19JourneyEvent(c.env, {
        name: 'launchpad.launch_failed',
        userId: user.sub,
        sessionId: id,
        teamId: startLoaded.session.team_id,
        plan: c.get('plan'),
        value: 1,
        traceId,
      })
      return c.json(
        { ok: false, error: { code: draftStart.error.code, message: draftStart.error.message }, trace_id: traceId },
        draftStart.error.status,
      )
    }
    const session = draftStart.session
    const questions = await fetchQuestions(c.env.DB, id)
    if (questions.length === 0) {
      await recordSprint19JourneyEvent(c.env, {
        name: 'launchpad.launch_failed',
        userId: user.sub,
        sessionId: id,
        teamId: session.team_id,
        plan: c.get('plan'),
        value: 1,
        traceId,
      })
      return c.json(
        {
          ok: false,
          error: { code: 'no_question', message: 'Session has no question yet' },
          trace_id: traceId,
        },
        409,
      )
    }
    const now = Date.now()
    const liveQ = questionToLive(questions[0])
    const logCtx = { trace_id: traceId, session_id: id, user_id: user.sub }

    console.log(JSON.stringify({ ts: new Date().toISOString(), level: 'info', event: 'session.start.attempt', ...logCtx }))

    // Check if session has energizers with draft state
    const energizers = await c.env.DB
      .prepare(`SELECT COUNT(*) as n FROM energizers WHERE session_id = ?1 AND state = 'draft'`)
      .bind(id)
      .first<{ n: number }>()
    const hasEnergizersToDo = (energizers?.n ?? 0) > 0
    const initialStatus = hasEnergizersToDo ? 'energizing' : 'live'

    // Conditional UPDATE: only transitions from draft → (energizing|live).
    // `meta.changes === 0` means a concurrent request already won this write.
    const result = await c.env.DB
      .prepare(
        `UPDATE sessions SET status = ?1, started_at = ?2
         WHERE id = ?3 AND owner_id = ?4 AND status = 'draft'`,
      )
      .bind(initialStatus, now, id, user.sub)
      .run()

    if (result.meta.changes === 0) {
      // A concurrent request already transitioned the session. Re-read it and
      // return success without a redundant DO /init call.
      const current = await fetchSession(c.env.DB, id, user.sub)
      console.log(JSON.stringify({ ts: new Date().toISOString(), level: 'info', event: 'session.start.concurrent_win', ...logCtx }))
      if (current?.status === 'energizing' || current?.status === 'live') {
        return c.json({ ok: true, data: { session: current, question: liveQ }, trace_id: traceId })
      }
      return c.json(
        { ok: false, error: { code: 'conflict', message: 'Session could not be started' }, trace_id: traceId },
        409,
      )
    }
    session.status = initialStatus
    session.started_at = now

    let doRes: Response
    try {
      doRes = await postDO(c.env, id, '/init', {
        sessionId: session.id,
        ownerId: session.owner_id,
        teamId: session.team_id ?? undefined,
        code: session.code,
        title: session.title,
        question: liveQ,
        questions: questions.map(questionToLive),
        votePolicy: session.vote_policy,
        sessionMode: session.session_mode,
        anonymity: session.anonymity ?? undefined,
        plan: c.get('plan'),
      })
    } catch (doNetworkErr) {
      // DO stub.fetch() threw at the network level (not the DO returning 500).
      // Roll back the DB transition so the session remains startable.
      console.log(JSON.stringify({ ts: new Date().toISOString(), level: 'error', event: 'session.start.do_network_error', ...logCtx, err: String(doNetworkErr) }))
      try {
        await c.env.DB
          .prepare(`UPDATE sessions SET status = 'draft', started_at = NULL WHERE id = ?1`)
          .bind(id)
          .run()
      } catch { /* best-effort rollback */ }
      await recordSprint19JourneyEvent(c.env, {
        name: 'launchpad.launch_failed',
        userId: user.sub,
        sessionId: id,
        teamId: session.team_id,
        plan: c.get('plan'),
        value: 1,
        traceId,
      })
      return c.json(
        { ok: false, error: { code: 'do_init_failed', message: 'Session room unavailable, please try again' }, trace_id: traceId },
        500,
      )
    }
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
      await recordSprint19JourneyEvent(c.env, {
        name: 'launchpad.launch_failed',
        userId: user.sub,
        sessionId: id,
        teamId: session.team_id,
        plan: c.get('plan'),
        value: 1,
        traceId,
      })
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
    await recordSprint19JourneyEvent(c.env, {
      name: 'launchpad.launch_success',
      userId: user.sub,
      sessionId: id,
      teamId: session.team_id,
      plan: c.get('plan'),
      traceId,
    })
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
    const closeLoaded = requireFound(await fetchSession(c.env.DB, id, user.sub))
    if (!closeLoaded.ok) {
      return c.json(
        { ok: false, error: { code: closeLoaded.error.code, message: closeLoaded.error.message }, trace_id: c.get('trace_id') },
        closeLoaded.error.status,
      )
    }
    const liveClose = requireLiveForClose(closeLoaded.session)
    if (!liveClose.ok) {
      return c.json(
        { ok: false, error: { code: liveClose.error.code, message: liveClose.error.message }, trace_id: c.get('trace_id') },
        liveClose.error.status,
      )
    }
    const session = liveClose.session
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

  // POST /api/sessions/:id/transition-to-live — ENERGIZING → LIVE.
  // Transitions a session from ENERGIZING state (after energizers) to LIVE (show questions).
  app.post('/:id/transition-to-live', async (c) => {
    const user = c.get('user')
    const id = c.req.param('id')
    const traceId = c.get('trace_id')
    const loaded = requireFound(await fetchSession(c.env.DB, id, user.sub))
    if (!loaded.ok) {
      return c.json(
        { ok: false, error: { code: loaded.error.code, message: loaded.error.message }, trace_id: traceId },
        loaded.error.status,
      )
    }
    const session = loaded.session
    if (session.status !== 'energizing') {
      return c.json(
        {
          ok: false,
          error: {
            code: 'conflict',
            message: 'Session must be in ENERGIZING state to transition to LIVE',
          },
          trace_id: traceId,
        },
        409,
      )
    }

    // Update DB status to live
    const result = await c.env.DB
      .prepare(`UPDATE sessions SET status = 'live' WHERE id = ?1 AND owner_id = ?2 AND status = 'energizing'`)
      .bind(id, user.sub)
      .run()

    if (result.meta.changes === 0) {
      return c.json(
        {
          ok: false,
          error: { code: 'conflict', message: 'Session could not be transitioned to LIVE' },
          trace_id: traceId,
        },
        409,
      )
    }

    // Notify DO to update its internal state (if it exists)
    try {
      const stub = await doStub(c.env, id)
      await stub.fetch('https://do.internal/transition-to-live', { method: 'POST' })
    } catch {
      // Best effort — if DO doesn't respond, session state is still updated in DB
    }

    session.status = 'live'
    return c.json({
      ok: true,
      data: { session },
      trace_id: traceId,
    })
  })

  // GET /api/sessions/:id/results — aggregate persisted totals (CLOSED) or the
  // live DO snapshot (LIVE). DRAFT sessions have no results to show.
  app.get('/:id/results', async (c) => {
    const user = c.get('user')
    const id = c.req.param('id')
    const resultsLoaded = requireFound(await fetchSession(c.env.DB, id, user.sub))
    if (!resultsLoaded.ok) {
      return c.json(
        { ok: false, error: { code: resultsLoaded.error.code, message: resultsLoaded.error.message }, trace_id: c.get('trace_id') },
        resultsLoaded.error.status,
      )
    }
    const resultsGate = rejectDraftForResults(resultsLoaded.session)
    if (!resultsGate.ok) {
      return c.json(
        { ok: false, error: { code: resultsGate.error.code, message: resultsGate.error.message }, trace_id: c.get('trace_id') },
        resultsGate.error.status,
      )
    }
    const session = resultsGate.session
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
  // ─────────────────────────────────────────────────────────────────────────-
  app.post('/:id/questions/generate', async (c) => {
    const user = c.get('user')
    const id = c.req.param('id')

    const rl = await rateLimit(c.env.ACTIONS_KV, user.sub, {
      max: 20,
      windowSeconds: 3600,
      prefix: 'ai-wizard',
    })
    if (!rl.allowed) {
      writeEvent(c.env.METRICS_AE, {
        name: 'ai.rate_limited',
        userId: user.sub,
        sessionId: id,
        plan: c.get('plan'),
        count: 20,
        traceId: c.get('trace_id'),
      })
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

    const genLoaded = requireFound(await fetchSession(c.env.DB, id, user.sub))
    if (!genLoaded.ok) {
      return c.json(
        { ok: false, error: { code: genLoaded.error.code, message: genLoaded.error.message }, trace_id: c.get('trace_id') },
        genLoaded.error.status,
      )
    }
    const genDraft = requireDraft(genLoaded.session, 'generate_questions')
    if (!genDraft.ok) {
      return c.json(
        { ok: false, error: { code: genDraft.error.code, message: genDraft.error.message }, trace_id: c.get('trace_id') },
        genDraft.error.status,
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
      const inferenceStart = Date.now()
      const result = await generateQuestions(c.env.AI, { ...parsed.data, language })
      writeEvent(c.env.METRICS_AE, {
        name: 'ai.inference',
        userId: user.sub,
        sessionId: id,
        plan: c.get('plan'),
        durationMs: Date.now() - inferenceStart,
        count: result.questions.length,
        traceId: c.get('trace_id'),
      })
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
  // WIZ-AI-01: POST /api/sessions/:id/ai/generate
  // SSE variant used by the Sprint 19 wizard. It sends a ready event
  // immediately, then streams the final validated question payload when the
  // Workers AI generation completes.
  // ──────────────────────────────────────────────────────────────────────────
  app.post('/:id/ai/generate', async (c) => {
    const user = c.get('user')
    const id = c.req.param('id')

    const rl = await rateLimit(c.env.ACTIONS_KV, user.sub, {
      max: 20,
      windowSeconds: 3600,
      prefix: 'ai-wizard',
    })
    if (!rl.allowed) {
      writeEvent(c.env.METRICS_AE, {
        name: 'ai.rate_limited',
        userId: user.sub,
        sessionId: id,
        plan: c.get('plan'),
        count: 20,
        traceId: c.get('trace_id'),
      })
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

    const sseLoaded = requireFound(await fetchSession(c.env.DB, id, user.sub))
    if (!sseLoaded.ok) {
      return c.json(
        { ok: false, error: { code: sseLoaded.error.code, message: sseLoaded.error.message }, trace_id: c.get('trace_id') },
        sseLoaded.error.status,
      )
    }
    const sseDraft = requireDraft(sseLoaded.session, 'generate_questions')
    if (!sseDraft.ok) {
      return c.json(
        { ok: false, error: { code: sseDraft.error.code, message: sseDraft.error.message }, trace_id: c.get('trace_id') },
        sseDraft.error.status,
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

    const encoder = new TextEncoder()
    const language = c.req.header('accept-language') ?? 'en'
    const grounding = JSON.stringify({
      sessionTitle: parsed.data.sessionTitle,
      sessionGoal: parsed.data.sessionGoal,
      focusArea: parsed.data.focusArea ?? null,
      language,
    })
    const groundingHash = await hashGrounding(grounding)
    const traceId = c.get('trace_id')

    function sse(event: string, data: unknown): Uint8Array {
      return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    }

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(sse('ready', { trace_id: traceId, groundingHash }))
        try {
          const inferenceStart = Date.now()
          const result = await generateQuestions(c.env.AI, { ...parsed.data, language })
          writeEvent(c.env.METRICS_AE, {
            name: 'ai.inference',
            userId: user.sub,
            sessionId: id,
            plan: c.get('plan'),
            durationMs: Date.now() - inferenceStart,
            count: result.questions.length,
            traceId,
          })
          controller.enqueue(sse('questions', {
            questions: result.questions,
            confidence: result.confidence,
            groundingHash,
          }))
          controller.enqueue(sse('done', { ok: true }))
        } catch (err) {
          if (err instanceof WizardValidationError) {
            controller.enqueue(sse('error', {
              code: 'ai_output_invalid',
              message: 'AI returned an output that failed validation',
              details: err.details,
            }))
          } else if (err instanceof WizardAIError) {
            const sanitized = sanitizeError(err, c.env.ENV, 500)
            controller.enqueue(sse('error', { ...sanitized, code: 'ai_failed' }))
          } else {
            controller.enqueue(sse('error', {
              code: 'internal_error',
              message: err instanceof Error ? err.message : 'Unexpected AI generation error',
            }))
          }
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache, no-transform',
        connection: 'keep-alive',
      },
    })
  })

  // ──────────────────────────────────────────────────────────────────────────
  // LAUNCHPAD-02: POST /api/sessions/:id/questions
  // Appends a new question to a DRAFT session without replacing existing ones.
  // ──────────────────────────────────────────────────────────────────────────
  app.post('/:id/questions', async (c) => {
    const user = c.get('user')
    const id = c.req.param('id')

    const addQLoaded = requireFound(await fetchSession(c.env.DB, id, user.sub))
    if (!addQLoaded.ok) {
      return c.json(
        { ok: false, error: { code: addQLoaded.error.code, message: addQLoaded.error.message }, trace_id: c.get('trace_id') },
        addQLoaded.error.status,
      )
    }
    const addQDraft = requireDraft(addQLoaded.session, 'add_question')
    if (!addQDraft.ok) {
      return c.json(
        { ok: false, error: { code: addQDraft.error.code, message: addQDraft.error.message }, trace_id: c.get('trace_id') },
        addQDraft.error.status,
      )
    }
    const session = addQDraft.session

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
    const denied = deniedQuestionFeature(c.get('plan'), c.get('planQuotas'), parsed.data.kind)
    if (denied) {
      return c.json({ ok: false, error: denied, trace_id: c.get('trace_id') }, 403)
    }
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

    const reorderLoaded = requireFound(await fetchSession(c.env.DB, id, user.sub))
    if (!reorderLoaded.ok) {
      return c.json(
        { ok: false, error: { code: reorderLoaded.error.code, message: reorderLoaded.error.message }, trace_id: c.get('trace_id') },
        reorderLoaded.error.status,
      )
    }
    const reorderDraft = requireDraft(reorderLoaded.session, 'reorder')
    if (!reorderDraft.ok) {
      return c.json(
        { ok: false, error: { code: reorderDraft.error.code, message: reorderDraft.error.message }, trace_id: c.get('trace_id') },
        reorderDraft.error.status,
      )
    }
    const session = reorderDraft.session

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

    const patchQLoaded = requireFound(await fetchSession(c.env.DB, id, user.sub))
    if (!patchQLoaded.ok) {
      return c.json(
        { ok: false, error: { code: patchQLoaded.error.code, message: patchQLoaded.error.message }, trace_id: c.get('trace_id') },
        patchQLoaded.error.status,
      )
    }
    const patchQDraft = requireDraft(patchQLoaded.session, 'patch')
    if (!patchQDraft.ok) {
      return c.json(
        { ok: false, error: { code: patchQDraft.error.code, message: patchQDraft.error.message }, trace_id: c.get('trace_id') },
        patchQDraft.error.status,
      )
    }
    const session = patchQDraft.session

    const body = await c.req.json().catch(() => null)
    const parsed = AddQuestionSchema.safeParse(body)
    if (!parsed.success) {
      return c.json(
        { ok: false, error: { code: 'validation', message: 'Invalid question payload', details: parsed.error.flatten() }, trace_id: c.get('trace_id') },
        400,
      )
    }

    const rawOptions = autoPopulateOptions(parsed.data.kind, parsed.data.options)
    const denied = deniedQuestionFeature(c.get('plan'), c.get('planQuotas'), parsed.data.kind)
    if (denied) {
      return c.json({ ok: false, error: denied, trace_id: c.get('trace_id') }, 403)
    }
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
    const { deleted } = await hardDeleteSession(c.env.DB, id, user.sub)
    if (!deleted) {
      return c.json(
        { ok: false, error: { code: 'not_found', message: 'Session not found' }, trace_id: c.get('trace_id') },
        404,
      )
    }
    return c.json({ ok: true, trace_id: c.get('trace_id') })
  })

  // POST /api/sessions/:id/duplicate — create a DRAFT copy (optional body.title)
  app.post('/:id/duplicate', async (c) => {
    const user = c.get('user')
    const id = c.req.param('id')
    const quotas = c.get('planQuotas')

    const validated = await validateBody(c, DuplicateSessionSchema)
    if ('error' in validated) {
      return validated.error
    }
    const { data: body } = validated

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

    const existingTitles = await fetchOwnerSessionTitles(c.env.DB, user.sub)
    const title =
      body.title ?? suggestDuplicateTitle(session.title, existingTitles)

    const newId = ulid()
    const code = generateJoinCode()
    const now = Date.now()

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
  app.get('/:id/export.csv', requireFeature('resultsExport'), async (c) => {
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

  // ──────────────────────────────────────────────────────────────────────────
  // S18 prereq: GET /api/sessions/:id/preflight
  // Validates a DRAFT session is launch-ready. Returns a list of named checks
  // with pass/fail and a top-level `ready` boolean (true iff all pass).
  // ──────────────────────────────────────────────────────────────────────────
  app.get('/:id/preflight', async (c) => {
    const user = c.get('user')
    const id = c.req.param('id')
    const traceId = c.get('trace_id')

    const pfLoaded = requireFound(await fetchSession(c.env.DB, id, user.sub))
    if (!pfLoaded.ok) {
      return c.json(
        { ok: false, error: { code: pfLoaded.error.code, message: pfLoaded.error.message }, trace_id: traceId },
        pfLoaded.error.status,
      )
    }
    const pfDraft = requireDraft(pfLoaded.session, 'preflight')
    if (!pfDraft.ok) {
      return c.json(
        { ok: false, error: { code: pfDraft.error.code, message: pfDraft.error.message }, trace_id: traceId },
        pfDraft.error.status,
      )
    }
    const session = pfDraft.session

    const questions = await fetchQuestions(c.env.DB, id)
    const checks: { id: string; label: string; pass: boolean; message?: string }[] = []

    const pushCheck = (
      check: { id: string; label: string; pass: boolean; message?: string | undefined },
    ) => {
      const entry: { id: string; label: string; pass: boolean; message?: string } = {
        id: check.id,
        label: check.label,
        pass: check.pass,
      }
      if (check.message !== undefined) entry.message = check.message
      checks.push(entry)
    }

    // 1. has_questions
    pushCheck({
      id: 'has_questions',
      label: 'At least one question',
      pass: questions.length >= 1,
      message: questions.length === 0 ? 'Add at least one question before launching' : undefined,
    })

    // 2. questions_valid: every poll/ranking/consent question must have ≥2 options
    const invalid = questions.filter(
      (q) => q.kind !== 'open' && q.kind !== 'word_cloud' && q.options.length < 2,
    )
    pushCheck({
      id: 'questions_valid',
      label: 'All questions have ≥2 options',
      pass: invalid.length === 0,
      message: invalid.length > 0 ? `${invalid.length} question(s) need more options` : undefined,
    })

    // 3. title_set
    const titleOk = !!(session.title && session.title.trim().length > 0)
    pushCheck({
      id: 'title_set',
      label: 'Session title set',
      pass: titleOk,
      message: titleOk ? undefined : 'Set a session title before launching',
    })

    // 4. ai_consent: only required if AI-generated
    const consentOk = session.ai_generated === 1 ? !!session.ai_consent_at : true
    pushCheck({
      id: 'ai_consent',
      label: 'AI generation consent recorded',
      pass: consentOk,
      message: consentOk ? undefined : 'GDPR consent required for AI-generated sessions',
    })

    const ready = checks.every((check) => check.pass)
    const failureCount = checks.filter((check) => !check.pass).length
    await recordSprint19JourneyEvent(c.env, {
      name: 'preflight.checked',
      userId: user.sub,
      sessionId: id,
      teamId: session.team_id,
      plan: c.get('plan'),
      count: failureCount,
      traceId,
    })
    if (!ready) {
      await recordSprint19JourneyEvent(c.env, {
        name: 'preflight.failed',
        userId: user.sub,
        sessionId: id,
        teamId: session.team_id,
        plan: c.get('plan'),
        count: failureCount,
        traceId,
      })
      console.log(
        JSON.stringify({
          ts: new Date().toISOString(),
          level: 'warn',
          event: 'preflight.failed',
          session_id: id,
          failed_checks: checks.filter((check) => !check.pass).map((check) => check.id),
          trace_id: traceId,
        }),
      )
    }
    return c.json({ ok: true, data: { ready, checks }, trace_id: traceId })
  })

  // ──────────────────────────────────────────────────────────────────────────
  // S18 prereq: POST /api/sessions/:id/ai/refine
  // Iterative refinement of AI-generated drafts. Caches by SHA-256 of the
  // grounding text so repeated identical refines are free. Rate-limit:
  // 10/hour/user. DRAFT-only.
  // ──────────────────────────────────────────────────────────────────────────
  app.post('/:id/ai/refine', async (c) => {
    const user = c.get('user')
    const id = c.req.param('id')
    const traceId = c.get('trace_id')

    const rl = await rateLimit(c.env.ACTIONS_KV, user.sub, {
      max: 10,
      windowSeconds: 3600,
      prefix: 'ai-refine',
    })
    if (!rl.allowed) {
      writeEvent(c.env.METRICS_AE, {
        name: 'ai.rate_limited',
        userId: user.sub,
        sessionId: id,
        plan: c.get('plan'),
        count: 10,
        traceId,
      })
      return c.json(
        {
          ok: false,
          error: {
            code: 'rate_limited',
            message: 'Too many AI refinements. Try again in an hour.',
            details: { reset_at: rl.resetAt, limit: 10 },
          },
          trace_id: traceId,
        },
        429,
      )
    }

    const refineLoaded = requireFound(await fetchSession(c.env.DB, id, user.sub))
    if (!refineLoaded.ok) {
      return c.json(
        { ok: false, error: { code: refineLoaded.error.code, message: refineLoaded.error.message }, trace_id: traceId },
        refineLoaded.error.status,
      )
    }
    const refineDraft = requireDraft(refineLoaded.session, 'ai_refine')
    if (!refineDraft.ok) {
      return c.json(
        { ok: false, error: { code: refineDraft.error.code, message: refineDraft.error.message }, trace_id: traceId },
        refineDraft.error.status,
      )
    }
    const session = refineDraft.session

    const validated = await validateBody(c, RefineQuestionsSchema)
    if ('error' in validated) return validated.error
    const { grounding, feedback } = validated.data

    const groundingHash = await hashGrounding(grounding)
    const cacheKey = `draft:ai:${id}`

    // Cache hit: same grounding hash already stored. Return cached questions.
    if (session.ai_grounding_hash && session.ai_grounding_hash === groundingHash) {
      const cachedRaw = await c.env.SESSIONS_KV.get(cacheKey)
      if (cachedRaw) {
        const cached = validateKvJson(cachedRaw, CachedQuestionsSchema)
        if (cached) {
          return c.json({
            ok: true,
            data: { questions: cached.questions, confidence: cached.confidence ?? 1, cached: true },
            trace_id: traceId,
          })
        }
      }
    }

    try {
      const language = c.req.header('accept-language') ?? 'en'
      // The refine prompt blends grounding + user feedback into the goal field.
      const inferenceStart = Date.now()
      const result = await generateQuestions(c.env.AI, {
        sessionTitle: session.title,
        sessionGoal: `${grounding}\n\nRefinement feedback: ${feedback}`,
        language,
      })
      writeEvent(c.env.METRICS_AE, {
        name: 'ai.inference',
        userId: user.sub,
        sessionId: id,
        plan: c.get('plan'),
        durationMs: Date.now() - inferenceStart,
        count: result.questions.length,
        traceId,
      })

      // Persist hash on the session row for future cache hits.
      await c.env.DB
        .prepare(`UPDATE sessions SET ai_grounding_hash = ?1 WHERE id = ?2`)
        .bind(groundingHash, id)
        .run()
      // Store refined questions in KV (24h TTL) for cache replays.
      await c.env.SESSIONS_KV.put(
        cacheKey,
        JSON.stringify({ questions: result.questions, confidence: result.confidence }),
        { expirationTtl: 86400 },
      )

      return c.json({
        ok: true,
        data: { questions: result.questions, confidence: result.confidence, cached: false },
        trace_id: traceId,
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
            trace_id: traceId,
          },
          502,
        )
      }
      if (err instanceof WizardAIError) {
        const sanitized = sanitizeError(err, c.env.ENV, 500)
        return c.json(
          { ok: false, error: { ...sanitized, code: 'ai_failed' }, trace_id: traceId },
          500,
        )
      }
      throw err
    }
  })

  // ──────────────────────────────────────────────────────────────────────────
  // S18 prereq: GET /api/sessions/:id/insights/themes?window=7d|30d
  // Reads pre-computed daily insights for the DX-INSIGHTS-02 sparkline. No AI
  // call here — only reads from `insights_daily`. Closed/archived only.
  // ──────────────────────────────────────────────────────────────────────────
  app.get('/:id/insights/themes', requireFeature('insightsAI'), async (c) => {
    const id = c.req.param('id')
    const traceId = c.get('trace_id')

    const themesLoaded = requireFound(await fetchSession(c.env.DB, id, c.get('user').sub))
    if (!themesLoaded.ok) {
      return c.json(
        { ok: false, error: { code: themesLoaded.error.code, message: themesLoaded.error.message }, trace_id: traceId },
        themesLoaded.error.status,
      )
    }
    const themesGate = requireClosedOrArchivedForInsights(themesLoaded.session)
    if (!themesGate.ok) {
      return c.json(
        { ok: false, error: { code: themesGate.error.code, message: themesGate.error.message }, trace_id: traceId },
        themesGate.error.status,
      )
    }

    const windowParam = c.req.query('window') === '7d' ? '7d' : '30d'
    const sqliteOffset = windowParam === '7d' ? '-7 days' : '-30 days'

    const { results } = await c.env.DB
      .prepare(
        `SELECT day, themes_json, confidence, n_votes
           FROM insights_daily
          WHERE session_id = ?1 AND day >= date('now', ?2)
          ORDER BY day DESC`,
      )
      .bind(id, sqliteOffset)
      .all<{ day: string; themes_json: string; confidence: number; n_votes: number }>()

    const rows = results ?? []
    if (rows.length === 0) {
      return c.json({
        ok: true,
        data: { themes: [], trend: [], window: windowParam },
        trace_id: traceId,
      })
    }

    let topThemes: unknown = []
    try {
      topThemes = JSON.parse(rows[0].themes_json)
    } catch {
      topThemes = []
    }
    const trend = rows.map((r) => ({ day: r.day, confidence: r.confidence, n_votes: r.n_votes }))

    return c.json({
      ok: true,
      data: { themes: topThemes, trend, window: windowParam },
      trace_id: traceId,
    })
  })

  parent.route('/api/sessions', app)
}

// SHA-256 hex of the grounding text — used to detect repeated refines and
// short-circuit with cached results.
async function hashGrounding(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
