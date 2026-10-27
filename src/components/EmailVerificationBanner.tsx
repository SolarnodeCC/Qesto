import { useState } from 'react'
import { MailCheck } from 'lucide-react'
import { api } from '../api/client'
import { useAuth } from '../hooks/useAuth'
import { useT } from '../i18n'

// DD-10 (#883): password signups must confirm their address before accepting
// team invites, buying a plan or creating API keys. Renders nothing once the
// address is verified (or for accounts that never needed it).

type SendState = 'idle' | 'sending' | 'sent' | 'error'

export default function EmailVerificationBanner() {
  const auth = useAuth()
  const t = useT('common')
  const [state, setState] = useState<SendState>('idle')

  if (auth.status !== 'authenticated' || auth.user.email_verified !== false) return null
  const email = auth.user.email

  async function resend() {
    setState('sending')
    const res = await api('/api/auth/verify-email/resend', { method: 'POST' })
    setState(res.ok ? 'sent' : 'error')
  }

  return (
    <div
      role="status"
      className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-1.5"
    >
      <MailCheck className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden="true" />
      <p className="text-sm text-amber-900 dark:text-amber-100">
        <strong className="font-semibold">{t('verifyEmail.title')}</strong>{' '}
        <span className="text-amber-800 dark:text-amber-200">{t('verifyEmail.body', { email })}</span>
      </p>
      <span className="ml-auto text-sm">
        {state === 'sent' ? (
          <span className="text-amber-800 dark:text-amber-200">{t('verifyEmail.sent')}</span>
        ) : (
          <button
            type="button"
            onClick={() => void resend()}
            disabled={state === 'sending'}
            className="rounded-lg border border-amber-300 dark:border-amber-800 bg-white dark:bg-amber-950 px-3 py-1 text-xs font-medium text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          >
            {state === 'sending' ? t('verifyEmail.sending') : t('verifyEmail.resend')}
          </button>
        )}
        {state === 'error' && (
          <span role="alert" className="ml-2 text-red-700 dark:text-red-300">
            {t('verifyEmail.error')}
          </span>
        )}
      </span>
    </div>
  )
}
