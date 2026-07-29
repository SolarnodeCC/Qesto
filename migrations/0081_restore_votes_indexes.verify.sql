-- Expect 1 for each of the six production votes indexes.
SELECT COUNT(*) AS idx_votes_session FROM sqlite_master
  WHERE type = 'index' AND name = 'idx_votes_session';
SELECT COUNT(*) AS idx_votes_question FROM sqlite_master
  WHERE type = 'index' AND name = 'idx_votes_question';
SELECT COUNT(*) AS idx_votes_session_id_submitted_at FROM sqlite_master
  WHERE type = 'index' AND name = 'idx_votes_session_id_submitted_at';
SELECT COUNT(*) AS idx_votes_session_question FROM sqlite_master
  WHERE type = 'index' AND name = 'idx_votes_session_question';
SELECT COUNT(*) AS idx_votes_session_submitted FROM sqlite_master
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
