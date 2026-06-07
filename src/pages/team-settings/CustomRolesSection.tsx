import { inputHint } from '../../ui/input-hint'
import type { CustomRole, Feedback, Permission, RoleAssignment, Team } from './types'
import { PERMISSIONS } from './types'

interface Props {
  customRoles: CustomRole[]
  roleAssignments: RoleAssignment[]
  rolesLoading: boolean
  team: Team
  canManageMembers: boolean
  roleName: string
  setRoleName: (v: string) => void
  selectedPermissions: Permission[]
  roleSaving: boolean
  editingRoleId: string | null
  roleFeedback: Feedback | null
  assigningRoleId: string
  setAssigningRoleId: (v: string) => void
  assigningUserId: string
  setAssigningUserId: (v: string) => void
  customRolesTitle: string
  customRolesEmpty: string
  customRolesChooseMember: string
  onSaveRole: (e: React.FormEvent) => void
  onDeleteRole: (roleId: string) => void
  onEditRole: (role: CustomRole) => void
  onResetRoleForm: () => void
  onTogglePermission: (p: Permission) => void
  onAssignRole: (e: React.FormEvent) => void
  onUnassignRole: (roleId: string, userId: string) => void
}

export function CustomRolesSection({
  customRoles,
  roleAssignments,
  rolesLoading,
  team,
  canManageMembers,
  roleName,
  setRoleName,
  selectedPermissions,
  roleSaving,
  editingRoleId,
  roleFeedback,
  assigningRoleId,
  setAssigningRoleId,
  assigningUserId,
  setAssigningUserId,
  customRolesTitle,
  customRolesEmpty,
  customRolesChooseMember,
  onSaveRole,
  onDeleteRole,
  onEditRole,
  onResetRoleForm,
  onTogglePermission,
  onAssignRole,
  onUnassignRole,
}: Props) {
  return (
    <section aria-labelledby="section-custom-roles" className="space-y-5 rounded-xl border border-pulse-200 p-6">
      <div className="space-y-1">
        <h2 id="section-custom-roles" className="text-lg font-semibold">{customRolesTitle}</h2>
        <p className="text-sm text-pulse-500">
          Delegate focused permissions without making every teammate an admin.
        </p>
      </div>

      {rolesLoading ? (
        <div className="h-20 rounded-lg bg-pulse-100 skeleton-shimmer" aria-hidden="true" />
      ) : customRoles.length > 0 ? (
        <ul className="divide-y divide-pulse-100" role="list">
          {customRoles.map((role) => {
            const assigned = roleAssignments.filter((a) => a.role_id === role.id)
            return (
              <li key={role.id} className="py-4 space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-pulse-900 dark:text-[#F0F2F8]">{role.name}</p>
                    <div className="flex flex-wrap gap-2">
                      {role.permissions.map((p) => (
                        <span key={p} className="rounded-full bg-teal-50 px-2 py-1 text-xs font-medium text-teal-700">
                          {p}
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
                        onClick={() => onEditRole(role)}
                        className="rounded-md border border-pulse-300 px-3 py-2 text-sm font-medium text-pulse-700 hover:border-teal-400 hover:text-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void onDeleteRole(role.id)}
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
                      const member = team.members.find((m) => m.userId === assignment.user_id)
                      return (
                        <span key={assignment.id} className="inline-flex items-center gap-2 rounded-md bg-pulse-50 dark:bg-[#1C2540] px-2 py-1 text-xs text-pulse-600 dark:text-[#A8B3CC]">
                          {member?.email ?? assignment.user_id}
                          {canManageMembers ? (
                            <button
                              type="button"
                              onClick={() => void onUnassignRole(role.id, assignment.user_id)}
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
        <p className="text-sm text-pulse-500">{customRolesEmpty}</p>
      )}

      {canManageMembers ? (
        <div className="space-y-5 border-t border-pulse-100 pt-5">
          <form onSubmit={(e) => void onSaveRole(e)} className="space-y-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="custom-role-name" className="text-sm font-medium">Role name</label>
              <input
                id="custom-role-name"
                type="text"
                value={roleName}
                onChange={(e) => setRoleName(e.target.value)}
                maxLength={80}
                {...inputHint("Workshop coordinator")}
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
                      onChange={() => onTogglePermission(permission.id)}
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
                  onClick={onResetRoleForm}
                  className="rounded-lg border border-pulse-300 px-4 py-2 font-medium text-pulse-700 hover:border-teal-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
                >
                  Cancel edit
                </button>
              ) : null}
            </div>
          </form>

          <form onSubmit={(e) => void onAssignRole(e)} className="grid gap-3 rounded-lg bg-pulse-50 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div className="flex flex-col gap-1">
              <label htmlFor="assign-role" className="text-sm font-medium">Role</label>
              <select
                id="assign-role"
                value={assigningRoleId}
                onChange={(e) => setAssigningRoleId(e.target.value)}
                className="border border-pulse-300 dark:border-[#2A3858] rounded-lg bg-white dark:bg-[#1C2540] text-pulse-900 dark:text-[#F0F2F8] px-3 py-2 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200 dark:focus:ring-teal-400/20"
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
                className="border border-pulse-300 dark:border-[#2A3858] rounded-lg bg-white dark:bg-[#1C2540] text-pulse-900 dark:text-[#F0F2F8] px-3 py-2 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200 dark:focus:ring-teal-400/20"
              >
                <option value="">{customRolesChooseMember}</option>
                {team.members.map((member) => (
                  <option key={member.userId} value={member.userId}>{member.email}</option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={roleSaving || !assigningRoleId || !assigningUserId}
              className="rounded-lg border border-pulse-300 dark:border-[#2A3858] bg-white dark:bg-transparent text-pulse-700 dark:text-[#A8B3CC] px-4 py-2 font-medium hover:border-teal-400 hover:text-teal-700 dark:hover:border-teal-600 dark:hover:text-teal-400 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
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
  )
}
