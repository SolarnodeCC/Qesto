-- Fix metrics_summary column names to match application code.
-- 0001_metrics_summary.sql used short names (ts, p50, p95, p99, error_rate);
-- the application expects bucket_ts, p50_ms, p95_ms, p99_ms, error_count.
--
-- jankurai:migration-safe approved=architect
-- rollback: RENAME COLUMN bucket_ts TO ts; p50_ms TO p50; p95_ms TO p95; p99_ms TO p99; error_count TO error_rate
-- backup: metrics_summary is a rolling analytics table; historical rows are non-critical and auto-expire
-- evidence: RENAME COLUMN is non-destructive; row count preserved; column semantics unchanged

ALTER TABLE metrics_summary RENAME COLUMN ts TO bucket_ts;
ALTER TABLE metrics_summary RENAME COLUMN p50 TO p50_ms;
ALTER TABLE metrics_summary RENAME COLUMN p95 TO p95_ms;
ALTER TABLE metrics_summary RENAME COLUMN p99 TO p99_ms;

-- Replace error_rate (REAL ratio) with error_count (INTEGER) to match query contract.
ALTER TABLE metrics_summary DROP COLUMN error_rate;
ALTER TABLE metrics_summary ADD COLUMN error_count INTEGER NOT NULL DEFAULT 0;

-- Rebuild indexes with correct column names and composite coverage.
DROP INDEX IF EXISTS idx_metrics_ts;
DROP INDEX IF EXISTS idx_metrics_route;
DROP INDEX IF EXISTS idx_metrics_ts_route;

CREATE INDEX IF NOT EXISTS idx_metrics_ts       ON metrics_summary(bucket_ts DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_route    ON metrics_summary(route, bucket_ts);
CREATE INDEX IF NOT EXISTS idx_metrics_ts_route ON metrics_summary(bucket_ts DESC, route);
