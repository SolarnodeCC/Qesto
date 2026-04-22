import type { ReactNode } from 'react'
import SkipLink from '../components/SkipLink'
import TeamSwitcher from '../components/TeamSwitcher'

interface MainLayoutProps {
  /** Content rendered inside `<main id="main">` */
  children: ReactNode
  /** Optional CSS class(es) applied to the `<main>` element */
  mainClassName?: string
  /** Optional nav links rendered inside the `<header><nav>` landmark */
  navSlot?: ReactNode
  /** When true the footer is omitted (e.g. full-screen presenter view) */
  noFooter?: boolean
}

/**
 * MainLayout — semantic landmark wrapper used on every routed page.
 *
 * Renders:
 *   <header>  (site banner with optional nav)
 *     <nav aria-label="Site navigation">
 *   <main id="main">  (page content)
 *   <footer>  (site info)
 *
 * The SkipLink lives here so it appears once per page, before the <header>.
 *
 * WCAG 1.3.6 Identify Purpose, 2.4.1 Bypass Blocks, 2.4.6 Headings and Labels
 */
export default function MainLayout({
  children,
  mainClassName = '',
  navSlot,
  noFooter = false,
}: MainLayoutProps) {
  return (
    <>
      <SkipLink />

      <header className="border-b border-pulse-200 bg-[var(--color-surface)]">
        <div className="grid-container flex items-center justify-between py-3 px-4 md:px-6">
          <a
            href="/"
            className="text-sm font-semibold uppercase tracking-widest text-teal-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 rounded"
          >
            Qesto
          </a>

          <div className="flex items-center gap-3">
            <TeamSwitcher />
            {navSlot ? (
              <nav aria-label="Site navigation">{navSlot}</nav>
            ) : (
              /* Always render a nav landmark — SR users expect it */
              <nav aria-label="Site navigation" />
            )}
          </div>
        </div>
      </header>

      <main
        id="main"
        tabIndex={-1}
        className={[
          // Reset tabIndex outline — focus is managed programmatically
          'focus:outline-none',
          mainClassName,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {children}
      </main>

      {!noFooter && (
        <footer className="border-t border-pulse-200 py-6">
          <div className="grid-container px-4 md:px-6 text-xs text-pulse-500 flex flex-wrap items-center justify-between gap-2">
            <span>
              &copy; {new Date().getFullYear()} Qesto. Edge-first, privacy-by-default.
            </span>
            <nav aria-label="Footer navigation">
              <ul className="flex items-center gap-4">
                <li>
                  <a
                    href="https://qesto.io/privacy"
                    className="hover:text-teal-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 rounded"
                  >
                    Privacy
                  </a>
                </li>
                <li>
                  <a
                    href="https://qesto.io/terms"
                    className="hover:text-teal-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 rounded"
                  >
                    Terms
                  </a>
                </li>
              </ul>
            </nav>
          </div>
        </footer>
      )}
    </>
  )
}
