import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import SkipLink from '../components/SkipLink'
import TeamSwitcher from '../components/TeamSwitcher'
import { useT } from '../i18n'
import JoinBar from '../components/JoinBar'
import { useAuth } from '../hooks/useAuth'
import LanguageSwitcher from '../components/LanguageSwitcher'
import { useColorScheme } from '../hooks/useColorScheme'

function NavDropdown({ label, links }: { label: string; links: Array<{ label: string; href: string }> }) {
  const location = useLocation()
  const isActive = links.some(l => location.pathname === l.href)
  const [isOpen, setIsOpen] = useState(false)
  const menuId = useId()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const closeTimerRef = useRef<number | null>(null)

  const cancelClose = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }

  const scheduleClose = () => {
    cancelClose()
    // Allow tiny cursor travel gaps between trigger and menu.
    closeTimerRef.current = window.setTimeout(() => setIsOpen(false), 120)
  }

  useEffect(() => {
    setIsOpen(false)
  }, [location.pathname])

  useEffect(() => {
    return () => {
      cancelClose()
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={() => {
        cancelClose()
        setIsOpen(true)
      }}
      onMouseLeave={scheduleClose}
      onFocus={() => {
        cancelClose()
        setIsOpen(true)
      }}
      onBlur={(e) => {
        const nextTarget = e.relatedTarget as Node | null
        if (!nextTarget || !containerRef.current?.contains(nextTarget)) {
          scheduleClose()
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') setIsOpen(false)
      }}
    >
      <button
        type="button"
        className={[
          'flex items-center gap-1 text-sm font-medium rounded px-2 py-1',
          'hover:text-teal-600 dark:hover:text-teal-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:focus-visible:ring-teal-400 focus-visible:ring-offset-2',
          isActive ? 'text-teal-600 dark:text-teal-400' : 'text-pulse-600 dark:text-[#A8B3CC]',
        ].join(' ')}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-controls={menuId}
        onClick={() => setIsOpen(open => !open)}
      >
        {label}
        <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-px">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <ul
        id={menuId}
        role="menu"
        className={[
          'absolute left-0 top-full mt-1 z-50 min-w-[160px] rounded-lg border border-pulse-200 dark:border-white/8 bg-white dark:bg-[#1C2540] shadow-elevated py-1',
          isOpen ? 'block' : 'hidden',
        ].join(' ')}
      >
        {links.map(link => (
          <li key={link.href} role="none">
            <Link
              to={link.href}
              role="menuitem"
              className="block px-4 py-2 text-sm text-pulse-700 dark:text-[#A8B3CC] hover:bg-teal-50 hover:text-teal-700 dark:hover:bg-teal-500/10 dark:hover:text-teal-400 focus:outline-none focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-teal-500 dark:focus-visible:ring-teal-400"
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
  const auth = useAuth()
  const { scheme, toggle } = useColorScheme()
  const showTeamSwitcher = auth.status === 'authenticated' && location.pathname === '/dashboard'
  const showJoinBar = !HIDE_JOIN_BAR_PATTERNS.some((p) => p.test(location.pathname))

  const MARKETING_PATHS = ['/', '/pricing', '/events', '/hr', '/nonprofit', '/consulting', '/privacy', '/terms']
  const isMarketingPage =
    MARKETING_PATHS.includes(location.pathname) ||
    location.pathname.startsWith('/features/') ||
    location.pathname.startsWith('/use-cases/')

  const t = useT('solutions')
  const solutionLinks = [
    { label: t('navLinks.events'), href: '/events' },
    { label: t('navLinks.hr'), href: '/hr' },
    { label: t('navLinks.nonprofit'), href: '/nonprofit' },
    { label: t('navLinks.consulting'), href: '/consulting' },
  ]
  const featureLinks = [
    { label: t('navLinks.aiInsights'), href: '/features/ai-insights' },
    { label: t('navLinks.livePolling'), href: '/features/live-polling' },
    { label: t('navLinks.featurePrivacy'), href: '/features/privacy' },
  ]
  const useCaseLinks = [
    { label: t('navLinks.teamMeetings'), href: '/use-cases/team-meetings' },
    { label: t('navLinks.workshops'), href: '/use-cases/workshops' },
    { label: t('navLinks.training'), href: '/use-cases/training' },
  ]

  return (
    <>
      <SkipLink />

      <header className="border-b border-pulse-200 dark:border-white/7 bg-[var(--color-surface)]">
        <div className="grid-container flex items-center justify-between py-3 px-4 md:px-6">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-base font-extrabold uppercase tracking-widest text-teal-600 dark:text-teal-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:focus-visible:ring-teal-400 focus-visible:ring-offset-2 rounded"
          >
            {/* Sparkle mark — DESIGN-POLISH-02 */}
            <svg
              aria-hidden="true"
              focusable="false"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="text-violet-500 flex-shrink-0"
            >
              <path d="M12 2l1.8 5.4 5.7 0-4.6 3.4 1.8 5.4L12 13l-4.7 3.2 1.8-5.4L4.5 7.4l5.7 0z" />
            </svg>
            Qesto
          </Link>

          <div className="flex items-center gap-3">
            {showTeamSwitcher && <TeamSwitcher />}
            <nav aria-label="Site navigation" className="flex items-center gap-1">
              {isMarketingPage && (
                <>
                  <NavDropdown label={t('nav.solutions')} links={solutionLinks} />
                  <NavDropdown label={t('nav.features')} links={featureLinks} />
                  <NavDropdown label={t('nav.useCases')} links={useCaseLinks} />
                  <Link
                    to="/pricing"
                    className="text-sm font-medium text-pulse-600 dark:text-[#A8B3CC] hover:text-teal-600 dark:hover:text-teal-400 px-2 py-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:focus-visible:ring-teal-400 focus-visible:ring-offset-2"
                  >
                    {t('footer.pricing')}
                  </Link>
                  <Link
                    to="/privacy"
                    className="text-sm font-medium text-pulse-600 dark:text-[#A8B3CC] hover:text-teal-600 dark:hover:text-teal-400 px-2 py-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:focus-visible:ring-teal-400 focus-visible:ring-offset-2"
                  >
                    {t('footer.privacyPolicy')}
                  </Link>
                </>
              )}
              {!isMarketingPage && <LanguageSwitcher />}
              {navSlot}
            </nav>
            <button
              type="button"
              onClick={toggle}
              aria-label={scheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="ml-1 flex items-center justify-center w-8 h-8 rounded text-pulse-500 dark:text-[#A8B3CC] hover:text-pulse-800 dark:hover:text-[#F0F2F8] hover:bg-pulse-100 dark:hover:bg-white/8 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:focus-visible:ring-teal-400 focus-visible:ring-offset-2 transition-colors duration-200"
            >
              {scheme === 'dark' ? (
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="4" />
                  <line x1="12" y1="2" x2="12" y2="6" />
                  <line x1="12" y1="18" x2="12" y2="22" />
                  <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
                  <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
                  <line x1="2" y1="12" x2="6" y2="12" />
                  <line x1="18" y1="12" x2="22" y2="12" />
                  <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
                  <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
                </svg>
              ) : (
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </button>
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
        <footer className="border-t border-pulse-200 dark:border-white/7 py-6">
          <div className="grid-container px-4 md:px-6 text-xs text-pulse-500 dark:text-[#6B7A99] flex flex-wrap items-center justify-between gap-2">
            <span>
              &copy; {new Date().getFullYear()} Qesto. Edge-first, privacy-by-default.
            </span>
            <nav aria-label="Footer navigation">
              <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <li>
                  <Link
                    to="/pricing"
                    className="hover:text-teal-600 dark:hover:text-teal-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:focus-visible:ring-teal-400 focus-visible:ring-offset-2 rounded"
                  >
                    {t('footer.pricing')}
                  </Link>
                </li>
                <li>
                  <Link
                    to="/events"
                    className="hover:text-teal-600 dark:hover:text-teal-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:focus-visible:ring-teal-400 focus-visible:ring-offset-2 rounded"
                  >
                    {t('footer.events')}
                  </Link>
                </li>
                <li>
                  <Link
                    to="/hr"
                    className="hover:text-teal-600 dark:hover:text-teal-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:focus-visible:ring-teal-400 focus-visible:ring-offset-2 rounded"
                  >
                    {t('footer.hr')}
                  </Link>
                </li>
                <li>
                  <Link
                    to="/nonprofit"
                    className="hover:text-teal-600 dark:hover:text-teal-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:focus-visible:ring-teal-400 focus-visible:ring-offset-2 rounded"
                  >
                    {t('footer.nonprofit')}
                  </Link>
                </li>
                <li>
                  <Link
                    to="/consulting"
                    className="hover:text-teal-600 dark:hover:text-teal-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:focus-visible:ring-teal-400 focus-visible:ring-offset-2 rounded"
                  >
                    {t('footer.consulting')}
                  </Link>
                </li>
                <li>
                  <Link
                    to="/features/ai-insights"
                    className="hover:text-teal-600 dark:hover:text-teal-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:focus-visible:ring-teal-400 focus-visible:ring-offset-2 rounded"
                  >
                    {t('footer.aiInsights')}
                  </Link>
                </li>
                <li>
                  <Link
                    to="/features/live-polling"
                    className="hover:text-teal-600 dark:hover:text-teal-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:focus-visible:ring-teal-400 focus-visible:ring-offset-2 rounded"
                  >
                    {t('footer.livePolling')}
                  </Link>
                </li>
                <li>
                  <Link
                    to="/features/privacy"
                    className="hover:text-teal-600 dark:hover:text-teal-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:focus-visible:ring-teal-400 focus-visible:ring-offset-2 rounded"
                  >
                    {t('footer.featurePrivacy')}
                  </Link>
                </li>
                <li>
                  <Link
                    to="/privacy"
                    className="hover:text-teal-600 dark:hover:text-teal-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:focus-visible:ring-teal-400 focus-visible:ring-offset-2 rounded"
                  >
                    {t('footer.privacyPolicy')}
                  </Link>
                </li>
                <li>
                  <Link
                    to="/terms"
                    className="hover:text-teal-600 dark:hover:text-teal-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:focus-visible:ring-teal-400 focus-visible:ring-offset-2 rounded"
                  >
                    {t('footer.terms')}
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
