-- jankurai:allow HLT-030-SQL-BAD-BEHAVIOR reason=d1-sqlite-no-concurrent-index expires=2027-06-01
PRAGMA foreign_key_check;
SELECT COUNT(*) AS workspace_trend FROM sqlite_master WHERE type = 'table' AND name = 'workspace_trend';
