// Proof-aware decoders for team, permission, and role boundaries.

import { z } from 'zod'

// ── Team & Permission Validators ─────────────────────────────────────────────

export const PermissionSchema = z.enum([
  'session:create',
  'session:update',
  'session:launch',
  'session:close',
  'session:archive',
  'session:export',
  'session:moderate',
  'energizer:activate',
  'template:read',
  'template:write',
  'team:manage_members',
  'team:manage_auth',
  'team:read_audit',
  'billing:manage',
  'admin:read',
  'admin:write',
])

export type ValidPermission = z.infer<typeof PermissionSchema>

export const PermissionArraySchema = z.array(PermissionSchema)

export type ValidPermissionArray = z.infer<typeof PermissionArraySchema>

export const RoleSchema = z.enum(['owner', 'admin', 'member', 'viewer'])

export type ValidRole = z.infer<typeof RoleSchema>

// Intentionally excludes 'owner': invite creation never writes owner role,
// so accepting it from KV would allow a crafted entry to grant owner via invite.
export const TeamInviteTokenSchema = z.object({
  teamId: z.string(),
  email: z.string().email(),
  role: z.enum(['admin', 'member', 'viewer']),
})

export type ValidTeamInviteToken = z.infer<typeof TeamInviteTokenSchema>

// ── GDPR / KV team documents ─────────────────────────────────────────────────

export const TeamIdsIndexSchema = z.array(z.string().min(1))

export const TeamDocumentMemberSchema = z.object({
  userId: z.string().min(1),
})

export const TeamDocumentSchema = z.object({
  members: z.array(TeamDocumentMemberSchema).optional(),
})

export type ValidTeamDocument = z.infer<typeof TeamDocumentSchema>
