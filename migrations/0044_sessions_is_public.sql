-- Growth Engine: Add is_public column to sessions table (opt-out for template gallery)
-- Safety: Additive column + partial index. PostgreSQL: Set lock/statement timeouts.
-- Metadata: migrations/.metadata/0044_sessions_is_public.json

SET lock_timeout = '5s';
SET statement_timeout = '30s';

ALTER TABLE sessions ADD COLUMN is_public INTEGER DEFAULT 1;
CREATE INDEX idx_sessions_is_public ON sessions(is_public) WHERE is_public = 1;

RESET lock_timeout;
RESET statement_timeout;
