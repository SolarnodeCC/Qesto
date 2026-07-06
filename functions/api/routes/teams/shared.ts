// Shared types, KV/membership helpers, validation schemas, and permission guard
// for the team routes. Extracted from the former single-file routes/teams.ts so
// the route groups (crud in index.ts, roles.ts, members.ts) stay focused.

import { z } from 'zod'
import { ulid } from '../../lib/ulid'
import { readKvJson, writeKvJson } from '../../lib/kv'
import { hasTeamPermission, type Permission } from '../../lib/authz'
import { recordAuditEvent } from '../../lib/audit'
import { validateKvJson, PermissionArraySchema } from '../../lib/protocol-schemas'
import { teamDocumentKey, userTeamsIndexKey } from '../../lib/kv-keys'
import type { Env } from '../../types'
import type { AuthVariables } from '../../middleware/auth'
import type { PlanVariables } from '../../middleware/plan'

export type Role = 'owner' | 'admin' | 'member' | 'viewer'

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

export type TeamBranding = {
  logoUrl?: string | null | undefined
  primaryColor?: string | undefined
  secondaryColor?: string | undefined
  /** BRAND-CUSTOM-DOMAINS-COMPLETE — CNAME target join.qesto.cc (DNS at customer). */
  customDomain?: string | null | undefined
}

export type Team = {
  id: string
  name: string
  ownerId: string
  members: TeamMember[]
  plan: 'free' | 'starter' | 'team'
  samlConfig: SamlConfig | null
  branding?: TeamBranding | null
  createdAt: number
  personal?: true
  /**
   * SOVEREIGN+ (ADR-0058) config-as-data tenant residency/exclusion surface.
   * Optional + backward compatible: absent ⇒ default region (`eu-001`), not
   * sovereign. `isSovereign` enables the hard residency boundary + federation/
   * egress exclusion (SOVEREIGN-EXCLUSION-01); `fedrampModerate` reflects the
   * S89 FedRAMP boundary (ADR-0052) for the posture matrix.
   */
  regionId?: string
  isSovereign?: boolean
  fedrampModerate?: boolean
}

export type Vars = AuthVariables & PlanVariables

export type CustomRoleRow = {
  id: string
  team_id: string
  name: string
  permissions_json: string
  created_by: string
  created_at: number
  updated_at: number
}

export type RoleAssignmentRow = {
  id: string
  team_id: string
  user_id: string
  role_id: string
  assigned_by: string
  assigned_at: number
}

// ─── KV helpers ──────────────────────────────────────────────────────────────

export async function loadTeam(kv: KVNamespace, id: string): Promise<Team | null> {
  return readKvJson<Team>(kv, teamDocumentKey(id))
}

export async function saveTeam(kv: KVNamespace, team: Team): Promise<void> {
  await writeKvJson(kv, teamDocumentKey(team.id), team)
}

export async function loadUserTeamIds(kv: KVNamespace, userId: string): Promise<string[]> {
  return (await readKvJson<string[]>(kv, userTeamsIndexKey(userId))) ?? []
}

export async function addUserTeam(kv: KVNamespace, userId: string, teamId: string): Promise<void> {
  const ids = await loadUserTeamIds(kv, userId)
  if (!ids.includes(teamId)) {
    ids.push(teamId)
    await writeKvJson(kv, userTeamsIndexKey(userId), ids)
  }
}

export async function removeUserTeam(kv: KVNamespace, userId: string, teamId: string): Promise<void> {
  const ids = await loadUserTeamIds(kv, userId)
  const filtered = ids.filter((id) => id !== teamId)
  if (filtered.length !== ids.length) {
    await writeKvJson(kv, userTeamsIndexKey(userId), filtered)
  }
}

// ─── Membership helpers ──────────────────────────────────────────────────────

export function findMember(team: Team, userId: string): TeamMember | undefined {
  return team.members.find((m) => m.userId === userId)
}

export function isOwner(team: Team, userId: string): boolean {
  return team.ownerId === userId
}

export function isMemberOrOwner(team: Team, userId: string): boolean {
  return isOwner(team, userId) || team.members.some((m) => m.userId === userId)
}

/**
 * Persist a TENANT (team) role in D1 user_roles so the shared RBAC middleware can
 * enforce team-level route permissions (sessions/teams CRUD). This is team-scoped
 * authority only.
 *
 * SECURITY (#586): this NEVER confers platform-admin authority. Platform admin
 * lives in the separate `platform_roles` table and is checked by adminMiddleware
 * / the rbac admin matrix. Writing 'owner' here (e.g. ensurePersonalTeam on every
 * signup) does not grant access to /api/admin/*.
 */
export async function upsertUserRole(db: D1Database, userId: string, role: Role): Promise<void> {
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

export const CreateTeamSchema = z.object({
  name: z.string().min(1).max(100).trim(),
})

export const SamlConfigSchema = z.object({
  idpEntityId: z.string().min(1).max(512),
  idpSsoUrl: z.string().url().max(1024),
  idpCertificate: z.string().max(16_384).optional(),
})

export const BrandingSchema = z.object({
  logoUrl: z.string().url().max(2048).nullable().optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  customDomain: z
    .string()
    .regex(/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i)
    .max(253)
    .nullable()
    .optional(),
})

export function teamDomainKey(host: string): string {
  return `team-domain:${host.toLowerCase()}`
}

export const PatchTeamSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  samlConfig: SamlConfigSchema.nullable().optional(),
  branding: BrandingSchema.nullable().optional(),
})

export const InviteMemberSchema = z.object({
  email: z.string().email().max(254),
  role: z.enum(['admin', 'member', 'viewer']).default('member'),
})

export const CreateCustomRoleSchema = z.object({
  name: z.string().min(1).max(80).trim(),
  permissions: z.array(z.string()).min(1).max(32),
})

export const PatchCustomRoleSchema = z.object({
  name: z.string().min(1).max(80).trim().optional(),
  permissions: z.array(z.string()).min(1).max(32).optional(),
})

export const AssignRoleSchema = z.object({
  userId: z.string().min(1).max(128),
})

export function roleDto(row: CustomRoleRow): {
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

export type { Env }
