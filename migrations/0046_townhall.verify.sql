PRAGMA foreign_key_check;
SELECT COUNT(*) AS townhall_table FROM sqlite_master WHERE type = 'table' AND name = 'townhall_questions';
