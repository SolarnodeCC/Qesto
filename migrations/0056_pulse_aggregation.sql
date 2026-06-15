-- PULSE aggregation store (ADR-0057, S91 PULSE-STORE-01)

CREATE TABLE IF NOT EXISTS pulse_session_rollup (
  session_id TEXT PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
  team_id TEXT,
  workspace_id TEXT,
  closed_at INTEGER NOT NULL,
  participant_count INTEGER NOT NULL DEFAULT 0,
  vote_count INTEGER NOT NULL DEFAULT 0,
  participation_rate REAL NOT NULL DEFAULT 0,
  sentiment_score REAL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  computed_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pulse_session_team_closed
  ON pulse_session_rollup(team_id, closed_at DESC);

CREATE TABLE IF NOT EXISTS pulse_team_daily (
  team_id TEXT NOT NULL,
  day TEXT NOT NULL,
  participation_avg REAL NOT NULL DEFAULT 0,
  sentiment_avg REAL,
  session_count INTEGER NOT NULL DEFAULT 0,
  response_total INTEGER NOT NULL DEFAULT 0,
  computed_at INTEGER NOT NULL,
  PRIMARY KEY (team_id, day)
);
CREATE INDEX IF NOT EXISTS idx_pulse_team_daily_day
  ON pulse_team_daily(team_id, day DESC);
