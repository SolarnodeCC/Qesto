-- Migration 0053: ADR-0048 recurring workspace extensions (Sprint 85+).
-- Apply: wrangler d1 migrations apply qesto_3_db --local

-- Session linkage: workspace instances
ALTER TABLE sessions ADD COLUMN workspace_id TEXT REFERENCES workspaces(id) ON DELETE SET NULL;
ALTER TABLE sessions ADD COLUMN workspace_seq INTEGER;

CREATE INDEX IF NOT EXISTS idx_sessions_workspace ON sessions(workspace_id, workspace_seq DESC);

-- Workspace lifecycle fields (kind 'event' enforced in API — SQLite CHECK not widened in place)
ALTER TABLE workspaces ADD COLUMN cadence TEXT CHECK (cadence IS NULL OR cadence IN ('weekly','biweekly','sprint','manual'));
ALTER TABLE workspaces ADD COLUMN retention_days INTEGER;
ALTER TABLE workspaces ADD COLUMN last_instance_at INTEGER;
ALTER TABLE workspaces ADD COLUMN archived_at INTEGER;

-- Materialised workspace trends (mirrors team_insight_rollup shape)
CREATE TABLE IF NOT EXISTS workspace_trend (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('team_health','participation','recurring_themes')),
  window TEXT NOT NULL CHECK (window IN ('30d','90d','180d')),
  payload_json TEXT NOT NULL,
  computed_at INTEGER NOT NULL,
  PRIMARY KEY (workspace_id, kind, window)
);

CREATE INDEX IF NOT EXISTS idx_workspace_trend_computed ON workspace_trend(workspace_id, computed_at DESC);
