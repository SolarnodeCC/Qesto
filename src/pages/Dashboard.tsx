import { useState, useEffect, useMemo, useRef } from 'react'
import { BookOpen, Check, FileText, Library, MoreHorizontal, Sparkles, UserRound, X } from 'lucide-react'
import { Link, Navigate } from 'react-router-dom'
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
import SessionWizard from '../components/SessionWizard'
import { sessionGradient } from '../utils/sessionGradient'

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


// ─── Session Card ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === 'live') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-teal-500 text-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide shadow-sm">
        <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse shrink-0" aria-hidden="true" />
        LIVE
      </span>
    )
  }
  if (status === 'closed' || status === 'archived') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
        Gesloten
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-pulse-100 dark:bg-pulse-800 text-pulse-600 dark:text-[#A8B3CC] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
      Concept
    </span>
  )
}

interface SessionCardProps {
  session: SessionSummary
  actionLoading: Record<string, string>
  actionFeedback: Record<string, { message: string; isError: boolean }>
  confirmDeleteId: string | null
  onDuplicate: (id: string) => void
  onExportCSV: (id: string, title: string) => void
  onSaveAsTemplate: (id: string, title: string) => void
  onDelete: (id: string) => void
  onConfirmDelete: (id: string | null) => void
}

function SessionCard({
  session: s,
  actionLoading,
  actionFeedback,
  confirmDeleteId,
  onDuplicate,
  onExportCSV,
  onSaveAsTemplate,
  onDelete,
  onConfirmDelete,
}: SessionCardProps) {
  const t = useT('dashboard')
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const gradient = sessionGradient(s.id)

  const cardLink =
    s.status === 'live'
      ? `/sessions/${s.id}/present`
      : s.status === 'closed' || s.status === 'archived'
      ? `/sessions/${s.id}/results`
      : `/sessions/${s.id}/launchpad`

  const formattedDate = new Date(s.created_at).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  useEffect(() => {
    if (!menuOpen) return
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  return (
    <article
      className={[
        'group relative flex flex-col rounded-lg border bg-white dark:bg-[#151C2E] shadow-card overflow-hidden',
        'hover:shadow-elevated transition-shadow duration-200',
        s.status === 'live' ? 'border-teal-400 dark:border-teal-600' : 'border-pulse-200 dark:border-[#1E2A45]',
        s.status === 'live' ? 'border-l-[3px] border-l-teal-500' : '',
      ].join(' ')}
      aria-label={`${s.title} — ${s.status}`}
    >
      {/* Gradient thumbnail */}
      <Link
        to={cardLink}
        tabIndex={-1}
        aria-hidden="true"
        className="block"
        style={{ aspectRatio: '16/10', background: gradient }}
      />

      {/* Overlay: status badge + three-dots menu */}
      <div className="absolute top-2 left-2">
        <StatusBadge status={s.status} />
      </div>
      <div ref={menuRef} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          aria-label={`Opties voor ${s.title}`}
          className="flex items-center justify-center w-7 h-7 rounded-md bg-white/80 dark:bg-[#151C2E]/80 backdrop-blur-sm text-pulse-600 dark:text-[#A8B3CC] hover:bg-white dark:hover:bg-[#1C2540] border border-pulse-200 dark:border-[#1E2A45] shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 transition-colors"
        >
          <MoreHorizontal size={14} aria-hidden="true" />
        </button>
        {menuOpen && (
          <ul
            role="menu"
            className="absolute right-0 top-full mt-1 z-10 min-w-[160px] rounded-lg border border-pulse-200 dark:border-[#1E2A45] bg-white dark:bg-[#1C2540] shadow-elevated py-1 animate-page-enter"
          >
            <li role="none">
              <Link
                to={`/sessions/${s.id}/results`}
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="block px-3 py-2 text-sm text-pulse-700 dark:text-[#A8B3CC] hover:bg-teal-50 dark:hover:bg-teal-500/10 hover:text-teal-700 dark:hover:text-teal-400 focus:outline-none focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-teal-500"
              >
                {t('postSessionReview')}
              </Link>
            </li>
            <li role="none">
              <button
                type="button"
                role="menuitem"
                disabled={actionLoading[s.id] === 'export'}
                onClick={() => { setMenuOpen(false); onExportCSV(s.id, s.title) }}
                className="w-full text-left px-3 py-2 text-sm text-pulse-700 dark:text-[#A8B3CC] hover:bg-teal-50 dark:hover:bg-teal-500/10 hover:text-teal-700 dark:hover:text-teal-400 focus:outline-none focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-teal-500 disabled:opacity-50"
              >
                {t('exportExcel')}
              </button>
            </li>
            <li role="none">
              <button
                type="button"
                role="menuitem"
                disabled={!!actionLoading[s.id]}
                onClick={() => { setMenuOpen(false); onDuplicate(s.id) }}
                className="w-full text-left px-3 py-2 text-sm text-pulse-700 dark:text-[#A8B3CC] hover:bg-teal-50 dark:hover:bg-teal-500/10 hover:text-teal-700 dark:hover:text-teal-400 focus:outline-none focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-teal-500 disabled:opacity-50"
              >
                {actionLoading[s.id] === 'duplicate' ? t('duplicating') : t('duplicate')}
              </button>
            </li>
            <li role="none">
              <button
                type="button"
                role="menuitem"
                disabled={!!actionLoading[s.id]}
                onClick={() => { setMenuOpen(false); onSaveAsTemplate(s.id, s.title) }}
                className="w-full text-left px-3 py-2 text-sm text-pulse-700 dark:text-[#A8B3CC] hover:bg-teal-50 dark:hover:bg-teal-500/10 hover:text-teal-700 dark:hover:text-teal-400 focus:outline-none focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-teal-500 disabled:opacity-50"
              >
                {actionLoading[s.id] === 'template' ? t('saving') : t('template')}
              </button>
            </li>
            <li role="separator" className="my-1 border-t border-pulse-100 dark:border-[#1E2A45]" />
            {confirmDeleteId === s.id ? (
              <li role="none" className="px-3 py-2">
                <p className="text-xs text-red-600 dark:text-red-400 font-medium mb-1.5">{t('confirmDelete')}</p>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    disabled={actionLoading[s.id] === 'delete'}
                    onClick={() => { setMenuOpen(false); onDelete(s.id) }}
                    className="flex-1 rounded bg-red-600 text-white text-xs font-medium px-2 py-1 hover:bg-red-700 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                  >
                    {actionLoading[s.id] === 'delete' ? t('deleting') : t('yes')}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMenuOpen(false); onConfirmDelete(null) }}
                    className="flex-1 rounded border border-pulse-200 dark:border-[#2A3858] text-xs font-medium px-2 py-1 text-pulse-600 dark:text-[#A8B3CC] hover:bg-pulse-50 dark:hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                  >
                    {t('cancel')}
                  </button>
                </div>
              </li>
            ) : (
              <li role="none">
                <button
                  type="button"
                  role="menuitem"
                  disabled={!!actionLoading[s.id]}
                  onClick={() => { onConfirmDelete(s.id) }}
                  className="w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 focus:outline-none focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-50"
                >
                  {t('delete')}
                </button>
              </li>
            )}
          </ul>
        )}
      </div>

      {/* Card body */}
      <div className="flex flex-col flex-1 p-3">
        <Link
          to={cardLink}
          className="block group/title focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 rounded"
        >
          <p className="text-sm font-semibold text-pulse-900 dark:text-[#F0F2F8] line-clamp-2 group-hover/title:text-teal-600 dark:group-hover/title:text-teal-400 leading-snug">
            {s.title}
          </p>
        </Link>
        <div className="mt-2 flex items-center gap-2 text-xs text-pulse-400 dark:text-[#6B7A99]">
          <code className="font-mono font-semibold tracking-widest bg-pulse-100 dark:bg-pulse-800/60 text-pulse-600 dark:text-[#A8B3CC] rounded-full px-2 py-0.5">
            {s.code}
          </code>
          <span aria-hidden="true">·</span>
          <time dateTime={new Date(s.created_at).toISOString()}>{formattedDate}</time>
        </div>
        {actionFeedback[s.id] && (
          <p className={`mt-1.5 text-xs font-medium ${actionFeedback[s.id].isError ? 'text-red-600' : 'text-teal-600'}`}>
            {actionFeedback[s.id].message}
          </p>
        )}
      </div>
    </article>
  )
}

// ─── Session card skeleton ────────────────────────────────────────────────────

function SessionCardSkeleton() {
  return (
    <div className="rounded-lg border border-pulse-200 dark:border-[#1E2A45] bg-white dark:bg-[#151C2E] overflow-hidden shadow-card" aria-hidden="true">
      <div className="skeleton-shimmer bg-pulse-200 dark:bg-pulse-800" style={{ aspectRatio: '16/10' }} />
      <div className="p-3 space-y-2">
        <div className="h-4 w-3/4 rounded bg-pulse-200 dark:bg-pulse-800 skeleton-shimmer" />
        <div className="h-3 w-1/2 rounded bg-pulse-200 dark:bg-pulse-800 skeleton-shimmer" />
      </div>
    </div>
  )
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

export default function Dashboard() {
  const auth = useAuth()
  const t = useT('dashboard')
  const [activeSection, setActiveSection] = useState<DashboardSection>('home')
  const { state, refresh } = useSessions()
  const userId = auth.status === 'authenticated' ? auth.user.id : undefined
  const { data: quotaData } = useQuotaUsage(userId)
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
  const activeTeamId = localStorage.getItem('activeTeamId')
  const activePlan = (teams.find((t) => t.id === activeTeamId)?.plan ?? teams[0]?.plan) as string | undefined

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

  async function handleDuplicate(sessionId: string) {
    setActionLoading((prev) => ({ ...prev, [sessionId]: 'duplicate' }))
    try {
      const res = await api<unknown>(`/api/sessions/${encodeURIComponent(sessionId)}/duplicate`, { method: 'POST' })
      if (res.ok) {
        await refresh()
        setFeedback(sessionId, 'Duplicated!', false)
      } else {
        setFeedback(sessionId, res.error.message, true)
      }
    } finally {
      setActionLoading((prev) => { const next = { ...prev }; delete next[sessionId]; return next })
    }
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
    onDuplicate: (id: string) => void handleDuplicate(id),
    onExportCSV: handleExportCSV,
    onSaveAsTemplate: (id: string, title: string) => void handleSaveAsTemplate(id, title),
    onDelete: (id: string) => void handleDelete(id),
    onConfirmDelete: setConfirmDeleteId,
  }

  return (
    <AppShellLayout
      activeSection={activeSection}
      onSectionChange={setActiveSection}
      {...(activePlan !== undefined ? { planName: activePlan } : {})}
      {...(quotaData?.usage.sessions_created !== undefined ? { sessionsUsed: quotaData.usage.sessions_created } : {})}
      {...(quotaData?.quotas.max_sessions_per_month !== undefined ? { sessionsMax: quotaData.quotas.max_sessions_per_month } : {})}
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
            <button
              type="button"
              onClick={() => setWizardOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-pulse-900 dark:bg-[#F0F2F8] text-white dark:text-pulse-900 px-5 py-2.5 text-sm font-semibold shadow-card hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 transition-opacity"
            >
              <Sparkles size={15} aria-hidden="true" />
              {t('newSession').replace('+ ', '')}
            </button>
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
                  <p className="text-body-s text-pulse-500 dark:text-pulse-400">No insights generated yet. Analyze your closed sessions to surface themes.</p>
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
    </AppShellLayout>
  )
}
