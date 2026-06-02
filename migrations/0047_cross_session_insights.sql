-- Migration 0047: Cross-session intelligence (EPIC-INSIGHTS+, ADR-0045, Sprint 81).
-- Apply: wrangler d1 migrations apply qesto_3_db --local
-- Safety: additive columns + new table. No destructive backfill required.

ALTER TABLE insights_daily ADD COLUMN team_id TEXT;
ALTER TABLE insights_daily ADD COLUMN embedding_ref INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_insights_daily_team_day
  ON insights_daily(team_id, day DESC);

CREATE TABLE IF NOT EXISTS team_insight_rollup (
  team_id TEXT NOT NULL,
  kind TEXT NOT NULL
    CHECK (kind IN ('recurring_themes', 'engagement_trend', 'facilitator_scorecard')),
  window TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  computed_at INTEGER NOT NULL,
  PRIMARY KEY (team_id, kind, window)
);

CREATE INDEX IF NOT EXISTS idx_team_insight_rollup_computed
  ON team_insight_rollup(team_id, computed_at DESC);
