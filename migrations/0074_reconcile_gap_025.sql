-- 0074_reconcile_gap_025.sql
-- Reconciliation no-op: migration 0025 was applied directly to production
-- during sprint development without being recorded in the migrations directory.
-- This file restores contiguous sequence numbering for disaster-recovery reproducibility.
-- See TECH_DEBT_AUDIT_2026-05.md TD-03.
SELECT 1; -- no-op
