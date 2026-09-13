import { CalendarClock, Sparkles } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useT } from '../i18n'
import { freeAccessDaysLeft } from '../lib/free-access'

// ADR-0074 — temporary all-users free access. Renders nothing outside the
// window. The plan on `auth.user` is already the granted tier; this banner only
// tells people the access is temporary and when it ends, so nobody is surprised
// when a feature re-locks.

export default function FreeAccessBanner() {
  const auth = useAuth()
  const t = useT('common')

  const promo = auth.status === 'authenticated' ? auth.user.free_access : undefined
  if (!promo?.active || !promo.until) return null

  const daysLeft = freeAccessDaysLeft(promo.until)
  const endsOn = new Date(promo.until).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div
      role="status"
      className="rounded-xl border border-teal-200 dark:border-teal-900/60 bg-teal-50 dark:bg-teal-950/40 px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-1.5"
    >
      <Sparkles className="h-4 w-4 shrink-0 text-teal-600 dark:text-teal-400" aria-hidden="true" />
      <p className="text-sm text-teal-900 dark:text-teal-100">
        <strong className="font-semibold">{t('freeAccess.title')}</strong>{' '}
        <span className="text-teal-800 dark:text-teal-200">{t('freeAccess.body', { date: endsOn })}</span>
      </p>
      <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-teal-300 dark:border-teal-800 bg-white dark:bg-teal-950 px-2.5 py-1 text-xs font-medium text-teal-700 dark:text-teal-300 whitespace-nowrap">
        <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
        {daysLeft <= 0 ? t('freeAccess.endsToday') : t('freeAccess.daysLeft', { count: daysLeft })}
      </span>
    </div>
  )
}
