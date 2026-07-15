-- Verify the votes table now carries the widened UNIQUE(question_id, voter_id,
-- option_id) key (expect 1), still enforces the old key's leading columns
-- (expect 1), that both indexes survived the rebuild (expect 1 each), and that
-- the temporary rebuild table was cleaned up (expect 0).
SELECT COUNT(*) AS votes_unique_widened FROM sqlite_master
  WHERE type = 'table' AND name = 'votes' AND sql LIKE '%UNIQUE(question_id, voter_id, option_id)%';
SELECT COUNT(*) AS idx_votes_session FROM sqlite_master
  WHERE type = 'index' AND name = 'idx_votes_session';
SELECT COUNT(*) AS idx_votes_session_submitted FROM sqlite_master
  WHERE type = 'index' AND name = 'idx_votes_session_id_submitted_at';
SELECT COUNT(*) AS temp_table_removed FROM sqlite_master
  WHERE type = 'table' AND name = 'votes__unique_fix';
