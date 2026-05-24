-- PERF-DB-INDICES-01 (Sprint 46): hot-path query indexes
CREATE INDEX IF NOT EXISTS idx_votes_session_question ON votes(session_id, question_id);
CREATE INDEX IF NOT EXISTS idx_votes_session_submitted ON votes(session_id, submitted_at);
CREATE INDEX IF NOT EXISTS idx_sessions_team_created ON sessions(team_id, created_at DESC);
