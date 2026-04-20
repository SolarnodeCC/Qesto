import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

type Status = 'idle' | 'sending' | 'sent' | 'invalid' | 'error'

export default function Login() {
  const { requestMagicLink } = useAuth()
  const [search] = useSearchParams()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')

  const callbackError = search.get('error')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setStatus('sending')
    const result = await requestMagicLink(email)
    setStatus(result === 'sent' ? 'sent' : result === 'invalid' ? 'invalid' : 'error')
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <section
        aria-labelledby="login-title"
        className="w-full max-w-md space-y-6 rounded-2xl border border-pulse-200 bg-white dark:bg-pulse-800 dark:border-pulse-700 p-8 shadow-sm"
      >
        <div className="space-y-2 text-center">
          <h1
            id="login-title"
            className="text-3xl font-semibold bg-gradient-to-br from-teal-500 to-violet-600 bg-clip-text text-transparent"
          >
            Sign in to Qesto
          </h1>
          <p className="text-sm text-pulse-600">We&rsquo;ll email you a one-time sign-in link.</p>
        </div>

        {callbackError === 'invalid' && (
          <p role="alert" className="rounded-lg bg-red-50 dark:bg-red-900/30 p-3 text-sm text-red-800 dark:text-red-200">
            That sign-in link was invalid. Please request a new one.
          </p>
        )}
        {callbackError === 'expired' && (
          <p role="alert" className="rounded-lg bg-amber-50 dark:bg-amber-900/30 p-3 text-sm text-amber-800 dark:text-amber-200">
            Your sign-in link has expired or was already used. Request a new one below.
          </p>
        )}

        {status === 'sent' ? (
          <div
            role="status"
            className="rounded-lg bg-teal-50 dark:bg-teal-900/30 p-4 text-sm text-teal-800 dark:text-teal-100"
          >
            <p className="font-medium">Check your inbox.</p>
            <p className="mt-1">We sent a sign-in link to <strong>{email}</strong>. It expires in 15 minutes.</p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <div className="space-y-2">
              <label htmlFor="login-email" className="block text-sm font-medium">
                Work email
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={status === 'invalid'}
                aria-describedby={status === 'invalid' ? 'login-email-err' : undefined}
                className="w-full rounded-lg border border-pulse-300 bg-white dark:bg-pulse-900 dark:border-pulse-700 px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                placeholder="you@example.com"
              />
              {status === 'invalid' && (
                <p id="login-email-err" className="text-sm text-red-700 dark:text-red-300">
                  That doesn&rsquo;t look like a valid email.
                </p>
              )}
            </div>
            <button
              type="submit"
              disabled={status === 'sending'}
              className="w-full rounded-lg bg-gradient-to-br from-teal-500 to-violet-600 text-white py-2.5 font-medium transition hover:brightness-110 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
            >
              {status === 'sending' ? 'Sending…' : 'Send sign-in link'}
            </button>
            {status === 'error' && (
              <p role="alert" className="text-sm text-red-700 dark:text-red-300">
                Something went wrong. Please try again in a moment.
              </p>
            )}
          </form>
        )}

        <p className="text-xs text-pulse-500 text-center">
          By signing in you agree to Qesto&rsquo;s privacy defaults — no third-party AI, GDPR consent logged.
        </p>
      </section>
    </main>
  )
}
