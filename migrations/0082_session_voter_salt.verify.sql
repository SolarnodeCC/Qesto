-- Expect 1: the voter_salt column exists on sessions.
SELECT COUNT(*) AS voter_salt_column
FROM pragma_table_info('sessions')
WHERE name = 'voter_salt';

-- Expect 0: no session may carry an empty-string salt (absent must be NULL, so
-- the code's "no salt -> legacy derivation" branch stays unambiguous).
SELECT COUNT(*) AS empty_salts FROM sessions WHERE voter_salt = '';
