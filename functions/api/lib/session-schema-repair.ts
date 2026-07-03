/**
 * Ensures newer nullable `sessions` columns exist on older D1 databases so
 * townhall (and the other v2 modes) can persist their config.
 *
 * NOTE: the `session_mode` CHECK-constraint widen that this module used to run
 * live on the request path — a full `DROP TABLE sessions` + rebuild via
 * `rebuildSessionsTableForTownhall()` — was removed after it was implicated as
 * a D1 storage-reset landmine during the 2026-07-03 incident. Widening the
 * CHECK is now migration `0078_widen_session_mode.sql`, applied out of band.
 * This module only adds missing additive columns and WARNS if the CHECK still
 * needs widening.
 */

import { logEvent } from './log'

const SESSION_COLUMN_ALTERS = [
  `ALTER TABLE sessions ADD COLUMN vote_policy TEXT NOT NULL DEFAULT 'once'`,
  `ALTER TABLE sessions ADD COLUMN session_mode TEXT NOT NULL DEFAULT 'reflection'`,
  `ALTER TABLE sessions ADD COLUMN team_id TEXT DEFAULT NULL`,
  `ALTER TABLE sessions ADD COLUMN workspace_id TEXT`,
  `ALTER TABLE sessions ADD COLUMN workspace_seq INTEGER`,
  `ALTER TABLE sessions ADD COLUMN ai_generated INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE sessions ADD COLUMN ai_consent_at INTEGER`,
  `ALTER TABLE sessions ADD COLUMN ai_grounding_hash TEXT`,
  `ALTER TABLE sessions ADD COLUMN ai_accepted_count INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE sessions ADD COLUMN ai_dismissed_count INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE sessions ADD COLUMN ai_recap_model TEXT`,
  `ALTER TABLE sessions ADD COLUMN ai_recap_edited_at INTEGER`,
  `ALTER TABLE sessions ADD COLUMN townhall_moderation TEXT`,
  `ALTER TABLE sessions ADD COLUMN is_public INTEGER DEFAULT 1`,
] as const

let _townhallSchemaReady = false

export async function sessionsTableNeedsModeWiden(db: D1Database): Promise<boolean> {
  try {
    const row = await db
      .prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'sessions'`)
      .first<{ sql: string | null }>()
    if (!row?.sql) return false
    // sqlite_master DDL is the only reliable signal — SQLite cannot ALTER CHECK in place.
    return !row.sql.includes("'townhall'")
  } catch {
    return false
  }
}

async function addMissingSessionColumns(db: D1Database): Promise<void> {
  for (const ddl of SESSION_COLUMN_ALTERS) {
    await db.prepare(ddl).run().catch(() => {})
  }
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS townhall_questions (
        id            TEXT PRIMARY KEY,
        session_id    TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        body          TEXT NOT NULL,
        display_name  TEXT,
        author_hash   TEXT NOT NULL,
        status        TEXT NOT NULL
                        CHECK (status IN ('pending','approved','dismissed','answered','grouped')),
        upvotes       INTEGER NOT NULL DEFAULT 0,
        group_parent  TEXT,
        was_spotlit   INTEGER NOT NULL DEFAULT 0,
        created_at    INTEGER NOT NULL,
        resolved_at   INTEGER,
        FOREIGN KEY (group_parent) REFERENCES townhall_questions(id) ON DELETE SET NULL
      )`,
    )
    .run()
    .catch(() => {})
  await db
    .prepare(`CREATE INDEX IF NOT EXISTS idx_townhall_q_session ON townhall_questions(session_id, status)`)
    .run()
    .catch(() => {})
}

/** Idempotent additive repair for townhall REST config/export paths and cold-start patch. */
export async function ensureTownhallSchema(db: D1Database): Promise<void> {
  if (_townhallSchemaReady) return
  await addMissingSessionColumns(db)
  if (await sessionsTableNeedsModeWiden(db)) {
    // The live `DROP TABLE sessions` rebuild that used to run here was removed
    // (2026-07-03 D1 incident): a table rebuild on the request path could reset
    // D1 storage. Widening the CHECK is now migration 0078, applied out of band.
    // Surface the pending widen so an operator can apply it; do NOT rebuild live.
    logEvent({
      event: 'sessions.mode_widen_pending',
      message:
        'sessions.session_mode CHECK lacks newer modes; apply migration 0078_widen_session_mode',
    })
  }
  _townhallSchemaReady = true
}

/** Test-only: reset module guard between Vitest cases. */
export function __resetTownhallSchemaRepairForTests(): void {
  _townhallSchemaReady = false
}
