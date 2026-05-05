import { useState, useEffect, useRef } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useT } from '../i18n'
import { api } from '../api/client'
import MainLayout from '../layouts/MainLayout'

// ─── Types matching the backend Team shape ────────────────────────────────────

type Role = 'owner' | 'admin' | 'member' | 'viewer'

interface SamlConfig {
  idpEntityId: string
  idpSsoUrl: string
  idpCertificate?: string
}

interface TeamMember {
  userId: string
  email: string
  role: Role
  joinedAt: number
}

interface Team {
  id: string
  name: string
  ownerId: string
  members: TeamMember[]
  plan: 'free' | 'starter' | 'team'
  samlConfig: SamlConfig | null
  createdAt: number
}

type Permission =
  | 'session:create'
  | 'session:update'
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

type CustomRole = {
  id: string
  teamId: string
  name: string
  permissions: Permission[]
  createdBy: string
  createdAt: number
  updatedAt: number
}

type RoleAssignment = {
  id: string
  team_id: string
  user_id: string
  role_id: string
  assigned_by: string
  assigned_at: number
}

const PERMISSIONS: Array<{ id: Permission; label: string; description: string }> = [
  { id: 'session:create', label: 'Create sessions', description: 'Start new draft sessions.' },
  { id: 'session:update', label: 'Edit sessions', description: 'Change draft questions and settings.' },
  { id: 'session:launch', label: 'Launch sessions', description: 'Open the lobby from Launchpad.' },
  { id: 'session:close', label: 'Close sessions', description: 'End live sessions.' },
  { id: 'session:archive', label: 'Archive sessions', description: 'Move closed sessions to archive.' },
  { id: 'session:export', label: 'Export sessions', description: 'Download session results.' },
  { id: 'energizer:activate', label: 'Activate energizers', description: 'Start LIVE energizers separately from session launch and close.' },
  { id: 'template:read', label: 'Read templates', description: 'Use team and Qesto templates.' },
  { id: 'template:write', label: 'Manage templates', description: 'Create and update team templates.' },
  { id: 'team:manage_members', label: 'Manage members', description: 'Invite, remove, and delegate roles.' },
  { id: 'team:manage_auth', label: 'Manage authentication', description: 'Configure SAML when the plan allows it.' },
  { id: 'team:read_audit', label: 'Read audit log', description: 'View compliance evidence.' },
  { id: 'billing:manage', label: 'Manage billing', description: 'Change plan and billing settings.' },
]

// ─── Role badge ───────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: Role }) {
  const colours: Record<Role, string> = {
    owner: 'bg-violet-100 text-violet-700',
    admin: 'bg-teal-100 text-teal-700',
    member: 'bg-pulse-100 text-pulse-600',
    viewer: 'bg-pulse-100 text-pulse-500',
  }
  return (
    <span
      className={`inline-block text-xs uppercase tracking-wider rounded-full px-2 py-0.5 ${colours[role]}`}
    >
      {role}
    </span>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TeamSettings() {
  const { id } = useParams<{ id: string }>()
  const auth = useAuth()
  const t = useT('sessions')

  const [team, setTeam] = useState<Team | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // General section state
  const [teamName, setTeamName] = useState('')
  const [nameSaving, setNameSaving] = useState(false)
  const [nameFeedback, setNameFeedback] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null)

  // Invite section state
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'member' | 'viewer'>('member')
  const [inviting, setInviting] = useState(false)
  const [inviteFeedback, setInviteFeedback] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null)

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
  const [roleFeedback, setRoleFeedback] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null)
  const [assigningRoleId, setAssigningRoleId] = useState<string>('')
  const [assigningUserId, setAssigningUserId] = useState<string>('')

  // SAML section state
  const [samlEntityId, setSamlEntityId] = useState('')
  const [samlSsoUrl, setSamlSsoUrl] = useState('')
  const [samlSaving, setSamlSaving] = useState(false)
  const [samlFeedback, setSamlFeedback] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null)

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
          setAssigningUserId(res.data.team.members.find((member) => member.userId !== res.data.team.ownerId)?.userId ?? '')
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
      <MainLayout mainClassName="min-h-screen max-w-2xl mx-auto p-8">
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
  const canManageMembers = currentMember?.role === 'owner' || currentMember?.role === 'admin' || customRoles.some(
    (role) =>
      role.permissions.includes('team:manage_members') &&
      roleAssignments.some((assignment) => assignment.role_id === role.id && assignment.user_id === currentUserId),
  )

  // ── Handlers ───────────────────────────────────────────────────────────────

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault()
    if (!id || !team) return
    const trimmed = teamName.trim()
    if (!trimmed || trimmed === team.name) return
    setNameSaving(true)
    setNameFeedback(null)
    const res = await api<{ team: Team }>(`/api/teams/${id}`, {
      method: 'PATCH',
      body: { name: trimmed },
    })
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
    const res = await api<{ removed: boolean }>(`/api/teams/${id}/members/${userId}`, {
      method: 'DELETE',
    })
    setRemovingId(null)
    if (res.ok) {
      setTeam({
        ...team,
        members: team.members.filter((m) => m.userId !== userId),
      })
    }
  }

  function resetRoleForm() {
    setRoleName('')
    setSelectedPermissions(['template:read'])
    setEditingRoleId(null)
  }

  function togglePermission(permission: Permission) {
    setSelectedPermissions((current) =>
      current.includes(permission)
        ? current.filter((item) => item !== permission)
        : [...current, permission],
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
    const endpoint = editingRoleId
      ? `/api/teams/${id}/roles/${editingRoleId}`
      : `/api/teams/${id}/roles`
    const res = await api<{ role: CustomRole }>(endpoint, {
      method: editingRoleId ? 'PATCH' : 'POST',
      body: { name: trimmed, permissions: selectedPermissions },
    })
    setRoleSaving(false)
    if (res.ok) {
      setCustomRoles((roles) =>
        editingRoleId
          ? roles.map((role) => (role.id === res.data.role.id ? res.data.role : role))
          : [...roles, res.data.role],
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
    const res = await api<{ deleted: boolean; roleId: string }>(`/api/teams/${id}/roles/${roleId}`, {
      method: 'DELETE',
    })
    setRoleSaving(false)
    if (res.ok) {
      setCustomRoles((roles) => roles.filter((role) => role.id !== res.data.roleId))
      setRoleAssignments((assignments) => assignments.filter((assignment) => assignment.role_id !== res.data.roleId))
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
          (assignment) =>
            assignment.role_id === res.data.assignment.role_id &&
            assignment.user_id === res.data.assignment.user_id,
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
    const res = await api<{ removed: boolean }>(`/api/teams/${id}/roles/${roleId}/assignments/${userId}`, {
      method: 'DELETE',
    })
    setRoleSaving(false)
    if (res.ok) {
      setRoleAssignments((assignments) =>
        assignments.filter((assignment) => assignment.role_id !== roleId || assignment.user_id !== userId),
      )
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
      body: {
        samlConfig: { idpEntityId: entityId, idpSsoUrl: ssoUrl },
      },
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
      <MainLayout navSlot={navSlot} mainClassName="min-h-screen max-w-2xl mx-auto p-8">
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
      <MainLayout navSlot={navSlot} mainClassName="min-h-screen max-w-2xl mx-auto p-8">
        <p role="alert" className="text-red-600">
          {loadError ?? 'Team not found.'}
        </p>
      </MainLayout>
    )
  }

  return (
    <MainLayout navSlot={navSlot} mainClassName="min-h-screen max-w-2xl mx-auto p-8 space-y-10">
      <div className="animate-page-enter space-y-10">
        <div>
          <h1
            ref={h1Ref}
            tabIndex={-1}
            className="text-3xl font-semibold focus:outline-none"
          >
            Team settings
          </h1>
          <p className="text-sm text-pulse-500 mt-1">
            {team.name}
            {currentMember ? (
              <> &middot; you are a <RoleBadge role={currentMember.role} /></>
            ) : null}
          </p>
        </div>

        {/* ── General ──────────────────────────────────────────────────────── */}
        <section aria-labelledby="section-general" className="space-y-4 rounded-xl border border-pulse-200 p-6">
          <h2 id="section-general" className="text-lg font-semibold">General</h2>
          <form onSubmit={(e) => void handleSaveName(e)} className="flex flex-col gap-3">
            <label htmlFor="team-name" className="text-sm font-medium">
              Team name
            </label>
            <input
              id="team-name"
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              maxLength={100}
              disabled={!isOwner || nameSaving}
              className="border border-pulse-300 rounded-lg px-3 py-2 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200 disabled:bg-pulse-50 disabled:text-pulse-500"
            />
            {nameFeedback ? (
              <p
                role="alert"
                className={`text-sm ${nameFeedback.kind === 'ok' ? 'text-teal-600' : 'text-red-600'}`}
              >
                {nameFeedback.msg}
              </p>
            ) : null}
            {isOwner && (
              <button
                type="submit"
                disabled={nameSaving || teamName.trim() === team.name || teamName.trim().length === 0}
                className="self-start inline-flex items-center rounded-lg bg-gradient-to-br from-teal-500 to-violet-600 text-white px-4 py-2 font-medium hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
              >
                {nameSaving ? 'Saving…' : 'Save name'}
              </button>
            )}
          </form>
        </section>

        {/* ── Members ───────────────────────────────────────────────────────── */}
        <section aria-labelledby="section-members" className="space-y-4 rounded-xl border border-pulse-200 p-6">
          <h2 id="section-members" className="text-lg font-semibold">Members</h2>
          <ul className="divide-y divide-pulse-100" role="list">
            {team.members.map((member) => (
              <li
                key={member.userId}
                className="flex items-center justify-between gap-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {member.email}
                    {member.userId === currentUserId ? (
                      <span className="ml-1 text-pulse-400 text-xs">(you)</span>
                    ) : null}
                  </p>
                  <p className="text-xs text-pulse-400">
                    Joined {new Date(member.joinedAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <RoleBadge role={member.role} />
                  {isOwner && member.userId !== currentUserId && member.userId !== team.ownerId ? (
                    <button
                      type="button"
                      aria-label={`Remove ${member.email}`}
                      onClick={() => void handleRemoveMember(member.userId)}
                      disabled={removingId === member.userId}
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center text-sm text-red-600 hover:text-red-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 rounded disabled:opacity-50"
                    >
                      {removingId === member.userId ? 'Removing…' : 'Remove'}
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* ── Custom roles ─────────────────────────────────────────────────── */}
        <section aria-labelledby="section-custom-roles" className="space-y-5 rounded-xl border border-pulse-200 p-6">
          <div className="space-y-1">
            <h2 id="section-custom-roles" className="text-lg font-semibold">{t('customRolesTitle')}</h2>
            <p className="text-sm text-pulse-500">
              Delegate focused permissions without making every teammate an admin.
            </p>
          </div>

          {rolesLoading ? (
            <div className="h-20 rounded-lg bg-pulse-100 skeleton-shimmer" aria-hidden="true" />
          ) : customRoles.length > 0 ? (
            <ul className="divide-y divide-pulse-100" role="list">
              {customRoles.map((role) => {
                const assigned = roleAssignments.filter((assignment) => assignment.role_id === role.id)
                return (
                  <li key={role.id} className="py-4 space-y-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-2">
                        <p className="text-sm font-semibold text-pulse-900">{role.name}</p>
                        <div className="flex flex-wrap gap-2">
                          {role.permissions.map((permission) => (
                            <span key={permission} className="rounded-full bg-teal-50 px-2 py-1 text-xs font-medium text-teal-700">
                              {permission}
                            </span>
                          ))}
                        </div>
                        <p className="text-xs text-pulse-400">
                          Assigned to {assigned.length} {assigned.length === 1 ? 'member' : 'members'}.
                        </p>
                      </div>
                      {canManageMembers ? (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => editRole(role)}
                            className="rounded-md border border-pulse-300 px-3 py-2 text-sm font-medium text-pulse-700 hover:border-teal-400 hover:text-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteCustomRole(role.id)}
                            disabled={roleSaving}
                            className="rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:border-red-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </div>
                      ) : null}
                    </div>
                    {assigned.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {assigned.map((assignment) => {
                          const member = team.members.find((entry) => entry.userId === assignment.user_id)
                          return (
                            <span key={assignment.id} className="inline-flex items-center gap-2 rounded-md bg-pulse-50 px-2 py-1 text-xs text-pulse-600">
                              {member?.email ?? assignment.user_id}
                              {canManageMembers ? (
                                <button
                                  type="button"
                                  onClick={() => void handleUnassignCustomRole(role.id, assignment.user_id)}
                                  className="font-medium text-red-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 rounded"
                                >
                                  Unassign
                                </button>
                              ) : null}
                            </span>
                          )
                        })}
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="text-sm text-pulse-500">{t('customRolesEmpty')}</p>
          )}

          {canManageMembers ? (
            <div className="space-y-5 border-t border-pulse-100 pt-5">
              <form onSubmit={(e) => void handleSaveCustomRole(e)} className="space-y-4">
                <div className="flex flex-col gap-1">
                  <label htmlFor="custom-role-name" className="text-sm font-medium">Role name</label>
                  <input
                    id="custom-role-name"
                    type="text"
                    value={roleName}
                    onChange={(e) => setRoleName(e.target.value)}
                    maxLength={80}
                    placeholder="Workshop coordinator"
                    className="border border-pulse-300 rounded-lg px-3 py-2 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                  />
                </div>

                <fieldset className="space-y-3">
                  <legend className="text-sm font-medium">Permissions</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {PERMISSIONS.map((permission) => (
                      <label
                        key={permission.id}
                        className="flex items-start gap-3 rounded-lg border border-pulse-200 p-3 text-sm hover:border-teal-300"
                      >
                        <input
                          type="checkbox"
                          checked={selectedPermissions.includes(permission.id)}
                          onChange={() => togglePermission(permission.id)}
                          className="mt-1 h-4 w-4 rounded border-pulse-300 text-teal-600 focus:ring-teal-500"
                        />
                        <span>
                          <span className="block font-medium text-pulse-800">{permission.label}</span>
                          <span className="block text-xs text-pulse-500">{permission.description}</span>
                          <span className="block text-xs text-teal-700">{permission.id}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={roleSaving || !roleName.trim() || selectedPermissions.length === 0}
                    className="rounded-lg bg-gradient-to-br from-teal-500 to-violet-600 px-4 py-2 font-medium text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
                  >
                    {roleSaving ? 'Saving…' : editingRoleId ? 'Update role' : 'Create role'}
                  </button>
                  {editingRoleId ? (
                    <button
                      type="button"
                      onClick={resetRoleForm}
                      className="rounded-lg border border-pulse-300 px-4 py-2 font-medium text-pulse-700 hover:border-teal-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
                    >
                      Cancel edit
                    </button>
                  ) : null}
                </div>
              </form>

              <form onSubmit={(e) => void handleAssignCustomRole(e)} className="grid gap-3 rounded-lg bg-pulse-50 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <div className="flex flex-col gap-1">
                  <label htmlFor="assign-role" className="text-sm font-medium">Role</label>
                  <select
                    id="assign-role"
                    value={assigningRoleId}
                    onChange={(e) => setAssigningRoleId(e.target.value)}
                    className="border border-pulse-300 rounded-lg bg-white px-3 py-2 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                  >
                    <option value="">Choose role</option>
                    {customRoles.map((role) => (
                      <option key={role.id} value={role.id}>{role.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="assign-member" className="text-sm font-medium">Member</label>
                  <select
                    id="assign-member"
                    value={assigningUserId}
                    onChange={(e) => setAssigningUserId(e.target.value)}
                    className="border border-pulse-300 rounded-lg bg-white px-3 py-2 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                  >
                    <option value="">{t('customRolesChooseMember')}</option>
                    {team.members.map((member) => (
                      <option key={member.userId} value={member.userId}>{member.email}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={roleSaving || !assigningRoleId || !assigningUserId}
                  className="rounded-lg border border-pulse-300 bg-white px-4 py-2 font-medium text-pulse-700 hover:border-teal-400 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
                >
                  Assign role
                </button>
              </form>
            </div>
          ) : (
            <p className="rounded-lg bg-pulse-50 p-3 text-sm text-pulse-500">
              Permission denied: custom roles require <code>team:manage_members</code>.
            </p>
          )}

          {roleFeedback ? (
            <p
              role="alert"
              aria-live="polite"
              className={`text-sm ${roleFeedback.kind === 'ok' ? 'text-teal-600' : 'text-red-600'}`}
            >
              {roleFeedback.msg}
            </p>
          ) : null}
        </section>

        {/* ── Invite ─────────────────────────────────────────────────────────── */}
        <section aria-labelledby="section-invite" className="space-y-4 rounded-xl border border-pulse-200 p-6">
          <h2 id="section-invite" className="text-lg font-semibold">{t('inviteMember')}</h2>
          <form onSubmit={(e) => void handleInvite(e)} className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 flex flex-col gap-1">
                <label htmlFor="invite-email" className="text-sm font-medium">
                  Email address
                </label>
                <input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@example.com"
                  maxLength={254}
                  disabled={inviting}
                  className="border border-pulse-300 rounded-lg px-3 py-2 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200 disabled:bg-pulse-50"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="invite-role" className="text-sm font-medium">
                  Role
                </label>
                <select
                  id="invite-role"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as 'admin' | 'member' | 'viewer')}
                  disabled={inviting}
                  className="border border-pulse-300 rounded-lg px-3 py-2 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200 disabled:bg-pulse-50 bg-white"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
            </div>
            {inviteFeedback ? (
              <p
                role="alert"
                aria-live="polite"
                className={`text-sm ${inviteFeedback.kind === 'ok' ? 'text-teal-600' : 'text-red-600'}`}
              >
                {inviteFeedback.msg}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={inviting || inviteEmail.trim().length === 0}
              className="self-start inline-flex items-center rounded-lg bg-gradient-to-br from-teal-500 to-violet-600 text-white px-4 py-2 font-medium hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
            >
              {inviting ? 'Sending…' : 'Send invite'}
            </button>
          </form>
        </section>

        {/* ── SAML (owner only) ─────────────────────────────────────────────── */}
        {isOwner && (
          <section aria-labelledby="section-saml" className="space-y-4 rounded-xl border border-pulse-200 p-6">
            <h2 id="section-saml" className="text-lg font-semibold">{t('samlConfiguration')}</h2>
            <p className="text-sm text-pulse-500">
              Configure single sign-on via SAML 2.0. Contact your identity provider for these values.
            </p>
            <form onSubmit={(e) => void handleSaveSaml(e)} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label htmlFor="saml-entity-id" className="text-sm font-medium">
                  Entity ID
                </label>
                <input
                  id="saml-entity-id"
                  type="text"
                  value={samlEntityId}
                  onChange={(e) => setSamlEntityId(e.target.value)}
                  placeholder="https://your-idp.example.com/metadata"
                  maxLength={512}
                  disabled={samlSaving}
                  className="border border-pulse-300 rounded-lg px-3 py-2 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200 disabled:bg-pulse-50 font-mono text-sm"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="saml-sso-url" className="text-sm font-medium">
                  IdP Metadata URL (SSO endpoint)
                </label>
                <input
                  id="saml-sso-url"
                  type="url"
                  value={samlSsoUrl}
                  onChange={(e) => setSamlSsoUrl(e.target.value)}
                  placeholder="https://your-idp.example.com/sso"
                  maxLength={1024}
                  disabled={samlSaving}
                  className="border border-pulse-300 rounded-lg px-3 py-2 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200 disabled:bg-pulse-50 font-mono text-sm"
                />
              </div>
              {samlFeedback ? (
                <p
                  role="alert"
                  aria-live="polite"
                  className={`text-sm ${samlFeedback.kind === 'ok' ? 'text-teal-600' : 'text-red-600'}`}
                >
                  {samlFeedback.msg}
                </p>
              ) : null}
              <button
                type="submit"
                disabled={samlSaving || !samlEntityId.trim() || !samlSsoUrl.trim()}
                className="self-start inline-flex items-center rounded-lg bg-gradient-to-br from-teal-500 to-violet-600 text-white px-4 py-2 font-medium hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
              >
                {samlSaving ? 'Saving…' : 'Save SAML configuration'}
              </button>
            </form>
          </section>
        )}
      </div>
    </MainLayout>
  )
}
