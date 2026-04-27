-- Migration 0010: fix anonymity CHECK constraint.
-- The original constraint was CHECK (anonymity IN ('anonymous','identified')).
-- SQLite cannot ALTER a CHECK constraint, so we add a replacement column,
-- migrate the data, drop the old column, and rename the new one.
-- Apply: `wrangler d1 migrations apply DB --remote`

ALTER TABLE sessions ADD COLUMN anonymity_new TEXT NOT NULL DEFAULT 'full'
  CHECK (anonymity_new IN ('full','partial','none'));

UPDATE sessions SET anonymity_new = CASE anonymity
  WHEN 'anonymous'  THEN 'full'
  WHEN 'identified' THEN 'none'
  ELSE anonymity
END;

ALTER TABLE sessions DROP COLUMN anonymity;

ALTER TABLE sessions RENAME COLUMN anonymity_new TO anonymity;
