import { useState, useRef } from 'react'
import { useAdminUsers, type AdminUser } from '../../hooks/useAdminUsers'
import { useT } from '../../i18n'
import { Heading, Body, Button, Card, TextInput } from '../../ui/components'

// ─── Plan badge colours ───────────────────────────────────────────────────────

const PLAN_BRAND_NAMES: Record<AdminUser['plan'], string> = {
  free:    'Pulse',
  starter: 'Signal',
  team:    'Chorus',
}

function PlanBadge({ plan }: { plan: AdminUser['plan'] }) {
  const variant: Record<AdminUser['plan'], string> = {
    free: 'bg-pulse-100 text-pulse-600',
    starter: 'bg-teal-100 text-teal-700',
    team: 'bg-purple-100 text-purple-700',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium uppercase tracking-wide ${variant[plan]}`}>
      {PLAN_BRAND_NAMES[plan]}
    </span>
  )
}

function StatusBadge({ suspended }: { suspended: boolean }) {
  return suspended ? (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-600">
      Suspended
    </span>
  ) : (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-600">
      Active
    </span>
  )
}

function RoleBadge({ role }: { role: 'owner' | 'admin' | null }) {
  if (!role) return <span className="text-pulse-400">—</span>
  const styles = role === 'owner'
    ? 'bg-purple-100 text-purple-700'
    : 'bg-blue-100 text-blue-700'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles}`}>
      {role === 'owner' ? 'Super Admin' : 'Admin'}
    </span>
  )
}

function formatDate(ts: number | null) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString(undefined, { dateStyle: 'medium' })
}

// ─── Create/Edit modal ────────────────────────────────────────────────────────

type ModalMode = { type: 'create' } | { type: 'edit'; user: AdminUser }

function UserModal({
  mode,
  onClose,
  onSave,
}: {
  mode: ModalMode
  onClose: () => void
  onSave: (data: Partial<AdminUser> & { email?: string }) => Promise<void>
}) {
  const t = useT('admin')
  const isEdit = mode.type === 'edit'
  const user = isEdit ? mode.user : null

  const [email, setEmail] = useState(user?.email ?? '')
  const [displayName, setDisplayName] = useState(user?.display_name ?? '')
  const [plan, setPlan] = useState<AdminUser['plan']>(user?.plan ?? 'free')
  const [adminRole, setAdminRole] = useState<'owner' | 'admin' | ''>(
    user?.admin_role ?? ''
  )
  const [saving, setSaving] = useState(false)
  const [fieldError, setFieldError] = useState<string | null>(null)

  async function handleSave() {
    if (!isEdit && !email.trim()) { setFieldError(t('nameEmailRequired')); return }
    setSaving(true)
    setFieldError(null)
    try {
      await onSave({
        ...(isEdit ? {} : { email: email.trim() }),
        display_name: displayName.trim() || null,
        plan,
        admin_role: adminRole === '' ? null : adminRole,
      })
      onClose()
    } catch (e) {
      setFieldError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" role="dialog" aria-modal="true">
      <div className="bg-white dark:bg-[#1C2540] rounded-xl shadow-elevated w-full max-w-md mx-4 p-6 space-y-4">
        <Heading level="s">{isEdit ? t('editUser') : t('createAccountTitle')}</Heading>

        {!isEdit && (
          <div className="space-y-1">
            <label className="text-body-s font-medium text-pulse-700 dark:text-[#A8B3CC]">{t('emailLbl')}</label>
            <TextInput
              placeholder={t('namePlaceholderAdmin')}
              value={email}
              onChange={setEmail}
              type="email"
              className="w-full"
            />
          </div>
        )}

        {isEdit && (
          <div className="space-y-1">
            <label className="text-body-s font-medium text-pulse-700 dark:text-[#A8B3CC]">{t('emailReadonly')}</label>
            <p className="text-body-s text-pulse-500 dark:text-[#6B7A99] px-3 py-2 rounded-md bg-pulse-50 dark:bg-[#0F1526]">{user?.email}</p>
          </div>
        )}

        <div className="space-y-1">
          <label className="text-body-s font-medium text-pulse-700 dark:text-[#A8B3CC]">{t('displayNameLbl')}</label>
          <TextInput
            placeholder={t('nameOptionalPlaceholder')}
            value={displayName}
            onChange={setDisplayName}
            className="w-full"
          />
        </div>

        <div className="space-y-1">
          <label className="text-body-s font-medium text-pulse-700 dark:text-[#A8B3CC]">{t('planLbl')}</label>
          <select
            value={plan}
            onChange={(e) => setPlan(e.target.value as AdminUser['plan'])}
            className="w-full border border-pulse-300 dark:border-[#2A3858] rounded-md px-3 py-2 text-body-s bg-white dark:bg-[#1C2540] text-pulse-900 dark:text-[#F0F2F8] focus:border-teal-500 focus:ring-2 focus:ring-teal-100 focus:outline-none"
          >
            <option value="free">{t('planOptionFree')}</option>
            <option value="starter">{t('planOptionStarter')}</option>
            <option value="team">{t('planOptionTeam')}</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-body-s font-medium text-pulse-700 dark:text-[#A8B3CC]">{t('adminRoleLbl')}</label>
          <select
            value={adminRole}
            onChange={(e) => setAdminRole(e.target.value as 'owner' | 'admin' | '')}
            className="w-full border border-pulse-300 dark:border-[#2A3858] rounded-md px-3 py-2 text-body-s bg-white dark:bg-[#1C2540] text-pulse-900 dark:text-[#F0F2F8] focus:border-teal-500 focus:ring-2 focus:ring-teal-100 focus:outline-none"
          >
            <option value="">{t('noAdminRole')}</option>
            <option value="admin">{t('admin')}</option>
            <option value="owner">{t('superAdmin')}</option>
          </select>
        </div>

        {fieldError && <Body size="s" className="text-red-600">{fieldError}</Body>}

        <div className="flex gap-2 justify-end pt-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>{t('cancelBtn')}</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? t('saving') : t('save')}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AdminUsersTab() {
  const t = useT('admin')
  const {
    users, total, loading, error,
    setSearch, offset, setOffset, limit,
    createUser, updateUser, suspendUser, restoreUser,
  } = useAdminUsers()

  const [modal, setModal] = useState<ModalMode | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleSearchChange(val: string) {
    if (searchRef.current) clearTimeout(searchRef.current)
    searchRef.current = setTimeout(() => {
      setSearch(val)
      setOffset(0)
    }, 300)
  }

  async function handleSuspend(user: AdminUser) {
    setActionLoading(user.id)
    setActionError(null)
    const res = await suspendUser(user.id)
    if (!res.ok) setActionError(res.error.message)
    setActionLoading(null)
  }

  async function handleRestore(user: AdminUser) {
    setActionLoading(user.id)
    setActionError(null)
    const res = await restoreUser(user.id)
    if (!res.ok) setActionError(res.error.message)
    setActionLoading(null)
  }

  async function handleModalSave(data: Partial<AdminUser> & { email?: string }) {
    if (modal?.type === 'create') {
      const res = await createUser({
        email: data.email!,
        ...(data.display_name != null ? { display_name: data.display_name } : {}),
        ...(data.plan != null ? { plan: data.plan } : {}),
        admin_role: data.admin_role ?? null,
      })
      if (!res.ok) throw new Error(res.error.message)
    } else if (modal?.type === 'edit') {
      const res = await updateUser(modal.user.id, {
        ...(data.display_name != null ? { display_name: data.display_name } : {}),
        ...(data.plan != null ? { plan: data.plan } : {}),
        admin_role: data.admin_role as 'admin' | 'owner' | null,
      })
      if (!res.ok) throw new Error(res.error.message)
    }
  }

  const totalPages = Math.ceil(total / limit)
  const currentPage = Math.floor(offset / limit) + 1

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Heading level="m" className="border-l-4 border-teal-500 pl-3">{t('users')}</Heading>
        <Button variant="primary" onClick={() => setModal({ type: 'create' })}>
          {t('createAccountBtn')}
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <TextInput
          placeholder="Search by name or email…"
          onChange={handleSearchChange}
          className="w-full max-w-sm"
        />
        <Body size="s" className="text-pulse-400 whitespace-nowrap">{total} users total</Body>
      </div>

      {error && <Body size="s" className="text-red-600">{error}</Body>}
      {actionError && (
        <p className="text-body-s text-red-600" role="alert">
          {actionError}
        </p>
      )}

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-body-s">
          <thead>
            <tr className="border-b border-pulse-200 dark:border-[#1E2A45] bg-pulse-50 dark:bg-[#0F1526]">
              <th className="text-left px-4 py-3 font-medium text-pulse-600 dark:text-[#6B7A99] uppercase text-xs tracking-wide">Name</th>
              <th className="text-left px-4 py-3 font-medium text-pulse-600 dark:text-[#6B7A99] uppercase text-xs tracking-wide">Email</th>
              <th className="text-left px-4 py-3 font-medium text-pulse-600 dark:text-[#6B7A99] uppercase text-xs tracking-wide">Plan</th>
              <th className="text-left px-4 py-3 font-medium text-pulse-600 dark:text-[#6B7A99] uppercase text-xs tracking-wide">Last login</th>
              <th className="text-left px-4 py-3 font-medium text-pulse-600 dark:text-[#6B7A99] uppercase text-xs tracking-wide">Admin role</th>
              <th className="text-left px-4 py-3 font-medium text-pulse-600 dark:text-[#6B7A99] uppercase text-xs tracking-wide">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-pulse-100 dark:divide-[#1E2A45]">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={7} className="px-4 py-3">
                    <div className="h-4 bg-pulse-100 dark:bg-[#1C2540] rounded animate-pulse w-full" />
                  </td>
                </tr>
              ))
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-pulse-400">
                  No users found
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="hover:bg-pulse-50 dark:hover:bg-[#0F1526]">
                  <td className="px-4 py-3 font-medium text-pulse-900 dark:text-[#F0F2F8]">
                    {user.display_name || user.email.split('@')[0]}
                  </td>
                  <td className="px-4 py-3 text-pulse-500 dark:text-[#6B7A99]">{user.email}</td>
                  <td className="px-4 py-3"><PlanBadge plan={user.plan} /></td>
                  <td className="px-4 py-3 text-pulse-400 dark:text-[#6B7A99] text-sm">{formatDate(user.last_login_at)}</td>
                  <td className="px-4 py-3"><RoleBadge role={user.admin_role} /></td>
                  <td className="px-4 py-3"><StatusBadge suspended={!!user.suspended_at} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setModal({ type: 'edit', user })}
                      >
                        Edit
                      </Button>
                      {user.suspended_at ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={actionLoading === user.id}
                          onClick={() => handleRestore(user)}
                        >
                          {actionLoading === user.id ? '…' : 'Restore'}
                        </Button>
                      ) : (
                        <Button
                          variant="danger"
                          size="sm"
                          disabled={actionLoading === user.id}
                          onClick={() => handleSuspend(user)}
                        >
                          {actionLoading === user.id ? '…' : 'Suspend'}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-body-s text-pulse-500">
          <span>Page {currentPage} of {totalPages}</span>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setOffset(Math.max(0, offset - limit))}
            >
              Previous
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => setOffset(offset + limit)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {modal && (
        <UserModal
          mode={modal}
          onClose={() => setModal(null)}
          onSave={handleModalSave}
        />
      )}
    </div>
  )
}
