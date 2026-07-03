// CODE-SPLIT-01 — shared session route helpers.
import { ulid } from '../../lib/ulid'
import { writeEvent } from '../../lib/observability'
import { readKvText, writeKvJson } from '../../lib/kv'
import type { AuthVariables } from '../../middleware/auth'
import type { PlanVariables } from '../../middleware/plan'
import { denyFeature, featureAllowed, questionKindFeature } from '../../lib/entitlements'
import { validateKvJson, PollOptionArraySchema } from '../../lib/protocol-schemas'
import type { PollQuestionInput } from '../../lib/domain-schemas'
import { extractThemes, INSIGHTS_MODEL, type InsightTheme } from '../../lib/ai-insights'
import { upsertInsightsSessionVector } from '../../lib/insights-vectorize'
import { upsertInsightsDaily } from '../../lib/team-insights'
import {
  toInsightsInput,
  type SessionBundle,
  type QuestionBreakdown,
} from '../../lib/session-bundle'
import type { LiveQuestion } from '../../realtime'
import type { Env, PlanQuotas, PlanTier, Question, Session } from '../../types'
import type { Team } from '../teams'
import { effectiveTeamPermissionsForUser, type Permission } from '../../lib/authz'
import { readKvJson } from '../../lib/kv'
import { teamDocumentKey } from '../../lib/kv-keys'
import { INSIGHTS_SHARED_CACHE_TTL_SECONDS } from '../../lib/constants'
import { CachedThemeLabelsSchema, decodeKvJson } from '../../lib/boundary-decode'
import { logEvent } from '../../lib/log'
import { ensureTownhallSchema } from '../../lib/session-schema-repair'

export type SessionVars = AuthVariables & PlanVariables
export type SessionRow = Session & { team_id: string | null }

export type Sprint19JourneyEvent =
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
export async function patchSchemaIfNeeded(db: D1Database): Promise<void> {
  if (_schemaPatchDone) return
  _schemaPatchDone = true
  await db.prepare(`ALTER TABLE sessions ADD COLUMN vote_policy TEXT NOT NULL DEFAULT 'once' CHECK (vote_policy IN ('once','multi','react'))`).run().catch(() => {})
  // Avoid adding a narrow session_mode CHECK — legacy patch left prod unable to set 'townhall'.
  await db.prepare(`ALTER TABLE sessions ADD COLUMN session_mode TEXT NOT NULL DEFAULT 'reflection'`).run().catch(() => {})
  // OBS-001: analytics segmentation column. Nullable — individual (no-team) sessions remain valid.
  await db.prepare(`ALTER TABLE sessions ADD COLUMN team_id TEXT DEFAULT NULL`).run().catch(() => {})
  // Sprint 18 prereq: AI provenance + GDPR consent audit trail for wizard generation.
  await db.prepare(`ALTER TABLE sessions ADD COLUMN ai_generated INTEGER NOT NULL DEFAULT 0`).run().catch(() => {})
  await db.prepare(`ALTER TABLE sessions ADD COLUMN ai_consent_at INTEGER`).run().catch(() => {})
  await db.prepare(`ALTER TABLE sessions ADD COLUMN ai_grounding_hash TEXT`).run().catch(() => {})
  await db.prepare(`ALTER TABLE sessions ADD COLUMN ai_accepted_count INTEGER NOT NULL DEFAULT 0`).run().catch(() => {})
  await db.prepare(`ALTER TABLE sessions ADD COLUMN ai_dismissed_count INTEGER NOT NULL DEFAULT 0`).run().catch(() => {})
  await db.prepare(`ALTER TABLE sessions ADD COLUMN ai_recap_model TEXT`).run().catch(() => {})
  await db.prepare(`ALTER TABLE sessions ADD COLUMN ai_recap_edited_at INTEGER`).run().catch(() => {})
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
  await ensureTownhallSchema(db).catch((err) => {
    logEvent({
      event: 'patchSchemaIfNeeded.ensureTownhallSchema_failed',
      errorClass: err instanceof Error ? err.name : 'UnknownError',
      message: err instanceof Error ? err.message : String(err),
    })
  })
}

export async function presenterPermissionsForSession(
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

export function rowToQuestion(row: QuestionRow): Question {
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

export function deniedQuestionFeature(plan: PlanTier, quotas: PlanQuotas, kind: Question['kind']) {
  const feature = questionKindFeature(kind)
  if (!feature || featureAllowed(quotas, feature)) return null
  return denyFeature(plan, feature)
}

export async function recordSprint19JourneyEvent(
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

export async function fetchSession(db: D1Database, id: string, ownerId: string): Promise<Session | null> {
  const row = await db
    .prepare(
      `SELECT id, owner_id, code, title, status, anonymity, vote_policy, session_mode,
              townhall_moderation,
              created_at, started_at, closed_at, archived_at, team_id,
              workspace_id, workspace_seq,
              ai_generated, ai_consent_at, ai_grounding_hash,
              ai_accepted_count, ai_dismissed_count,
              ai_recap_model, ai_recap_edited_at
         FROM sessions
        WHERE id = ?1 AND owner_id = ?2`,
    )
    .bind(id, ownerId)
    .first<SessionRow>()
  return row ?? null
}

/**
 * Load session and verify caller has required access level.
 * Checks both owner_id (exclusive owner) and team membership (co-access).
 *
 * @param db Database connection
 * @param sessionId Session ID to load
 * @param userId Caller's user ID
 * @param options.requireOwner If true, only owner can access. If false, team members with appropriate permission can access.
 * @returns Session if authorized, null if not found or unauthorized
 */
export async function requireSessionAccess(
  db: D1Database,
  sessionId: string,
  userId: string,
  options: { requireOwner?: boolean } = {},
): Promise<SessionRow | null> {
  const session = await db
    .prepare(
      `SELECT id, owner_id, code, title, status, anonymity, vote_policy, session_mode,
              townhall_moderation,
              created_at, started_at, closed_at, archived_at, team_id,
              workspace_id, workspace_seq,
              ai_generated, ai_consent_at, ai_grounding_hash,
              ai_accepted_count, ai_dismissed_count,
              ai_recap_model, ai_recap_edited_at
         FROM sessions
        WHERE id = ?1`,
    )
    .bind(sessionId)
    .first<SessionRow>()

  if (!session) return null

  // Owner always has access
  if (session.owner_id === userId) return session

  // If owner-only access required, reject non-owners
  if (options.requireOwner) return null

  // Team co-access not yet implemented (future: check team membership)
  // For now, non-owners without team implementation are denied
  return null
}

export async function fetchOwnerSessionTitles(db: D1Database, ownerId: string): Promise<string[]> {
  const { results } = await db
    .prepare(`SELECT title FROM sessions WHERE owner_id = ?1`)
    .bind(ownerId)
    .all<{ title: string }>()
  return (results ?? []).map((r) => r.title)
}

export async function fetchQuestions(db: D1Database, sessionId: string): Promise<Question[]> {
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

export async function upsertPollQuestion(
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

export async function fetchSessionByCode(db: D1Database, code: string): Promise<Session | null> {
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

export function questionToLive(q: Question): LiveQuestion {
  return { id: q.id, kind: q.kind, prompt: q.prompt, options: q.options }
}

// Thrown when the SESSION_ROOM Durable Object binding is absent from the
// runtime (e.g. the Pages project is missing the DO binding, or the DO-hosting
// Worker failed to deploy). This is a *deterministic* infrastructure failure —
// every session/mode fails identically and no retry can help — so it must be
// surfaced distinctly instead of masquerading as a transient `TypeError`.
export class DOBindingUnavailableError extends Error {
  readonly binding = 'SESSION_ROOM'
  constructor() {
    super('SESSION_ROOM Durable Object binding is not available in this runtime')
    this.name = 'DOBindingUnavailableError'
  }
}

// True for failures that will recur identically on every attempt — retrying is
// pointless and only prolongs the outage for the user. A missing binding is the
// canonical case; classifying it here keeps the retry/response logic in one place.
export function isDeterministicDOFailure(err: unknown): boolean {
  return err instanceof DOBindingUnavailableError
}

export async function getSessionRoomStub(env: Env, sessionId: string): Promise<DurableObjectStub> {
  // Guard the binding before touching it: if SESSION_ROOM is unwired,
  // `env.SESSION_ROOM.idFromName` is a bare `TypeError` buried inside
  // `do.stub_fetch_rejected`. Detecting it here yields an actionable,
  // greppable signal (`do.binding_unavailable`) and a typed, non-retryable error.
  if (typeof env.SESSION_ROOM?.idFromName !== 'function') {
    throw new DOBindingUnavailableError()
  }
  const id = env.SESSION_ROOM.idFromName(sessionId)
  return env.SESSION_ROOM.get(id)
}

// Classifies a stub.fetch rejection for structured logging. Cloudflare DO
// exceptions carry `retryable` (request confirmed NOT delivered — safe to
// retry regardless of idempotency) and `overloaded` flags.
export function describeDOError(err: unknown): {
  errorClass: string
  errorMessage: string
  retryable: boolean
  overloaded: boolean
  stack?: string
} {
  return {
    errorClass: err instanceof Error ? err.name : 'UnknownError',
    errorMessage: err instanceof Error ? err.message : String(err),
    retryable: (err as { retryable?: boolean })?.retryable === true,
    overloaded: (err as { overloaded?: boolean })?.overloaded === true,
    ...(err instanceof Error && err.stack ? { stack: err.stack } : {}),
  }
}

// Single choke point for SessionRoom DO fetches. A rejection here used to
// surface to the caller as an opaque "Session room unavailable" with no
// diagnostics; now every rejection is logged with class/message/retryable,
// and rejections Cloudflare marks `retryable` (guaranteed undelivered) get
// exactly one retry on a fresh stub, per CF guidance.
export async function fetchDO(env: Env, sessionId: string, path: string, init: RequestInit): Promise<Response> {
  const url = `https://do.internal${path}`
  try {
    const room = await getSessionRoomStub(env, sessionId)
    return await room.fetch(url, init)
  } catch (err) {
    // A missing DO binding is deterministic and infrastructural — log it under a
    // distinct, greppable event so it is not lost among transient stub blips, and
    // never retry (a fresh stub cannot conjure a binding that isn't wired up).
    if (isDeterministicDOFailure(err)) {
      logEvent({ event: 'do.binding_unavailable', session_id: sessionId, path, ...describeDOError(err) })
      throw err
    }
    const info = describeDOError(err)
    logEvent({ event: 'do.stub_fetch_rejected', session_id: sessionId, path, attempt: 1, ...info })
    if (!info.retryable) throw err
    try {
      const room = await getSessionRoomStub(env, sessionId)
      const res = await room.fetch(url, init)
      logEvent({ event: 'do.stub_fetch_retry_success', session_id: sessionId, path })
      return res
    } catch (err2) {
      logEvent({ event: 'do.stub_fetch_rejected', session_id: sessionId, path, attempt: 2, ...describeDOError(err2) })
      throw err2
    }
  }
}

export async function postDO(env: Env, sessionId: string, path: string, body?: unknown): Promise<Response> {
  // Stringify before any fetch so a serialisation throw happens once, up
  // front, and is classed by the caller's catch instead of aborting a retry.
  const init: RequestInit = {
    method: 'POST',
    ...(body !== undefined
      ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
      : {}),
  }
  return fetchDO(env, sessionId, path, init)
}

// Best-effort background insight generation triggered on session close.
// Runs via waitUntil so it never delays the close response.
// Only fires for team-plan users (cross-session intelligence is Team-tier, ADR-0045).
//
// INSIGHTS-02 (ADR-0045 Tier-1):
//   - ZK guard: zero-knowledge sessions never contribute to any cross-session store.
//   - Writes the per-session aggregate to `insights_daily` (team_id + embedding_ref),
//     idempotently (UNIQUE(session_id, day)).
//   - Upserts the session embedding with `team_id` metadata for later clustering.
//   - Emits `insight.aggregated` so the rollup cron / KPIs can observe coverage.
export async function precomputeInsights(
  env: Env,
  sessionId: string,
  sessionTitle: string,
  ownerId: string,
  opts: {
    anonymity?: string | null
    teamId?: string | null
    plan?: PlanTier | undefined
    traceId?: string | undefined
  } = {},
): Promise<void> {
  const MODEL = INSIGHTS_MODEL
  const cacheKey = `insights:${sessionId}`

  // ZK exclusion at the write boundary (ADR-0045 §4) — defence in depth, not a
  // query-time filter that can be forgotten. ZK sessions are structurally absent
  // from insights_daily, the vector metadata, and therefore every rollup.
  if (opts.anonymity === 'zero_knowledge') {
    logEvent({ event: 'insights.precompute.zk_skip', sessionId })
    return
  }

  const userRow = await env.DB.prepare(`SELECT plan FROM users WHERE id = ?1`)
    .bind(ownerId)
    .first<{ plan: string }>()
  if (userRow?.plan !== 'team') return

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

  // Reuse a previously-cached analysis (e.g. the host ran analyze before close) to
  // avoid a duplicate AI call; otherwise distil themes now and cache them.
  let themes: InsightTheme[]
  const cached = await readKvText(env.DECISIONS_KV, cacheKey)
  const cachedLabels = cached ? parseCachedThemeLabels(cached) : null
  if (cachedLabels && cachedLabels.length > 0) {
    themes = cachedLabels.map((theme) => ({ theme, count: 0, examples: [] }))
  } else {
    const result = await extractThemes(env.AI, input, MODEL)
    themes = result.themes
    const payload = {
      session_id: sessionId,
      generated_at: Date.now(),
      model: MODEL,
      themes: themes.map((t) => t.theme),
      follow_ups: [] as string[],
    }
    await writeKvJson(env.DECISIONS_KV, cacheKey, payload, { expirationTtl: INSIGHTS_SHARED_CACHE_TTL_SECONDS })
  }

  const nVotes =
    openResponses.length +
    pollBreakdown.reduce((sum, q) => sum + q.options.reduce((s, o) => s + o.votes, 0), 0)
  // Cheap, monotonic confidence proxy: more contributing responses → higher
  // confidence, clamped to [0, 1]. Zero when nothing distilled.
  const confidence = themes.length > 0 ? Math.min(1, Math.round((nVotes / 25) * 100) / 100) : 0

  // Upsert the session embedding tagged with team metadata (ADR-0045 §2) so the
  // Tier-2 cron can cluster recurring topics. Best-effort: a Vectorize failure
  // must not drop the insights_daily write.
  let embeddingRef = false
  try {
    embeddingRef = await upsertInsightsSessionVector(
      { AI: env.AI, DECISIONS_VECTORIZE: env.DECISIONS_VECTORIZE },
      {
        sessionId,
        sessionTitle,
        themeCount: themes.length,
        teamId: opts.teamId ?? null,
        closedAt: bundle.closedAt,
      },
    )
  } catch (vecErr) {
    logEvent({ event: 'insights.precompute.vectorize_skip', sessionId, error: String(vecErr) })
  }

  // Persist the per-session aggregate. Idempotent on (session_id, day).
  await upsertInsightsDaily(env.DB, {
    id: ulid(),
    session_id: sessionId,
    team_id: opts.teamId ?? null,
    day: new Date(bundle.closedAt).toISOString().slice(0, 10),
    themes_json: JSON.stringify(themes),
    confidence,
    n_votes: nVotes,
    embedding_ref: embeddingRef,
    computed_at: Date.now(),
  })

  writeEvent(env.METRICS_AE, {
    name: 'insight.aggregated',
    sessionId,
    teamId: opts.teamId ?? undefined,
    plan: opts.plan,
    count: themes.length,
    value: confidence,
    traceId: opts.traceId,
  })

  logEvent({ event: 'insights.precompute.ok', sessionId, theme_count: themes.length, embedding_ref: embeddingRef })
}

/** Extract theme labels from a cached precompute/analyze payload (`{ themes: string[] }`). */
function parseCachedThemeLabels(raw: string): string[] | null {
  const parsed = decodeKvJson(raw, CachedThemeLabelsSchema)
  return parsed?.themes ?? null
}

// SHA-256 hex of the grounding text — used to detect repeated refines and
// short-circuit with cached results.
export async function hashGrounding(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

