// Apply schema columns that may be missing on older D1 databases (pre-migration 0008).
// Runs once per worker cold-start; subsequent calls are no-ops after the columns exist.
let _schemaPatchDone = false

export async function patchSessionSchemaIfNeeded(db: D1Database): Promise<void> {
  if (_schemaPatchDone) return
  _schemaPatchDone = true
  await db.prepare(`ALTER TABLE sessions ADD COLUMN vote_policy TEXT NOT NULL DEFAULT 'once' CHECK (vote_policy IN ('once','multi','react'))`).run().catch(() => {})
  await db.prepare(`ALTER TABLE sessions ADD COLUMN session_mode TEXT NOT NULL DEFAULT 'reflection' CHECK (session_mode IN ('reflection','fun'))`).run().catch(() => {})
  await db.prepare(`ALTER TABLE sessions ADD COLUMN team_id TEXT DEFAULT NULL`).run().catch(() => {})
  await db.prepare(`ALTER TABLE sessions ADD COLUMN ai_generated INTEGER NOT NULL DEFAULT 0`).run().catch(() => {})
  await db.prepare(`ALTER TABLE sessions ADD COLUMN ai_consent_at INTEGER`).run().catch(() => {})
  await db.prepare(`ALTER TABLE sessions ADD COLUMN ai_grounding_hash TEXT`).run().catch(() => {})
  await db.prepare(`ALTER TABLE sessions ADD COLUMN ai_accepted_count INTEGER NOT NULL DEFAULT 0`).run().catch(() => {})
  await db.prepare(`ALTER TABLE sessions ADD COLUMN ai_dismissed_count INTEGER NOT NULL DEFAULT 0`).run().catch(() => {})
  await db.prepare(`ALTER TABLE sessions ADD COLUMN ai_recap_model TEXT`).run().catch(() => {})
  await db.prepare(`ALTER TABLE sessions ADD COLUMN ai_recap_edited_at INTEGER`).run().catch(() => {})
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS sprint19_events (
      id TEXT PRIMARY KEY,
      event_name TEXT NOT NULL,
      user_id TEXT NOT NULL,
      session_id TEXT,
      team_id TEXT,
      plan TEXT,
      count INTEGER NOT NULL DEFAULT 0,
      value REAL NOT NULL DEFAULT 0,
      duration_ms INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      trace_id TEXT NOT NULL
    )`,
  ).run().catch(() => {})
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_sprint19_events_name_created ON sprint19_events(event_name, created_at)`).run().catch(() => {})
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_sprint19_events_session ON sprint19_events(session_id)`).run().catch(() => {})
}
