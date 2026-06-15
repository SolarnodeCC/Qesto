-- PULSE-AUDIT-01 (ADR-0057) — aggregation query audit log.
-- Every PULSE aggregation read (summary / trends) is logged: who queried, the
-- cohort size returned, how many rows were k-anonymity masked, and when.
-- DPO-readable; retained alongside the aggregation plane it audits.
-- jankurai:migration-safe verify foreign_key_check quick_check

CREATE TABLE IF NOT EXISTS pulse_query_audit (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  query_type TEXT NOT NULL CHECK (query_type IN ('summary', 'trends', 'audit')),
  window TEXT NOT NULL,
  cohort_size INTEGER NOT NULL DEFAULT 0,
  masked_rows INTEGER NOT NULL DEFAULT 0,
  trace_id TEXT,
  queried_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pulse_query_audit_team_time
  ON pulse_query_audit(team_id, queried_at DESC);

PRAGMA foreign_key_check;
PRAGMA quick_check;
