import { useState, useEffect, useMemo, useRef } from 'react'
import { BookOpen, Check, ChevronDown, FileText, Library, Megaphone, Sparkles, UserRound, X } from 'lucide-react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useSessions } from '../hooks/useSessions'
import { useInsights } from '../hooks/useInsights'
import type { PollOption } from '@/types/session'
import type { SessionSummary } from '../types/session'
import { useQuotaUsage } from '../hooks/useQuotaUsage'
import { useT } from '../i18n'
import { api, getAuthToken } from '../api/client'
import AppShellLayout, { type DashboardSection } from '../layouts/AppShellLayout'
import { SessionListSkeleton } from '../components/SkeletonLoader'
import InsightThemeCard from '../components/InsightThemeCard'
import AINarrative from '../components/AINarrative'
import { CoachingCard } from '../components/CoachingCard'
import { SimilarSessionsPanel } from '../components/SimilarSessionsPanel'
import SessionWizard from '../components/SessionWizard'
import DuplicateSessionModal from '../components/DuplicateSessionModal'
import { SessionCard, SessionCardSkeleton } from './dashboard/SessionCard'

const SUPERUSER_EMAIL = (import.meta.env.VITE_SUPERUSER_EMAIL as string | undefined) ?? ''

type StatusFilter = 'all' | 'live' | 'draft' | 'closed'

interface Template {
  id: string
  type: 'qesto' | 'customer'
  name: string
  description: string
  category: string
  topic: string
  previewAlt: string
  questions: Array<{ kind: string; prompt: string; options: PollOption[] }>
}

interface TemplateModalState {
  open: boolean
  template: Template | null
}



// ─── Filter chips ─────────────────────────────────────────────────────────────

function FilterChips({ value, onChange }: { value: StatusFilter; onChange: (v: StatusFilter) => void }) {
  const t = useT('dashboard')
  const chips: { id: StatusFilter; label: string }[] = [
    { id: 'all',    label: t('filterAll') },
    { id: 'live',   label: t('filterLive') },
    { id: 'draft',  label: t('filterDraft') },
    { id: 'closed', label: t('filterClosed') },
  ]
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter op status">
      {chips.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          aria-pressed={value === id}
          onClick={() => onChange(id)}
          className={[
            'rounded-full px-3 py-1 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1',
            value === id
              ? 'bg-teal-600 text-white shadow-inner'
              : 'bg-white dark:bg-[#151C2E] border border-pulse-200 dark:border-[#1E2A45] text-pulse-600 dark:text-[#A8B3CC] hover:border-teal-400 dark:hover:border-teal-600 hover:text-teal-700 dark:hover:text-teal-400',
          ].join(' ')}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

// ─── TemplateGroup (preserved) ────────────────────────────────────────────────

function TemplateGroup({
  title,
  subtitle,
  icon,
  templates,
  onPreview,
}: {
  title: string
  subtitle: string
  icon: 'customer' | 'qesto'
  templates: Template[]
  onPreview: (template: Template) => void
}) {
  const t = useT('dashboard')
  const Icon = icon === 'customer' ? UserRound : Library
  if (templates.length === 0) return null
  return (
    <section className="space-y-3" aria-labelledby={`tmpl-group-${title.replace(/\s+/g, '-').toLowerCase()}`}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300 shrink-0" aria-hidden="true">
          <Icon size={18} />
        </span>
        <div>
          <h3 id={`tmpl-group-${title.replace(/\s+/g, '-').toLowerCase()}`} className="text-base font-semibold text-pulse-900 dark:text-[#F0F2F8]">
            {title}
          </h3>
          <p className="text-sm text-pulse-500 dark:text-[#A8B3CC]">{subtitle}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {templates.map((tmpl) => (
          <button
            key={tmpl.id}
            type="button"
            onClick={() => onPreview(tmpl)}
            className="text-left overflow-hidden rounded-lg border border-pulse-200 dark:border-[#1E2A45] dark:bg-[#151C2E] hover:border-teal-300 dark:hover:border-teal-600 hover:bg-teal-50 dark:hover:bg-teal-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:focus-visible:ring-teal-400 focus-visible:ring-offset-2 transition-colors"
          >
            <div
              role="img"
              aria-label={tmpl.previewAlt}
              className="h-24 bg-[linear-gradient(135deg,#f0fdfa_0%,#eef2ff_55%,#fff7ed_100%)] dark:bg-[linear-gradient(135deg,#103f3c_0%,#24255a_55%,#3f2a12_100%)] p-3"
            >
              <div className="flex h-full items-end justify-between gap-3" aria-hidden="true">
                <BookOpen className="h-7 w-7 text-teal-700/60 dark:text-teal-300/70" />
                <div className="flex gap-1">
                  <span className="h-8 w-5 rounded bg-teal-500/25" />
                  <span className="h-12 w-5 rounded bg-violet-500/25" />
                  <span className="h-6 w-5 rounded bg-amber-500/25" />
                </div>
              </div>
            </div>
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <h4 className="font-medium text-pulse-900 dark:text-[#F0F2F8]">{tmpl.name}</h4>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-pulse-100 px-2 py-0.5 text-xs text-pulse-600 dark:bg-pulse-800 dark:text-[#A8B3CC]">
                  <FileText size={12} aria-hidden="true" />
                  {t('templateQuestionCount', { count: tmpl.questions.length })}
                </span>
              </div>
              <p className="text-sm text-pulse-500 dark:text-[#A8B3CC] mt-1 line-clamp-2">{tmpl.description}</p>
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

type DuplicateModalState = { sourceId: string; sourceTitle: string } | null

export default function Dashboard() {
  const auth = useAuth()
  const navigate = useNavigate()
  const t = useT('dashboard')
  const [activeSection, setActiveSection] = useState<DashboardSection>('home')
  const { state, refresh } = useSessions()
  const userId = auth.status === 'authenticated' ? auth.user.id : undefined
  void useQuotaUsage(userId)
  const closedSessions =
    state.status === 'ready'
      ? state.sessions.filter((s) => s.status === 'closed' || s.status === 'archived')
      : []
  const { themes: insightThemes, loading: insightsLoading, planGated, analyzeSession } = useInsights(
    closedSessions,
    activeSection === 'insights',
  )
  const [wizardOpen, setWizardOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [templates, setTemplates] = useState<Template[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(true)
  const [modal, setModal] = useState<TemplateModalState>({ open: false, template: null })
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [teams, setTeams] = useState<Array<{ id: string; name: string; plan: string }>>([])
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<Record<string, string>>({})
  const [actionFeedback, setActionFeedback] = useState<Record<string, { message: string; isError: boolean }>>({})
  const [teamsLoading, setTeamsLoading] = useState(true)
  const [duplicateModal, setDuplicateModal] = useState<DuplicateModalState>(null)
  const [newMenuOpen, setNewMenuOpen] = useState(false)
  const [creatingTownhall, setCreatingTownhall] = useState(false)
  const newMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    async function loadTemplates() {
      setTemplatesLoading(true)
      try {
        const qestoBody = await api<{ templates: Template[] }>('/api/templates')
        const customerBody = await api<{ templates: Template[] }>('/api/templates/mine')
        if (cancelled) return
        const qestoTemplates = qestoBody.ok ? qestoBody.data.templates : []
        const customerTemplates = customerBody.ok ? customerBody.data.templates : []
        setTemplates([...customerTemplates, ...qestoTemplates])
      } catch {
        if (!cancelled) setTemplates([])
      } finally {
        if (!cancelled) setTemplatesLoading(false)
      }
    }
    void loadTemplates()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    void api<{ teams: Array<{ id: string; name: string; plan: string }> }>('/api/teams')
      .then((res) => { if (res.ok) setTeams(res.data.teams) })
      .finally(() => setTeamsLoading(false))
  }, [])

  useEffect(() => {
    if (!wizardOpen) return
    void api<unknown>('/api/sessions/journey-events', {
      method: 'POST',
      body: { event: 'wizard.opened' },
    })
  }, [wizardOpen])

  // Close the "New session" dropdown on outside click or Escape.
  useEffect(() => {
    if (!newMenuOpen) return
    function onPointer(e: MouseEvent) {
      if (newMenuRef.current && !newMenuRef.current.contains(e.target as Node)) setNewMenuOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setNewMenuOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [newMenuOpen])

  // IntersectionObserver: update activeSection as user scrolls
  useEffect(() => {
    const sections: { id: DashboardSection; elId: string }[] = [
      { id: 'insights',  elId: 'section-insights' },
      { id: 'teams',     elId: 'section-teams' },
      { id: 'templates', elId: 'section-templates' },
    ]
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const match = sections.find((s) => s.elId === entry.target.id)
            if (match) setActiveSection(match.id)
          }
        }
      },
      { threshold: 0.3 },
    )
    for (const { elId } of sections) {
      const el = document.getElementById(elId)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [])

  if (auth.status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--color-bg)]">
        <div className="space-y-4 w-80">
          <div className="h-8 w-48 rounded-lg bg-pulse-200 dark:bg-pulse-800 skeleton-shimmer" aria-hidden="true" />
          <SessionListSkeleton rows={3} />
        </div>
      </div>
    )
  }
  if (auth.status === 'anonymous') {
    return <Navigate to="/login" replace />
  }

  const isSuperuser = auth.user.email === SUPERUSER_EMAIL
  const userName = auth.user.email.split('@')[0]
  // Town hall is a Team-plan feature behind a server flag. Show the entry point
  // only when the flag is on; non-Team users see it as an upsell.
  const townhallFeatureEnabled = auth.user.townhallEnabled === true
  const isTeamPlan = teams.some((tm) => tm.plan === 'team')

  async function onCreateTownhall() {
    if (!isTeamPlan) {
      navigate('/pricing')
      return
    }
    setError(null)
    setCreatingTownhall(true)
    const activeTeamId = localStorage.getItem('activeTeamId') ?? undefined
    const created = await api<{ session: { id: string } }>('/api/sessions', {
      method: 'POST',
      body: { title: t('townhallDefaultTitle'), ...(activeTeamId ? { teamId: activeTeamId } : {}) },
      idempotencyKey: crypto.randomUUID(),
    })
    if (!created.ok) {
      setCreatingTownhall(false)
      setError(created.error.message)
      return
    }
    const sessionId = created.data.session.id
    const configured = await api<unknown>(`/api/sessions/${encodeURIComponent(sessionId)}/townhall/config`, {
      method: 'POST',
      body: { moderation: 'pre' },
    })
    setCreatingTownhall(false)
    if (!configured.ok) {
      if (configured.status === 403) {
        navigate('/pricing')
        return
      }
      setError(configured.error.message)
      return
    }
    navigate(`/sessions/${encodeURIComponent(sessionId)}/townhall`)
  }

  const customerTemplates = templates.filter((tmpl) => tmpl.type === 'customer')
  const qestoTemplates = templates.filter((tmpl) => tmpl.type !== 'customer')
  const qestoTopics = Array.from(new Set(qestoTemplates.map((tmpl) => tmpl.topic || tmpl.category)))

  const wizardInitialTemplate = useMemo(
    () =>
      selectedTemplate
        ? { id: selectedTemplate.id, name: selectedTemplate.name, description: selectedTemplate.description, questions: selectedTemplate.questions }
        : null,
    [selectedTemplate],
  )

  // Recent: up to 4 most recent sessions by created_at desc
  const recentSessions: SessionSummary[] =
    state.status === 'ready'
      ? [...state.sessions].sort((a, b) => b.created_at - a.created_at).slice(0, 4)
      : []

  const filteredSessions: SessionSummary[] =
    state.status === 'ready'
      ? (() => {
          const q = search.trim().toLowerCase()
          return state.sessions.filter((s) => {
            if (statusFilter === 'live' && s.status !== 'live') return false
            if (statusFilter === 'draft' && s.status !== 'draft') return false
            if (statusFilter === 'closed' && s.status !== 'closed' && s.status !== 'archived') return false
            if (!q) return true
            return (
              s.title.toLowerCase().includes(q) ||
              s.code.toLowerCase().includes(q)
            )
          })
        })()
      : []

  function handleUseTemplate() {
    if (!modal.template) return
    setError(null)
    setSelectedTemplate(modal.template)
    setModal({ open: false, template: null })
    setWizardOpen(true)
  }

  function setFeedback(sessionId: string, message: string, isError: boolean) {
    setActionFeedback((prev) => ({ ...prev, [sessionId]: { message, isError } }))
    setTimeout(
      () => setActionFeedback((prev) => { const next = { ...prev }; delete next[sessionId]; return next }),
      3000,
    )
  }

  async function handleDelete(sessionId: string) {
    setActionLoading((prev) => ({ ...prev, [sessionId]: 'delete' }))
    try {
      const token = getAuthToken()
      const headers: Record<string, string> = {}
      if (token) headers['authorization'] = `Bearer ${token}`
      const res = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE', credentials: 'include', headers })
      if (res.ok) {
        setConfirmDeleteId(null)
        await refresh()
      } else {
        setConfirmDeleteId(null)
        setFeedback(sessionId, 'Delete failed', true)
      }
    } finally {
      setActionLoading((prev) => { const next = { ...prev }; delete next[sessionId]; return next })
    }
  }

  function openDuplicateModal(sourceId: string, sourceTitle: string) {
    setDuplicateModal({ sourceId, sourceTitle })
  }

  async function handleSaveAsTemplate(sessionId: string, title: string) {
    setActionLoading((prev) => ({ ...prev, [sessionId]: 'template' }))
    try {
      const res = await api<unknown>('/api/templates/mine', {
        method: 'POST',
        body: { sessionId, name: title },
      })
      if (res.ok) {
        setFeedback(sessionId, 'Saved as template!', false)
      } else {
        setFeedback(sessionId, res.error.message, true)
      }
    } finally {
      setActionLoading((prev) => { const next = { ...prev }; delete next[sessionId]; return next })
    }
  }

  function handleExportCSV(sessionId: string, title: string) {
    const a = document.createElement('a')
    a.href = `/api/sessions/${encodeURIComponent(sessionId)}/export.csv`
    a.download = `${title}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const cardProps = {
    actionLoading,
    actionFeedback,
    confirmDeleteId,
    onDuplicate: (id: string, title: string) => openDuplicateModal(id, title),
    onExportCSV: handleExportCSV,
    onSaveAsTemplate: (id: string, title: string) => void handleSaveAsTemplate(id, title),
    onDelete: (id: string) => void handleDelete(id),
    onConfirmDelete: setConfirmDeleteId,
  }

  return (
    <AppShellLayout
      activeSection={activeSection}
      onSectionChange={setActiveSection}
      isSuperuser={isSuperuser}
    >
      <div className="max-w-[1200px] mx-auto px-6 lg:px-10 py-10 animate-page-enter space-y-12">

        {/* ── Hero ── */}
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
          <div className="mt-6 flex flex-wrap gap-3">
            {townhallFeatureEnabled ? (
              <div ref={newMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setNewMenuOpen((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={newMenuOpen}
                  disabled={creatingTownhall}
                  className="inline-flex items-center gap-2 rounded-lg bg-pulse-900 dark:bg-[#F0F2F8] text-white dark:text-pulse-900 px-5 py-2.5 text-sm font-semibold shadow-card hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
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
                    className="absolute left-0 z-20 mt-2 w-72 rounded-xl border border-pulse-200 dark:border-[#2A3858] bg-white dark:bg-[#0F1729] p-1.5 shadow-lg"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => { setNewMenuOpen(false); setWizardOpen(true) }}
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
                      onClick={() => { setNewMenuOpen(false); void onCreateTownhall() }}
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
                onClick={() => setWizardOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-pulse-900 dark:bg-[#F0F2F8] text-white dark:text-pulse-900 px-5 py-2.5 text-sm font-semibold shadow-card hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 transition-opacity"
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
              className="inline-flex items-center gap-2 rounded-lg border border-pulse-300 dark:border-[#2A3858] bg-white dark:bg-transparent text-pulse-700 dark:text-[#A8B3CC] px-5 py-2.5 text-sm font-semibold hover:border-teal-400 dark:hover:border-teal-600 hover:text-teal-700 dark:hover:text-teal-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 transition-colors"
            >
              {t('startFromTemplate')}
            </button>
            <button
              type="button"
              disabled
              title="Coming soon"
              className="inline-flex items-center gap-2 rounded-lg border border-pulse-200 dark:border-[#1E2A45] bg-white dark:bg-transparent text-pulse-400 dark:text-[#6B7A99] px-5 py-2.5 text-sm font-semibold cursor-not-allowed opacity-60"
            >
              {t('importSession')}
            </button>
          </div>
        </section>

        {/* ── Recent sessions ── */}
        <section aria-labelledby="recent-heading">
          <div className="flex items-center justify-between mb-4">
            <h2 id="recent-heading" className="text-xl font-semibold text-pulse-900 dark:text-[#F0F2F8]">
              {t('recentSessions')}
            </h2>
          </div>
          {state.status === 'loading' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => <SessionCardSkeleton key={i} />)}
            </div>
          ) : state.status === 'error' ? (
            <p role="alert" className="text-sm text-red-600">{state.error.message}</p>
          ) : recentSessions.length === 0 ? (
            <p className="text-sm text-pulse-500 dark:text-[#A8B3CC]">{t('noSessionsYet')}</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {recentSessions.map((s) => (
                <SessionCard key={s.id} session={s} {...cardProps} />
              ))}
            </div>
          )}
        </section>

        {/* ── All sessions ── */}
        <section aria-labelledby="all-sessions-heading">
          <div className="flex items-center justify-between mb-4">
            <h2 id="all-sessions-heading" className="text-xl font-semibold text-pulse-900 dark:text-[#F0F2F8]">
              {t('allSessions')}
            </h2>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            <div className="relative flex-1 max-w-sm">
              <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-pulse-400">
                <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
              </svg>
              <input
                type="search"
                aria-label={t('searchSessions')}
                placeholder={t('searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-pulse-200 dark:border-[#2A3858] bg-white dark:bg-[#1C2540] py-2 pl-9 pr-3 text-sm text-pulse-800 dark:text-[#F0F2F8] placeholder:text-pulse-400 dark:placeholder:text-[#6B7A99] focus:outline-none focus:border-teal-400 dark:focus:border-teal-400 focus:ring-2 focus:ring-teal-200 dark:focus:ring-teal-400/20"
              />
            </div>
            <FilterChips value={statusFilter} onChange={setStatusFilter} />
          </div>
          {state.status === 'loading' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => <SessionCardSkeleton key={i} />)}
            </div>
          ) : state.status === 'error' ? (
            <p role="alert" className="text-sm text-red-600">{state.error.message}</p>
          ) : filteredSessions.length === 0 ? (
            <p className="text-sm text-pulse-500 dark:text-[#A8B3CC] py-6 text-center">
              {search || statusFilter !== 'all' ? t('noMatchingSearch') : t('noSessionsYet')}
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {filteredSessions.map((s) => (
                <SessionCard key={s.id} session={s} {...cardProps} />
              ))}
            </div>
          )}
        </section>

        {/* ── Insights ── */}
        <section id="section-insights" aria-labelledby="insights-heading">
          <h2 id="insights-heading" className="text-xl font-semibold text-pulse-900 dark:text-[#F0F2F8] mb-6">
            {t('insights')}
          </h2>
          <div className="space-y-6">
            <AINarrative />
            {closedSessions[0] && !planGated && (
              <>
                <CoachingCard sessionId={closedSessions[0].id} enabled={!insightsLoading} />
                <SimilarSessionsPanel
                  sessionId={closedSessions[0].id}
                  defaultQuery={closedSessions[0].title}
                  enabled={!insightsLoading}
                />
              </>
            )}
            <div className="space-y-3">
              <h3 className="text-heading-s font-semibold dark:text-pulse-100">{t('topThemes')}</h3>
              {planGated ? (
                <div className="rounded-lg border border-violet-200 bg-violet-50 dark:bg-violet-900/20 dark:border-violet-700 p-5 space-y-3">
                  <p className="text-body-s text-violet-800 dark:text-violet-300 font-medium">{t('aiInsightsPlanRequired')}</p>
                  <p className="text-body-s text-violet-700 dark:text-violet-400">{t('upgradeForInsights')}</p>
                  <Link to="/pricing" className="inline-flex items-center gap-1.5 rounded-md bg-violet-600 text-white px-4 py-2 text-sm font-medium hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2">
                    View plans →
                  </Link>
                </div>
              ) : closedSessions.length === 0 ? (
                <p className="text-body-s text-pulse-500 dark:text-pulse-400">
                  AI-identified themes across your closed sessions. Close more sessions to see richer patterns.
                </p>
              ) : insightsLoading ? (
                <ul className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <li key={i} className="h-24 rounded-lg bg-pulse-200 dark:bg-pulse-700 skeleton-shimmer" aria-hidden="true" />
                  ))}
                </ul>
              ) : insightThemes.length === 0 ? (
                <div className="space-y-4">
                  <p className="text-body-s text-pulse-500 dark:text-pulse-400">{t('insightsEmpty')}</p>
                  <div className="space-y-2">
                    {closedSessions.slice(0, 3).map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => void analyzeSession(s.id)}
                        className="w-full text-left flex items-center justify-between gap-3 p-3 rounded-lg border border-pulse-200 dark:border-[#1E2A45] hover:border-teal-400 dark:hover:border-teal-600 hover:bg-teal-50 dark:hover:bg-teal-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:focus-visible:ring-teal-400 focus-visible:ring-offset-2 transition-colors"
                      >
                        <span className="text-sm font-medium text-pulse-800 dark:text-pulse-200">{s.title}</span>
                        <span className="text-xs text-teal-600 dark:text-teal-400 font-medium flex items-center gap-1">
                          <Sparkles size={12} aria-hidden="true" />
                          Analyze
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <ul className="space-y-3">
                  {insightThemes.map((theme) => (
                    <li key={theme.id}>
                      <InsightThemeCard
                        title={theme.title}
                        description={theme.description}
                        sessionCount={theme.sessionCount}
                        confidence={theme.confidence}
                        trend30d={theme.trend30d}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        {/* ── Teams ── */}
        <section id="section-teams" aria-labelledby="teams-heading">
          <h2 id="teams-heading" className="text-xl font-semibold text-pulse-900 dark:text-[#F0F2F8] mb-4">
            {t('teams')}
          </h2>
          {teamsLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-16 rounded-xl bg-pulse-200 dark:bg-pulse-800 skeleton-shimmer" aria-hidden="true" />
              ))}
            </div>
          ) : teams.length === 0 ? (
            <p className="text-sm text-pulse-500 dark:text-[#A8B3CC]">{t('noTeamsYet')}</p>
          ) : (
            <ul className="divide-y divide-pulse-200 dark:divide-[#1E2A45] rounded-xl border border-pulse-200 dark:border-[#1E2A45]">
              {teams.map((team) => (
                <li key={team.id} className="flex items-center justify-between gap-4 p-4">
                  <div>
                    <p className="font-medium text-pulse-800 dark:text-[#F0F2F8]">{team.name}</p>
                    <p className="text-xs text-pulse-400 dark:text-[#6B7A99] mt-0.5 capitalize">{team.plan} plan</p>
                  </div>
                  <Link
                    to={`/teams/${team.id}/settings`}
                    className="text-sm text-teal-600 dark:text-teal-400 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:focus-visible:ring-teal-400 focus-visible:ring-offset-2 rounded"
                  >
                    Settings →
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── Inspiration / Templates ── */}
        <section id="section-templates" aria-labelledby="inspiration-heading">
          <h2 id="inspiration-heading" className="text-xl font-semibold text-pulse-900 dark:text-[#F0F2F8] mb-2">
            {t('inspiration')}
          </h2>
          <p className="text-sm text-pulse-500 dark:text-[#A8B3CC] mb-6">{t('templateCatalogueIntro')}</p>
          {templatesLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 rounded-lg bg-pulse-200 dark:bg-pulse-800 skeleton-shimmer" aria-hidden="true" />
              ))}
            </div>
          ) : templates.length === 0 ? (
            <p className="text-sm text-pulse-500 dark:text-[#A8B3CC]">{t('noTemplatesAvailable')}</p>
          ) : (
            <div className="space-y-8">
              {customerTemplates.length > 0 && (
                <TemplateGroup
                  title={t('customerTemplates')}
                  subtitle={t('customerTemplatesSubtitle')}
                  icon="customer"
                  templates={customerTemplates}
                  onPreview={(template) => setModal({ open: true, template })}
                />
              )}
              {qestoTopics.map((topic) => (
                <TemplateGroup
                  key={topic}
                  title={t(`templateTopic.${topic}`)}
                  subtitle={t(`templateTopicSubtitle.${topic}`)}
                  icon="qesto"
                  templates={qestoTemplates.filter((tmpl) => (tmpl.topic || tmpl.category) === topic)}
                  onPreview={(template) => setModal({ open: true, template })}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ── Template modal ── */}
      {modal.open && modal.template && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          role="dialog"
          aria-labelledby="modal-title"
          aria-modal="true"
        >
          <div className="bg-white dark:bg-[#1C2540] rounded-xl shadow-xl dark:shadow-[0_24px_64px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.08)] max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 animate-page-enter space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                  {modal.template.type === 'customer' ? t('customerTemplate') : t('qestoTemplate')}
                </p>
                <h2 id="modal-title" className="text-xl font-semibold dark:text-[#F0F2F8] mt-1">
                  {modal.template.name}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setModal({ open: false, template: null })}
                aria-label={t('cancel')}
                className="p-2 rounded-md text-pulse-500 hover:text-pulse-800 hover:bg-pulse-100 dark:hover:bg-white/5 dark:text-[#A8B3CC] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <div
              role="img"
              aria-label={modal.template.previewAlt}
              className="h-32 rounded-lg border border-pulse-200 dark:border-[#2A3858] bg-[linear-gradient(135deg,#f0fdfa_0%,#eef2ff_52%,#fff7ed_100%)] dark:bg-[linear-gradient(135deg,#103f3c_0%,#24255a_52%,#3f2a12_100%)] p-4 grid grid-cols-[1fr_88px] gap-4 overflow-hidden"
            >
              <div className="space-y-2" aria-hidden="true">
                <div className="h-3 w-32 rounded-full bg-white/80 dark:bg-white/20" />
                <div className="h-3 w-48 rounded-full bg-white/70 dark:bg-white/15" />
                <div className="h-3 w-40 rounded-full bg-white/70 dark:bg-white/15" />
              </div>
              <div className="grid grid-cols-2 gap-2" aria-hidden="true">
                <div className="rounded-md bg-teal-500/30" />
                <div className="rounded-md bg-violet-500/30" />
                <div className="rounded-md bg-amber-500/30" />
                <div className="rounded-md bg-pulse-500/20" />
              </div>
            </div>
            <p className="text-sm text-pulse-600 dark:text-[#A8B3CC]">{modal.template.description}</p>
            <section className="space-y-2" aria-labelledby="template-preview-questions">
              <h3 id="template-preview-questions" className="text-sm font-semibold dark:text-[#F0F2F8]">
                {t('templatePreviewQuestions')}
              </h3>
              <ol className="space-y-2">
                {modal.template.questions.slice(0, 5).map((question, index) => (
                  <li key={`${question.prompt}-${index}`} className="flex gap-3 rounded-lg border border-pulse-200 dark:border-[#2A3858] p-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-50 text-xs font-semibold text-teal-700 dark:bg-teal-900/30 dark:text-teal-300">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-pulse-800 dark:text-[#F0F2F8]">{question.prompt}</p>
                      <p className="text-xs text-pulse-500 dark:text-[#A8B3CC] mt-0.5">{question.kind.replace(/_/g, ' ')}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setModal({ open: false, template: null })}
                className="px-4 py-2 rounded-lg border border-pulse-300 dark:border-[#2A3858] dark:text-[#A8B3CC] hover:bg-pulse-50 dark:hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={handleUseTemplate}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 text-white hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
              >
                <Check size={16} aria-hidden="true" />
                {t('useTemplate')}
              </button>
            </div>
          </div>
        </div>
      )}

      <SessionWizard
        open={wizardOpen}
        onClose={() => { setWizardOpen(false); setSelectedTemplate(null) }}
        onSessionCreated={() => { setSelectedTemplate(null); void refresh() }}
        initialTemplate={wizardInitialTemplate}
      />

      <DuplicateSessionModal
        open={duplicateModal !== null}
        sourceId={duplicateModal?.sourceId ?? ''}
        sourceTitle={duplicateModal?.sourceTitle ?? ''}
        existingTitles={state.status === 'ready' ? state.sessions.map((s) => s.title) : []}
        onClose={() => setDuplicateModal(null)}
        onSuccess={(newSessionId) => {
          void refresh()
          navigate(`/sessions/${newSessionId}/launchpad`)
        }}
      />
    </AppShellLayout>
  )
}
