/**
 * STUDIO-LIBRARY-01 (ADR-0060, S97) — persistence for the STUDIO content library.
 *
 * Thin D1 data-access layer for `studio_library_items` (migration 0066). Every
 * read/write is TENANT-SCOPED on `team_id` — a team only ever sees its own library
 * (no cross-tenant fork this sprint). The route layer owns auth + audit + HTTP; this
 * module owns SQL only, so isolation lives in one place.
 */

/** A persisted library item as stored/returned (question_json kept as parsed JSON). */
export type StudioLibraryItem = {
  id: string
  team_id: string
  created_by: string
  source: 'authored' | 'fork'
  forked_from_id: string | null
  question_json: unknown
  theme_id: string | null
  title: string
  use_count: number
  created_at: number
  updated_at: number
}

type StudioLibraryRow = Omit<StudioLibraryItem, 'question_json'> & { question_json: string }

function hydrate(row: StudioLibraryRow): StudioLibraryItem {
  let question_json: unknown = null
  try {
    question_json = JSON.parse(row.question_json)
  } catch {
    question_json = null
  }
  return { ...row, question_json }
}

export type SaveLibraryItemInput = {
  id: string
  teamId: string
  createdBy: string
  source: 'authored' | 'fork'
  forkedFromId: string | null
  questionJson: unknown
  themeId: string | null
  title: string
  now: number
}

/** Insert a new library item. Returns the hydrated row. */
export async function insertLibraryItem(
  db: D1Database,
  input: SaveLibraryItemInput,
): Promise<StudioLibraryItem> {
  await db
    .prepare(
      `INSERT INTO studio_library_items
         (id, team_id, created_by, source, forked_from_id, question_json, theme_id, title, use_count, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 0, ?9, ?10)`,
    )
    .bind(
      input.id,
      input.teamId,
      input.createdBy,
      input.source,
      input.forkedFromId,
      JSON.stringify(input.questionJson),
      input.themeId,
      input.title,
      input.now,
      input.now,
    )
    .run()

  return {
    id: input.id,
    team_id: input.teamId,
    created_by: input.createdBy,
    source: input.source,
    forked_from_id: input.forkedFromId,
    question_json: input.questionJson,
    theme_id: input.themeId,
    title: input.title,
    use_count: 0,
    created_at: input.now,
    updated_at: input.now,
  }
}

/** List a team's library items, newest-first, with limit/offset paging. */
export async function listLibraryItems(
  db: D1Database,
  teamId: string,
  limit: number,
  offset: number,
): Promise<StudioLibraryItem[]> {
  const { results } = await db
    .prepare(
      `SELECT id, team_id, created_by, source, forked_from_id, question_json, theme_id, title, use_count, created_at, updated_at
       FROM studio_library_items
       WHERE team_id = ?1
       ORDER BY created_at DESC
       LIMIT ?2 OFFSET ?3`,
    )
    .bind(teamId, limit, offset)
    .all<StudioLibraryRow>()
  return results.map(hydrate)
}

/** Fetch one item, tenant-scoped. Returns null when missing or owned by another team. */
export async function getLibraryItem(
  db: D1Database,
  id: string,
  teamId: string,
): Promise<StudioLibraryItem | null> {
  const row = await db
    .prepare(
      `SELECT id, team_id, created_by, source, forked_from_id, question_json, theme_id, title, use_count, created_at, updated_at
       FROM studio_library_items
       WHERE id = ?1 AND team_id = ?2`,
    )
    .bind(id, teamId)
    .first<StudioLibraryRow>()
  return row ? hydrate(row) : null
}

/** Increment use_count on the original item (tenant-scoped). Returns rows changed. */
export async function incrementUseCount(
  db: D1Database,
  id: string,
  teamId: string,
  now: number,
): Promise<number> {
  const res = await db
    .prepare(
      `UPDATE studio_library_items
       SET use_count = use_count + 1, updated_at = ?3
       WHERE id = ?1 AND team_id = ?2`,
    )
    .bind(id, teamId, now)
    .run()
  return res.meta.changes
}

/** Delete an item, tenant-scoped. Returns rows changed (0 ⇒ not found / cross-team). */
export async function deleteLibraryItem(
  db: D1Database,
  id: string,
  teamId: string,
): Promise<number> {
  const res = await db
    .prepare(`DELETE FROM studio_library_items WHERE id = ?1 AND team_id = ?2`)
    .bind(id, teamId)
    .run()
  return res.meta.changes
}
