-- Marketing automation (Content Engine, Mention Monitor, Video Asset Library,
-- Review Dashboard) — single-owner internal tool, absorbs the existing
-- LinkedIn auto-posting pipeline into one cross-platform content schema.
--
-- `linkedin_posts` (workers/linkedin-scheduler) is retained but superseded —
-- it is a write-once log with no FK target here; no data migration is done.
-- The LinkedIn scheduler keeps running unmodified until cutover to the new
-- Publisher is verified in production, then it is decommissioned separately.

CREATE TABLE IF NOT EXISTS video_assets (
  id           TEXT    PRIMARY KEY,                              -- ulid
  r2_key       TEXT    NOT NULL UNIQUE,                           -- videos/product-pipeline/... | videos/other-recordings/...
  category     TEXT    NOT NULL CHECK (category IN ('product-pipeline', 'other-recordings')),
  title        TEXT    NOT NULL,
  tags         TEXT    NOT NULL DEFAULT '[]',                     -- JSON string[]
  duration_sec INTEGER,
  size_bytes   INTEGER,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_video_assets_category ON video_assets(category);

CREATE TABLE IF NOT EXISTS content_calendar (
  id             TEXT    PRIMARY KEY,                            -- ulid
  platform       TEXT    NOT NULL CHECK (platform IN ('linkedin', 'youtube')),
  topic          TEXT    NOT NULL,
  scheduled_for  INTEGER NOT NULL,                                -- ms epoch
  status         TEXT    NOT NULL DEFAULT 'planned'
                   CHECK (status IN ('planned', 'generated', 'skipped')),
  video_asset_id TEXT,
  notes          TEXT,
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL,
  FOREIGN KEY (video_asset_id) REFERENCES video_assets(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_content_calendar_scheduled ON content_calendar(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_content_calendar_status ON content_calendar(status, scheduled_for);

CREATE TABLE IF NOT EXISTS content_items (
  id                  TEXT    PRIMARY KEY,                       -- ulid
  content_calendar_id TEXT    NOT NULL,
  platform            TEXT    NOT NULL CHECK (platform IN ('linkedin', 'youtube')),
  status              TEXT    NOT NULL DEFAULT 'draft'
                         CHECK (status IN ('draft', 'approved', 'rejected', 'published', 'failed')),
  body                TEXT,                                       -- linkedin body
  script              TEXT,                                       -- youtube script
  metadata            TEXT    NOT NULL DEFAULT '{}',               -- JSON {title, description, tags[]} for youtube
  video_asset_id      TEXT,
  youtube_video_id    TEXT,                                        -- owner-supplied, required before youtube publish
  generated_at        INTEGER NOT NULL,
  reviewed_at         INTEGER,
  published_at        INTEGER,
  platform_post_id    TEXT,                                        -- linkedin ugcPost URN | youtube video id
  failure_reason      TEXT,
  created_at          INTEGER NOT NULL,
  updated_at          INTEGER NOT NULL,
  FOREIGN KEY (content_calendar_id) REFERENCES content_calendar(id) ON DELETE CASCADE,
  FOREIGN KEY (video_asset_id) REFERENCES video_assets(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_content_items_calendar ON content_items(content_calendar_id);
CREATE INDEX IF NOT EXISTS idx_content_items_status ON content_items(status, generated_at DESC);

CREATE TABLE IF NOT EXISTS mentions (
  id          TEXT    PRIMARY KEY,                                -- ulid
  platform    TEXT    NOT NULL CHECK (platform IN ('linkedin', 'reddit', 'youtube')),
  source_id   TEXT    NOT NULL,                                   -- platform-native id, dedupe key
  author      TEXT,
  body        TEXT    NOT NULL,
  url         TEXT,
  reviewed    INTEGER NOT NULL DEFAULT 0 CHECK (reviewed IN (0, 1)),
  fetched_at  INTEGER NOT NULL,
  posted_at   INTEGER,
  created_at  INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mentions_platform_source ON mentions(platform, source_id);
CREATE INDEX IF NOT EXISTS idx_mentions_fetched_at ON mentions(fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_mentions_reviewed ON mentions(reviewed, fetched_at DESC);

CREATE TABLE IF NOT EXISTS monitor_state (
  platform       TEXT    PRIMARY KEY CHECK (platform IN ('linkedin', 'reddit', 'youtube')),
  cursor         TEXT,
  last_polled_at INTEGER,
  last_error     TEXT,
  updated_at     INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS engine_locks (
  job          TEXT    PRIMARY KEY,
  locked_at    INTEGER,
  locked_until INTEGER,
  last_run_at  INTEGER,
  last_status  TEXT CHECK (last_status IN ('success', 'failure', 'running')),
  updated_at   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS oauth_token_status (
  platform           TEXT    PRIMARY KEY CHECK (platform IN ('linkedin', 'reddit', 'youtube')),
  connected          INTEGER NOT NULL DEFAULT 0 CHECK (connected IN (0, 1)),
  expires_at         INTEGER,
  last_refreshed_at  INTEGER,
  last_refresh_error TEXT,
  updated_at         INTEGER NOT NULL
);

PRAGMA foreign_key_check;
PRAGMA quick_check;
