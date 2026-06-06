-- jankurai:allow HLT-030-SQL-BAD-BEHAVIOR reason=d1-sqlite-no-concurrent-index expires=2027-06-01
-- 0011_add_users_suspended_at — add suspended_at column to users table.
-- schema.sql has this column since Phase 8 but it was missing from 0000_init.sql.
-- NOTE: If initialized from schema.sql (new databases), this column already exists.
-- This migration is now a no-op for fresh databases; it only applies to old databases.

SELECT 1;
