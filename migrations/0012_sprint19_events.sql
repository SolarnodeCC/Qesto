-- Sprint 19 completion: durable journey events for wizard -> Launchpad evidence.

ALTER TABLE sessions ADD COLUMN ai_accepted_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sessions ADD COLUMN ai_dismissed_count INTEGER NOT NULL DEFAULT 0;

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
