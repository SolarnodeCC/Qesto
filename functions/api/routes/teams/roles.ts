// Custom-role + role-assignment routes for a team (RBAC-CUSTOM-ROLES).
// Registered by mountTeamRoutes (index.ts) onto the team sub-app.

import type { Hono } from 'hono'
import { ulid } from '../../lib/ulid'
import { validatePermissions } from '../../lib/authz'
import { recordAuditEvent } from '../../lib/audit'
import type { Env } from '../../types'
import {
  type Vars,
  type CustomRoleRow,
  type RoleAssignmentRow,
  loadTeam,
  isMemberOrOwner,
  requireTeamPermission,
  roleDto,
  findMember,
  CreateCustomRoleSchema,
  PatchCustomRoleSchema,
  AssignRoleSchema,
} from './shared'

export function registerRoleRoutes(app: Hono<{ Bindings: Env; Variables: Vars }>) {
  // ───────────────────────────────────────────────────────────────────────────
  // GET /api/teams/:id/roles — list custom roles and assignments
  // ───────────────────────────────────────────────────────────────────────────
  app.get('/:id/roles', async (c) => {
    const user = c.get('user')
    const team = await loadTeam(c.env.TEAMS_KV, c.req.param('id'))
    if (!team) {
      return c.json(
        { ok: false, error: { code: 'not_found', message: 'Team not found' }, trace_id: c.get('trace_id') },
        404,
      )
    }
    if (!isMemberOrOwner(team, user.sub)) {
      return c.json(
        { ok: false, error: { code: 'forbidden', message: 'Not a member of this team' }, trace_id: c.get('trace_id') },
        403,
      )
    }

    const [rolesRes, assignmentsRes] = await Promise.all([
      c.env.DB
        .prepare(`SELECT id, team_id, name, permissions_json, created_by, created_at, updated_at FROM custom_roles WHERE team_id = ?1 ORDER BY created_at ASC`)
        .bind(team.id)
        .all<CustomRoleRow>(),
      c.env.DB
        .prepare(`SELECT id, team_id, user_id, role_id, assigned_by, assigned_at FROM team_role_assignments WHERE team_id = ?1 ORDER BY assigned_at ASC`)
        .bind(team.id)
        .all<RoleAssignmentRow>(),
    ])

    return c.json({
      ok: true,
      data: {
        roles: (rolesRes.results ?? []).map(roleDto),
        assignments: assignmentsRes.results ?? [],
      },
      trace_id: c.get('trace_id'),
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // POST /api/teams/:id/roles — create custom role
  // ───────────────────────────────────────────────────────────────────────────
  app.post('/:id/roles', async (c) => {
    const user = c.get('user')
    const team = await loadTeam(c.env.TEAMS_KV, c.req.param('id'))
    if (!team) {
      return c.json(
        { ok: false, error: { code: 'not_found', message: 'Team not found' }, trace_id: c.get('trace_id') },
        404,
      )
    }
    const denied = await requireTeamPermission(c, team, 'team:manage_members', 'Manage members permission required')
    if (denied) return denied

    const body = (await c.req.json().catch(() => null)) as unknown
    const parsed = CreateCustomRoleSchema.safeParse(body)
    const permissions = parsed.success ? validatePermissions(parsed.data.permissions) : null
    if (!parsed.success || !permissions) {
      return c.json(
        { ok: false, error: { code: 'validation', message: 'Invalid custom role payload' }, trace_id: c.get('trace_id') },
        400,
      )
    }

    const now = Date.now()
    const role: CustomRoleRow = {
      id: ulid(),
      team_id: team.id,
      name: parsed.data.name,
      permissions_json: JSON.stringify(permissions),
      created_by: user.sub,
      created_at: now,
      updated_at: now,
    }
    await c.env.DB
      .prepare(
        `INSERT INTO custom_roles (id, team_id, name, permissions_json, created_by, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
      )
      .bind(role.id, role.team_id, role.name, role.permissions_json, role.created_by, role.created_at, role.updated_at)
      .run()
    await recordAuditEvent(c, {
      action: 'team.role.create',
      subject_type: 'custom_role',
      subject_id: role.id,
      after_snapshot: { teamId: team.id, name: role.name, permissions },
    })
    return c.json({ ok: true, data: { role: roleDto(role) }, trace_id: c.get('trace_id') }, 201)
  })

  // ───────────────────────────────────────────────────────────────────────────
  // PATCH /api/teams/:id/roles/:roleId — update custom role
  // ───────────────────────────────────────────────────────────────────────────
  app.patch('/:id/roles/:roleId', async (c) => {
    const team = await loadTeam(c.env.TEAMS_KV, c.req.param('id'))
    if (!team) {
      return c.json(
        { ok: false, error: { code: 'not_found', message: 'Team not found' }, trace_id: c.get('trace_id') },
        404,
      )
    }
    const denied = await requireTeamPermission(c, team, 'team:manage_members', 'Manage members permission required')
    if (denied) return denied

    const current = await c.env.DB
      .prepare(`SELECT id, team_id, name, permissions_json, created_by, created_at, updated_at FROM custom_roles WHERE id = ?1 AND team_id = ?2`)
      .bind(c.req.param('roleId'), team.id)
      .first<CustomRoleRow>()
    if (!current) {
      return c.json(
        { ok: false, error: { code: 'not_found', message: 'Custom role not found' }, trace_id: c.get('trace_id') },
        404,
      )
    }

    const body = (await c.req.json().catch(() => null)) as unknown
    const parsed = PatchCustomRoleSchema.safeParse(body)
    const permissions = parsed.success && parsed.data.permissions !== undefined ? validatePermissions(parsed.data.permissions) : undefined
    if (!parsed.success || permissions === null) {
      return c.json(
        { ok: false, error: { code: 'validation', message: 'Invalid custom role patch' }, trace_id: c.get('trace_id') },
        400,
      )
    }

    const nextName = parsed.data.name ?? current.name
    const nextPermissions = permissions ?? roleDto(current).permissions
    const updatedAt = Date.now()
    await c.env.DB
      .prepare(`UPDATE custom_roles SET name = ?1, permissions_json = ?2, updated_at = ?3 WHERE id = ?4 AND team_id = ?5`)
      .bind(nextName, JSON.stringify(nextPermissions), updatedAt, current.id, team.id)
      .run()
    const next = { ...current, name: nextName, permissions_json: JSON.stringify(nextPermissions), updated_at: updatedAt }
    await recordAuditEvent(c, {
      action: 'team.role.update',
      subject_type: 'custom_role',
      subject_id: current.id,
      before_snapshot: roleDto(current),
      after_snapshot: roleDto(next),
    })
    // #524: explicit role lifecycle event for a role definition change, with
    // before/after values for compliance review.
    await recordAuditEvent(c, {
      action: 'role.changed',
      subject_type: 'custom_role',
      subject_id: current.id,
      before_snapshot: roleDto(current),
      after_snapshot: roleDto(next),
    })
    return c.json({ ok: true, data: { role: roleDto(next) }, trace_id: c.get('trace_id') })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // DELETE /api/teams/:id/roles/:roleId — delete custom role + assignments
  // ───────────────────────────────────────────────────────────────────────────
  app.delete('/:id/roles/:roleId', async (c) => {
    const team = await loadTeam(c.env.TEAMS_KV, c.req.param('id'))
    if (!team) {
      return c.json(
        { ok: false, error: { code: 'not_found', message: 'Team not found' }, trace_id: c.get('trace_id') },
        404,
      )
    }
    const denied = await requireTeamPermission(c, team, 'team:manage_members', 'Manage members permission required')
    if (denied) return denied

    const current = await c.env.DB
      .prepare(`SELECT id, team_id, name, permissions_json, created_by, created_at, updated_at FROM custom_roles WHERE id = ?1 AND team_id = ?2`)
      .bind(c.req.param('roleId'), team.id)
      .first<CustomRoleRow>()
    if (!current) {
      return c.json(
        { ok: false, error: { code: 'not_found', message: 'Custom role not found' }, trace_id: c.get('trace_id') },
        404,
      )
    }
    await c.env.DB.prepare(`DELETE FROM team_role_assignments WHERE role_id = ?1 AND team_id = ?2`).bind(current.id, team.id).run()
    await c.env.DB.prepare(`DELETE FROM custom_roles WHERE id = ?1 AND team_id = ?2`).bind(current.id, team.id).run()
    await recordAuditEvent(c, {
      action: 'team.role.delete',
      subject_type: 'custom_role',
      subject_id: current.id,
      before_snapshot: roleDto(current),
    })
    return c.json({ ok: true, data: { deleted: true, roleId: current.id }, trace_id: c.get('trace_id') })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // POST /api/teams/:id/roles/:roleId/assignments — assign custom role
  // ───────────────────────────────────────────────────────────────────────────
  app.post('/:id/roles/:roleId/assignments', async (c) => {
    const user = c.get('user')
    const team = await loadTeam(c.env.TEAMS_KV, c.req.param('id'))
    if (!team) {
      return c.json(
        { ok: false, error: { code: 'not_found', message: 'Team not found' }, trace_id: c.get('trace_id') },
        404,
      )
    }
    const denied = await requireTeamPermission(c, team, 'team:manage_members', 'Manage members permission required')
    if (denied) return denied

    const role = await c.env.DB
      .prepare(`SELECT id, team_id, name, permissions_json, created_by, created_at, updated_at FROM custom_roles WHERE id = ?1 AND team_id = ?2`)
      .bind(c.req.param('roleId'), team.id)
      .first<CustomRoleRow>()
    if (!role) {
      return c.json(
        { ok: false, error: { code: 'not_found', message: 'Custom role not found' }, trace_id: c.get('trace_id') },
        404,
      )
    }

    const body = (await c.req.json().catch(() => null)) as unknown
    const parsed = AssignRoleSchema.safeParse(body)
    if (!parsed.success || !findMember(team, parsed.data.userId)) {
      return c.json(
        { ok: false, error: { code: 'validation', message: 'Assignment requires an existing team member' }, trace_id: c.get('trace_id') },
        400,
      )
    }

    const assignment: RoleAssignmentRow = {
      id: ulid(),
      team_id: team.id,
      user_id: parsed.data.userId,
      role_id: role.id,
      assigned_by: user.sub,
      assigned_at: Date.now(),
    }
    await c.env.DB
      .prepare(
        `INSERT INTO team_role_assignments (id, team_id, user_id, role_id, assigned_by, assigned_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(team_id, user_id, role_id) DO NOTHING`,
      )
      .bind(assignment.id, assignment.team_id, assignment.user_id, assignment.role_id, assignment.assigned_by, assignment.assigned_at)
      .run()
    await recordAuditEvent(c, {
      action: 'team.role.assign',
      subject_type: 'custom_role_assignment',
      subject_id: assignment.id,
      after_snapshot: { teamId: team.id, roleId: role.id, userId: assignment.user_id },
    })
    // #524: explicit role lifecycle event for the assigned custom role.
    await recordAuditEvent(c, {
      action: 'role.assigned',
      subject_type: 'team_member',
      subject_id: assignment.user_id,
      after_snapshot: { teamId: team.id, roleId: role.id, roleName: role.name, userId: assignment.user_id, via: 'custom_role' },
    })
    return c.json({ ok: true, data: { assignment }, trace_id: c.get('trace_id') }, 201)
  })

  // ───────────────────────────────────────────────────────────────────────────
  // DELETE /api/teams/:id/roles/:roleId/assignments/:userId — unassign custom role
  // ───────────────────────────────────────────────────────────────────────────
  app.delete('/:id/roles/:roleId/assignments/:userId', async (c) => {
    const team = await loadTeam(c.env.TEAMS_KV, c.req.param('id'))
    if (!team) {
      return c.json(
        { ok: false, error: { code: 'not_found', message: 'Team not found' }, trace_id: c.get('trace_id') },
        404,
      )
    }
    const denied = await requireTeamPermission(c, team, 'team:manage_members', 'Manage members permission required')
    if (denied) return denied

    await c.env.DB
      .prepare(`DELETE FROM team_role_assignments WHERE team_id = ?1 AND role_id = ?2 AND user_id = ?3`)
      .bind(team.id, c.req.param('roleId'), c.req.param('userId'))
      .run()
    await recordAuditEvent(c, {
      action: 'team.role.unassign',
      subject_type: 'custom_role_assignment',
      subject_id: `${team.id}:${c.req.param('roleId')}:${c.req.param('userId')}`,
      before_snapshot: { teamId: team.id, roleId: c.req.param('roleId'), userId: c.req.param('userId') },
    })
    // #524: explicit role lifecycle event for the removed custom-role grant.
    await recordAuditEvent(c, {
      action: 'role.removed',
      subject_type: 'team_member',
      subject_id: c.req.param('userId'),
      before_snapshot: { teamId: team.id, roleId: c.req.param('roleId'), userId: c.req.param('userId'), via: 'custom_role' },
    })
    return c.json({ ok: true, data: { removed: true }, trace_id: c.get('trace_id') })
  })
}
