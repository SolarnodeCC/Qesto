-- #586 (CRITICAL) — separate platform-admin authority from tenant (team) roles.
--
-- Previously the GLOBAL user_roles table stored team roles (owner/admin/...) AND
-- was consulted by adminMiddleware as platform-admin authority, so every team
-- owner became a platform admin. Platform-admin authority now lives in its own
-- table that team creation NEVER writes to. Bootstrapped only from the
-- SUPERUSER_EMAIL/SEED_ADMIN_EMAIL env allowlist or by an existing platform
-- admin via /api/admin/users.

CREATE TABLE IF NOT EXISTS platform_roles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('platform_admin')),
  granted_by TEXT,                                              -- user_id of the granting platform admin, or 'bootstrap'
  created_at INTEGER NOT NULL,
  UNIQUE(user_id, role)
);
CREATE INDEX IF NOT EXISTS idx_platform_roles_user_id ON platform_roles(user_id);

PRAGMA foreign_key_check;
PRAGMA quick_check;
