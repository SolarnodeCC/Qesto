import { type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import SkipLink from '../components/SkipLink'

type MaxWidth = 'xl' | '2xl' | '6xl'

const MAX_WIDTH_CLASS: Record<MaxWidth, string> = {
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '6xl': 'max-w-6xl',
}

interface HostConsoleShellProps {
  /** Page title, rendered as the `<h1>`. */
  title: string
  /** Optional secondary line under the title. */
  subtitle?: string
  /**
   * Pre-resolved connection status string (page owns the i18n namespace). When
   * non-null a standard amber indicator is shown; pass `null` when connected.
   */
  connectionLabel?: string | null
  /** Content container width. Defaults to `2xl` (Townhall); Retro/Ideate use `6xl`. */
  maxWidth?: MaxWidth
  /** Where the brand mark links back to. Defaults to the host dashboard. */
  backHref?: string
  children: ReactNode
}

/**
 * HostConsoleShell — shared chrome for full-screen host/moderator consoles
 * (`*Present`, board, organizer pages) that previously hand-rolled their own
 * header. Provides the brand mark, a consistent title/subtitle + connection
 * indicator, a SkipLink, and the `<main id="main">` landmark.
 *
 * Extracted per DESIGN_SYSTEM_AUDIT_2026-07-01 (the ~20 no-layout pages are the
 * root cause of most design drift). Icons use the favicon `<img>` mark, never
 * inline `<svg>`, per ADR-0071 Hard Rule #9.
 */
export default function HostConsoleShell({
  title,
  subtitle,
  connectionLabel = null,
  maxWidth = '2xl',
  backHref = '/dashboard',
  children,
}: HostConsoleShellProps) {
  return (
    <>
      <SkipLink />
      <div className={`mx-auto ${MAX_WIDTH_CLASS[maxWidth]} space-y-5 px-5 py-6`}>
        <header className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link
              to={backHref}
              className="flex items-center gap-1.5 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
              aria-label="Qesto"
            >
              <img src="/favicon.svg" alt="" width={20} height={20} className="shrink-0" />
              <span className="text-sm font-extrabold uppercase tracking-widest text-teal-700 dark:text-teal-400">
                Qesto
              </span>
            </Link>
            <span className="h-5 w-px bg-pulse-200 dark:bg-[var(--color-border)]" aria-hidden="true" />
            <div>
              <h1 className="text-lg font-bold text-pulse-900 dark:text-[var(--text-primary)]">{title}</h1>
              {subtitle && <p className="text-sm text-pulse-500 dark:text-[var(--text-muted)]">{subtitle}</p>}
            </div>
          </div>
          {connectionLabel && (
            <span className="text-xs text-amber-600" role="status">
              {connectionLabel}
            </span>
          )}
        </header>

        <main id="main" tabIndex={-1} className="space-y-5 focus:outline-none">
          {children}
        </main>
      </div>
    </>
  )
}
