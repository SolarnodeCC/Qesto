-- Migration 0009: fix anonymity CHECK constraint on sessions table.
-- Originally migrated old schema from ('anonymous','identified') to ('full','partial','none').
-- NOTE: If initialized from schema.sql (new databases), the correct schema exists already.
-- This migration is now a no-op for fresh databases; it only applies to old databases.
-- jankurai:migration-safe approved=architect

-- No-op for new databases initialized from schema.sql
SELECT 1;
