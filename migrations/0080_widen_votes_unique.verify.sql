-- Verify the votes table now carries the widened UNIQUE(question_id, voter_id,
-- option_id) key (expect 1), that every votes index survived the rebuild
-- (expect 1 each; total 6), and that the temporary rebuild table was cleaned up
-- (expect 0).
SELECT COUNT(*) AS votes_unique_widened FROM sqlite_master
  WHERE type = 'table' AND name = 'votes' AND sql LIKE '%UNIQUE(question_id, voter_id, option_id)%';
SELECT COUNT(*) AS idx_votes_session FROM sqlite_master
  WHERE type = 'index' AND name = 'idx_votes_session';
SELECT COUNT(*) AS idx_votes_question FROM sqlite_master
  WHERE type = 'index' AND name = 'idx_votes_question';
SELECT COUNT(*) AS idx_votes_session_submitted FROM sqlite_master
  WHERE type = 'index' AND name = 'idx_votes_session_id_submitted_at';
SELECT COUNT(*) AS idx_votes_session_question FROM sqlite_master
  WHERE type = 'index' AND name = 'idx_votes_session_question';
SELECT COUNT(*) AS idx_votes_session_submitted_legacy FROM sqlite_master
  WHERE type = 'index' AND name = 'idx_votes_session_submitted';
SELECT COUNT(*) AS idx_votes_session_voter FROM sqlite_master
  WHERE type = 'index' AND name = 'idx_votes_session_voter';
SELECT COUNT(*) AS votes_index_count FROM sqlite_master
  WHERE type = 'index' AND name IN (
    'idx_votes_session',
    'idx_votes_question',
    'idx_votes_session_id_submitted_at',
    'idx_votes_session_question',
    'idx_votes_session_submitted',
    'idx_votes_session_voter'
  );
SELECT COUNT(*) AS temp_table_removed FROM sqlite_master
  WHERE type = 'table' AND name = 'votes__unique_fix';
