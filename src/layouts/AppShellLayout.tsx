import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { HelpCircle, Home, Lightbulb, Library, Settings, Users } from 'lucide-react'
import SkipLink from '../components/SkipLink'
import LanguageSwitcher from '../components/LanguageSwitcher'
import { useAuth } from '../hooks/useAuth'
import { useColorScheme } from '../hooks/useColorScheme'
import { useT } from '../i18n'

export type DashboardSection = 'home' | 'insights' | 'teams' | 'templates'

const NAV_ITEMS: { id: DashboardSection; labelKey: string; icon: ReactNode }[] = [
  { id: 'home',      labelKey: 'home',      icon: <Home size={18} aria-hidden="true" /> },
  { id: 'insights',  labelKey: 'insights',  icon: <Lightbulb size={18} aria-hidden="true" /> },
  { id: 'teams',     labelKey: 'teams',     icon: <Users size={18} aria-hidden="true" /> },
  { id: 'templates', labelKey: 'templates', icon: <Library size={18} aria-hidden="true" /> },
]

interface AppShellLayoutProps {
  children: ReactNode
  activeSection: DashboardSection
  onSectionChange: (section: DashboardSection) => void
  planName?: string
  sessionsUsed?: number
  sessionsMax?: number
  isSuperuser?: boolean
}

export default function AppShellLayout({
  children,
  activeSection,
  onSectionChange,
  planName,
  sessionsUsed,
  sessionsMax,
  isSuperuser = false,
}: AppShellLayoutProps) {
  const t = useT('dashboard')
  const auth = useAuth()
  const { scheme, toggle } = useColorScheme()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false)
  const avatarRef = useRef<HTMLDivElement>(null)
  const hamburgerRef = useRef<HTMLButtonElement>(null)

  const userEmail = auth.status === 'authenticated' ? auth.user.email : ''
  const initials = userEmail.slice(0, 2).toUpperCase()

  // Close sidebar on Escape
  useEffect(() => {
    if (!sidebarOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setSidebarOpen(false)
        hamburgerRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [sidebarOpen])

  // Close avatar menu on outside click
  useEffect(() => {
    if (!avatarMenuOpen) return
    function onClickOutside(e: MouseEvent) {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) {
        setAvatarMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [avatarMenuOpen])

  function handleJoinSubmit(e: FormEvent) {
    e.preventDefault()
    const clean = joinCode.trim().toUpperCase()
    if (clean.length < 1) return
    navigate(`/j/${clean}`)
    setJoinCode('')
  }

  function handleNavClick(section: DashboardSection) {
    onSectionChange(section)
    setSidebarOpen(false)
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (section === 'home') {
      window.scrollTo({ top: 0, behavior: prefersReduced ? 'auto' : 'smooth' })
    } else {
      const el = document.getElementById(`section-${section}`)
      if (el) el.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'start' })
    }
  }

  const usagePercent = sessionsUsed !== undefined && sessionsMax && sessionsMax > 0
    ? Math.min(100, Math.round((sessionsUsed / sessionsMax) * 100))
    : null

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-bg)] dark:bg-[#0A0F1E]">
      <SkipLink />

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar ── */}
      <nav
        id="dashboard-sidebar"
        aria-label="Hoofdnavigatie"
        className={[
          'fixed inset-y-0 left-0 z-30 flex w-[240px] flex-col border-r border-pulse-200 dark:border-[#1E2A45]',
          'bg-white dark:bg-[#0F1628] transition-transform duration-200 ease-[cubic-bezier(0.2,0,0,1)]',
          'lg:static lg:z-auto lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        {/* Logo */}
        <div className="flex h-14 shrink-0 items-center px-5 border-b border-pulse-100 dark:border-[#1E2A45]">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm font-extrabold uppercase tracking-widest text-teal-600 dark:text-teal-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 rounded"
          >
            <svg aria-hidden="true" focusable="false" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-violet-500 shrink-0">
              <path d="M12 2l1.8 5.4 5.7 0-4.6 3.4 1.8 5.4L12 13l-4.7 3.2 1.8-5.4L4.5 7.4l5.7 0z" />
            </svg>
            Qesto
          </Link>
        </div>

        {/* Main nav */}
        <ul className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5" role="list">
          {NAV_ITEMS.map(({ id, labelKey, icon }) => {
            const isActive = activeSection === id
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => handleNavClick(id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={[
                    'w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium min-h-[44px]',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 transition-colors',
                    isActive
                      ? 'border-l-2 border-teal-500 pl-[10px] bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-300'
                      : 'text-pulse-600 dark:text-[#A8B3CC] hover:bg-pulse-100 dark:hover:bg-white/5 hover:text-pulse-900 dark:hover:text-[#F0F2F8]',
                  ].join(' ')}
                >
                  <span className="shrink-0">{icon}</span>
                  {t(labelKey)}
                </button>
              </li>
            )
          })}

          {isSuperuser && (
            <li>
              <Link
                to="/admin"
                className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium min-h-[44px] text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-1 transition-colors"
              >
                <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="h-[18px] w-[18px] shrink-0">
                  <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                </svg>
                Admin
              </Link>
            </li>
          )}
        </ul>

        {/* Account links */}
        <div className="border-t border-pulse-100 dark:border-[#1E2A45] px-2 py-3 space-y-0.5">
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-pulse-500 dark:text-[#6B7A99] hover:bg-pulse-100 dark:hover:bg-white/5 hover:text-pulse-800 dark:hover:text-[#A8B3CC] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 transition-colors"
            title="Coming soon"
          >
            <Settings size={16} aria-hidden="true" />
            {t('settings')}
          </a>
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-pulse-500 dark:text-[#6B7A99] hover:bg-pulse-100 dark:hover:bg-white/5 hover:text-pulse-800 dark:hover:text-[#A8B3CC] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 transition-colors"
            title="Coming soon"
          >
            <HelpCircle size={16} aria-hidden="true" />
            {t('help')}
          </a>
        </div>

        {/* Compact plan indicator */}
        {planName && (
          <div className="border-t border-pulse-100 dark:border-[#1E2A45] px-4 py-3">
            <div className="flex items-center justify-between gap-2 text-xs">
              <Link
                to="/pricing"
                className="font-semibold capitalize text-pulse-600 dark:text-[#A8B3CC] hover:text-teal-600 dark:hover:text-teal-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded"
              >
                {planName}
              </Link>
              {sessionsUsed !== undefined && sessionsMax !== undefined && (
                <span className="text-pulse-400 dark:text-[#6B7A99] tabular-nums">
                  {sessionsUsed}/{sessionsMax}
                </span>
              )}
            </div>
            {usagePercent !== null && (
              <div className="mt-1.5 h-1 w-full rounded-full bg-pulse-200 dark:bg-pulse-800 overflow-hidden">
                <div
                  className={[
                    'h-full rounded-full transition-all',
                    usagePercent >= 90 ? 'bg-red-500' : usagePercent >= 70 ? 'bg-amber-500' : 'bg-teal-500',
                  ].join(' ')}
                  style={{ width: `${usagePercent}%` }}
                  aria-hidden="true"
                />
              </div>
            )}
          </div>
        )}
      </nav>

      {/* ── Right column ── */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-pulse-200 dark:border-[#1E2A45] bg-white dark:bg-[#0F1628] px-4 lg:px-6">
          {/* Left: hamburger (mobile only) + compact join form */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              ref={hamburgerRef}
              type="button"
              className="lg:hidden p-2 rounded-md text-pulse-500 hover:bg-pulse-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
              aria-label="Open navigatiemenu"
              aria-expanded={sidebarOpen}
              aria-controls="dashboard-sidebar"
              onClick={() => setSidebarOpen(true)}
            >
              <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zm0 10.5a.75.75 0 01.75-.75h7.5a.75.75 0 010 1.5h-7.5a.75.75 0 01-.75-.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10z" clipRule="evenodd" />
              </svg>
            </button>
            <form
              onSubmit={handleJoinSubmit}
              className="hidden sm:flex items-center gap-0 rounded-lg border border-pulse-200 dark:border-[#2A3858] overflow-hidden"
              aria-label={t('joinSessionPrompt')}
            >
              <span className="pl-3 pr-1 text-xs text-pulse-400 dark:text-[#6B7A99] whitespace-nowrap select-none">
                {t('joinSessionPrompt')}
              </span>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, ''))}
                maxLength={6}
                aria-label="Sessiecode"
                spellCheck={false}
                autoCapitalize="characters"
                className="w-16 bg-transparent py-1.5 px-1 text-sm font-mono font-semibold text-pulse-700 dark:text-[#F0F2F8] placeholder:text-pulse-300 dark:placeholder:text-[#2A3858] focus:outline-none"
                placeholder="ABC1"
              />
              <button
                type="submit"
                disabled={joinCode.trim().length === 0}
                className="px-2.5 py-1.5 text-sm text-pulse-400 dark:text-[#6B7A99] hover:text-teal-600 dark:hover:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-500/10 disabled:opacity-0 transition-colors border-l border-pulse-200 dark:border-[#2A3858]"
                aria-label="Deelnemen"
              >
                →
              </button>
            </form>
          </div>

          {/* Right: lang + dark mode + avatar */}
          <div className="flex items-center gap-2 shrink-0">
            <LanguageSwitcher />
            <button
              type="button"
              onClick={toggle}
              aria-label={scheme === 'dark' ? 'Schakel naar lichte modus' : 'Schakel naar donkere modus'}
              className="flex items-center justify-center w-8 h-8 rounded text-pulse-500 dark:text-[#A8B3CC] hover:text-pulse-800 dark:hover:text-[#F0F2F8] hover:bg-pulse-100 dark:hover:bg-white/8 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 transition-colors"
            >
              {scheme === 'dark' ? (
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="4" /><line x1="12" y1="2" x2="12" y2="6" /><line x1="12" y1="18" x2="12" y2="22" />
                  <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" /><line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
                  <line x1="2" y1="12" x2="6" y2="12" /><line x1="18" y1="12" x2="22" y2="12" />
                  <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" /><line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
                </svg>
              ) : (
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </button>

            {/* Avatar with dropdown */}
            {auth.status === 'authenticated' && (
              <div ref={avatarRef} className="relative">
                <button
                  type="button"
                  onClick={() => setAvatarMenuOpen((v) => !v)}
                  aria-expanded={avatarMenuOpen}
                  aria-haspopup="menu"
                  title={userEmail}
                  className="flex items-center justify-center w-8 h-8 rounded-full bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 text-xs font-bold hover:bg-teal-100 dark:hover:bg-teal-900/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 transition-colors"
                  aria-label={`Account: ${userEmail}`}
                >
                  {initials}
                </button>
                {avatarMenuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 top-full mt-1 z-50 min-w-[180px] rounded-xl border border-pulse-200 dark:border-[#1E2A45] bg-white dark:bg-[#1C2540] shadow-elevated py-1 animate-page-enter"
                  >
                    <div className="px-3 py-2 text-xs text-pulse-500 dark:text-[#6B7A99] border-b border-pulse-100 dark:border-[#1E2A45]">
                      {userEmail}
                    </div>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => { setAvatarMenuOpen(false); void auth.logout() }}
                      className="w-full text-left px-3 py-2 text-sm text-pulse-700 dark:text-[#A8B3CC] hover:bg-pulse-50 dark:hover:bg-white/5 hover:text-red-600 dark:hover:text-red-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500 transition-colors"
                    >
                      Uitloggen
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        {/* Main content */}
        <main
          id="main"
          tabIndex={-1}
          className="flex-1 overflow-y-auto focus:outline-none"
        >
          {children}
        </main>
      </div>
    </div>
  )
}
