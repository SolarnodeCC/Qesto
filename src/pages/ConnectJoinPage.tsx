// FE-CONNECT-JOIN-UI-01 (ADR-0062) — operator UI to accept a federation invite
// and join a federated session. Aggregate-only co-tenant stats: this page must
// NEVER render another tenant's name or identity, only counts (ADR-0062 anonymity
// guarantee). See functions/api/routes/federation.ts `POST /connect/join`.
import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useT } from '../i18n'
import { api } from '../api/client'
import MainLayout from '../layouts/MainLayout'

type FederationMember = {
  teamId: string
  scope: string
  regionId: string
  joinedAt: number
}

type JoinResponse = {
  sessionId: string
  member: FederationMember
  tenantCount: number
}

type JoinState =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'success'; data: JoinResponse }
  | { status: 'error'; message: string }

const ERROR_KEY_BY_CODE: Record<string, string> = {
  invite_invalid: 'error.invite_invalid',
  forbidden: 'error.forbidden',
  already_member: 'error.already_member',
  federation_disabled: 'error.federation_disabled',
  kv_unavailable: 'error.kv_unavailable',
  not_found: 'error.not_found',
}

export default function ConnectJoinPage() {
  const auth = useAuth()
  const t = useT('connect')

  const [token, setToken] = useState('')
  const [joiningTeamId, setJoiningTeamId] = useState('')
  const [state, setState] = useState<JoinState>({ status: 'idle' })

  if (auth.status === 'loading') {
    return (
      <MainLayout mainClassName="min-h-screen max-w-2xl mx-auto p-12">
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-pulse-200 skeleton-shimmer" aria-hidden="true" />
          ))}
        </div>
      </MainLayout>
    )
  }
  if (auth.status === 'anonymous') {
    return <Navigate to="/login" replace />
  }

  const canSubmit = token.trim().length > 0 && joiningTeamId.trim().length > 0 && state.status !== 'submitting'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setState({ status: 'submitting' })
    const res = await api<JoinResponse>('/api/federation/connect/join', {
      method: 'POST',
      body: { token: token.trim(), joiningTeamId: joiningTeamId.trim() },
    })
    if (res.ok) {
      setState({ status: 'success', data: res.data })
    } else {
      const key = ERROR_KEY_BY_CODE[res.error.code]
      setState({ status: 'error', message: key ? t(key) : t('error.generic') })
    }
  }

  function handleReset() {
    setToken('')
    setJoiningTeamId('')
    setState({ status: 'idle' })
  }

  return (
    <MainLayout mainClassName="min-h-screen max-w-2xl mx-auto p-12">
      <h1 tabIndex={-1} className="text-2xl font-bold text-pulse-900 dark:text-[#F0F2F8] focus:outline-none">
        {t('join.title')}
      </h1>
      <p className="mt-2 text-sm text-pulse-600 dark:text-[#9AA8C7]">{t('join.subtitle')}</p>

      {state.status === 'success' ? (
        <div className="mt-8 rounded-lg border border-teal-200 bg-teal-50 p-6 dark:border-teal-800 dark:bg-teal-900/20" aria-live="polite">
          <div className="flex items-center gap-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-teal-100 dark:bg-teal-800" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-teal-600 dark:text-teal-300" aria-hidden="true">
                <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2 className="font-semibold text-teal-800 dark:text-teal-200">{t('join.successTitle')}</h2>
          </div>
          <p className="mt-3 text-sm text-teal-900 dark:text-teal-100">{t('join.successBody')}</p>

          {/* Aggregate-only stat. CRITICAL: never render other tenants' names/identities — counts only. */}
          <p className="mt-4 text-lg font-semibold text-teal-900 dark:text-teal-100">
            {t('join.tenantCount', { count: state.data.tenantCount })}
          </p>

          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-pulse-500 dark:text-[#9AA8C7]">{t('join.scopeLabel')}</dt>
              <dd className="font-medium text-pulse-900 dark:text-[#F0F2F8]">{state.data.member.scope}</dd>
            </div>
            <div>
              <dt className="text-pulse-500 dark:text-[#9AA8C7]">{t('join.regionLabel')}</dt>
              <dd className="font-medium text-pulse-900 dark:text-[#F0F2F8]">{state.data.member.regionId}</dd>
            </div>
          </dl>

          <p className="mt-4 text-xs text-pulse-500 dark:text-[#9AA8C7]">{t('join.privacyNote')}</p>

          <button
            type="button"
            onClick={handleReset}
            className="mt-6 min-h-[44px] rounded-lg border border-teal-300 px-6 py-2.5 text-sm font-medium text-teal-700 hover:bg-teal-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:border-teal-700 dark:text-teal-200 dark:hover:bg-teal-900/40"
          >
            {t('join.joinAnother')}
          </button>
        </div>
      ) : (
        <form className="mt-8 space-y-6" onSubmit={(e) => void handleSubmit(e)}>
          <div>
            <label htmlFor="connect-token" className="block text-sm font-medium text-pulse-900 dark:text-[#F0F2F8]">
              {t('join.tokenLabel')}
            </label>
            <textarea
              id="connect-token"
              className="mt-1 w-full rounded-lg border border-pulse-200 px-3 py-2 text-sm dark:border-[#2A3858] dark:bg-pulse-900 dark:text-[#F0F2F8] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
              rows={3}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={t('join.tokenPlaceholder')}
              required
            />
          </div>

          <div>
            <label htmlFor="connect-team-id" className="block text-sm font-medium text-pulse-900 dark:text-[#F0F2F8]">
              {t('join.teamIdLabel')}
            </label>
            <input
              id="connect-team-id"
              type="text"
              className="mt-1 w-full min-h-[44px] rounded-lg border border-pulse-200 px-3 py-2 text-sm dark:border-[#2A3858] dark:bg-pulse-900 dark:text-[#F0F2F8] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
              value={joiningTeamId}
              onChange={(e) => setJoiningTeamId(e.target.value)}
              placeholder={t('join.teamIdPlaceholder')}
              required
            />
          </div>

          {state.status === 'error' && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {state.message}
            </p>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="min-h-[44px] rounded-lg bg-gradient-to-br from-teal-500 to-violet-600 px-8 py-3 text-sm font-medium text-white hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 disabled:opacity-50"
          >
            {state.status === 'submitting' ? t('join.submitting') : t('join.submit')}
          </button>
        </form>
      )}

    </MainLayout>
  )
}
