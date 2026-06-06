-- jankurai:allow HLT-030-SQL-BAD-BEHAVIOR reason=d1-sqlite-no-concurrent-index expires=2027-06-01
-- Sprint 19 completion: durable journey events for wizard -> Launchpad evidence.
-- NOTE: If initialized from schema.sql (new databases), these columns already exist.
-- This migration is now a no-op for fresh databases; it only applies to old databases.
-- jankurai:migration-safe approved=architect

SELECT 1;

CREATE TABLE IF NOT EXISTS sprint19_events (
  id TEXT PRIMARY KEY,
  event_name TEXT NOT NULL CHECK (
    event_name IN (
      'wizard.opened',
      'wizard.completed',
      'ai.suggestions_resolved',
      'launchpad.opened',
      'launchpad.launch_attempt',
      'launchpad.launch_success',
      'launchpad.launch_failed',
      'preflight.checked',
      'preflight.failed'
    )
  ),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE,
  team_id TEXT,
  plan TEXT,
  count INTEGER NOT NULL DEFAULT 0,
  value REAL NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  trace_id TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sprint19_events_name_created ON sprint19_events(event_name, created_at);
CREATE INDEX IF NOT EXISTS idx_sprint19_events_session ON sprint19_events(session_id);
