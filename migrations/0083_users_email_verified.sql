-- 0083_users_email_verified.sql
-- DD-10 (#883) — record proof of mailbox ownership.
--
-- Password signup issued a 14-day session without proving the caller controls
-- the address. `email_verified_at` is set when the user consumes a magic link
-- (the one-time token only the inbox owner can read) or signs in with Google
-- (which rejects unverified emails). Sensitive surfaces — team invite accept,
-- billing checkout, API-key creation — require it (lib/email-verification.ts).
--
-- Backfill: every account that has ever consumed a magic link HAS proven
-- ownership, so it is marked verified at its first consumption. Password-only
-- accounts stay NULL and are asked to verify via the in-app banner; Google
-- accounts are marked on their next login. Kept identical to BACKFILL_SQL in
-- functions/api/lib/email-verification.ts, which self-heals the column when
-- this migration has not been applied yet.
--
-- jankurai:migration-safe verify

ALTER TABLE users ADD COLUMN email_verified_at INTEGER;

UPDATE users SET email_verified_at = (
    SELECT MIN(m.consumed_at) FROM magic_links m
     WHERE m.email = users.email AND m.consumed_at IS NOT NULL
  ) WHERE email_verified_at IS NULL;
