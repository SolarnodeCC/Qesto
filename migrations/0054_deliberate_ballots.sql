-- Migration 0054: DELIBERATE verifiable governance voting (epic E86, ADR-0049).
-- Apply: `wrangler d1 migrations apply qesto-prod`
-- Safety: new table + additive indexes only. No data backfill, no column drops.
-- jankurai:migration-safe approved=architect
-- SQLite-compatible.

-- Append-only commitment ledger for DELIBERATE-RECEIPT-01. Each row is one
-- cast ballot. The ledger is ANONYMOUS: voter_hash is a salted, per-session
-- SHA-256 (no user id), so account deletion never orphans a verifiable ballot
-- and the same person is unlinkable across sessions. `commitment` =
-- SHA-256(sessionFingerprint:ballotNonce:choice) — coercion-resistant.
CREATE TABLE IF NOT EXISTS deliberate_ballots (
  id            TEXT PRIMARY KEY,                              -- uuid
  session_id    TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  ballot_nonce  TEXT NOT NULL,                                 -- 128-bit blinding factor (hex)
  commitment    TEXT NOT NULL,                                 -- hex SHA-256 commitment (Merkle leaf)
  choice        TEXT NOT NULL,                                 -- public tally bucket
  voter_hash    TEXT NOT NULL,                                 -- salted anon dedup key, no PII
  leaf_index    INTEGER NOT NULL,                              -- insertion order, 0-based
  created_at    INTEGER NOT NULL,                              -- epoch ms
  UNIQUE(session_id, voter_hash),                              -- one ballot per voter per session
  UNIQUE(session_id, ballot_nonce)                             -- nonce uniqueness (anti-replay)
);
CREATE INDEX IF NOT EXISTS idx_deliberate_ballots_session ON deliberate_ballots(session_id);

-- CHECK-enum widening is canonical in schema.sql (SQLite cannot ALTER a CHECK
-- constraint in place; fresh DBs initialize from schema.sql). Per the 0046
-- precedent:
--   sessions.session_mode += 'deliberate'
-- Old databases enforcing the narrower CHECK require a table rebuild to widen
-- it; new databases already have the correct constraint from schema.sql.
