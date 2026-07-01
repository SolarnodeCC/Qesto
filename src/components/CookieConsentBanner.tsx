import { useLocation } from 'react-router-dom'
import { useT } from '../i18n'
import { Button } from '../ui/components'
import { useCookieConsent } from '../hooks/useCookieConsent'

// Projected / embedded screens where a consent banner would overlay content the
// audience is watching and where there is no individual visitor to consent.
export function isConsentBannerSuppressed(pathname: string): boolean {
  return (
    pathname.includes('/display') ||
    pathname.endsWith('/present') ||
    pathname.endsWith('/townhall')
  )
}

/**
 * Bottom-anchored, non-blocking cookie banner. Microsoft Clarity (analytics) only
 * loads after the visitor accepts here — see useCookieConsent / src/lib/clarity.ts.
 */
export function CookieConsentBanner() {
  const t = useT('consent')
  const location = useLocation()
  const { consent, accept, reject } = useCookieConsent()

  // Hidden once a choice exists, and on projected/embedded routes.
  if (consent !== null) return null
  if (isConsentBannerSuppressed(location.pathname)) return null

  return (
    <div
      role="region"
      aria-label={t('aria')}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-pulse-200 dark:border-[var(--color-border-strong)] bg-surface dark:bg-[var(--color-surface-elevated)] shadow-elevated animate-page-enter"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="body-s text-pulse-700 dark:text-[var(--text-secondary)]">
          <p className="font-semibold text-ink dark:text-[var(--text-primary)]">{t('title')}</p>
          <p className="mt-1">
            {t('description')}{' '}
            <a
              href="/privacy"
              className="font-medium text-teal-700 underline hover:text-teal-800 dark:text-teal-400"
            >
              {t('privacyLink')}
            </a>
          </p>
        </div>
        <div className="flex shrink-0 gap-3">
          <Button variant="ghost" onClick={reject}>
            {t('reject')}
          </Button>
          <Button variant="primary" onClick={accept}>
            {t('accept')}
          </Button>
        </div>
      </div>
    </div>
  )
}
