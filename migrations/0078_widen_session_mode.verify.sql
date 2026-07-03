-- Verify the sessions table now carries the widened session_mode CHECK
-- (expect 1), still enforces the widened status CHECK (expect 1), and that the
-- temporary rebuild table was cleaned up (expect 0).
SELECT COUNT(*) AS sessions_mode_widened FROM sqlite_master
  WHERE type = 'table' AND name = 'sessions' AND sql LIKE '%''deliberate''%';
SELECT COUNT(*) AS sessions_status_widened FROM sqlite_master
  WHERE type = 'table' AND name = 'sessions' AND sql LIKE '%''energizing''%';
SELECT COUNT(*) AS idx_sessions_is_public FROM sqlite_master
  WHERE type = 'index' AND name = 'idx_sessions_is_public';
SELECT COUNT(*) AS temp_table_removed FROM sqlite_master
  WHERE type = 'table' AND name = 'sessions__mode_fix';
