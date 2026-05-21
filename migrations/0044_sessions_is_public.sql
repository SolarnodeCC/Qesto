-- Growth Engine: Add is_public column to sessions table (opt-out for template gallery)
ALTER TABLE sessions ADD COLUMN is_public INTEGER DEFAULT 1;
CREATE INDEX idx_sessions_is_public ON sessions(is_public) WHERE is_public = 1;
