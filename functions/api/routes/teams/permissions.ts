// CODE-SPLIT — shared team permission + DTO helpers (no behavior change).
import { hasTeamPermission, type Permission } from '../../lib/authz'
import { recordAuditEvent } from '../../lib/audit'
import { validateKvJson, PermissionArraySchema } from '../../lib/protocol-schemas'
import type { CustomRoleRow, RoleDto, Team } from './types'

export function roleDto(row: CustomRoleRow): RoleDto {
  const permissions = validateKvJson(row.permissions_json, PermissionArraySchema) ?? []
  return {
    id: row.id,
    teamId: row.team_id,
    name: row.name,
    permissions,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function requireTeamPermission(
  c: any,
  team: Team,
  permission: Permission,
  message: string,
): Promise<Response | null> {
  const user = c.get('user')
  const allowed = await hasTeamPermission(c.env.DB, team, user.sub, permission)
  if (allowed) return null
  await recordAuditEvent(c, {
    action: 'team.permission_denied',
    subject_type: 'team',
    subject_id: team.id,
    after_snapshot: { permission },
  })
  return c.json(
    { ok: false, error: { code: 'forbidden', message }, trace_id: c.get('trace_id') },
    403,
  )
}
