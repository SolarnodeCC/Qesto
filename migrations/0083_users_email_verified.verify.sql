-- Expect 1: the email_verified_at column exists on users.
SELECT COUNT(*) AS email_verified_column
FROM pragma_table_info('users')
WHERE name = 'email_verified_at';

-- Expect 0: no user who consumed a magic link is left unverified.
SELECT COUNT(*) AS missed_backfill FROM users u
WHERE u.email_verified_at IS NULL
  AND EXISTS (SELECT 1 FROM magic_links m WHERE m.email = u.email AND m.consumed_at IS NOT NULL);
