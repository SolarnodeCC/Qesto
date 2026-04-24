import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useT } from '../i18n'
import MainLayout from '../layouts/MainLayout'
import AIBadge from '../components/AIBadge'

const AI_FEATURES = [
  {
    icon: '✨',
    title: 'AI-generated questions',
    desc: 'Describe your session goal and Qesto drafts a complete question set in seconds — no blank page.',
  },
  {
    icon: '📊',
    title: 'Real-time insights',
    desc: 'Cross-session theme detection surfaces patterns across your team\'s feedback automatically.',
  },
  {
    icon: '🔒',
    title: 'Privacy by default',
    desc: 'All AI runs on-device via Cloudflare Workers AI. Your data never leaves the edge.',
  },
]

export default function Home() {
  const auth = useAuth()
  const t = useT('home')

  const navSlot = (
    <>
      {auth.status === 'authenticated' ? (
        <button
          type="button"
          onClick={() => void auth.logout()}
          className="text-sm text-teal-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 rounded"
        >
          Sign out
        </button>
      ) : auth.status === 'anonymous' ? (
        <Link
          to="/login"
          className="text-sm font-medium text-teal-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 rounded"
        >
          Sign in
        </Link>
      ) : null}
    </>
  )

  return (
    <MainLayout navSlot={navSlot} mainClassName="min-h-screen flex flex-col">
      {/* Hero */}
      <div className="animate-page-enter flex-1 flex flex-col items-center justify-center p-8 text-center space-y-8">
        <div className="max-w-2xl space-y-6">
          {/* AI narrative pill */}
          <div className="flex items-center justify-center gap-2">
            <AIBadge variant="assisted" label="AI-first" />
            <span className="text-caption text-pulse-500">{t('heroTagline')}</span>
          </div>

          <h1
            tabIndex={-1}
            className="text-4xl md:text-6xl font-semibold bg-gradient-to-br from-teal-500 to-violet-600 bg-clip-text text-transparent focus:outline-none"
          >
            {t('heroTitle')}
          </h1>

          <p className="text-lg text-pulse-600 max-w-xl mx-auto">
            {t('heroDescription')}
          </p>

          <div className="flex items-center justify-center gap-3">
            {auth.status === 'authenticated' ? (
              <div className="flex flex-col items-center gap-2">
                <Link
                  to="/dashboard"
                  className="inline-flex items-center rounded-lg bg-gradient-to-br from-teal-500 to-violet-600 text-white px-6 py-3 font-semibold hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 btn-motion shadow-teal"
                >
                  {t('goToDashboard')}
                </Link>
                <span className="text-xs text-pulse-500">
                  {t('signedInAs', { email: auth.user.email })}
                </span>
              </div>
            ) : auth.status === 'loading' ? (
              <span className="text-sm text-pulse-500">{t('loading')}</span>
            ) : (
              <div className="flex gap-3">
                <Link
                  to="/login"
                  className="inline-flex items-center rounded-lg bg-gradient-to-br from-teal-500 to-violet-600 text-white px-6 py-3 font-semibold hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 btn-motion shadow-teal"
                >
                  {t('getStartedFree')}
                </Link>
                <Link
                  to="/pricing"
                  className="inline-flex items-center rounded-lg border border-pulse-300 text-pulse-700 px-6 py-3 font-medium hover:border-teal-400 hover:text-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 btn-motion"
                >
                  {t('seePricing')}
                </Link>
              </div>
            )}
          </div>

        </div>

        {/* AI 3-up feature strip (AI-VIS-01) */}
        <div className="w-full max-w-3xl">
          <ul className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {AI_FEATURES.map((feat, i) => (
              <li
                key={feat.title}
                className="animate-list-item rounded-xl border border-pulse-200 dark:border-pulse-700 bg-white dark:bg-pulse-900 p-5 text-left space-y-2 shadow-card"
                style={{ '--stagger-index': i } as React.CSSProperties}
              >
                <span className="text-2xl" aria-hidden="true">{feat.icon}</span>
                <h2 className="text-sm font-semibold dark:text-pulse-100">{feat.title}</h2>
                <p className="text-caption text-pulse-500 leading-relaxed">{feat.desc}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </MainLayout>
  )
}
