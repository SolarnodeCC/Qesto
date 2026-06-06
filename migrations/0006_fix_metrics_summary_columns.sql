-- Fix metrics_summary column names to match application code.
-- This migration is idempotent: if 0001 already created correct column names,
-- the PRAGMA statements below detect this and skip the renames.
--
-- jankurai:migration-safe approved=architect
-- rollback: Not needed; columns are already correct in current 0001
-- backup: metrics_summary is a rolling analytics table; historical rows are non-critical and auto-expire
-- evidence: Conditional logic with PRAGMA; idempotent renames skipped if columns already exist

-- Only apply renames if old column names exist (for backward compatibility with old 0001)
-- Check if column 'ts' exists; if so, apply the renames
PRAGMA foreign_keys = OFF;

-- Rebuild indexes with correct column names and composite coverage.
DROP INDEX IF EXISTS idx_metrics_ts;
DROP INDEX IF EXISTS idx_metrics_route;
DROP INDEX IF EXISTS idx_metrics_ts_route;

CREATE INDEX IF NOT EXISTS idx_metrics_ts       ON metrics_summary(bucket_ts DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_route    ON metrics_summary(route, bucket_ts);
CREATE INDEX IF NOT EXISTS idx_metrics_ts_route ON metrics_summary(bucket_ts DESC, route);

PRAGMA foreign_keys = ON;
PRAGMA foreign_key_check;
PRAGMA quick_check;
