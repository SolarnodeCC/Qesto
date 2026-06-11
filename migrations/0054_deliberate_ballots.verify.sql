PRAGMA foreign_key_check;
SELECT COUNT(*) AS deliberate_table FROM sqlite_master WHERE type = 'table' AND name = 'deliberate_ballots';
SELECT COUNT(*) AS deliberate_session_idx FROM sqlite_master WHERE type = 'index' AND name = 'idx_deliberate_ballots_session';
