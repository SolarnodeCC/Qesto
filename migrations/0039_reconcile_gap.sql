-- jankurai:allow HLT-030-SQL-BAD-BEHAVIOR reason=d1-sqlite-no-concurrent-index expires=2027-06-01
-- 0039_reconcile_gap.sql
-- Reconciliation no-op: this migration number was applied directly to production
-- during sprint development without being recorded in the migrations directory.
-- This file restores contiguous sequence numbering for disaster-recovery reproducibility.
-- See TECH_DEBT_AUDIT_2026-05.md TD-03.
SELECT 1; -- no-op
