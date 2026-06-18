SELECT COUNT(*) AS connect_federation_members FROM sqlite_master WHERE type = 'table' AND name = 'connect_federation_members';
SELECT COUNT(*) AS idx_connect_members_session_region FROM sqlite_master WHERE type = 'index' AND name = 'idx_connect_members_session_region';
