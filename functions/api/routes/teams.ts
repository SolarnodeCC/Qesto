// Team management routes.
//
// Teams live in TEAMS_KV as `team:{id}` → JSON blob, and membership is
// additionally represented in D1's `user_roles` table so the shared RBAC
// middleware (middleware/rbac.ts) can answer per-request permission checks.
//
// Routes (all require auth):
//   POST   /api/teams                       create team (caller → owner)
//   GET    /api/teams                       list teams caller is a member of
//   GET    /api/teams/:id                   fetch team (members only)
//   PATCH  /api/teams/:id                   update name / samlConfig (owner)
//   POST   /api/teams/:id/members           invite member by email (owner/admin)
//   DELETE /api/teams/:id/members/:userId   remove member (owner)
//
// KV shape (TEAMS_KV):
//   team:{teamId}        → Team JSON blob (see Team type below)
//   user-teams:{userId}  → string[] of teamIds for reverse lookup (GET /teams)
//   team-invite:{token}  → { teamId, email, role, createdAt } (1-day TTL)

import { Hono } from 'hono'
import { z } from 'zod'
import { ulid } from '../lib/ulid'
import { generateMagicLinkToken, hashMagicLinkToken } from '../lib/tokens'
import { sendEmail } from '../lib/email'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import { planMiddleware, type PlanVariables } from '../middleware/plan'
import { writeEvent } from '../lib/observability'
import { denyFeature, denyLimit, featureAllowed, maxTeamMembersForPlan } from '../lib/entitlements'
import {
  hasTeamPermission,
  patchAuthzSchemaIfNeeded,
  validatePermissions,
  type Permission,
} from '../lib/authz'
import { recordAuditEvent } from '../lib/audit'
import { readKvJson, writeKvJson } from '../lib/kv'
import { validateBody } from '../lib/validate'
import { validateKvJson, PermissionArraySchema, TeamInviteTokenSchema } from '../lib/validators'
import { TEAM_INVITE_TTL_SECONDS } from '../lib/constants'
import { teamDocumentKey, teamInviteKey, userTeamsIndexKey } from '../lib/kv-keys'
import type { Env } from '../types'
import { safeLogContext } from '../lib/log'

type Role = 'owner' | 'admin' | 'member' | 'viewer'

export type SamlConfig = {
  idpEntityId: string              // IdP's entity ID (issuer)
  idpSsoUrl: string                // IdP's single sign-on URL (HTTP-Redirect binding)
  idpCertificate?: string | undefined // PEM-encoded cert — parsed but not yet used for sig check (SEC-SAML-01)
}

export type TeamMember = {
  userId: string
  email: string
  role: Role
  joinedAt: number
}

export type Team = {
  id: string
  name: string
  ownerId: string
  members: TeamMember[]
  plan: 'free' | 'starter' | 'team'
  samlConfig: SamlConfig | null
  createdAt: number
}

type Vars = AuthVariables & PlanVariables

// ─── KV helpers ──────────────────────────────────────────────────────────────

async function loadTeam(kv: KVNamespace, id: string): Promise<Team | null> {
  return readKvJson<Team>(kv, teamDocumentKey(id))
}

async function saveTeam(kv: KVNamespace, team: Team): Promise<void> {
  await writeKvJson(kv, teamDocumentKey(team.id), team)
}

async function loadUserTeamIds(kv: KVNamespace, userId: string): Promise<string[]> {
  return (await readKvJson<string[]>(kv, userTeamsIndexKey(userId))) ?? []
}

async function addUserTeam(kv: KVNamespace, userId: string, teamId: string): Promise<void> {
  const ids = await loadUserTeamIds(kv, userId)
  if (!ids.includes(teamId)) {
    ids.push(teamId)
    await writeKvJson(kv, userTeamsIndexKey(userId), ids)
  }
}

async function removeUserTeam(kv: KVNamespace, userId: string, teamId: string): Promise<void> {
  const ids = await loadUserTeamIds(kv, userId)
  const filtered = ids.filter((id) => id !== teamId)
  if (filtered.length !== ids.length) {
    await writeKvJson(kv, userTeamsIndexKey(userId), filtered)
  }
}

// ─── Membership helpers ──────────────────────────────────────────────────────

function findMember(team: Team, userId: string): TeamMember | undefined {
  return team.members.find((m) => m.userId === userId)
}

function isOwner(team: Team, userId: string): boolean {
  return team.ownerId === userId
}

function isMemberOrOwner(team: Team, userId: string): boolean {
  return isOwner(team, userId) || team.members.some((m) => m.userId === userId)
}

/**
 * Persist role in D1 user_roles so the shared RBAC middleware can enforce
 * team-level permissions uniformly. Team scoping is out of v1 scope — we only
 * track a global role per user. Owners/admins of any team get owner/admin role.
 */
async function upsertUserRole(db: D1Database, userId: string, role: Role): Promise<void> {
  const id = ulid()
  const now = Date.now()
  // ON CONFLICT(user_id, role) DO NOTHING — role already exists.
  await db
    .prepare(
      `INSERT INTO user_roles (id, user_id, role, created_at)
       VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT(user_id, role) DO NOTHING`,
    )
    .bind(id, userId, role, now)
    .run()
}

// ─── Validation schemas ──────────────────────────────────────────────────────

const CreateTeamSchema = z.object({
  name: z.string().min(1).max(100).trim(),
})

const SamlConfigSchema = z.object({
  idpEntityId: z.string().min(1).max(512),
  idpSsoUrl: z.string().url().max(1024),
  idpCertificate: z.string().max(16_384).optional(),
})

const PatchTeamSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  samlConfig: SamlConfigSchema.nullable().optional(),
})

const InviteMemberSchema = z.object({
  email: z.string().email().max(254),
  role: z.enum(['admin', 'member', 'viewer']).default('member'),
})

const CreateCustomRoleSchema = z.object({
  name: z.string().min(1).max(80).trim(),
  permissions: z.array(z.string()).min(1).max(32),
})

const PatchCustomRoleSchema = z.object({
  name: z.string().min(1).max(80).trim().optional(),
  permissions: z.array(z.string()).min(1).max(32).optional(),
})

const AssignRoleSchema = z.object({
  userId: z.string().min(1).max(128),
})

type CustomRoleRow = {
  id: string
  team_id: string
  name: string
  permissions_json: string
  created_by: string
  created_at: number
  updated_at: number
}

type RoleAssignmentRow = {
  id: string
  team_id: string
  user_id: string
  role_id: string
  assigned_by: string
  assigned_at: number
}

function roleDto(row: CustomRoleRow): {
  id: string
  teamId: string
  name: string
  permissions: Permission[]
  createdBy: string
  createdAt: number
  updatedAt: number
} {
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

async function requireTeamPermission(
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

// ─── Routes ──────────────────────────────────────────────────────────────────

export function mountTeamRoutes(parent: Hono<{ Bindings: Env; Variables: Vars }>) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()

  // All team routes require authentication + plan context.
  app.use('*', authMiddleware)
  app.use('*', planMiddleware)
  app.use('*', async (c, next) => {
    await patchAuthzSchemaIfNeeded(c.env.DB)
    await next()
  })

  // ───────────────────────────────────────────────────────────────────────────
  // POST /api/teams — create team
  // ───────────────────────────────────────────────────────────────────────────
  app.post('/', async (c) => {
    const validated = await validateBody(c, CreateTeamSchema)
    if ('error' in validated) {
      return validated.error
    }
    const { data: body } = validated

    const user = c.get('user')
    const plan = c.get('plan')
    const now = Date.now()
    const team: Team = {
      id: ulid(),
      name: body.name,
      ownerId: user.sub,
      members: [
        { userId: user.sub, email: user.email, role: 'owner', joinedAt: now },
      ],
      plan,
      samlConfig: null,
      createdAt: now,
    }

    await saveTeam(c.env.TEAMS_KV, team)
    await addUserTeam(c.env.TEAMS_KV, user.sub, team.id)
    await upsertUserRole(c.env.DB, user.sub, 'owner')
    await recordAuditEvent(c, {
      action: 'team.create',
      subject_type: 'team',
      subject_id: team.id,
      after_snapshot: { name: team.name, ownerId: team.ownerId },
    })

    writeEvent(c.env.METRICS_AE, {
      name: 'team_created',
      userId: user.sub,
      teamId: team.id,
      plan,
      traceId: c.get('trace_id'),
    })

    return c.json({ ok: true, data: { team }, trace_id: c.get('trace_id') }, 201)
  })

  // ───────────────────────────────────────────────────────────────────────────
  // GET /api/teams — list teams caller belongs to
  // ───────────────────────────────────────────────────────────────────────────
  app.get('/', async (c) => {
    const user = c.get('user')
    const ids = await loadUserTeamIds(c.env.TEAMS_KV, user.sub)
    const teams: Team[] = []
    for (const id of ids) {
      const t = await loadTeam(c.env.TEAMS_KV, id)
      if (t && isMemberOrOwner(t, user.sub)) teams.push(t)
    }
    return c.json({ ok: true, data: { teams }, trace_id: c.get('trace_id') })
  })

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
    return c.json({ ok: true, data: { removed: true }, trace_id: c.get('trace_id') })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // GET /api/teams/:id — fetch single team (member or owner only)
  // ───────────────────────────────────────────────────────────────────────────
  app.get('/:id', async (c) => {
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
    return c.json({ ok: true, data: { team }, trace_id: c.get('trace_id') })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // PATCH /api/teams/:id — update name / samlConfig (owner only)
  // ───────────────────────────────────────────────────────────────────────────
  app.patch('/:id', async (c) => {
    const team = await loadTeam(c.env.TEAMS_KV, c.req.param('id'))
    if (!team) {
      return c.json(
        { ok: false, error: { code: 'not_found', message: 'Team not found' }, trace_id: c.get('trace_id') },
        404,
      )
    }
    const body = (await c.req.json().catch(() => null)) as unknown
    const parsed = PatchTeamSchema.safeParse(body)
    if (!parsed.success) {
      return c.json(
        {
          ok: false,
          error: { code: 'validation', message: 'Invalid patch payload', details: parsed.error.flatten() },
          trace_id: c.get('trace_id'),
        },
        400,
      )
    }

    if (parsed.data.name !== undefined) {
      const denied = await requireTeamPermission(c, team, 'team:manage_members', 'Manage members permission required')
      if (denied) return denied
      team.name = parsed.data.name
    }
    if (parsed.data.samlConfig !== undefined) {
      const denied = await requireTeamPermission(c, team, 'team:manage_auth', 'Manage authentication permission required')
      if (denied) return denied
      const plan = c.get('plan')
      const quotas = c.get('planQuotas')
      if (parsed.data.samlConfig !== null && !featureAllowed(quotas, 'samlSso')) {
        return c.json({ ok: false, error: denyFeature(plan, 'samlSso'), trace_id: c.get('trace_id') }, 403)
      }
      team.samlConfig = parsed.data.samlConfig
    }

    await saveTeam(c.env.TEAMS_KV, team)
    await recordAuditEvent(c, {
      action: 'team.update',
      subject_type: 'team',
      subject_id: team.id,
      after_snapshot: {
        name: team.name,
        samlConfigured: team.samlConfig !== null,
      },
    })
    return c.json({ ok: true, data: { team }, trace_id: c.get('trace_id') })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // POST /api/teams/:id/members — invite member by email
  // Issues a magic-link style invite token; member is added on acceptance.
  // ───────────────────────────────────────────────────────────────────────────
  app.post('/:id/members', async (c) => {
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
    const parsed = InviteMemberSchema.safeParse(body)
    if (!parsed.success) {
      return c.json(
        {
          ok: false,
          error: { code: 'validation', message: 'Invalid invite payload', details: parsed.error.flatten() },
          trace_id: c.get('trace_id'),
        },
        400,
      )
    }

    const email = parsed.data.email.toLowerCase().trim()
    // No-op if already a member.
    if (team.members.some((m) => m.email === email)) {
      return c.json(
        { ok: false, error: { code: 'already_member', message: 'Email is already a team member' }, trace_id: c.get('trace_id') },
        409,
      )
    }
    const plan = c.get('plan')
    const limit = maxTeamMembersForPlan(plan)
    if (team.members.length >= limit) {
      return c.json(
        {
          ok: false,
          error: denyLimit(plan, `Team member limit exceeded for your ${plan} plan`, limit, team.members.length),
          trace_id: c.get('trace_id'),
        },
        403,
      )
    }

    const raw = generateMagicLinkToken()
    const tokenHash = await hashMagicLinkToken(raw)
    await c.env.TEAMS_KV.put(
      teamInviteKey(tokenHash),
      JSON.stringify({ teamId: team.id, email, role: parsed.data.role, createdAt: Date.now() }),
      { expirationTtl: TEAM_INVITE_TTL_SECONDS },
    )

    const inviteUrl = `${c.env.PAGES_URL}/teams/accept?token=${raw}`
    try {
      await sendEmail(c.env.RESEND_API_KEY, {
        to: email,
        subject: `You've been invited to ${team.name} on Qesto`,
        text: `${user.email} invited you to join ${team.name} on Qesto.\n\nAccept the invite (valid 24 hours):\n${inviteUrl}`,
        html: `<p><strong>${user.email}</strong> invited you to join <strong>${team.name}</strong> on Qesto.</p><p>The invite is valid for 24 hours.</p><p><a href="${inviteUrl}">Accept invite</a></p>`,
      })
    } catch (err) {
      safeLogContext(err, { traceId: c.get('trace_id') ?? 'unknown', route: '[teams] invite/email', errorClass: err instanceof Error ? err.name : 'UnknownError' })
    }
    await recordAuditEvent(c, {
      action: 'team.role.assign',
      subject_type: 'team_invite',
      subject_id: team.id,
      after_snapshot: { role: parsed.data.role, invited: true },
    })

    return c.json(
      { ok: true, data: { invited: true, email, role: parsed.data.role }, trace_id: c.get('trace_id') },
      202,
    )
  })

  // ───────────────────────────────────────────────────────────────────────────
  // DELETE /api/teams/:id/members/:userId — remove member (owner only)
  // ───────────────────────────────────────────────────────────────────────────
  app.delete('/:id/members/:userId', async (c) => {
    const targetId = c.req.param('userId')
    const team = await loadTeam(c.env.TEAMS_KV, c.req.param('id'))
    if (!team) {
      return c.json(
        { ok: false, error: { code: 'not_found', message: 'Team not found' }, trace_id: c.get('trace_id') },
        404,
      )
    }
    const denied = await requireTeamPermission(c, team, 'team:manage_members', 'Manage members permission required')
    if (denied) return denied
    if (targetId === team.ownerId) {
      return c.json(
        { ok: false, error: { code: 'invalid_target', message: 'Cannot remove the team owner' }, trace_id: c.get('trace_id') },
        400,
      )
    }

    const before = team.members.length
    team.members = team.members.filter((m) => m.userId !== targetId)
    if (team.members.length === before) {
      return c.json(
        { ok: false, error: { code: 'not_found', message: 'User is not a member of this team' }, trace_id: c.get('trace_id') },
        404,
      )
    }

    await saveTeam(c.env.TEAMS_KV, team)
    await removeUserTeam(c.env.TEAMS_KV, targetId, team.id)
    await recordAuditEvent(c, {
      action: 'team.role.unassign',
      subject_type: 'team_member',
      subject_id: targetId,
      before_snapshot: { teamId: team.id },
    })

    return c.json({ ok: true, data: { removed: true, userId: targetId }, trace_id: c.get('trace_id') })
  })

  parent.route('/api/teams', app)
}

// ─── Internal helpers used by the SAML acceptance flow (routes/auth/saml.ts) ─

/**
 * Attach a user to a team (called when a SAML callback or invite acceptance
 * successfully identifies the team + user). Idempotent.
 */
export async function attachUserToTeam(
  kv: KVNamespace,
  db: D1Database,
  teamId: string,
  userId: string,
  email: string,
  role: Role = 'member',
): Promise<void> {
  const team = await loadTeam(kv, teamId)
  if (!team) return
  if (!team.members.some((m) => m.userId === userId)) {
    team.members.push({ userId, email, role, joinedAt: Date.now() })
    await saveTeam(kv, team)
    await addUserTeam(kv, userId, teamId)
  }
  await upsertUserRole(db, userId, role)
}

export async function consumeInvite(
  kv: KVNamespace,
  tokenHash: string,
): Promise<{ teamId: string; email: string; role: Role } | null> {
  const raw = await kv.get(teamInviteKey(tokenHash))
  if (!raw) return null
  await kv.delete(teamInviteKey(tokenHash))
  const invite = validateKvJson(raw, TeamInviteTokenSchema)
  if (!invite) return null
  return { teamId: invite.teamId, email: invite.email, role: invite.role as Role }
}

export { loadTeam, saveTeam }
