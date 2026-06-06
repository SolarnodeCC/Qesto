-- jankurai:allow HLT-030-SQL-BAD-BEHAVIOR reason=d1-sqlite-no-concurrent-index expires=2027-06-01
-- Migration: 0025_phase2_vote_buffering.sql
-- ADR-042 Phase 2.2: Vote buffering + R2 snapshots schema
--
-- Adds efficient indexes for batch vote operations and tracking
-- for DO recovery strategy (snapshots + tail replay from flush log).
--
-- Applied: Phase 2 (Week 3)

-- Index: optimized batch recovery from D1 during DO rehydration
-- Allows efficient query of votes since a given timestamp
CREATE INDEX IF NOT EXISTS idx_votes_session_id_submitted_at
  ON votes(session_id, submitted_at DESC);

-- Vote flush log: tracks when DO flushed buffered votes to D1
-- Used for recovery: DO can replay tail of votes since last flush
CREATE TABLE IF NOT EXISTS vote_flush_log (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  flush_time INTEGER NOT NULL,           -- timestamp (ms)
  batch_count INTEGER NOT NULL,          -- votes in this batch
  buffer_size_at_flush INTEGER,          -- DO memory state at flush
  created_at INTEGER NOT NULL DEFAULT (
    cast(round(unixepoch('now') * 1000) as integer)
  ),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_vote_flush_log_session_id
  ON vote_flush_log(session_id, flush_time DESC);

-- Snapshot metadata: tracks R2 snapshots for DO recovery
-- Tells DO which snapshot is latest + when it was taken
CREATE TABLE IF NOT EXISTS vote_buffer_snapshots (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  r2_key TEXT NOT NULL,                 -- path in R2 bucket
  do_instance_id TEXT,                  -- Durable Object ID (for debugging)
  buffered_votes_count INTEGER,         -- votes in buffer at snapshot time
  last_flush_time INTEGER,              -- latest vote_flush_log.flush_time
  snapshot_timestamp INTEGER NOT NULL,  -- when snapshot was created (ms)
  created_at INTEGER NOT NULL DEFAULT (
    cast(round(unixepoch('now') * 1000) as integer)
  ),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_vote_buffer_snapshots_session_id
  ON vote_buffer_snapshots(session_id, snapshot_timestamp DESC);

-- Cleanup: remove old snapshots + flush logs after session is archived
-- Triggered on session archival (optional; can also be a background cron job)
--
-- Usage: called after session transitions to ARCHIVED state
-- PRAGMA foreign_keys = ON;
-- DELETE FROM vote_flush_log WHERE session_id = ?;
-- DELETE FROM vote_buffer_snapshots WHERE session_id = ?;
