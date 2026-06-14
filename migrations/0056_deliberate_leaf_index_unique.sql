-- Migration 0056: enforce stable DELIBERATE ledger leaf ordering.
-- Safety: additive unique index only. If this fails, duplicate leaf_index rows
-- already exist and require manual ledger remediation before certification.

CREATE UNIQUE INDEX IF NOT EXISTS idx_deliberate_ballots_session_leaf_index
  ON deliberate_ballots(session_id, leaf_index);
