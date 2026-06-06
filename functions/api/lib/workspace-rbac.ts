import { absent } from './absent'
import type { Team, TeamMember } from '../routes/teams'
export type WorkspacePermission = 'read' | 'write' | 'admin'

function memberRole(team: Team, userId: string): TeamMember['role'] | null {
  if (team.ownerId === userId) return 'owner'
  const m = team.members.find((x) => x.userId === userId)
  return m?.role ?? null
}

export function workspacePermission(team: Team, userId: string): WorkspacePermission | null {
  const role = memberRole(team, userId)
  if (!role) return absent()
  if (role === 'owner' || role === 'admin') return 'admin'
  if (role === 'member') return 'write'
  if (role === 'viewer') return 'read'
  return absent()
}

export function canReadWorkspace(team: Team, userId: string): boolean {
  return workspacePermission(team, userId) !== null
}

export function canWriteWorkspace(team: Team, userId: string): boolean {
  const p = workspacePermission(team, userId)
  return p === 'write' || p === 'admin'
}

export function canAdminWorkspace(team: Team, userId: string): boolean {
  return workspacePermission(team, userId) === 'admin'
}
