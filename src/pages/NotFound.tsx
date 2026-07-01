import { Link } from 'react-router-dom'
import { useT } from '../i18n'
import LegalFooter from '../layouts/LegalFooter'

export default function NotFound() {
  const t = useT('not-found')
  return (
    <div className="min-h-screen flex flex-col">
      <main id="main" className="flex flex-1 flex-col items-center justify-center p-8">
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-2">
            <img src="/favicon.svg" alt="" width={24} height={24} className="shrink-0" />
            <span className="text-sm font-extrabold uppercase tracking-widest text-teal-700 dark:text-teal-400">Qesto</span>
          </div>
          <p className="text-6xl font-semibold text-violet-600" aria-hidden="true">404</p>
          <h1 tabIndex={-1} className="text-pulse-600 dark:text-[var(--text-muted)] focus:outline-none">{t('pageNotFound')}</h1>
          <Link to="/" className="inline-flex min-h-[44px] items-center text-teal-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 rounded">
            {t('backHome')}
          </Link>
        </div>
      </main>
      <LegalFooter className="px-6 pb-6" />
    </div>
  )
}
