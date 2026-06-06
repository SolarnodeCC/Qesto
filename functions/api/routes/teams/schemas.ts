// CODE-SPLIT — team request validation schemas (no behavior change).
import { z } from 'zod'

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
