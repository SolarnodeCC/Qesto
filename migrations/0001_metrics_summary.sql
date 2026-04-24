-- Phase 8 Step 1: Observability — Durable metrics history (D1 table)
-- Populated every 5 minutes by scheduled worker from KV metrics buckets.
-- Supports admin dashboard historical queries and CSV export.

CREATE TABLE IF NOT EXISTS metrics_summary (
  id            TEXT    PRIMARY KEY,
  bucket_ts     INTEGER NOT NULL,
  route         TEXT    NOT NULL,
  p50_ms        INTEGER NOT NULL,
  p95_ms        INTEGER NOT NULL,
  p99_ms        INTEGER NOT NULL,
  error_count   INTEGER NOT NULL,
  request_count INTEGER NOT NULL,
  created_at    INTEGER NOT NULL DEFAULT (CAST(UNIXEPOCH() * 1000 AS INTEGER))
);

CREATE INDEX IF NOT EXISTS idx_metrics_ts    ON metrics_summary(bucket_ts DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_route ON metrics_summary(route, bucket_ts);
CREATE INDEX IF NOT EXISTS idx_metrics_ts_route ON metrics_summary(bucket_ts DESC, route);

-- Retention: 90 days (delete old rows via scheduled worker)
-- Granularity: 5-minute buckets (one row per route per 5 min)
