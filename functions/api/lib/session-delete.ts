/**
 * Hard-delete a session and all D1 rows that reference it.
 * Explicit child deletes avoid 500s when legacy DBs lack ON DELETE CASCADE on every table.
 */
export async function hardDeleteSession(
  db: D1Database,
  sessionId: string,
  ownerId: string,
): Promise<{ deleted: boolean }> {
  const statements = [
    `DELETE FROM votes WHERE session_id = ?1`,
    `DELETE FROM team_quiz_responses WHERE energizer_id IN (SELECT id FROM energizers WHERE session_id = ?1)`,
    `DELETE FROM battle_royale_rounds WHERE energizer_id IN (SELECT id FROM energizers WHERE session_id = ?1)`,
    `DELETE FROM bracket_matches WHERE energizer_id IN (SELECT id FROM energizers WHERE session_id = ?1)`,
    `DELETE FROM energizer_votes WHERE session_id = ?1`,
    `DELETE FROM energizers WHERE session_id = ?1`,
    `DELETE FROM leaderboard_entries WHERE session_id = ?1`,
    `DELETE FROM badges WHERE session_id = ?1`,
    `DELETE FROM insights_daily WHERE session_id = ?1`,
    `DELETE FROM sprint19_events WHERE session_id = ?1`,
    `DELETE FROM questions WHERE session_id = ?1`,
    `DELETE FROM sessions WHERE id = ?1 AND owner_id = ?2`,
  ]

  const batch = statements.map((sql, index) => {
    if (index === statements.length - 1) {
      return db.prepare(sql).bind(sessionId, ownerId)
    }
    return db.prepare(sql).bind(sessionId)
  })

  const results = await db.batch(batch)
  const last = results[results.length - 1]
  const changes = last?.meta?.changes ?? 0
  return { deleted: changes > 0 }
}
