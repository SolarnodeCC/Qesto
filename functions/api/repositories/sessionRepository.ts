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
): Promise<{ createdAt: number }> {
  const now = Date.now()
  await db
    .prepare(
      `INSERT INTO sessions (id, title, status, code, team_id, owner_id, created_at, anonymity, vote_policy, session_mode)
       VALUES (?1, ?2, 'draft', ?3, ?4, ?5, ?6, 'full', 'once', 'reflection')`,
    )
    .bind(params.id, params.title, params.code, params.teamId, params.ownerId, now)
    .run()
  return { createdAt: now }
}

export type QuestionSummaryRow = { id: string; kind: string; prompt: string }
export type VoteCountRow = { question_id: string; option_id: string; count: number }

/**
 * Questions + aggregated vote counts for the public `GET /sessions/:id/results`
 * endpoints. Single implementation behind the v1/v2/v3 wrappers — response
 * field names differ per version (v2 says `votes`, v1/v3 say `vote_counts`)
 * but the data is identical.
 */
export async function fetchSessionResultsData(
  db: D1Database,
  sessionId: string,
): Promise<{ questions: QuestionSummaryRow[]; voteCounts: VoteCountRow[] }> {
  const questions = await db
    .prepare(`SELECT id, kind, prompt FROM questions WHERE session_id = ?1 ORDER BY position`)
    .bind(sessionId)
    .all<QuestionSummaryRow>()
  const votes = await db
    .prepare(
      `SELECT question_id, option_id, COUNT(*) as count FROM votes WHERE session_id = ?1 GROUP BY question_id, option_id`,
    )
    .bind(sessionId)
    .all<VoteCountRow>()
  return { questions: questions.results ?? [], voteCounts: votes.results ?? [] }
}

/** Persist the wizard-refine grounding hash for cache replays (WIZ-AI). */
export async function updateSessionGroundingHash(db: D1Database, sessionId: string, hash: string): Promise<void> {
  await db.prepare(`UPDATE sessions SET ai_grounding_hash = ?1 WHERE id = ?2`).bind(hash, sessionId).run()
}

export type SessionRowBasic = { id: string; team_id: string | null; title: string; status: string }

/**
 * Minimal un-scoped session row. Exists for the public v2 results contract,
 * which exposes exactly these four fields (snake_case) and does its own
 * team check; prefer {@link fetchSessionForTeam} elsewhere.
 */
export async function fetchSessionRowBasic(db: D1Database, sessionId: string): Promise<SessionRowBasic | null> {
  const row = await db
    .prepare(`SELECT id, team_id, title, status FROM sessions WHERE id = ?1`)
    .bind(sessionId)
    .first<SessionRowBasic>()
  return row ?? null
}
