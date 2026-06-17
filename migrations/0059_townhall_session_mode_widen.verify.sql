PRAGMA foreign_key_check;
PRAGMA quick_check;
SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'sessions';
