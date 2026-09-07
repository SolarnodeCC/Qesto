/**
 * Hard-delete a session and all D1 rows that reference it.
 * Explicit child deletes avoid 500s when legacy DBs lack ON DELETE CASCADE on every table.
 *
 * When `vectorize` is supplied the session's decision vector is removed too.
 * DECISIONS_VECTORIZE is keyed by session id and its metadata carries the
 * session title, so without this a deleted session leaves a permanently
 * retrievable record of itself in a cross-tenant index (audit #12). Only the
 * GDPR user-erasure path did this before; the ordinary
 * `DELETE /api/sessions/:id` did not.
 *
 * The vector delete runs first, while the id is still known, and is
 * best-effort: losing it must not block the D1 deletion, which is the
 * durable-record removal that actually matters legally.
 */
export async function hardDeleteSession(
  db: D1Database,
  sessionId: string,
  ownerId: string,
  vectorize?: VectorizeIndex,
): Promise<{ deleted: boolean }> {
  if (vectorize) {
    try {
      await vectorize.deleteByIds([sessionId])
    } catch {
      /* best-effort — the D1 delete below is the legal floor */
    }
  }

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
