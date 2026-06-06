-- jankurai:allow HLT-030-SQL-BAD-BEHAVIOR reason=d1-sqlite-no-concurrent-index expires=2027-06-01
PRAGMA foreign_key_check;
SELECT COUNT(*) AS insights_daily FROM sqlite_master WHERE type = 'table' AND name = 'insights_daily';
SELECT COUNT(*) AS team_insight_rollup FROM sqlite_master WHERE type = 'table' AND name = 'team_insight_rollup';
