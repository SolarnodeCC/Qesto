import { useEffect, useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { useT } from '../i18n'
import { api } from '../api/client'
import MainLayout from '../layouts/MainLayout'

interface AcceptInviteData {
  teamName: string
  joined: boolean
}

type AcceptState =
  | { status: 'loading' }
  | { status: 'success'; teamName: string }
  | { status: 'error'; message: string }

export default function TeamInvite() {
  const t = useT('join')
  // Support both /teams/invite/:token (route param) and /teams/accept?token=... (query param)
  const { token: routeToken } = useParams<{ token?: string }>()
  const [searchParams] = useSearchParams()
  const queryToken = searchParams.get('token')
  const token = routeToken ?? queryToken ?? ''

  const [state, setState] = useState<AcceptState>({ status: 'loading' })

  useEffect(() => {
    if (!token) {
      setState({ status: 'error', message: t('noInviteTokenFound') })
      return
    }

    void api<AcceptInviteData>('/api/teams/accept-invite', {
      method: 'POST',
      body: { token },
    }).then((res) => {
      if (res.ok) {
        setState({ status: 'success', teamName: res.data.teamName })
      } else {
        // Map backend error codes to friendly messages
        const code = res.error.code
        let message = res.error.message
        if (code === 'not_found' || code === 'invalid_token') {
          message = t('inviteLinkExpired')
        } else if (code === 'already_member') {
          message = t('alreadyMemberOfTeam')
        }
        setState({ status: 'error', message })
      }
    })
  }, [token, t])

  return (
    <MainLayout mainClassName="min-h-screen flex items-center justify-center p-12">
      <div className="max-w-md w-full text-center space-y-8 animate-page-enter">
        {state.status === 'loading' && (
          <>
            <div
              className="mx-auto h-24 w-24 rounded-full border-4 border-teal-200 border-t-teal-500 animate-spin"
              aria-hidden="true"
            />
            <p className="text-pulse-600 dark:text-[#A8B3CC]" aria-live="polite" aria-busy="true">
              {t('confirmingInvite')}
            </p>
          </>
        )}

        {state.status === 'success' && (
          <>
            <div
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-teal-100"
              aria-hidden="true"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-12 w-12 text-teal-600" aria-hidden="true">
                <path
                  d="M5 13l4 4L19 7"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div aria-live="polite">
              <h1 tabIndex={-1} className="text-2xl font-semibold focus:outline-none">
                You've joined {state.teamName}!
              </h1>
              <p className="text-pulse-500 mt-2">
                You now have access to the team's sessions and insights.
              </p>
            </div>
            <Link
              to="/dashboard"
              className="inline-flex items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-violet-600 text-white px-8 py-3 font-medium hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 min-h-[44px]"
            >
              Go to dashboard
            </Link>
          </>
        )}

        {state.status === 'error' && (
          <>
            <div
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100"
              aria-hidden="true"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-12 w-12 text-red-500" aria-hidden="true">
                <path
                  d="M6 18L18 6M6 6l12 12"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div role="alert" aria-live="assertive">
              <h1 tabIndex={-1} className="text-2xl font-semibold focus:outline-none">
                Invite not accepted
              </h1>
              <p className="text-pulse-500 mt-2">{state.status === 'error' ? state.message : ''}</p>
            </div>
            <Link
              to="/dashboard"
              className="inline-flex items-center justify-center rounded-lg border border-pulse-300 dark:border-[#2A3858] text-pulse-700 dark:text-[#A8B3CC] px-8 py-3 font-medium hover:bg-pulse-50 dark:hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 min-h-[44px]"
            >
              Go to dashboard
            </Link>
          </>
        )}
      </div>
    </MainLayout>
  )
}
