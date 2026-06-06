PRAGMA foreign_key_check;
SELECT COUNT(*) AS workspace_trend FROM sqlite_master WHERE type = 'table' AND name = 'workspace_trend';
