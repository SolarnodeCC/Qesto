import { useState, useEffect, useRef } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useT } from '../i18n'
import { api } from '../api/client'
import MainLayout from '../layouts/MainLayout'
import { TeamIntegrations } from './team-settings/TeamIntegrations'
import { RoleBadge } from './team-settings/RoleBadge'
import { GeneralSection } from './team-settings/GeneralSection'
import { MembersSection } from './team-settings/MembersSection'
import { CustomRolesSection } from './team-settings/CustomRolesSection'
import { InviteSection } from './team-settings/InviteSection'
import { SamlSection } from './team-settings/SamlSection'
import { BrandingSection } from './team-settings/BrandingSection'
import type {
  Team,
  CustomRole,
  RoleAssignment,
  Permission,
  Feedback,
} from './team-settings/types'

export default function TeamSettings() {
  const { id } = useParams<{ id: string }>()
  const auth = useAuth()
  const t = useT('sessions')
  const tTeam = useT('team')

  const [team, setTeam] = useState<Team | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // General section state
  const [teamName, setTeamName] = useState('')
  const [nameSaving, setNameSaving] = useState(false)
  const [nameFeedback, setNameFeedback] = useState<Feedback | null>(null)

  // Invite section state
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'member' | 'viewer'>('member')
  const [inviting, setInviting] = useState(false)
  const [inviteFeedback, setInviteFeedback] = useState<Feedback | null>(null)

  // Remove member state
  const [removingId, setRemovingId] = useState<string | null>(null)

  // Custom role section state
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([])
  const [roleAssignments, setRoleAssignments] = useState<RoleAssignment[]>([])
  const [rolesLoading, setRolesLoading] = useState(false)
  const [roleName, setRoleName] = useState('')
  const [selectedPermissions, setSelectedPermissions] = useState<Permission[]>(['template:read'])
  const [roleSaving, setRoleSaving] = useState(false)
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null)
  const [roleFeedback, setRoleFeedback] = useState<Feedback | null>(null)
  const [assigningRoleId, setAssigningRoleId] = useState<string>('')
  const [assigningUserId, setAssigningUserId] = useState<string>('')

  // SAML section state
  const [samlEntityId, setSamlEntityId] = useState('')
  const [samlSsoUrl, setSamlSsoUrl] = useState('')
  const [samlSaving, setSamlSaving] = useState(false)
  const [samlFeedback, setSamlFeedback] = useState<Feedback | null>(null)

  const h1Ref = useRef<HTMLHeadingElement>(null)

  // ── Load team on mount ────────────────────────────────────────────────────

  useEffect(() => {
    if (!id) return
    setLoading(true)
    void api<{ team: Team }>(`/api/teams/${id}`)
      .then((res) => {
        if (res.ok) {
          setTeam(res.data.team)
          setTeamName(res.data.team.name)
          setAssigningUserId(res.data.team.members.find((m) => m.userId !== res.data.team.ownerId)?.userId ?? '')
          if (res.data.team.samlConfig) {
            setSamlEntityId(res.data.team.samlConfig.idpEntityId)
            setSamlSsoUrl(res.data.team.samlConfig.idpSsoUrl)
          }
          setRolesLoading(true)
          void api<{ roles: CustomRole[]; assignments: RoleAssignment[] }>(`/api/teams/${res.data.team.id}/roles`)
            .then((rolesRes) => {
              if (rolesRes.ok) {
                setCustomRoles(rolesRes.data.roles)
                setRoleAssignments(rolesRes.data.assignments)
                setAssigningRoleId(rolesRes.data.roles[0]?.id ?? '')
              }
            })
            .finally(() => setRolesLoading(false))
        } else {
          setLoadError(res.error.message)
        }
      })
      .finally(() => setLoading(false))
  }, [id])

  // ── Guard: redirect unauthenticated users ─────────────────────────────────

  if (auth.status === 'loading') {
    return (
      <MainLayout mainClassName="min-h-screen max-w-2xl mx-auto p-12">
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-pulse-200 skeleton-shimmer" aria-hidden="true" />
          ))}
        </div>
      </MainLayout>
    )
  }
  if (auth.status === 'anonymous') {
    return <Navigate to="/login" replace />
  }

  const currentUserId = auth.user.id
  const isOwner = team?.ownerId === currentUserId
  const currentMember = team?.members.find((m) => m.userId === currentUserId)
  const canManageMembers =
    currentMember?.role === 'owner' ||
    currentMember?.role === 'admin' ||
    customRoles.some(
      (role) =>
        role.permissions.includes('team:manage_members') &&
        roleAssignments.some((a) => a.role_id === role.id && a.user_id === currentUserId),
    )

  // ── Handlers ───────────────────────────────────────────────────────────────

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault()
    if (!id || !team) return
    const trimmed = teamName.trim()
    if (!trimmed || trimmed === team.name) return
    setNameSaving(true)
    setNameFeedback(null)
    const res = await api<{ team: Team }>(`/api/teams/${id}`, { method: 'PATCH', body: { name: trimmed } })
    setNameSaving(false)
    if (res.ok) {
      setTeam(res.data.team)
      setNameFeedback({ kind: 'ok', msg: 'Team name saved.' })
    } else {
      setNameFeedback({ kind: 'err', msg: res.error.message })
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!id) return
    const email = inviteEmail.trim()
    if (!email) return
    setInviting(true)
    setInviteFeedback(null)
    const res = await api<{ invited: boolean; email: string }>(`/api/teams/${id}/members`, {
      method: 'POST',
      body: { email, role: inviteRole },
    })
    setInviting(false)
    if (res.ok) {
      setInviteEmail('')
      setInviteFeedback({ kind: 'ok', msg: `Invite sent to ${res.data.email}.` })
    } else {
      setInviteFeedback({ kind: 'err', msg: res.error.message })
    }
  }

  async function handleRemoveMember(userId: string) {
    if (!id || !team) return
    setRemovingId(userId)
    const res = await api<{ removed: boolean }>(`/api/teams/${id}/members/${userId}`, { method: 'DELETE' })
    setRemovingId(null)
    if (res.ok) {
      setTeam({ ...team, members: team.members.filter((m) => m.userId !== userId) })
    }
  }

  function resetRoleForm() {
    setRoleName('')
    setSelectedPermissions(['template:read'])
    setEditingRoleId(null)
  }

  function togglePermission(permission: Permission) {
    setSelectedPermissions((current) =>
      current.includes(permission) ? current.filter((p) => p !== permission) : [...current, permission],
    )
  }

  function editRole(role: CustomRole) {
    setEditingRoleId(role.id)
    setRoleName(role.name)
    setSelectedPermissions(role.permissions.length > 0 ? role.permissions : ['template:read'])
    setRoleFeedback(null)
    h1Ref.current?.focus()
  }

  async function handleSaveCustomRole(e: React.FormEvent) {
    e.preventDefault()
    if (!id || selectedPermissions.length === 0) return
    const trimmed = roleName.trim()
    if (!trimmed) return
    setRoleSaving(true)
    setRoleFeedback(null)
    const endpoint = editingRoleId ? `/api/teams/${id}/roles/${editingRoleId}` : `/api/teams/${id}/roles`
    const res = await api<{ role: CustomRole }>(endpoint, {
      method: editingRoleId ? 'PATCH' : 'POST',
      body: { name: trimmed, permissions: selectedPermissions },
    })
    setRoleSaving(false)
    if (res.ok) {
      setCustomRoles((roles) =>
        editingRoleId ? roles.map((r) => (r.id === res.data.role.id ? res.data.role : r)) : [...roles, res.data.role],
      )
      setAssigningRoleId((current) => current || res.data.role.id)
      resetRoleForm()
      setRoleFeedback({ kind: 'ok', msg: editingRoleId ? 'Custom role updated.' : 'Custom role created.' })
    } else {
      const prefix = res.error.code === 'forbidden' ? 'Permission denied: ' : ''
      setRoleFeedback({ kind: 'err', msg: `${prefix}${res.error.message}` })
    }
  }

  async function handleDeleteCustomRole(roleId: string) {
    if (!id) return
    setRoleSaving(true)
    setRoleFeedback(null)
    const res = await api<{ deleted: boolean; roleId: string }>(`/api/teams/${id}/roles/${roleId}`, { method: 'DELETE' })
    setRoleSaving(false)
    if (res.ok) {
      setCustomRoles((roles) => roles.filter((r) => r.id !== res.data.roleId))
      setRoleAssignments((assignments) => assignments.filter((a) => a.role_id !== res.data.roleId))
      if (editingRoleId === res.data.roleId) resetRoleForm()
      setRoleFeedback({ kind: 'ok', msg: 'Custom role deleted.' })
    } else {
      setRoleFeedback({ kind: 'err', msg: res.error.message })
    }
  }

  async function handleAssignCustomRole(e: React.FormEvent) {
    e.preventDefault()
    if (!id || !assigningRoleId || !assigningUserId) return
    setRoleSaving(true)
    setRoleFeedback(null)
    const res = await api<{ assignment: RoleAssignment }>(`/api/teams/${id}/roles/${assigningRoleId}/assignments`, {
      method: 'POST',
      body: { userId: assigningUserId },
    })
    setRoleSaving(false)
    if (res.ok) {
      setRoleAssignments((assignments) => {
        const exists = assignments.some(
          (a) => a.role_id === res.data.assignment.role_id && a.user_id === res.data.assignment.user_id,
        )
        return exists ? assignments : [...assignments, res.data.assignment]
      })
      setRoleFeedback({ kind: 'ok', msg: 'Role assigned.' })
    } else {
      setRoleFeedback({ kind: 'err', msg: res.error.message })
    }
  }

  async function handleUnassignCustomRole(roleId: string, userId: string) {
    if (!id) return
    setRoleSaving(true)
    setRoleFeedback(null)
    const res = await api<{ removed: boolean }>(`/api/teams/${id}/roles/${roleId}/assignments/${userId}`, { method: 'DELETE' })
    setRoleSaving(false)
    if (res.ok) {
      setRoleAssignments((assignments) => assignments.filter((a) => a.role_id !== roleId || a.user_id !== userId))
      setRoleFeedback({ kind: 'ok', msg: 'Role unassigned.' })
    } else {
      setRoleFeedback({ kind: 'err', msg: res.error.message })
    }
  }

  async function handleSaveSaml(e: React.FormEvent) {
    e.preventDefault()
    if (!id) return
    const entityId = samlEntityId.trim()
    const ssoUrl = samlSsoUrl.trim()
    if (!entityId || !ssoUrl) return
    setSamlSaving(true)
    setSamlFeedback(null)
    const res = await api<{ team: Team }>(`/api/teams/${id}`, {
      method: 'PATCH',
      body: { samlConfig: { idpEntityId: entityId, idpSsoUrl: ssoUrl } },
    })
    setSamlSaving(false)
    if (res.ok) {
      setTeam(res.data.team)
      setSamlFeedback({ kind: 'ok', msg: 'SAML configuration saved.' })
    } else {
      setSamlFeedback({ kind: 'err', msg: res.error.message })
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const navSlot = (
    <button
      type="button"
      onClick={() => void auth.logout()}
      className="text-sm text-teal-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 rounded"
    >
      Sign out
    </button>
  )

  if (loading) {
    return (
      <MainLayout navSlot={navSlot} mainClassName="min-h-screen max-w-2xl mx-auto p-12">
        <div className="space-y-4 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-pulse-200" aria-hidden="true" />
          ))}
        </div>
      </MainLayout>
    )
  }

  if (loadError || !team) {
    return (
      <MainLayout navSlot={navSlot} mainClassName="min-h-screen max-w-2xl mx-auto p-12">
        <p role="alert" className="text-red-600">
          {loadError ?? 'Team not found.'}
        </p>
      </MainLayout>
    )
  }

  return (
    <MainLayout navSlot={navSlot} mainClassName="min-h-screen max-w-2xl mx-auto density-pad-8 density-stack-10">
      <div className="animate-page-enter density-stack-10">
        <div>
          <h1 ref={h1Ref} tabIndex={-1} className="text-3xl font-semibold focus:outline-none">
            Team settings
          </h1>
          <p className="text-sm text-pulse-500 mt-1">
            {team.name}
            {currentMember ? (
              <> &middot; you are a <RoleBadge role={currentMember.role} /></>
            ) : null}
          </p>
        </div>

        <GeneralSection
          teamName={teamName}
          setTeamName={setTeamName}
          nameSaving={nameSaving}
          nameFeedback={nameFeedback}
          isOwner={!!isOwner}
          savedName={team.name}
          onSave={handleSaveName}
        />

        <MembersSection
          members={team.members}
          currentUserId={currentUserId}
          isOwner={!!isOwner}
          ownerId={team.ownerId}
          removingId={removingId}
          onRemove={handleRemoveMember}
        />

        <CustomRolesSection
          customRoles={customRoles}
          roleAssignments={roleAssignments}
          rolesLoading={rolesLoading}
          team={team}
          canManageMembers={canManageMembers}
          roleName={roleName}
          setRoleName={setRoleName}
          selectedPermissions={selectedPermissions}
          roleSaving={roleSaving}
          editingRoleId={editingRoleId}
          roleFeedback={roleFeedback}
          assigningRoleId={assigningRoleId}
          setAssigningRoleId={setAssigningRoleId}
          assigningUserId={assigningUserId}
          setAssigningUserId={setAssigningUserId}
          customRolesTitle={t('customRolesTitle')}
          customRolesEmpty={t('customRolesEmpty')}
          customRolesChooseMember={t('customRolesChooseMember')}
          onSaveRole={handleSaveCustomRole}
          onDeleteRole={handleDeleteCustomRole}
          onEditRole={editRole}
          onResetRoleForm={resetRoleForm}
          onTogglePermission={togglePermission}
          onAssignRole={handleAssignCustomRole}
          onUnassignRole={handleUnassignCustomRole}
        />

        <InviteSection
          inviteEmail={inviteEmail}
          setInviteEmail={setInviteEmail}
          inviteRole={inviteRole}
          setInviteRole={setInviteRole}
          inviting={inviting}
          inviteFeedback={inviteFeedback}
          inviteMemberLabel={t('inviteMember')}
          onInvite={handleInvite}
        />

        {isOwner && (
          <SamlSection
            samlEntityId={samlEntityId}
            setSamlEntityId={setSamlEntityId}
            samlSsoUrl={samlSsoUrl}
            setSamlSsoUrl={setSamlSsoUrl}
            samlSaving={samlSaving}
            samlFeedback={samlFeedback}
            samlConfigLabel={t('samlConfiguration')}
            onSave={handleSaveSaml}
          />
        )}

        <BrandingSection
          team={team}
          teamId={id ?? ''}
          brandingDescription={tTeam('branding_description')}
          onTeamUpdate={setTeam}
        />

        <TeamIntegrations teamId={id} />
      </div>
    </MainLayout>
  )
}
