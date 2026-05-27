import type { Env } from '../../types'

let _sprint19SchemaPatchDone = false

export async function patchSprint19SchemaIfNeeded(db: D1Database): Promise<void> {
  if (_sprint19SchemaPatchDone) return
  _sprint19SchemaPatchDone = true
  await db.prepare(`ALTER TABLE sessions ADD COLUMN ai_accepted_count INTEGER NOT NULL DEFAULT 0`).run().catch(() => {})
  await db.prepare(`ALTER TABLE sessions ADD COLUMN ai_dismissed_count INTEGER NOT NULL DEFAULT 0`).run().catch(() => {})
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

export function metricsKv(env: Env): KVNamespace | undefined {
  const extended = env as Env & { METRICS_KV?: KVNamespace }
  return extended.METRICS_KV
}
