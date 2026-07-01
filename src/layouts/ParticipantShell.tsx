import { type ReactNode } from 'react'
import SkipLink from '../components/SkipLink'
import LegalFooter from './LegalFooter'

type MaxWidth = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl'

const MAX_WIDTH_CLASS: Record<MaxWidth, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
}

interface ParticipantShellProps {
  /** Page title, rendered as the `<h1>`. */
  title: string
  /**
   * Pre-resolved connection status string (page owns the i18n namespace). When
   * non-null a standard amber indicator is shown; pass `null` when connected.
   */
  connectionLabel?: string | null
  /** Optional secondary line under the title. */
  subtitle?: string
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
  subtitle,
  maxWidth = 'xl',
  children,
}: ParticipantShellProps) {
  return (
    <>
      <SkipLink />
      <div className={`mx-auto flex min-h-dvh flex-col ${MAX_WIDTH_CLASS[maxWidth]} px-5 py-8`}>
        <header className="mb-6 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <img src="/favicon.svg" alt="" width={18} height={18} className="shrink-0" />
            <div>
              <h1 className="text-xl font-bold text-pulse-900 dark:text-[var(--text-primary)]">{title}</h1>
              {subtitle && <p className="text-sm text-pulse-500 dark:text-[var(--text-muted)]">{subtitle}</p>}
            </div>
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

        <LegalFooter className="mt-8" />
      </div>
    </>
  )
}
