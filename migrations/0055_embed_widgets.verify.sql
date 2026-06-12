PRAGMA foreign_key_check;
SELECT COUNT(*) AS embed_widgets_table FROM sqlite_master WHERE type = 'table' AND name = 'embed_widgets';
SELECT COUNT(*) AS embed_widgets_team_idx FROM sqlite_master WHERE type = 'index' AND name = 'idx_embed_widgets_team';
SELECT COUNT(*) AS embed_widgets_session_idx FROM sqlite_master WHERE type = 'index' AND name = 'idx_embed_widgets_session';
