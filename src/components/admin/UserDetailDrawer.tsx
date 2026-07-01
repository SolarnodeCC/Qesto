import { useState } from 'react'
import { useAdminUserDetail } from '../../hooks/useAdminUserDetail'
import { Heading, Body, Caption, Button, Card } from '../../ui/components'

// Platformbeheer Module 3 — per-user support drawer. Shows account, subscription,
// activity, and the full audit trail, plus the privileged actions (impersonate,
// GDPR export, GDPR delete). Every action is audited server-side.

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1 text-sm">
      <span className="text-pulse-500 dark:text-[var(--text-muted)]">{label}</span>
      <span className="text-pulse-800 dark:text-[var(--text-secondary)] text-right">{value}</span>
    </div>
  )
}

function fmt(ts: number | null) {
  return ts ? new Date(ts).toLocaleString() : '—'
}

export default function UserDetailDrawer({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { detail, loading, error, impersonate, gdprDelete, downloadExport } = useAdminUserDetail(userId)
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function handleImpersonate() {
    setBusy('impersonate')
    setNotice(null)
    const res = await impersonate()
    if (res && res.ok) {
      // The server set the HttpOnly impersonation cookie. Reload the app in the
      // SAME tab so the cookie takes effect; the global banner then shows
      // "viewing as X" with a Stop control. (A new tab would not carry it.)
      window.location.assign('/dashboard')
      return
    }
    setBusy(null)
    setNotice(res && !res.ok ? `Impersonation failed: ${res.error.message}` : 'Impersonation failed.')
  }

  async function handleDelete() {
    setBusy('delete')
    setNotice(null)
    const res = await gdprDelete()
    setBusy(null)
    setConfirmDelete(false)
    if (res && res.ok) {
      setNotice(`Deleted: ${res.data.sessionsDeleted} sessions, ${res.data.vectorsDeleted} vectors purged, account ${res.data.userRowDeleted ? 'removed' : 'not found'}.`)
    } else {
      setNotice(res && !res.ok ? `Deletion failed: ${res.error.message}` : 'Deletion failed.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className="bg-white dark:bg-[var(--color-surface-elevated)] h-full w-full max-w-lg shadow-elevated overflow-y-auto p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <Heading level="s">User detail</Heading>
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
        </div>

        {loading && !detail && <Body size="s" className="text-pulse-500">Loading…</Body>}
        {error && !detail && <Body size="s" className="text-red-600">{error}</Body>}

        {notice && (
          <Card className="border border-teal-300 dark:border-teal-800 bg-teal-50 dark:bg-teal-900/20">
            <Body size="s" className="text-teal-700 dark:text-teal-400">{notice}</Body>
          </Card>
        )}

        {detail && (
          <>
            <Card className="space-y-1">
              <Caption>Account</Caption>
              <Row label="Email" value={detail.account.email} />
              <Row label="Name" value={detail.account.display_name ?? '—'} />
              <Row label="Role" value={detail.account.role} />
              <Row label="Registered" value={fmt(detail.account.created_at)} />
              <Row label="Last login" value={fmt(detail.account.last_login_at)} />
              <Row label="Status" value={detail.account.suspended_at ? 'Suspended' : 'Active'} />
            </Card>

            <Card className="space-y-1">
              <Caption>Subscription</Caption>
              <Row label="Plan" value={detail.subscription.plan} />
              <Row label="Stripe customer" value={detail.subscription.has_stripe ? detail.subscription.stripe_customer_id : 'none'} />
              {!detail.subscription.live_sync_available && (
                <Caption className="text-pulse-400 dark:text-[#5A6788]">No Stripe customer linked — live billing sync unavailable.</Caption>
              )}
            </Card>

            <Card className="space-y-1">
              <Caption>Activity — hosted sessions</Caption>
              <Row label="Total" value={detail.activity.hosted_sessions.total} />
              <Row label="Live / Closed / Draft" value={`${detail.activity.hosted_sessions.live} / ${detail.activity.hosted_sessions.closed} / ${detail.activity.hosted_sessions.draft}`} />
              {detail.activity.recent_sessions.length > 0 && (
                <div className="pt-2 space-y-1">
                  {detail.activity.recent_sessions.map((s) => (
                    <div key={s.id} className="text-xs text-pulse-600 dark:text-[var(--text-muted)] flex justify-between gap-2">
                      <span className="truncate">{s.title}</span>
                      <span className="shrink-0">{s.status} · {new Date(s.created_at).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="space-y-2">
              <Caption>Support actions</Caption>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" disabled={busy !== null} onClick={handleImpersonate}>
                  {busy === 'impersonate' ? '…' : 'Impersonate'}
                </Button>
                <Button variant="secondary" size="sm" onClick={downloadExport}>
                  Export data (JSON)
                </Button>
                {confirmDelete ? (
                  <>
                    <Button variant="danger" size="sm" disabled={busy !== null} onClick={handleDelete}>
                      {busy === 'delete' ? '…' : 'Confirm GDPR delete'}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                  </>
                ) : (
                  <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
                    GDPR delete…
                  </Button>
                )}
              </div>
              {confirmDelete && (
                <Caption className="text-red-600">
                  Irreversible. Purges all three privacy layers: session content, metadata, and decision vectors.
                </Caption>
              )}
            </Card>

            <Card className="space-y-1">
              <Caption>Audit trail</Caption>
              {detail.audit_trail.length === 0 ? (
                <Body size="s" className="text-pulse-500 dark:text-[var(--text-muted)]">No audit events.</Body>
              ) : (
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {detail.audit_trail.map((a, i) => (
                    <div key={`${a.trace_id}-${i}`} className="text-xs font-mono text-pulse-600 dark:text-[var(--text-muted)] flex justify-between gap-2">
                      <span>{a.action}</span>
                      <span className="shrink-0">{new Date(a.ts).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </>
        )}
      </div>
    </div>
  )
}
