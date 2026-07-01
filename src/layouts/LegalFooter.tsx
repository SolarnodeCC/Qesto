import { Link } from 'react-router-dom'
import { useT } from '../i18n'

interface LegalFooterProps {
  className?: string
}

/**
 * Shared Privacy/Terms footer for auth and participant flows that render
 * outside MainLayout. Centralizes the compliance links flagged in
 * DESIGN_SYSTEM_AUDIT_2026-07-01 (Critical finding #4).
 */
export default function LegalFooter({ className = '' }: LegalFooterProps) {
  const t = useT('solutions')
  return (
    <footer
      className={`border-t border-pulse-200 dark:border-[var(--color-border)] pt-4 text-xs text-pulse-500 dark:text-[var(--text-muted)] ${className}`}
    >
      <nav aria-label="Legal" className="flex items-center justify-center gap-4">
        <Link
          to="/privacy"
          className="rounded hover:text-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:hover:text-teal-400"
        >
          {t('footer.privacyPolicy')}
        </Link>
        <Link
          to="/terms"
          className="rounded hover:text-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:hover:text-teal-400"
        >
          {t('footer.terms')}
        </Link>
      </nav>
    </footer>
  )
}
