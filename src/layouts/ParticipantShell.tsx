import { type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import SkipLink from '../components/SkipLink'
import { useT } from '../i18n'

type MaxWidth = 'sm' | 'md' | 'lg' | 'xl'

const MAX_WIDTH_CLASS: Record<MaxWidth, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
}

interface ParticipantShellProps {
  /** Page title, rendered as the `<h1>`. */
  title: string
  /**
   * Pre-resolved connection status string (page owns the i18n namespace). When
   * non-null a standard amber indicator is shown; pass `null` when connected.
   */
  connectionLabel?: string | null
  /** Content container width. Defaults to `xl`. */
  maxWidth?: MaxWidth
  children: ReactNode
}

/**
 * ParticipantShell — shared chrome for full-screen participant join flows
 * (`*Join` pages) that previously hand-rolled their own header and shipped no
 * footer. Provides the brand mark, a consistent title + connection indicator, a
 * SkipLink, the `<main id="main">` landmark, and — critically — a footer with
 * Privacy/Terms links.
 *
 * These join pages are consent-collection surfaces; the audit
 * (DESIGN_SYSTEM_AUDIT_2026-07-01) flagged the total absence of legal links on
 * every participant flow as a Critical compliance gap. Centralizing them here
 * closes that gap once for every consumer. Icons use the favicon `<img>` mark,
 * never inline `<svg>` (ADR-0071 Hard Rule #9).
 */
export default function ParticipantShell({
  title,
  connectionLabel = null,
  maxWidth = 'xl',
  children,
}: ParticipantShellProps) {
  const t = useT('solutions')
  return (
    <>
      <SkipLink />
      <div className={`mx-auto flex min-h-dvh flex-col ${MAX_WIDTH_CLASS[maxWidth]} px-5 py-8`}>
        <header className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <img src="/favicon.svg" alt="" width={18} height={18} className="shrink-0" />
            <h1 className="text-xl font-bold text-pulse-900 dark:text-[var(--text-primary)]">{title}</h1>
          </div>
          {connectionLabel && (
            <span className="text-xs text-amber-600" role="status">
              {connectionLabel}
            </span>
          )}
        </header>

        <main id="main" tabIndex={-1} className="flex-1 space-y-6 focus:outline-none">
          {children}
        </main>

        <footer className="mt-8 border-t border-pulse-200 dark:border-[var(--color-border)] pt-4 text-xs text-pulse-500 dark:text-[var(--text-muted)]">
          <nav aria-label="Legal" className="flex items-center justify-center gap-4">
            <Link
              to="/privacy"
              className="hover:text-teal-700 dark:hover:text-teal-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 rounded"
            >
              {t('footer.privacyPolicy')}
            </Link>
            <Link
              to="/terms"
              className="hover:text-teal-700 dark:hover:text-teal-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 rounded"
            >
              {t('footer.terms')}
            </Link>
          </nav>
        </footer>
      </div>
    </>
  )
}
