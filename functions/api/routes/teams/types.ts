// CODE-SPLIT — shared team route types (no behavior change).
import type { Hono } from 'hono'
import type { AuthVariables } from '../../middleware/auth'
import type { PlanVariables } from '../../middleware/plan'
import type { Permission } from '../../lib/authz'
import type { Env } from '../../types'

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
}

export type Vars = AuthVariables & PlanVariables

export type TeamsApp = Hono<{ Bindings: Env; Variables: Vars }>

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

export type RoleDto = {
  id: string
  teamId: string
  name: string
  permissions: Permission[]
  createdBy: string
  createdAt: number
  updatedAt: number
}
