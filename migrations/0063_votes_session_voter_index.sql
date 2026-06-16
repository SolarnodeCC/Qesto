-- 0063_votes_session_voter_index.sql
-- #540: the session-close badge computation aggregates votes per participant
-- (GROUP BY voter_id WHERE session_id = ?). Add the composite index so that
-- aggregation is an index range scan instead of a full per-session table scan.
-- Non-destructive, idempotent.
CREATE INDEX IF NOT EXISTS idx_votes_session_voter ON votes(session_id, voter_id);
