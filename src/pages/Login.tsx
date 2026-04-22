import { useState, useEffect, type FormEvent } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useT } from '../i18n'
import BuildStamp from '../components/BuildStamp'

type Tab = 'magic' | 'login' | 'signup'
type MagicStatus = 'idle' | 'sending' | 'sent' | 'invalid' | 'error'
type LoginStatus = 'idle' | 'submitting' | 'invalid_credentials' | 'error'
type SignupStatus = 'idle' | 'submitting' | 'email_taken' | 'password_too_short' | 'error'
type ResetStatus = 'idle' | 'submitting' | 'sent' | 'invalid' | 'error'

export default function Login() {
  const { requestMagicLink, loginWithPassword, signupWithPassword, requestPasswordReset, status } = useAuth()
  const [search] = useSearchParams()
  const navigate = useNavigate()
  const t = useT('auth')

  useEffect(() => {
    if (status === 'authenticated') navigate('/dashboard', { replace: true })
  }, [status, navigate])

  const [tab, setTab] = useState<Tab>('magic')

  // Magic link state
  const [magicEmail, setMagicEmail] = useState('')
  const [magicStatus, setMagicStatus] = useState<MagicStatus>('idle')

  // Password login state
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginStatus, setLoginStatus] = useState<LoginStatus>('idle')
  const [showResetForm, setShowResetForm] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetStatus, setResetStatus] = useState<ResetStatus>('idle')

  // Signup state
  const [signupEmail, setSignupEmail] = useState('')
  const [signupName, setSignupName] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [signupStatus, setSignupStatus] = useState<SignupStatus>('idle')

  const callbackError = search.get('error')

  async function onMagicSubmit(e: FormEvent) {
    e.preventDefault()
    setMagicStatus('sending')
    const result = await requestMagicLink(magicEmail)
    setMagicStatus(result === 'sent' ? 'sent' : result === 'invalid' ? 'invalid' : 'error')
  }

  async function onLoginSubmit(e: FormEvent) {
    e.preventDefault()
    setLoginStatus('submitting')
    const result = await loginWithPassword(loginEmail, loginPassword)
    if (result === 'ok') { navigate('/dashboard', { replace: true }); return }
    setLoginStatus(result === 'invalid_credentials' ? 'invalid_credentials' : 'error')
  }

  async function onSignupSubmit(e: FormEvent) {
    e.preventDefault()
    if (signupPassword.length < 8) {
      setSignupStatus('password_too_short')
      return
    }
    setSignupStatus('submitting')
    const result = await signupWithPassword(signupEmail, signupPassword, signupName || undefined)
    if (result === 'ok') { navigate('/dashboard', { replace: true }); return }
    setSignupStatus(result === 'email_taken' ? 'email_taken' : 'error')
  }

  async function onResetSubmit(e: FormEvent) {
    e.preventDefault()
    setResetStatus('submitting')
    const result = await requestPasswordReset(resetEmail)
    setResetStatus(result === 'sent' ? 'sent' : result === 'invalid' ? 'invalid' : 'error')
  }

  const tabClass = (active: boolean) =>
    `flex-1 py-2 text-sm font-medium rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
      active
        ? 'bg-blue-600 text-white shadow-sm'
        : 'text-pulse-600 dark:text-pulse-400 hover:text-pulse-900 dark:hover:text-pulse-100'
    }`

  const inputClass =
    'w-full rounded-lg border border-pulse-300 bg-white dark:bg-pulse-900 dark:border-pulse-700 px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500'

  const primaryBtn =
    'w-full rounded-lg bg-gradient-to-br from-teal-500 to-violet-600 text-white py-2.5 font-medium transition hover:brightness-110 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2'

  return (
    <main id="main" className="min-h-screen flex items-center justify-center p-6">
      <section
        aria-labelledby="login-title"
        className="w-full max-w-md space-y-5 rounded-2xl border border-pulse-200 bg-white dark:bg-pulse-800 dark:border-pulse-700 p-8 shadow-sm"
      >
        <div className="space-y-1 text-center">
          <h1
            id="login-title"
            tabIndex={-1}
            className="text-3xl font-semibold bg-gradient-to-br from-teal-500 to-violet-600 bg-clip-text text-transparent focus:outline-none"
          >
            {t('loginTitle')}
          </h1>
          <p className="text-sm text-pulse-600 dark:text-pulse-400">{t('loginSubtitle')}</p>
        </div>

        {/* Callback error banners */}
        {callbackError === 'invalid' && (
          <p role="alert" className="rounded-lg bg-red-50 dark:bg-red-900/30 p-3 text-sm text-red-800 dark:text-red-200">
            {t('linkInvalidOrExpired')}
          </p>
        )}
        {callbackError === 'expired' && (
          <p role="alert" className="rounded-lg bg-amber-50 dark:bg-amber-900/30 p-3 text-sm text-amber-800 dark:text-amber-200">
            {t('linkInvalidOrExpired')}
          </p>
        )}
        {callbackError === 'sso_failed' && (
          <p role="alert" className="rounded-lg bg-red-50 dark:bg-red-900/30 p-3 text-sm text-red-800 dark:text-red-200">
            {t('errorSSOFailed')}
          </p>
        )}
        {callbackError === 'provider_not_configured' && (
          <p role="alert" className="rounded-lg bg-amber-50 dark:bg-amber-900/30 p-3 text-sm text-amber-800 dark:text-amber-200">
            {t('errorSSOFailed')}
          </p>
        )}

        {/* OAuth buttons */}
        <div className="space-y-2">
          <a
            href="/api/auth/microsoft"
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-pulse-300 dark:border-pulse-600 bg-white dark:bg-pulse-900 px-4 py-2.5 text-sm font-medium text-pulse-800 dark:text-pulse-200 hover:bg-pulse-50 dark:hover:bg-pulse-700 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <MicrosoftIcon />
            {t('continueWithMicrosoft')}
          </a>
          <a
            href="/api/auth/google"
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-pulse-300 dark:border-pulse-600 bg-white dark:bg-pulse-900 px-4 py-2.5 text-sm font-medium text-pulse-800 dark:text-pulse-200 hover:bg-pulse-50 dark:hover:bg-pulse-700 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <GoogleIcon />
            {t('continueWithGoogle')}
          </a>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-pulse-200 dark:bg-pulse-700" />
          <span className="text-xs text-pulse-500">{t('orViaEmail')}</span>
          <div className="flex-1 h-px bg-pulse-200 dark:bg-pulse-700" />
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 rounded-lg bg-pulse-100 dark:bg-pulse-900 p-1" role="tablist">
          <button role="tab" aria-selected={tab === 'magic'} className={tabClass(tab === 'magic')} onClick={() => setTab('magic')}>
            {t('magicLinkTab')}
          </button>
          <button role="tab" aria-selected={tab === 'login'} className={tabClass(tab === 'login')} onClick={() => setTab('login')}>
            {t('login')}
          </button>
          <button role="tab" aria-selected={tab === 'signup'} className={tabClass(tab === 'signup')} onClick={() => setTab('signup')}>
            {t('signup')}
          </button>
        </div>

        {/* Magic link tab */}
        {tab === 'magic' && (
          <div role="tabpanel">
            {magicStatus === 'sent' ? (
              <div role="status" className="rounded-lg bg-teal-50 dark:bg-teal-900/30 p-4 text-sm text-teal-800 dark:text-teal-100">
                <p className="font-medium">{t('checkInbox')}</p>
                <p className="mt-1">{t('magicLinkSent', { email: magicEmail })}</p>
                <p className="mt-1 text-xs opacity-80">{t('magicLinkExpiry')}</p>
                <button
                  className="mt-3 text-xs underline underline-offset-2"
                  onClick={() => { setMagicStatus('idle'); setMagicEmail('') }}
                >
                  {t('tryDifferentEmail')}
                </button>
              </div>
            ) : (
              <form onSubmit={onMagicSubmit} className="space-y-4" noValidate>
                <div className="space-y-1.5">
                  <label htmlFor="magic-email" className="block text-sm font-medium">
                    {t('emailLabel')}
                  </label>
                  <input
                    id="magic-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={magicEmail}
                    onChange={(e) => setMagicEmail(e.target.value)}
                    aria-invalid={magicStatus === 'invalid'}
                    className={inputClass}
                    placeholder={t('emailPlaceholder')}
                  />
                  {magicStatus === 'invalid' && (
                    <p className="text-sm text-red-700 dark:text-red-300">{t('errorInvalidEmail')}</p>
                  )}
                </div>
                <button type="submit" disabled={magicStatus === 'sending'} className={primaryBtn}>
                  {magicStatus === 'sending' ? t('sending') : t('sendLink')}
                </button>
                {magicStatus === 'error' && (
                  <p role="alert" className="text-sm text-red-700 dark:text-red-300">{t('genericError')}</p>
                )}
              </form>
            )}
          </div>
        )}

        {/* Password login tab */}
        {tab === 'login' && (
          <div role="tabpanel">
            {showResetForm ? (
              <form onSubmit={onResetSubmit} className="space-y-4" noValidate>
                {resetStatus === 'sent' ? (
                  <div className="rounded-lg bg-teal-50 dark:bg-teal-900/30 p-4 text-sm text-teal-800 dark:text-teal-100">
                    {t('passwordResetSentDesc', { email: resetEmail })}
                    <p className="mt-1 text-xs opacity-80">{t('passwordResetExpiry')}</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <label htmlFor="reset-email" className="block text-sm font-medium">
                        {t('emailLabel')}
                      </label>
                      <input
                        id="reset-email"
                        type="email"
                        autoComplete="email"
                        required
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        className={inputClass}
                        placeholder={t('emailPlaceholder')}
                      />
                    </div>
                    {resetStatus === 'invalid' && (
                      <p role="alert" className="text-sm text-red-700 dark:text-red-300">{t('errorInvalidEmail')}</p>
                    )}
                    {resetStatus === 'error' && (
                      <p role="alert" className="text-sm text-red-700 dark:text-red-300">{t('genericError')}</p>
                    )}
                    <button type="submit" disabled={resetStatus === 'submitting'} className={primaryBtn}>
                      {resetStatus === 'submitting' ? t('sending') : t('requestNewLink')}
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className="text-sm text-teal-600 dark:text-teal-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded"
                  onClick={() => {
                    setShowResetForm(false)
                    setResetStatus('idle')
                  }}
                >
                  {t('backToLogin')}
                </button>
              </form>
            ) : (
              <form onSubmit={onLoginSubmit} className="space-y-4" noValidate>
                <div className="space-y-1.5">
                  <label htmlFor="login-email" className="block text-sm font-medium">
                    {t('emailLabel')}
                  </label>
                  <input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className={inputClass}
                    placeholder={t('emailPlaceholder')}
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="login-password" className="block text-sm font-medium">
                    {t('passwordLabel2')}
                  </label>
                  <input
                    id="login-password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className={inputClass}
                  />
                  <div className="text-right">
                    <button
                      type="button"
                      className="text-sm text-teal-600 dark:text-teal-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded"
                      onClick={() => {
                        setResetEmail(loginEmail)
                        setShowResetForm(true)
                      }}
                    >
                      {t('forgotPassword')}
                    </button>
                  </div>
                </div>
                {loginStatus === 'invalid_credentials' && (
                  <p role="alert" className="text-sm text-red-700 dark:text-red-300">{t('loginFailed')}</p>
                )}
                {loginStatus === 'error' && (
                  <p role="alert" className="text-sm text-red-700 dark:text-red-300">{t('genericError')}</p>
                )}
                <button type="submit" disabled={loginStatus === 'submitting'} className={primaryBtn}>
                  {loginStatus === 'submitting' ? t('loggingIn') : t('login')}
                </button>
                <p className="text-center text-sm text-pulse-500">
                  {t('noPassword')}{' '}
                  <button
                    type="button"
                    className="text-teal-600 dark:text-teal-400 hover:underline"
                    onClick={() => setTab('magic')}
                  >
                    {t('useMagicLink')}
                  </button>
                </p>
              </form>
            )}
          </div>
        )}

        {/* Signup tab */}
        {tab === 'signup' && (
          <div role="tabpanel">
            <form onSubmit={onSignupSubmit} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <label htmlFor="signup-email" className="block text-sm font-medium">
                  {t('emailLabel')}
                </label>
                <input
                  id="signup-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  className={inputClass}
                  placeholder={t('emailPlaceholder')}
                />
                {signupStatus === 'email_taken' && (
                  <p className="text-sm text-red-700 dark:text-red-300">{t('signupFailed')}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <label htmlFor="signup-name" className="block text-sm font-medium">
                  {t('nameOptional')}
                </label>
                <input
                  id="signup-name"
                  type="text"
                  autoComplete="name"
                  value={signupName}
                  onChange={(e) => setSignupName(e.target.value)}
                  className={inputClass}
                  placeholder={t('namePlaceholder')}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="signup-password" className="block text-sm font-medium">
                  {t('passwordLabel')}
                </label>
                <input
                  id="signup-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={signupPassword}
                  onChange={(e) => { setSignupPassword(e.target.value); if (signupStatus === 'password_too_short') setSignupStatus('idle') }}
                  aria-invalid={signupStatus === 'password_too_short'}
                  className={inputClass}
                />
                {signupStatus === 'password_too_short' && (
                  <p role="alert" className="text-sm text-red-700 dark:text-red-300">{t('passwordMin8')}</p>
                )}
              </div>
              {signupStatus === 'error' && (
                <p role="alert" className="text-sm text-red-700 dark:text-red-300">{t('genericError')}</p>
              )}
              <button type="submit" disabled={signupStatus === 'submitting'} className={primaryBtn}>
                {signupStatus === 'submitting' ? t('loggingIn') : t('createAccount')}
              </button>
              <p className="text-center text-sm text-pulse-500">
                {t('alreadyHaveAccount')}{' '}
                <button
                  type="button"
                  className="text-teal-600 dark:text-teal-400 hover:underline"
                  onClick={() => setTab('login')}
                >
                  {t('login')}
                </button>
              </p>
            </form>
          </div>
        )}

        {/* Continue without account */}
        <p className="text-center text-sm">
          <a href="/" className="text-pulse-500 hover:text-pulse-700 dark:hover:text-pulse-300 underline underline-offset-2">
            {t('continueWithoutAccount')}
          </a>
        </p>
        <BuildStamp />
      </section>
    </main>
  )
}

function MicrosoftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 21 21" aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  )
}
