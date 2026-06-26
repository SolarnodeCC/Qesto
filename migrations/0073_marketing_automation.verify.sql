-- Verification for 0073_marketing_automation.sql — table + index existence checks.

SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'video_assets';
SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'content_calendar';
SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'content_items';
SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'mentions';
SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'monitor_state';
SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'engine_locks';
SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'oauth_token_status';

SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_video_assets_category';
SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_content_calendar_scheduled';
SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_content_calendar_status';
SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_content_items_calendar';
SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_content_items_status';
SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_mentions_platform_source';
SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_mentions_fetched_at';
SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_mentions_reviewed';
