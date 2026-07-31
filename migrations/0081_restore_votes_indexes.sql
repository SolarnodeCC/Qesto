-- 0081_restore_votes_indexes.sql
-- Production already applied 0080_widen_votes_unique (verified 2026-07-15), which
-- rebuilt `votes` and only recreated 2 of 6 indexes. Editing 0080 cannot repair
-- already-applied environments, so this follow-up restores the missing indexes
-- idempotently (IF NOT EXISTS). Safe on greenfield DBs that apply the fixed 0080
-- first — the CREATE INDEX statements become no-ops.
-- jankurai:migration-safe verify

CREATE INDEX IF NOT EXISTS idx_votes_question ON votes(question_id);
CREATE INDEX IF NOT EXISTS idx_votes_session_question ON votes(session_id, question_id);
CREATE INDEX IF NOT EXISTS idx_votes_session_submitted ON votes(session_id, submitted_at);
CREATE INDEX IF NOT EXISTS idx_votes_session_voter ON votes(session_id, voter_id);
-- Also ensure the two indexes 0080 already attempted remain present.
CREATE INDEX IF NOT EXISTS idx_votes_session ON votes(session_id);
CREATE INDEX IF NOT EXISTS idx_votes_session_id_submitted_at ON votes(session_id, submitted_at DESC);
