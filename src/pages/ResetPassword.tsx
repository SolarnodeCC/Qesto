import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useT } from '../i18n'

type Status = 'idle' | 'submitting' | 'success' | 'invalid' | 'error'

export default function ResetPassword() {
  const t = useT('auth')
  const { confirmPasswordReset } = useAuth()
  const [search] = useSearchParams()
  const token = search.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [status, setStatus] = useState<Status>('idle')

  const invalidToken = token.length !== 64

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (password.length < 8 || password !== confirmPassword) {
      setStatus('invalid')
      return
    }
    setStatus('submitting')
    const result = await confirmPasswordReset(token, password)
    if (result === 'ok') {
      setStatus('success')
      return
    }
    if (result === 'invalid_token' || result === 'invalid') {
      setStatus('invalid')
      return
    }
    setStatus('error')
  }

  return (
    <main id="main" className="min-h-screen flex items-center justify-center p-6">
      <section className="w-full max-w-md space-y-5 rounded-xl border border-pulse-200 bg-white dark:bg-pulse-800 dark:border-pulse-700 p-8 shadow-sm">
        <h1 tabIndex={-1} className="text-2xl font-semibold">{t('setNewPassword')}</h1>

        {invalidToken ? (
          <div className="space-y-3">
            <p role="alert" className="text-sm text-red-700 dark:text-red-300">{t('resetLinkInvalid')}</p>
            <p className="text-sm text-pulse-600 dark:text-pulse-400">{t('resetLinkHint')}</p>
            <Link to="/login" className="text-sm text-teal-600 dark:text-teal-400 hover:underline">
              {t('requestNewLink')}
            </Link>
          </div>
        ) : status === 'success' ? (
          <div className="space-y-3">
            <p className="rounded-lg bg-teal-50 dark:bg-teal-900/30 p-3 text-sm text-teal-800 dark:text-teal-100">{t('passwordSet')}</p>
            <p className="text-sm text-pulse-600 dark:text-pulse-400">{t('passwordSetSub')}</p>
            <Link to="/dashboard" className="text-sm text-teal-600 dark:text-teal-400 hover:underline">
              {t('goToDashboard')}
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <label htmlFor="new-password" className="block text-sm font-medium">{t('newPassword')}</label>
              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-pulse-300 bg-white dark:bg-pulse-900 dark:border-pulse-700 px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="confirm-password" className="block text-sm font-medium">{t('confirmPassword')}</label>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg border border-pulse-300 bg-white dark:bg-pulse-900 dark:border-pulse-700 px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
              />
            </div>
            {status === 'invalid' && (
              <p role="alert" className="text-sm text-red-700 dark:text-red-300">{t('passwordsDontMatch')}</p>
            )}
            {status === 'error' && (
              <p role="alert" className="text-sm text-red-700 dark:text-red-300">{t('genericError')}</p>
            )}
            <button
              type="submit"
              disabled={status === 'submitting'}
              className="w-full rounded-lg bg-gradient-to-br from-teal-500 to-violet-600 text-white py-2.5 font-medium transition hover:brightness-110 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
            >
              {status === 'submitting' ? t('savingPassword') : t('savePasswordAndLogin')}
            </button>
          </form>
        )}
      </section>
    </main>
  )
}
