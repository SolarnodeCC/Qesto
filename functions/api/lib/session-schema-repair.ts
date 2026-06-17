/**
 * Repairs legacy D1 sessions schema so townhall config can persist
 * `session_mode = 'townhall'` and read `townhall_moderation`.
 *
 * SQLite cannot widen a CHECK constraint in place; older databases may still
 * enforce session_mode IN ('reflection','fun') from patchSchemaIfNeeded.
 */

const SESSION_MODE_VALUES =
  "'reflection','fun','townhall','stage','retro','ideate','deliberate'" as const

const SESSIONS_INDEX_DDL = [
  'CREATE INDEX IF NOT EXISTS idx_sessions_owner ON sessions(owner_id)',
  'CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status)',
  'CREATE INDEX IF NOT EXISTS idx_sessions_code ON sessions(code)',
  'CREATE INDEX IF NOT EXISTS idx_sessions_owner_status ON sessions(owner_id, status, created_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_sessions_team ON sessions(team_id)',
  'CREATE INDEX IF NOT EXISTS idx_sessions_workspace ON sessions(workspace_id, workspace_seq DESC)',
  'CREATE INDEX IF NOT EXISTS idx_sessions_is_public ON sessions(is_public) WHERE is_public = 1',
] as const

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

const OPTIONAL_SESSION_COLUMNS: Array<{ name: string; defaultExpr: string }> = [
  { name: 'vote_policy', defaultExpr: "'once'" },
  { name: 'session_mode', defaultExpr: "'reflection'" },
  { name: 'team_id', defaultExpr: 'NULL' },
  { name: 'workspace_id', defaultExpr: 'NULL' },
  { name: 'workspace_seq', defaultExpr: 'NULL' },
  { name: 'ai_generated', defaultExpr: '0' },
  { name: 'ai_consent_at', defaultExpr: 'NULL' },
  { name: 'ai_grounding_hash', defaultExpr: 'NULL' },
  { name: 'ai_accepted_count', defaultExpr: '0' },
  { name: 'ai_dismissed_count', defaultExpr: '0' },
  { name: 'ai_recap_model', defaultExpr: 'NULL' },
  { name: 'ai_recap_edited_at', defaultExpr: 'NULL' },
  { name: 'townhall_moderation', defaultExpr: 'NULL' },
  { name: 'is_public', defaultExpr: '1' },
]

const COPY_COLUMNS = [
  'id',
  'owner_id',
  'code',
  'title',
  'status',
  'anonymity',
  'vote_policy',
  'session_mode',
  'created_at',
  'started_at',
  'closed_at',
  'archived_at',
  'team_id',
  'workspace_id',
  'workspace_seq',
  'ai_generated',
  'ai_consent_at',
  'ai_grounding_hash',
  'ai_accepted_count',
  'ai_dismissed_count',
  'townhall_moderation',
  'is_public',
  'ai_recap_model',
  'ai_recap_edited_at',
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

async function listSessionColumnNames(db: D1Database): Promise<Set<string>> {
  const { results } = await db.prepare(`PRAGMA table_info(sessions)`).all<{ name: string }>()
  return new Set((results ?? []).map((r) => r.name))
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

function selectExpr(column: string, present: Set<string>): string {
  if (column === 'anonymity') {
    if (!present.has('anonymity')) return "'full'"
    return `CASE anonymity WHEN 'anonymous' THEN 'full' WHEN 'identified' THEN 'none' ELSE anonymity END`
  }
  const optional = OPTIONAL_SESSION_COLUMNS.find((c) => c.name === column)
  if (optional) {
    if (present.has(column)) return `COALESCE(${column}, ${optional.defaultExpr})`
    return optional.defaultExpr
  }
  if (present.has(column)) return column
  throw new Error(`sessions rebuild missing required column: ${column}`)
}

export async function rebuildSessionsTableForTownhall(db: D1Database): Promise<void> {
  const present = await listSessionColumnNames(db)
  const insertCols = COPY_COLUMNS.join(', ')
  const selectCols = COPY_COLUMNS.map((c) => selectExpr(c, present)).join(', ')

  await db.prepare('PRAGMA foreign_keys=OFF').run()
  try {
    await db
      .prepare(
        `CREATE TABLE sessions__mode_fix (
          id TEXT PRIMARY KEY,
          owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          code TEXT NOT NULL UNIQUE,
          title TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'draft'
            CHECK (status IN ('draft','energizing','live','closed','archived')),
          anonymity TEXT NOT NULL DEFAULT 'full'
            CHECK (anonymity IN ('full','partial','none','zero_knowledge')),
          vote_policy TEXT NOT NULL DEFAULT 'once'
            CHECK (vote_policy IN ('once','multi','react')),
          session_mode TEXT NOT NULL DEFAULT 'reflection'
            CHECK (session_mode IN (${SESSION_MODE_VALUES})),
          created_at INTEGER NOT NULL,
          started_at INTEGER,
          closed_at INTEGER,
          archived_at INTEGER,
          team_id TEXT DEFAULT NULL,
          workspace_id TEXT,
          workspace_seq INTEGER,
          ai_generated INTEGER NOT NULL DEFAULT 0,
          ai_consent_at INTEGER,
          ai_grounding_hash TEXT,
          ai_accepted_count INTEGER NOT NULL DEFAULT 0,
          ai_dismissed_count INTEGER NOT NULL DEFAULT 0,
          townhall_moderation TEXT CHECK (townhall_moderation IN ('pre','post')),
          is_public INTEGER DEFAULT 1,
          ai_recap_model TEXT,
          ai_recap_edited_at INTEGER
        )`,
      )
      .run()

    await db
      .prepare(`INSERT INTO sessions__mode_fix (${insertCols}) SELECT ${selectCols} FROM sessions`)
      .run()

    await db.prepare('DROP TABLE sessions').run()
    await db.prepare('ALTER TABLE sessions__mode_fix RENAME TO sessions').run()

    for (const ddl of SESSIONS_INDEX_DDL) {
      await db.prepare(ddl).run().catch(() => {})
    }
  } finally {
    await db.prepare('PRAGMA foreign_keys=ON').run()
  }
}

/** Idempotent repair for townhall REST config/export paths and cold-start patch. */
export async function ensureTownhallSchema(db: D1Database): Promise<void> {
  if (_townhallSchemaReady) return
  await addMissingSessionColumns(db)
  if (await sessionsTableNeedsModeWiden(db)) {
    await rebuildSessionsTableForTownhall(db)
  }
  _townhallSchemaReady = true
}

/** Test-only: reset module guard between Vitest cases. */
export function __resetTownhallSchemaRepairForTests(): void {
  _townhallSchemaReady = false
}
