-- 0019_reconcile_gap.sql
-- Reconciliation no-op: this migration number was applied directly to production
-- during sprint development without being recorded in the migrations directory.
-- This file restores contiguous sequence numbering for disaster-recovery reproducibility.
-- See TECH_DEBT_AUDIT_2026-05.md TD-03.
SELECT 1; -- no-op
