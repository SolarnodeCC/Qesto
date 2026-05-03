/** Thin D1 accessors shared by routes that scope sessions by owner_id. */

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

export async function sessionOwnedBy(db: D1Database, sessionId: string, ownerId: string): Promise<boolean> {
  const row = await db
    .prepare(`SELECT id FROM sessions WHERE id = ?1 AND owner_id = ?2`)
    .bind(sessionId, ownerId)
    .first<{ id: string }>()
  return !!row
}
