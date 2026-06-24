import type { Team } from '../routes/teams'
import { validateData, PermissionSchema, PermissionArraySchema } from './protocol-schemas'

// Derived from PermissionSchema — single source of truth, no manual drift possible
import { z } from 'zod'
export type Permission = z.infer<typeof PermissionSchema>

const ALL_TEAM_PERMISSIONS: Permission[] = [
  'session:create',
  'session:update',
  'session:launch',
  'session:close',
  'session:moderate',
  'session:archive',
  'session:export',
  'energizer:activate',
  'template:read',
  'template:write',
  'team:manage_members',
  'team:manage_auth',
  'team:read_audit',
  'billing:manage',
]

export const BUILTIN_ROLE_PERMISSIONS: Record<string, Permission[]> = {
  owner: ALL_TEAM_PERMISSIONS,
  admin: ALL_TEAM_PERMISSIONS.filter((permission) => permission !== 'billing:manage'),
  member: ['session:create', 'session:update', 'session:launch', 'session:close', 'session:moderate', 'template:read'],
  viewer: ['template:read'],
}

export const KNOWN_PERMISSIONS = new Set<Permission>([
  ...ALL_TEAM_PERMISSIONS,
  'admin:read',
  'admin:write',
])

type CustomRolePermissionRow = {
  permissions_json: string
}

function parsePermissions(value: string): Permission[] {
  try {
    const parsed = JSON.parse(value)
    const validated = validateData(parsed, PermissionArraySchema)
    return validated || []
  } catch {
    return []
  }
}

export async function patchAuthzSchemaIfNeeded(db: D1Database): Promise<void> {
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS custom_roles (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL,
      name TEXT NOT NULL,
      permissions_json TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
  ).run().catch(() => {})
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_custom_roles_team ON custom_roles(team_id)`).run().catch(() => {})
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS team_role_assignments (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role_id TEXT NOT NULL,
      assigned_by TEXT NOT NULL,
      assigned_at INTEGER NOT NULL,
      UNIQUE(team_id, user_id, role_id)
    )`,
  ).run().catch(() => {})
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_team_role_assignments_user_team ON team_role_assignments(user_id, team_id)`).run().catch(() => {})
}

export async function customPermissionsForUser(
  db: D1Database,
  teamId: string,
  userId: string,
): Promise<Permission[]> {
  const { results } = await db
    .prepare(
      `SELECT cr.permissions_json
         FROM custom_roles cr
         INNER JOIN team_role_assignments tra ON tra.role_id = cr.id
        WHERE tra.team_id = ?1 AND tra.user_id = ?2`,
    )
    .bind(teamId, userId)
    .all<CustomRolePermissionRow>()
  return [...new Set((results ?? []).flatMap((row) => parsePermissions(row.permissions_json)))]
}

export async function effectiveTeamPermissionsForUser(
  db: D1Database,
  team: Team,
  userId: string,
): Promise<Permission[]> {
  const member = team.members.find((entry) => entry.userId === userId)
  if (!member) return []
  const builtIn = BUILTIN_ROLE_PERMISSIONS[member.role] ?? []
  const custom = await customPermissionsForUser(db, team.id, userId)
  return [...new Set([...builtIn, ...custom])]
}

export async function hasTeamPermission(
  db: D1Database,
  team: Team,
  userId: string,
  permission: Permission,
): Promise<boolean> {
  const member = team.members.find((entry) => entry.userId === userId)
  if (!member) return false
  const permissions = await effectiveTeamPermissionsForUser(db, team, userId)
  return permissions.includes(permission)
}

export function validatePermissions(input: unknown): Permission[] | null {
  const validated = validateData(input, PermissionArraySchema)
  if (!validated) return null
  return [...new Set(validated)] as Permission[]
}
