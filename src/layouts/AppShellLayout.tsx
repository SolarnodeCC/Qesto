import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { HelpCircle, Home, Lightbulb, Library, Menu, Moon, Settings, Sparkles, Sun, Users } from 'lucide-react'
import SkipLink from '../components/SkipLink'
import LanguageSwitcher from '../components/LanguageSwitcher'
import { useAuth } from '../hooks/useAuth'
import { useHelpChat } from '../hooks/useHelpChat'
import { useColorSchemeContext } from '../hooks/ColorSchemeProvider'
import { useT } from '../i18n'
import { inputHint } from '../ui/input-hint'
import { COMPACT_CODE_FIELD_CLASS } from '../ui/input-field-class'

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
  isSuperuser?: boolean
}

export default function AppShellLayout({
  children,
  activeSection,
  onSectionChange,
  isSuperuser = false,
}: AppShellLayoutProps) {
  const t = useT('dashboard')
  const tCommon = useT('common')
  const auth = useAuth()
  const { openChat, state: helpChatState } = useHelpChat()
  const { scheme, toggle } = useColorSchemeContext()
  const navigate = useNavigate()
  const location = useLocation()
  const onSettingsPage = location.pathname === '/settings'
  const onAdminPage = location.pathname === '/admin'
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

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-bg)] dark:bg-[var(--color-bg)]">
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
          'fixed inset-y-0 left-0 z-30 flex w-[240px] flex-col border-r border-pulse-200 dark:border-[var(--color-border)]',
          'bg-white dark:bg-[#0F1628] transition-transform duration-200 ease-[cubic-bezier(0.2,0,0,1)]',
          'lg:static lg:z-auto lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        {/* Logo */}
        <div className="flex h-14 shrink-0 items-center px-5 border-b border-pulse-100 dark:border-[var(--color-border)]">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm font-extrabold uppercase tracking-widest text-teal-600 dark:text-teal-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 rounded"
          >
            <Sparkles aria-hidden="true" focusable={false} size={14} className="text-violet-500 shrink-0" />
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
                      : 'text-pulse-600 dark:text-[var(--text-secondary)] hover:bg-pulse-100 dark:hover:bg-white/5 hover:text-pulse-900 dark:hover:text-[#F0F2F8]',
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
                onClick={() => setSidebarOpen(false)}
                aria-current={onAdminPage ? 'page' : undefined}
                className={[
                  'w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium min-h-[44px] transition-colors',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-1',
                  onAdminPage
                    ? 'border-l-2 border-violet-500 pl-[10px] bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300'
                    : 'text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-500/10',
                ].join(' ')}
              >
                <Settings aria-hidden="true" className="h-[18px] w-[18px] shrink-0" />
                Admin
              </Link>
            </li>
          )}
        </ul>

        {/* Account links */}
        <div className="border-t border-pulse-100 dark:border-[var(--color-border)] px-2 py-3 space-y-0.5">
          <Link
            to="/settings"
            onClick={() => setSidebarOpen(false)}
            aria-current={onSettingsPage ? 'page' : undefined}
            className={[
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm min-h-[44px] transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1',
              onSettingsPage
                ? 'bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-300'
                : 'text-pulse-500 dark:text-[var(--text-muted)] hover:bg-pulse-100 dark:hover:bg-white/5 hover:text-pulse-800 dark:hover:text-[#A8B3CC]',
            ].join(' ')}
          >
            <Settings size={16} aria-hidden="true" />
            {t('settings')}
          </Link>
          <button
            type="button"
            onClick={() => {
              openChat()
              setSidebarOpen(false)
            }}
            aria-expanded={helpChatState.isOpen}
            aria-label={t('help')}
            className={[
              'w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm min-h-[44px]',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 transition-colors',
              helpChatState.isOpen
                ? 'bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-300'
                : 'text-pulse-500 dark:text-[var(--text-muted)] hover:bg-pulse-100 dark:hover:bg-white/5 hover:text-pulse-800 dark:hover:text-[#A8B3CC]',
            ].join(' ')}
          >
            <HelpCircle size={16} aria-hidden="true" />
            {t('help')}
          </button>
        </div>

      </nav>

      {/* ── Right column ── */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-pulse-200 dark:border-[var(--color-border)] bg-white dark:bg-[#0F1628] px-4 lg:px-6">
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
              <Menu aria-hidden="true" className="w-5 h-5" />
            </button>
            <form
              onSubmit={handleJoinSubmit}
              className="hidden sm:flex items-center gap-0 rounded-lg border border-pulse-200 dark:border-[var(--color-border-strong)] overflow-hidden"
              aria-label={t('joinSessionPrompt')}
            >
              <span className="pl-3 pr-1 text-xs text-pulse-500 dark:text-[var(--text-muted)] whitespace-nowrap select-none">
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
                className={COMPACT_CODE_FIELD_CLASS}
                {...inputHint("ABC1")}
              />
              <button
                type="submit"
                disabled={joinCode.trim().length === 0}
                className="px-2.5 py-1.5 text-sm text-pulse-500 dark:text-[var(--text-muted)] hover:text-teal-600 dark:hover:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-500/10 disabled:opacity-0 transition-colors border-l border-pulse-200 dark:border-[var(--color-border-strong)]"
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
              className="flex items-center justify-center w-8 h-8 rounded text-pulse-500 dark:text-[var(--text-secondary)] hover:text-pulse-800 dark:hover:text-[#F0F2F8] hover:bg-pulse-100 dark:hover:bg-white/8 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 transition-colors"
            >
              {scheme === 'dark' ? (
                <Sun aria-hidden="true" size={16} />
              ) : (
                <Moon aria-hidden="true" size={16} />
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
                    className="absolute right-0 top-full mt-1 z-50 min-w-[180px] rounded-xl border border-pulse-200 dark:border-[var(--color-border)] bg-white dark:bg-[var(--color-surface-elevated)] shadow-elevated py-1 animate-page-enter"
                  >
                    <div className="px-3 py-2 text-xs text-pulse-500 dark:text-[var(--text-muted)] border-b border-pulse-100 dark:border-[var(--color-border)]">
                      {userEmail}
                    </div>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => { setAvatarMenuOpen(false); void auth.logout() }}
                      className="w-full text-left px-3 py-2 text-sm text-pulse-700 dark:text-[var(--text-secondary)] hover:bg-pulse-50 dark:hover:bg-white/5 hover:text-red-600 dark:hover:text-red-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500 transition-colors"
                    >
                      {tCommon('logout')}
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
