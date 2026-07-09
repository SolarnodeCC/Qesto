/**
 * REPO-LAYER-01 — D1 session accessors (ADR-0026).
 * Routes should import from here instead of inline prepare().
 */

export type SessionRow = {
  id: string
  title: string
  status: string
  code: string | null
  team_id: string | null
  owner_id: string
  created_at: number
  closed_at: number | null
}

export async function fetchSessionTitleForOwner(
  db: D1Database,
  sessionId: string,
  ownerId: string,
): Promise<{ id: string; title: string } | null> {
  const row = await db
    .prepare(`SELECT id, title FROM sessions WHERE id = ?1 AND owner_id = ?2`)
    .bind(sessionId, ownerId)
    .first<{ id: string; title: string }>()
  return row ?? null
}

export type SessionAIGovernanceRow = {
  id: string
  title: string
  team_id: string | null
  anonymity: string
  ai_generated: number | null
  ai_consent_at: number | null
  status: string
  closed_at: number | null
}

/**
 * Session fields needed for AI governance checks at insight-generation time:
 * anonymity (ZK block + PII scrub), ai_generated/ai_consent_at (consent
 * re-check), team_id (tenant-scoped similarity surfacing).
 */
export async function fetchSessionAIGovernanceForOwner(
  db: D1Database,
  sessionId: string,
  ownerId: string,
): Promise<SessionAIGovernanceRow | null> {
  const row = await db
    .prepare(
      `SELECT id, title, team_id, anonymity, ai_generated, ai_consent_at, status, closed_at
         FROM sessions WHERE id = ?1 AND owner_id = ?2`,
    )
    .bind(sessionId, ownerId)
    .first<SessionAIGovernanceRow>()
  return row ?? null
}

export async function sessionOwnedBy(db: D1Database, sessionId: string, ownerId: string): Promise<boolean> {
  const row = await db
    .prepare(`SELECT id FROM sessions WHERE id = ?1 AND owner_id = ?2`)
    .bind(sessionId, ownerId)
    .first<{ id: string }>()
  return !!row
}

export async function fetchSessionForTeam(
  db: D1Database,
  sessionId: string,
  teamId: string,
): Promise<SessionRow | null> {
  const row = await db
    .prepare(
      `SELECT id, title, status, code, team_id, owner_id, created_at, closed_at
         FROM sessions WHERE id = ?1 AND team_id = ?2`,
    )
    .bind(sessionId, teamId)
    .first<SessionRow>()
  return row ?? null
}

export async function listSessionsForTeam(db: D1Database, teamId: string, limit = 100): Promise<SessionRow[]> {
  const { results } = await db
    .prepare(
      `SELECT id, title, status, code, team_id, owner_id, created_at, closed_at
         FROM sessions WHERE team_id = ?1 ORDER BY created_at DESC LIMIT ?2`,
    )
    .bind(teamId, limit)
    .all<SessionRow>()
  return results ?? []
}

export async function createDraftSessionForTeam(
  db: D1Database,
  params: { id: string; teamId: string; ownerId: string; title: string; code: string },
): Promise<void> {
  const now = Date.now()
  await db
    .prepare(
      `INSERT INTO sessions (id, title, status, code, team_id, owner_id, created_at, anonymity, vote_policy, session_mode)
       VALUES (?1, ?2, 'draft', ?3, ?4, ?5, ?6, 'full', 'once', 'reflection')`,
    )
    .bind(params.id, params.title, params.code, params.teamId, params.ownerId, now)
    .run()
}

/** Batch-append questions to a session starting at `startPosition` (one D1 batch). */
export async function insertQuestionsBatch(
  db: D1Database,
  sessionId: string,
  startPosition: number,
  questions: Array<{ id: string; kind: string; prompt: string; optionsJson: string }>,
): Promise<void> {
  const now = Date.now()
  await db.batch(
    questions.map((q, idx) =>
      db
        .prepare(
          `INSERT INTO questions (id, session_id, position, kind, prompt, options_json, created_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
        )
        .bind(q.id, sessionId, startPosition + idx, q.kind, q.prompt, q.optionsJson, now),
    ),
  )
}
