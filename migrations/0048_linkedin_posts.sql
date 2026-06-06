-- jankurai:allow HLT-030-SQL-BAD-BEHAVIOR reason=d1-sqlite-no-concurrent-index expires=2027-06-01
-- 0047_linkedin_posts.sql
-- LinkedIn auto-posting log (MKTG). One row per scheduled post attempt:
-- successful publishes (status='posted') and failures (status='error', the
-- LinkedIn/refresh error captured in `content`). No retry — the next cron
-- handles the next slot. See workers/linkedin-scheduler/.

CREATE TABLE IF NOT EXISTS linkedin_posts (
  id        TEXT PRIMARY KEY,                    -- ulid
  content   TEXT NOT NULL,                       -- post body, or error detail when status='error'
  posted_at INTEGER NOT NULL,                    -- unix ms
  status    TEXT NOT NULL DEFAULT 'posted'
            CHECK (status IN ('posted','error'))
);

CREATE INDEX IF NOT EXISTS idx_linkedin_posts_posted_at ON linkedin_posts(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_linkedin_posts_status ON linkedin_posts(status);
