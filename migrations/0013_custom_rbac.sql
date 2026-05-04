-- Sprint 21: custom RBAC foundation.

CREATE TABLE IF NOT EXISTS custom_roles (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  name TEXT NOT NULL,
  permissions_json TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_custom_roles_team ON custom_roles(team_id);

CREATE TABLE IF NOT EXISTS team_role_assignments (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  assigned_by TEXT NOT NULL,
  assigned_at INTEGER NOT NULL,
  UNIQUE(team_id, user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_team_role_assignments_user_team
  ON team_role_assignments(user_id, team_id);
