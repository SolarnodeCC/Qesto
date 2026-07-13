import { Link } from 'react-router-dom'
import { useT } from '../i18n'

export default function NotFound() {
  const t = useT('not-found')
  return (
    <main id="main" className="min-h-screen flex items-center justify-center p-12">
      <div className="text-center space-y-4">
        <p className="text-6xl font-semibold text-violet-600" aria-hidden="true">404</p>
        <h1 tabIndex={-1} className="text-pulse-600 dark:text-[#A8B3CC] focus:outline-none">{t('pageNotFound')}</h1>
        <Link to="/" className="text-teal-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 rounded">
          {t('backHome')}
        </Link>
      </div>
    </main>
  )
}
