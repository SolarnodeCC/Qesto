-- 0002_user_roles — RBAC role assignments.
-- The rbac middleware queries this table; without it every DB call silently
-- falls back to 'viewer', blocking all owner/admin/member operations.

CREATE TABLE IF NOT EXISTS user_roles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner','admin','member','viewer','guest')),
  created_at INTEGER NOT NULL,
  UNIQUE(user_id, role)
);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
