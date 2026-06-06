// CODE-SPLIT-01 — shared session route helpers.
import { readKvJson } from '../../lib/kv'
import { teamDocumentKey } from '../../lib/kv-keys'
import type { AuthVariables } from '../../middleware/auth'
import type { PlanVariables } from '../../middleware/plan'
import { denyFeature, featureAllowed, questionKindFeature } from '../../lib/entitlements'
import { validateKvJson, PollOptionArraySchema } from '../../lib/protocol-schemas'
import type { PollQuestionInput } from '../../lib/domain-schemas'
import type { LiveQuestion } from '../../realtime'
import type { Env, PlanQuotas, PlanTier, Question, Session } from '../../types'
import type { Team } from '../teams'
import { effectiveTeamPermissionsForUser, type Permission } from '../../lib/authz'
import { absent } from '../../lib/absent'
import { ulid } from '../../lib/ulid'
import { patchSessionSchemaIfNeeded } from '../../lib/session-schema-patch'

export type SessionVars = AuthVariables & PlanVariables
export type SessionRow = Session & { team_id: string | null }

export { patchSessionSchemaIfNeeded as patchSchemaIfNeeded }
export { recordSprint19JourneyEvent, type Sprint19JourneyEvent } from '../../lib/session-journey-events'
export { precomputeInsights } from '../../lib/session-insights-precompute'

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
  if (!feature || featureAllowed(quotas, feature)) return absent()
  return denyFeature(plan, feature)
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

export async function getSessionRoomStub(env: Env, sessionId: string): Promise<DurableObjectStub> {
  const id = env.SESSION_ROOM.idFromName(sessionId)
  return env.SESSION_ROOM.get(id)
}

export async function postDO(env: Env, sessionId: string, path: string, body: unknown): Promise<Response> {
  const room = await getSessionRoomStub(env, sessionId)
  return room.fetch(`https://do.internal${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export async function hashGrounding(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
