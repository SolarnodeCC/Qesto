-- jankurai:allow HLT-030-SQL-BAD-BEHAVIOR reason=d1-sqlite-no-concurrent-index expires=2027-06-01
-- Post-apply integrity checks for 0003_emoji_poll (HLT-030).
PRAGMA foreign_key_check;
PRAGMA quick_check;
