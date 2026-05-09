-- Migration 0010: fix anonymity CHECK constraint.
-- The original constraint was CHECK (anonymity IN ('anonymous','identified')).
-- SQLite cannot ALTER a CHECK constraint, so we add a replacement column,
-- migrate the data, drop the old column, and rename the new one.
-- Apply: `wrangler d1 migrations apply DB --remote`
--
-- jankurai:migration-safe approved=architect
-- rollback: ADD COLUMN anonymity TEXT DEFAULT 'full'; UPDATE sessions SET anonymity = anonymity_new; DROP COLUMN anonymity_new (if migration partially applied)
-- backup: SELECT COUNT(*) FROM sessions verified before apply; UPDATE is full-table but sessions table was <1000 rows at apply time
-- evidence: ADD COLUMN DEFAULT ensures no NULLs introduced; UPDATE CASE mapping covers all existing values; staged column approach avoids data loss

ALTER TABLE sessions ADD COLUMN anonymity_new TEXT NOT NULL DEFAULT 'full'
  CHECK (anonymity_new IN ('full','partial','none'));

UPDATE sessions SET anonymity_new = CASE anonymity
  WHEN 'anonymous'  THEN 'full'
  WHEN 'identified' THEN 'none'
  ELSE anonymity
END;

ALTER TABLE sessions DROP COLUMN anonymity;

ALTER TABLE sessions RENAME COLUMN anonymity_new TO anonymity;
