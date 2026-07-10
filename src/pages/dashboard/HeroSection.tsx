import { useEffect } from 'react'
import { ChevronDown, Megaphone, Sparkles } from 'lucide-react'
import { useT } from '../../i18n'
import type { DashboardSection } from '../../layouts/AppShellLayout'

interface HeroSectionProps {
  userName: string
  townhallFeatureEnabled: boolean
  isTeamPlan: boolean
  creatingTownhall: boolean
  newMenuOpen: boolean
  newMenuRef: React.RefObject<HTMLDivElement | null>
  onToggleMenu: () => void
  onOpenWizard: () => void
  onCreateTownhall: () => void
  setActiveSection: (s: DashboardSection) => void
}

export function HeroSection({
  userName,
  townhallFeatureEnabled,
  isTeamPlan,
  creatingTownhall,
  newMenuOpen,
  newMenuRef,
  onToggleMenu,
  onOpenWizard,
  onCreateTownhall,
  setActiveSection,
}: HeroSectionProps) {
  const t = useT('dashboard')

  // Menu Button pattern (WAI-ARIA): move focus into the menu on open and let
  // ↑/↓ traverse the items so keyboard users get the navigation the role implies.
  useEffect(() => {
    if (!newMenuOpen) return
    const first = newMenuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')
    first?.focus()
  }, [newMenuOpen, newMenuRef])

  function onMenuKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const items = Array.from(newMenuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])
    if (items.length === 0) return
    const idx = items.findIndex((el) => el === document.activeElement)
    const next = e.key === 'ArrowDown'
      ? items[(idx + 1) % items.length]
      : items[(idx - 1 + items.length) % items.length]
    next.focus()
  }
  return (
    <section aria-labelledby="hero-heading">
      <h1
        id="hero-heading"
        tabIndex={-1}
        className="font-display text-4xl lg:text-5xl font-bold text-pulse-900 dark:text-[#F0F2F8] focus:outline-none"
      >
        {t('greeting', { name: userName })}
      </h1>
      <p className="mt-2 text-lg text-pulse-500 dark:text-[#A8B3CC]">
        {t('sessionSubtext')}
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        {townhallFeatureEnabled ? (
          <div ref={newMenuRef} className="relative">
            <button
              type="button"
              onClick={onToggleMenu}
              aria-haspopup="menu"
              aria-expanded={newMenuOpen}
              disabled={creatingTownhall}
              className="inline-flex items-center gap-2 rounded-lg bg-pulse-900 dark:bg-[#F0F2F8] text-white dark:text-pulse-900 px-6 py-2.5 text-sm font-semibold shadow-card hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Sparkles size={15} aria-hidden="true" />
              {t('newSession').replace('+ ', '')}
              <ChevronDown
                size={15}
                aria-hidden="true"
                className={`transition-transform ${newMenuOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {newMenuOpen && (
              <div
                role="menu"
                aria-label={t('chooseSessionType')}
                onKeyDown={onMenuKeyDown}
                className="absolute left-0 z-20 mt-2 w-72 rounded-xl border border-pulse-200 dark:border-[#2A3858] bg-white dark:bg-[#0F1729] p-1.5 shadow-lg"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { onToggleMenu(); onOpenWizard() }}
                  className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-pulse-50 dark:hover:bg-[#1A2440] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                >
                  <Sparkles size={18} className="mt-0.5 shrink-0 text-teal-600 dark:text-teal-400" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-pulse-900 dark:text-[#F0F2F8]">{t('interactiveSession')}</span>
                    <span className="block text-xs text-pulse-500 dark:text-[#A8B3CC]">{t('interactiveSessionDesc')}</span>
                  </span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { onToggleMenu(); void onCreateTownhall() }}
                  className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-pulse-50 dark:hover:bg-[#1A2440] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                >
                  <Megaphone size={18} className="mt-0.5 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-pulse-900 dark:text-[#F0F2F8]">{t('townhallSession')}</span>
                      {!isTeamPlan && (
                        <span className="rounded-full bg-violet-100 dark:bg-violet-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
                          {t('teamBadge')}
                        </span>
                      )}
                    </span>
                    <span className="block text-xs text-pulse-500 dark:text-[#A8B3CC]">{t('townhallSessionDesc')}</span>
                  </span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={onOpenWizard}
            className="inline-flex items-center gap-2 rounded-lg bg-pulse-900 dark:bg-[#F0F2F8] text-white dark:text-pulse-900 px-6 py-2.5 text-sm font-semibold shadow-card hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 transition-opacity"
          >
            <Sparkles size={15} aria-hidden="true" />
            {t('newSession').replace('+ ', '')}
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            const el = document.getElementById('section-templates')
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
            setActiveSection('templates')
          }}
          className="inline-flex items-center gap-2 rounded-lg border border-pulse-300 dark:border-[#2A3858] bg-white dark:bg-transparent text-pulse-700 dark:text-[#A8B3CC] px-6 py-2.5 text-sm font-semibold hover:border-teal-400 dark:hover:border-teal-600 hover:text-teal-700 dark:hover:text-teal-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 transition-colors"
        >
          {t('startFromTemplate')}
        </button>
        <button
          type="button"
          disabled
          title={t('importComingSoon')}
          className="inline-flex items-center gap-2 rounded-lg border border-pulse-200 dark:border-[#1E2A45] bg-white dark:bg-transparent text-pulse-500 dark:text-[#8A96B0] px-6 py-2.5 text-sm font-semibold cursor-not-allowed opacity-60"
        >
          {t('importSession')}
        </button>
      </div>
    </section>
  )
}
