import { inputHint } from '../../ui/input-hint'
import type { Feedback } from './types'

interface Props {
  inviteEmail: string
  setInviteEmail: (v: string) => void
  inviteRole: 'admin' | 'member' | 'viewer'
  setInviteRole: (v: 'admin' | 'member' | 'viewer') => void
  inviting: boolean
  inviteFeedback: Feedback | null
  inviteMemberLabel: string
  onInvite: (e: React.FormEvent) => void
}

export function InviteSection({
  inviteEmail,
  setInviteEmail,
  inviteRole,
  setInviteRole,
  inviting,
  inviteFeedback,
  inviteMemberLabel,
  onInvite,
}: Props) {
  return (
    <section aria-labelledby="section-invite" className="space-y-4 rounded-xl border border-pulse-200 p-6">
      <h2 id="section-invite" className="text-lg font-semibold">{inviteMemberLabel}</h2>
      <form onSubmit={(e) => void onInvite(e)} className="flex flex-col gap-3">
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
              {...inputHint("colleague@example.com")}
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
              className="border border-pulse-300 dark:border-[var(--color-border-strong)] rounded-lg px-3 py-2 bg-white dark:bg-[var(--color-surface-elevated)] text-pulse-900 dark:text-[var(--text-primary)] outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200 dark:focus:ring-teal-400/20 disabled:bg-pulse-50 dark:disabled:bg-[var(--color-border)]"
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
  )
}
