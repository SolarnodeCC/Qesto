import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import SkipLink from '../components/SkipLink'
import TeamSwitcher from '../components/TeamSwitcher'
import JoinBar from '../components/JoinBar'

const SOLUTION_LINKS = [
  { label: 'Business', href: '/business' },
  { label: 'Education', href: '/education' },
  { label: 'Enterprise', href: '/enterprise' },
  { label: 'Events', href: '/events' },
  { label: 'HR & People', href: '/hr' },
  { label: 'Nonprofits', href: '/nonprofit' },
  { label: 'Consulting', href: '/consulting' },
]

const FEATURE_LINKS = [
  { label: 'AI Insights', href: '/features/ai-insights' },
  { label: 'Live Polling', href: '/features/live-polling' },
  { label: 'Privacy', href: '/features/privacy' },
]

const USE_CASE_LINKS = [
  { label: 'Team Meetings', href: '/use-cases/team-meetings' },
  { label: 'Workshops', href: '/use-cases/workshops' },
  { label: 'Training', href: '/use-cases/training' },
]

function NavDropdown({ label, links }: { label: string; links: Array<{ label: string; href: string }> }) {
  const location = useLocation()
  const isActive = links.some(l => location.pathname === l.href)

  return (
    <div className="relative group">
      <button
        type="button"
        className={[
          'flex items-center gap-1 text-sm font-medium rounded px-2 py-1',
          'hover:text-teal-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2',
          isActive ? 'text-teal-600' : 'text-pulse-600',
        ].join(' ')}
        aria-haspopup="true"
      >
        {label}
        <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-px">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <ul
        role="menu"
        className="absolute left-0 top-full mt-1 hidden group-hover:block group-focus-within:block z-50 min-w-[160px] rounded-lg border border-pulse-200 bg-white dark:bg-pulse-900 shadow-elevated py-1"
      >
        {links.map(link => (
          <li key={link.href} role="none">
            <Link
              to={link.href}
              role="menuitem"
              className="block px-4 py-2 text-sm text-pulse-700 dark:text-pulse-200 hover:bg-teal-50 hover:text-teal-700 dark:hover:bg-teal-900/30 focus:outline-none focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

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
const HIDE_JOIN_BAR_PATTERNS = [/^\/j\//, /\/present$/, /\/present\//]

export default function MainLayout({
  children,
  mainClassName = '',
  navSlot,
  noFooter = false,
}: MainLayoutProps) {
  const location = useLocation()
  const showJoinBar = !HIDE_JOIN_BAR_PATTERNS.some((p) => p.test(location.pathname))

  return (
    <>
      <SkipLink />

      <header className="border-b border-pulse-200 bg-[var(--color-surface)]">
        <div className="grid-container flex items-center justify-between py-3 px-4 md:px-6">
          <a
            href="/"
            className="inline-flex items-center gap-1 text-sm font-bold uppercase tracking-widest text-teal-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 rounded"
          >
            {/* Sparkle mark — DESIGN-POLISH-02 */}
            <svg
              aria-hidden="true"
              focusable="false"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="text-violet-500 flex-shrink-0"
            >
              <path d="M12 2l1.8 5.4 5.7 0-4.6 3.4 1.8 5.4L12 13l-4.7 3.2 1.8-5.4L4.5 7.4l5.7 0z" />
            </svg>
            Qesto
          </a>

          <div className="flex items-center gap-3">
            <TeamSwitcher />
            <nav aria-label="Site navigation" className="flex items-center gap-1">
              <NavDropdown label="Solutions" links={SOLUTION_LINKS} />
              <NavDropdown label="Features" links={FEATURE_LINKS} />
              <NavDropdown label="Use cases" links={USE_CASE_LINKS} />
              <Link
                to="/pricing"
                className="text-sm font-medium text-pulse-600 hover:text-teal-600 px-2 py-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
              >
                Pricing
              </Link>
              {navSlot}
            </nav>
          </div>
        </div>
      </header>

      {showJoinBar && <JoinBar />}

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
              <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <li>
                  <Link
                    to="/pricing"
                    className="hover:text-teal-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 rounded"
                  >
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link
                    to="/events"
                    className="hover:text-teal-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 rounded"
                  >
                    Events
                  </Link>
                </li>
                <li>
                  <Link
                    to="/hr"
                    className="hover:text-teal-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 rounded"
                  >
                    HR
                  </Link>
                </li>
                <li>
                  <Link
                    to="/nonprofit"
                    className="hover:text-teal-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 rounded"
                  >
                    Nonprofits
                  </Link>
                </li>
                <li>
                  <Link
                    to="/consulting"
                    className="hover:text-teal-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 rounded"
                  >
                    Consulting
                  </Link>
                </li>
                <li>
                  <Link
                    to="/features/ai-insights"
                    className="hover:text-teal-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 rounded"
                  >
                    AI Insights
                  </Link>
                </li>
                <li>
                  <Link
                    to="/privacy"
                    className="hover:text-teal-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 rounded"
                  >
                    Privacy
                  </Link>
                </li>
                <li>
                  <Link
                    to="/terms"
                    className="hover:text-teal-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 rounded"
                  >
                    Terms
                  </Link>
                </li>
              </ul>
            </nav>
          </div>
        </footer>
      )}
    </>
  )
}
