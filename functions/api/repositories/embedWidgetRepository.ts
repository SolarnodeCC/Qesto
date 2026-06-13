/**
 * EMBED-WIDGET-API-01 (ADR-0050) — D1 accessors for the embeddable widget.
 *
 * This repository is the SINGLE source of D1 access for the embed surface. The
 * public read plane (`routes/embed-widget-v1.ts`) calls ONLY the aggregate
 * accessors below — `widgetStateAggregate` / `widgetResultsAggregate` select
 * `COUNT(*)`/`GROUP BY` exclusively and have no column that could emit a
 * per-participant identifier (no voter_id, no IP, no fingerprint). That makes
 * the de-anonymization guarantee (Pentest #5) STRUCTURAL: there is no query
 * shape on the read path capable of returning identity.
 */
import type { EmbedWidget } from '../types'

type EmbedWidgetRow = {
  id: string
  team_id: string
  session_id: string
  session_code: string
  allowed_origins: string // JSON TEXT
  scope: string
  created_by: string
  created_at: number
  revoked_at: number | null
}

function hydrate(row: EmbedWidgetRow): EmbedWidget {
  let origins: string[] = []
  try {
    const parsed = JSON.parse(row.allowed_origins)
    if (Array.isArray(parsed)) origins = parsed.filter((o): o is string => typeof o === 'string')
  } catch {
    origins = []
  }
  return {
    id: row.id,
    team_id: row.team_id,
    session_id: row.session_id,
    session_code: row.session_code,
    allowed_origins: origins,
    scope: 'read',
    created_by: row.created_by,
    created_at: row.created_at,
    revoked_at: row.revoked_at,
  }
}

export async function insertEmbedWidget(
  db: D1Database,
  w: EmbedWidget,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO embed_widgets
         (id, team_id, session_id, session_code, allowed_origins, scope, created_by, created_at, revoked_at)
       VALUES (?1, ?2, ?3, ?4, ?5, 'read', ?6, ?7, NULL)`,
    )
    .bind(
      w.id,
      w.team_id,
      w.session_id,
      w.session_code,
      JSON.stringify(w.allowed_origins),
      w.created_by,
      w.created_at,
    )
    .run()
}

export async function listEmbedWidgetsForTeam(db: D1Database, teamId: string): Promise<EmbedWidget[]> {
  const { results } = await db
    .prepare(
      `SELECT id, team_id, session_id, session_code, allowed_origins, scope, created_by, created_at, revoked_at
         FROM embed_widgets WHERE team_id = ?1 ORDER BY created_at DESC`,
    )
    .bind(teamId)
    .all<EmbedWidgetRow>()
  return (results ?? []).map(hydrate)
}

/** Fetch one widget config scoped to its owning team (tenant isolation). */
export async function fetchEmbedWidgetForTeam(
  db: D1Database,
  widgetId: string,
  teamId: string,
): Promise<EmbedWidget | null> {
  const row = await db
    .prepare(
      `SELECT id, team_id, session_id, session_code, allowed_origins, scope, created_by, created_at, revoked_at
         FROM embed_widgets WHERE id = ?1 AND team_id = ?2`,
    )
    .bind(widgetId, teamId)
    .first<EmbedWidgetRow>()
  return row ? hydrate(row) : null
}

/** Fetch one widget config by id only — used by the public read plane to check revocation. */
export async function fetchEmbedWidgetById(db: D1Database, widgetId: string): Promise<EmbedWidget | null> {
  const row = await db
    .prepare(
      `SELECT id, team_id, session_id, session_code, allowed_origins, scope, created_by, created_at, revoked_at
         FROM embed_widgets WHERE id = ?1`,
    )
    .bind(widgetId)
    .first<EmbedWidgetRow>()
  return row ? hydrate(row) : null
}

/** Set revoked_at if not already revoked. Returns true if a row was revoked. */
export async function revokeEmbedWidget(
  db: D1Database,
  widgetId: string,
  teamId: string,
  now: number,
): Promise<boolean> {
  const res = await db
    .prepare(`UPDATE embed_widgets SET revoked_at = ?3 WHERE id = ?1 AND team_id = ?2 AND revoked_at IS NULL`)
    .bind(widgetId, teamId, now)
    .run()
  return (res.meta?.changes ?? 0) > 0
}

// ── Public-read aggregate accessors (NO per-participant column, by construction) ──

/** Public, immutable session fields safe to surface to a third-party embed. */
export type EmbedSessionView = {
  id: string
  code: string
  title: string
  status: string
  anonymity: string
}

/** Resolve a session by canonical id OR join code — both, so a token's sid/code pins it. */
export async function fetchEmbedSession(
  db: D1Database,
  idOrCode: string,
): Promise<EmbedSessionView | null> {
  const row = await db
    .prepare(
      `SELECT id, code, title, status, anonymity FROM sessions WHERE id = ?1 OR code = ?1`,
    )
    .bind(idOrCode)
    .first<EmbedSessionView>()
  return row ?? null
}

/**
 * Resolve a session by its CANONICAL id only (PEN5-E3). Used wherever the caller
 * already holds the trusted `claims.sid` (e.g. /handshake), so a join code that
 * happens to collide with another session's id can never resolve the wrong row
 * via the `id OR code` footgun. There is exactly one row per id (primary key).
 */
export async function fetchEmbedSessionById(
  db: D1Database,
  id: string,
): Promise<EmbedSessionView | null> {
  const row = await db
    .prepare(`SELECT id, code, title, status, anonymity FROM sessions WHERE id = ?1`)
    .bind(id)
    .first<EmbedSessionView>()
  return row ?? null
}

export type ActiveQuestionView = {
  id: string
  kind: string
  prompt: string
  options_json: string
}

/**
 * The first question for a session, used as the render target. NOTE: LIVE
 * "active question" authority lives in the SessionRoom DO; the embed polls the
 * persisted/configured question set (aggregate render target), per ADR-0050's
 * debounced-pull posture — it never connects to the DO.
 */
export async function fetchEmbedActiveQuestion(
  db: D1Database,
  sessionId: string,
): Promise<ActiveQuestionView | null> {
  const row = await db
    .prepare(
      `SELECT id, kind, prompt, options_json FROM questions WHERE session_id = ?1 ORDER BY position ASC LIMIT 1`,
    )
    .bind(sessionId)
    .first<ActiveQuestionView>()
  return row ?? null
}

/** Aggregate response count for a session — COUNT only, no per-voter shape. */
export async function widgetResponseCount(db: D1Database, sessionId: string): Promise<number> {
  const row = await db
    .prepare(`SELECT COUNT(*) AS n FROM votes WHERE session_id = ?1`)
    .bind(sessionId)
    .first<{ n: number }>()
  return row?.n ?? 0
}

export type OptionTally = { option_id: string; count: number }

/**
 * Aggregate tallies for one question — `GROUP BY option_id`, counts only.
 * This is the headline anonymity guarantee: the SELECT list is `option_id,
 * COUNT(*)` and nothing else; there is no voter_id, hash, IP, or name in the
 * projection, so the result is incapable of emitting identity.
 */
export async function widgetResultsAggregate(
  db: D1Database,
  sessionId: string,
  questionId: string,
): Promise<OptionTally[]> {
  const { results } = await db
    .prepare(
      `SELECT option_id, COUNT(*) AS count
         FROM votes WHERE session_id = ?1 AND question_id = ?2
        GROUP BY option_id`,
    )
    .bind(sessionId, questionId)
    .all<OptionTally>()
  return results ?? []
}
