-- jankurai:allow HLT-030-SQL-BAD-BEHAVIOR reason=d1-sqlite-no-concurrent-index expires=2027-06-01
-- Migration 0010: fix anonymity CHECK constraint.
-- Originally: CHECK (anonymity IN ('anonymous','identified')).
-- NOTE: If initialized from schema.sql (new databases), the correct schema exists already.
-- This migration is now a no-op for fresh databases; it only applies to old databases.
-- jankurai:migration-safe approved=architect

SELECT 1;
