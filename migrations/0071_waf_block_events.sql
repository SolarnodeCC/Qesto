-- Platformbeheer Module 2 (Realtime observability) — WAF / bot-protection event log.
--
-- The brief calls out a prior incident where a legitimate crawler (Googlebot)
-- was blocked by bot-protection rules and went unnoticed. This table is the
-- first-party sink for WAF/bot block events so the observability module can
-- surface a clear signal when a known-good crawler (Googlebot, Bingbot, …) is
-- blocked, instead of that fact being buried in Cloudflare dashboard logs.
--
-- Population is via Logpush / a WAF-event ingestion worker (out of scope for
-- this migration); the read path tolerates an empty table.

CREATE TABLE IF NOT EXISTS waf_block_events (
  id            TEXT    PRIMARY KEY,                              -- ulid
  ts            INTEGER NOT NULL,                                 -- unix ms of the block
  rule_id       TEXT,                                             -- WAF/bot rule that fired
  action        TEXT    NOT NULL DEFAULT 'block'                  -- block | challenge | log
    CHECK (action IN ('block', 'challenge', 'log', 'managed_challenge')),
  client_ip     TEXT,
  user_agent    TEXT,                                             -- raw UA string
  -- Classification computed at ingest: 'googlebot' | 'bingbot' | 'other_known'
  -- | 'unknown'. Lets the read path flag legit-crawler blocks without parsing
  -- UA strings on every dashboard load.
  crawler_class TEXT    NOT NULL DEFAULT 'unknown',
  path          TEXT,                                             -- requested path
  country       TEXT,                                             -- CF-IPCountry
  created_at    INTEGER NOT NULL DEFAULT (CAST(UNIXEPOCH() * 1000 AS INTEGER))
);

-- Time-window scans (the dominant query) and a partial-ish lookup for the
-- legit-crawler alert (crawler_class != 'unknown').
CREATE INDEX IF NOT EXISTS idx_waf_block_events_ts ON waf_block_events(ts DESC);
CREATE INDEX IF NOT EXISTS idx_waf_block_events_crawler ON waf_block_events(crawler_class, ts DESC);

PRAGMA foreign_key_check;
PRAGMA quick_check;
