import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronDown, Menu, Moon, Sparkles, Sun, X } from 'lucide-react'
import SkipLink from '../components/SkipLink'
import TeamSwitcher from '../components/TeamSwitcher'
import { useT } from '../i18n'
import JoinBar from '../components/JoinBar'
import { useAuth } from '../hooks/useAuth'
import LanguageSwitcher from '../components/LanguageSwitcher'
import { useColorSchemeContext } from '../hooks/ColorSchemeProvider'

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
          isActive ? 'text-teal-600 dark:text-teal-400' : 'text-[var(--text-secondary)]',
        ].join(' ')}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-controls={menuId}
        onClick={() => setIsOpen(open => !open)}
      >
        {label}
        <ChevronDown size={12} aria-hidden="true" className="mt-px" />
      </button>
      <ul
        id={menuId}
        role="menu"
        className={[
          'absolute left-0 top-full mt-1 z-[var(--z-dropdown)] min-w-[160px] rounded-lg border border-[color:var(--color-border)] bg-[var(--color-surface-elevated)] shadow-elevated py-1',
          isOpen ? 'block' : 'hidden',
        ].join(' ')}
      >
        {links.map(link => (
          <li key={link.href} role="none">
            <Link
              to={link.href}
              role="menuitem"
              className="block px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-teal-50 hover:text-teal-700 dark:hover:bg-teal-500/10 dark:hover:text-teal-400 focus:outline-none focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-teal-500 dark:focus-visible:ring-teal-400"
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
  const { scheme, toggle } = useColorSchemeContext()
  const showTeamSwitcher = auth.status === 'authenticated' && location.pathname === '/dashboard'
  const showJoinBar = !HIDE_JOIN_BAR_PATTERNS.some((p) => p.test(location.pathname))

  const MARKETING_PATHS = ['/', '/pricing', '/events', '/hr', '/nonprofit', '/consulting', '/privacy', '/terms', '/legal', '/legal/report']
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

  // LAYOUT-002: below md the marketing nav collapses behind a hamburger — the
  // inline dropdown row does not fit a phone viewport.
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const mobileNavId = useId()
  useEffect(() => {
    setMobileNavOpen(false)
  }, [location.pathname])

  const mobileNavSections = [
    { heading: t('nav.solutions'), links: solutionLinks },
    { heading: t('nav.features'), links: featureLinks },
    { heading: t('nav.useCases'), links: useCaseLinks },
    {
      heading: null,
      links: [
        { label: t('footer.pricing'), href: '/pricing' },
        { label: t('footer.privacyPolicy'), href: '/privacy' },
      ],
    },
  ]

  return (
    <>
      <SkipLink />

      <header className="border-b border-pulse-200 dark:border-white/7 bg-[var(--color-surface)]">
        <div className="grid-container flex items-center justify-between py-3 px-4 md:px-8">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-base font-extrabold uppercase tracking-widest text-teal-700 dark:text-teal-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:focus-visible:ring-teal-400 focus-visible:ring-offset-2 rounded"
          >
            {/* Sparkle mark — DESIGN-POLISH-02 */}
            <Sparkles size={14} aria-hidden="true" className="text-violet-500 flex-shrink-0" />
            Qesto
          </Link>

          <div className="flex items-center gap-3">
            {showTeamSwitcher && <TeamSwitcher />}
            <nav aria-label="Site navigation" className="flex items-center gap-1">
              {isMarketingPage && (
                <div className="hidden md:flex items-center gap-1">
                  <NavDropdown label={t('nav.solutions')} links={solutionLinks} />
                  <NavDropdown label={t('nav.features')} links={featureLinks} />
                  <NavDropdown label={t('nav.useCases')} links={useCaseLinks} />
                  <Link
                    to="/pricing"
                    className="text-sm font-medium text-pulse-600 text-[var(--text-secondary)] hover:text-teal-600 dark:hover:text-teal-400 px-2 py-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:focus-visible:ring-teal-400 focus-visible:ring-offset-2"
                  >
                    {t('footer.pricing')}
                  </Link>
                  <Link
                    to="/privacy"
                    className="text-sm font-medium text-pulse-600 text-[var(--text-secondary)] hover:text-teal-600 dark:hover:text-teal-400 px-2 py-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:focus-visible:ring-teal-400 focus-visible:ring-offset-2"
                  >
                    {t('footer.privacyPolicy')}
                  </Link>
                </div>
              )}
              {!isMarketingPage && <LanguageSwitcher />}
              {navSlot}
            </nav>
            {isMarketingPage && (
              <button
                type="button"
                onClick={() => setMobileNavOpen((open) => !open)}
                aria-expanded={mobileNavOpen}
                aria-controls={mobileNavId}
                aria-label={mobileNavOpen ? t('nav.closeMenu') : t('nav.openMenu')}
                className="md:hidden flex h-11 w-11 items-center justify-center rounded-lg text-pulse-600 text-[var(--text-secondary)] hover:text-pulse-800 dark:hover:text-[var(--text-primary)] hover:bg-pulse-100 dark:hover:bg-white/8 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:focus-visible:ring-teal-400 focus-visible:ring-offset-2 transition-colors"
              >
                {mobileNavOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
              </button>
            )}
            <button
              type="button"
              onClick={toggle}
              aria-label={scheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="ml-1 flex items-center justify-center w-12 h-12 rounded text-pulse-500 text-[var(--text-secondary)] hover:text-pulse-800 dark:hover:text-[var(--text-primary)] hover:bg-pulse-100 dark:hover:bg-white/8 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:focus-visible:ring-teal-400 focus-visible:ring-offset-2 transition-colors duration-200"
            >
              {scheme === 'dark' ? (
                <Sun size={16} aria-hidden="true" />
              ) : (
                <Moon size={16} aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {/* LAYOUT-002: stacked mobile menu — every row is a ≥44px touch target */}
        {isMarketingPage && mobileNavOpen && (
          <nav
            id={mobileNavId}
            aria-label="Mobile site navigation"
            className="md:hidden border-t border-pulse-200 dark:border-white/7 px-4 py-3"
          >
            {mobileNavSections.map((section, i) => (
              <div key={section.heading ?? `section-${i}`} className={i > 0 ? 'mt-2 pt-2 border-t border-pulse-100 dark:border-white/5' : ''}>
                {section.heading && (
                  <p className="px-2 pt-1 pb-0.5 text-xs font-semibold uppercase tracking-wide text-pulse-500 text-[var(--text-muted)]">
                    {section.heading}
                  </p>
                )}
                <ul>
                  {section.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        to={link.href}
                        className="flex items-center min-h-11 px-2 rounded-lg text-sm font-medium text-pulse-700 text-[var(--text-secondary)] hover:bg-teal-50 hover:text-teal-700 dark:hover:bg-teal-500/10 dark:hover:text-teal-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:focus-visible:ring-teal-400"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        )}
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
        <footer className="border-t border-pulse-200 dark:border-white/7 py-8">
          <div className="grid-container px-4 md:px-8 text-xs text-pulse-500 text-[var(--text-muted)] flex flex-wrap items-center justify-between gap-2">
            <span>
              &copy; {new Date().getFullYear()} Qesto. Edge-first, privacy-by-default.
            </span>
            <nav aria-label="Footer navigation">
              <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <li>
                  <Link
                    to="/pricing"
                    className="text-pulse-600 text-[var(--text-secondary)] hover:text-teal-700 dark:hover:text-teal-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:focus-visible:ring-teal-400 focus-visible:ring-offset-2 rounded"
                  >
                    {t('footer.pricing')}
                  </Link>
                </li>
                <li>
                  <Link
                    to="/events"
                    className="text-pulse-600 text-[var(--text-secondary)] hover:text-teal-700 dark:hover:text-teal-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:focus-visible:ring-teal-400 focus-visible:ring-offset-2 rounded"
                  >
                    {t('footer.events')}
                  </Link>
                </li>
                <li>
                  <Link
                    to="/hr"
                    className="text-pulse-600 text-[var(--text-secondary)] hover:text-teal-700 dark:hover:text-teal-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:focus-visible:ring-teal-400 focus-visible:ring-offset-2 rounded"
                  >
                    {t('footer.hr')}
                  </Link>
                </li>
                <li>
                  <Link
                    to="/nonprofit"
                    className="text-pulse-600 text-[var(--text-secondary)] hover:text-teal-700 dark:hover:text-teal-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:focus-visible:ring-teal-400 focus-visible:ring-offset-2 rounded"
                  >
                    {t('footer.nonprofit')}
                  </Link>
                </li>
                <li>
                  <Link
                    to="/consulting"
                    className="text-pulse-600 text-[var(--text-secondary)] hover:text-teal-700 dark:hover:text-teal-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:focus-visible:ring-teal-400 focus-visible:ring-offset-2 rounded"
                  >
                    {t('footer.consulting')}
                  </Link>
                </li>
                <li>
                  <Link
                    to="/features/ai-insights"
                    className="text-pulse-600 text-[var(--text-secondary)] hover:text-teal-700 dark:hover:text-teal-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:focus-visible:ring-teal-400 focus-visible:ring-offset-2 rounded"
                  >
                    {t('footer.aiInsights')}
                  </Link>
                </li>
                <li>
                  <Link
                    to="/features/live-polling"
                    className="text-pulse-600 text-[var(--text-secondary)] hover:text-teal-700 dark:hover:text-teal-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:focus-visible:ring-teal-400 focus-visible:ring-offset-2 rounded"
                  >
                    {t('footer.livePolling')}
                  </Link>
                </li>
                <li>
                  <Link
                    to="/features/privacy"
                    className="text-pulse-600 text-[var(--text-secondary)] hover:text-teal-700 dark:hover:text-teal-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:focus-visible:ring-teal-400 focus-visible:ring-offset-2 rounded"
                  >
                    {t('footer.featurePrivacy')}
                  </Link>
                </li>
                <li>
                  <Link
                    to="/trust/gdpr"
                    className="text-pulse-600 text-[var(--text-secondary)] hover:text-teal-700 dark:hover:text-teal-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:focus-visible:ring-teal-400 focus-visible:ring-offset-2 rounded"
                  >
                    GDPR trust center
                  </Link>
                </li>
                <li>
                  <Link
                    to="/trust/soc2"
                    className="text-pulse-600 text-[var(--text-secondary)] hover:text-teal-700 dark:hover:text-teal-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:focus-visible:ring-teal-400 focus-visible:ring-offset-2 rounded"
                  >
                    SOC 2 trust center
                  </Link>
                </li>
                <li>
                  <Link
                    to="/marketplace"
                    className="text-pulse-600 text-[var(--text-secondary)] hover:text-teal-700 dark:hover:text-teal-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:focus-visible:ring-teal-400 focus-visible:ring-offset-2 rounded"
                  >
                    Partner marketplace
                  </Link>
                </li>
                <li>
                  <Link
                    to="/privacy"
                    className="text-pulse-600 text-[var(--text-secondary)] hover:text-teal-700 dark:hover:text-teal-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:focus-visible:ring-teal-400 focus-visible:ring-offset-2 rounded"
                  >
                    {t('footer.privacyPolicy')}
                  </Link>
                </li>
                <li>
                  <Link
                    to="/terms"
                    className="text-pulse-600 text-[var(--text-secondary)] hover:text-teal-700 dark:hover:text-teal-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:focus-visible:ring-teal-400 focus-visible:ring-offset-2 rounded"
                  >
                    {t('footer.terms')}
                  </Link>
                </li>
                <li>
                  <Link
                    to="/legal"
                    className="text-pulse-600 text-[var(--text-secondary)] hover:text-teal-700 dark:hover:text-teal-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:focus-visible:ring-teal-400 focus-visible:ring-offset-2 rounded"
                  >
                    Legal
                  </Link>
                </li>
                <li>
                  <Link
                    to="/legal/report"
                    className="text-pulse-600 text-[var(--text-secondary)] hover:text-teal-700 dark:hover:text-teal-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:focus-visible:ring-teal-400 focus-visible:ring-offset-2 rounded"
                  >
                    Report illegal content
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
