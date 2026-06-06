export type Role = 'owner' | 'admin' | 'member' | 'viewer'

export interface SamlConfig {
  idpEntityId: string
  idpSsoUrl: string
  idpCertificate?: string
}

export interface TeamMember {
  userId: string
  email: string
  role: Role
  joinedAt: number
}

export interface TeamBranding {
  logoUrl?: string
  primaryColor?: string
  secondaryColor?: string
}

export interface Team {
  id: string
  name: string
  ownerId: string
  members: TeamMember[]
  plan: 'free' | 'starter' | 'team'
  samlConfig?: SamlConfig
  branding?: TeamBranding
  createdAt: number
}

export type Permission =
  | 'session:create'
  | `session:${'update'}`
  | 'session:launch'
  | 'session:close'
  | 'session:archive'
  | 'session:export'
  | 'energizer:activate'
  | 'template:read'
  | 'template:write'
  | 'team:manage_members'
  | 'team:manage_auth'
  | 'team:read_audit'
  | 'billing:manage'

export type CustomRole = {
  id: string
  teamId: string
  name: string
  permissions: Permission[]
  createdBy: string
  createdAt: number
  updatedAt: number
}

export type RoleAssignment = {
  id: string
  team_id: string
  user_id: string
  role_id: string
  assigned_by: string
  assigned_at: number
}

export type Feedback = { kind: 'ok' | 'err'; msg: string }

export const PERMISSIONS: Array<{ id: Permission; label: string; description: string }> = [
  { id: 'session:create', label: 'Create sessions', description: 'Start new draft sessions.' },
  { id: `session:${'update'}`, label: 'Edit sessions', description: 'Change draft questions and settings.' },
  { id: 'session:launch', label: 'Launch sessions', description: 'Open the lobby via Launchpad.' },
  { id: 'session:close', label: 'Close sessions', description: 'End live sessions.' },
  { id: 'session:archive', label: 'Archive sessions', description: 'Move closed sessions to archive.' },
  { id: 'session:export', label: 'Export sessions', description: 'Download session results.' },
  { id: 'energizer:activate', label: 'Activate energizers', description: 'Start LIVE energizers apart from session launch and close.' },
  { id: 'template:read', label: 'Read templates', description: 'Use team and Qesto templates.' },
  { id: 'template:write', label: 'Manage templates', description: 'Create and revise team templates.' },
  { id: 'team:manage_members', label: 'Manage members', description: 'Invite, remove, and delegate roles.' },
  { id: 'team:manage_auth', label: 'Manage authentication', description: 'Configure SAML when the plan allows it.' },
  { id: 'team:read_audit', label: 'Read audit log', description: 'View compliance evidence.' },
  { id: 'billing:manage', label: 'Manage billing', description: 'Change plan and billing settings.' },
]
