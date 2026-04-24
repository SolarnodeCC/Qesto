import { useState, useEffect } from 'react'
import { Sparkles } from 'lucide-react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useSessions } from '../hooks/useSessions'
import { useDensity, type Density } from '../hooks/useDensity'
import { useInsights } from '../hooks/useInsights'
import { useT } from '../i18n'
import { api } from '../api/client'
import MainLayout from '../layouts/MainLayout'
import { SessionListSkeleton } from '../components/SkeletonLoader'
import InsightThemeCard from '../components/InsightThemeCard'
import AINarrative from '../components/AINarrative'
import SessionWizard from '../components/SessionWizard'

const SUPERUSER_EMAIL = (import.meta.env.VITE_SUPERUSER_EMAIL as string | undefined) ?? ''

type DashboardTab = 'sessions' | 'insights' | 'teams' | 'templates'

interface Template {
  id: string
  name: string
  description: string
  category: string
  questions: Array<{
    kind: string
    prompt: string
    options: Array<{ id: string; label: string }>
  }>
}

interface TemplateModalState {
  open: boolean
  template: Template | null
}

interface TemplateResponse {
  ok: boolean
  data: { templates: Template[] }
}

export default function Dashboard() {
  const auth = useAuth()
  const navigate = useNavigate()
  const t = useT('dashboard')
  const [activeTab, setActiveTab] = useState<DashboardTab>('sessions')
  const { state, refresh, create } = useSessions()
  const { density, setDensity } = useDensity()
  const closedSessions =
    state.status === 'ready'
      ? state.sessions.filter((s) => s.status === 'closed' || s.status === 'archived')
      : []
  const { themes: insightThemes, loading: insightsLoading, planGated, analyzeSession } = useInsights(closedSessions, activeTab === 'insights')
  const [wizardOpen, setWizardOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'live'>('all')
  const [templates, setTemplates] = useState<Template[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(true)
  const [modal, setModal] = useState<TemplateModalState>({ open: false, template: null })
  const [creatingFromTemplate, setCreatingFromTemplate] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [teams, setTeams] = useState<Array<{ id: string; name: string; plan: string }>>([])
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<Record<string, string>>({})
  const [actionFeedback, setActionFeedback] = useState<Record<string, { message: string; isError: boolean }>>({})
  const [teamsLoading, setTeamsLoading] = useState(true)

  useEffect(() => {
    fetch('/api/templates')
      .then((res) => res.json() as Promise<TemplateResponse>)
      .then((data) => { if (data.ok) setTemplates(data.data.templates) })
      .catch(() => {})
      .finally(() => setTemplatesLoading(false))
  }, [])

  useEffect(() => {
    void api<{ teams: Array<{ id: string; name: string; plan: string }> }>('/api/teams')
      .then((res) => { if (res.ok) setTeams(res.data.teams) })
      .finally(() => setTeamsLoading(false))
  }, [])

  if (auth.status === 'loading') {
    return (
      <MainLayout mainClassName="min-h-screen max-w-5xl mx-auto p-8 space-y-8">
        <div className="space-y-2">
          <div className="h-9 w-48 rounded-lg bg-pulse-200 skeleton-shimmer" aria-hidden="true" />
          <div className="h-4 w-64 rounded-md bg-pulse-200 skeleton-shimmer" aria-hidden="true" />
        </div>
        <SessionListSkeleton rows={3} />
      </MainLayout>
    )
  }
  if (auth.status === 'anonymous') {
    return <Navigate to="/login" replace />
  }

  async function handleCreateFromTemplate() {
    if (!modal.template) return
    const template = modal.template

    setCreatingFromTemplate(true)
    setError(null)

    try {
      // Create a session with the template's questions
      const res = await create(template.name)
      if (!res.ok) {
        setError(res.error.message)
        return
      }

      const sessionId = (res.data as any)?.session?.id
      if (sessionId) {
        // Optionally: patch the session with template questions here if needed
        // For now, redirect to the session config page
        navigate(`/sessions/${sessionId}`)
      }
    } finally {
      setCreatingFromTemplate(false)
      setModal({ open: false, template: null })
    }
  }

  function setFeedback(sessionId: string, message: string, isError: boolean) {
    setActionFeedback((prev) => ({ ...prev, [sessionId]: { message, isError } }))
    setTimeout(() => setActionFeedback((prev) => { const next = { ...prev }; delete next[sessionId]; return next }), 3000)
  }

  async function handleDelete(sessionId: string) {
    setActionLoading((prev) => ({ ...prev, [sessionId]: 'delete' }))
    try {
      const token = (await import('../api/client')).getAuthToken()
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

  const isSuperuser = auth.user.email === SUPERUSER_EMAIL

  const activeTeamId = localStorage.getItem('activeTeamId')
  const activePlan = (teams.find((t) => t.id === activeTeamId)?.plan ?? (teams[0]?.plan)) as string | undefined

  const navSlot = (
    <div className="flex items-center gap-3">
      {isSuperuser && (
        <Link
          to="/admin"
          className="inline-flex items-center gap-1.5 rounded-lg border border-violet-300 bg-violet-50 px-3 py-1.5 text-sm font-medium text-violet-700 hover:bg-violet-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 min-h-[44px]"
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
            <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
          </svg>
          Admin panel
        </Link>
      )}
      <button
        type="button"
        onClick={() => void auth.logout()}
        className="text-sm text-teal-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 rounded"
      >
        Sign out
      </button>
    </div>
  )

  return (
    <MainLayout navSlot={navSlot} mainClassName="min-h-screen max-w-5xl mx-auto p-8 space-y-8">
      {/* animate-page-enter: entire content fades + slides up on mount (LAYOUT-MOTION-01) */}
      <div className="animate-page-enter space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 tabIndex={-1} className="text-3xl font-semibold focus:outline-none">
              {t('greeting', { name: auth.user.email.split('@')[0] })}
            </h1>
            <p className="text-sm text-pulse-500">{auth.user.email}</p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {activePlan && <PlanBadge plan={activePlan} />}
            <button
              type="button"
              onClick={() => setWizardOpen(true)}
              className="inline-flex items-center gap-2 rounded-md bg-[var(--gradient-brand)] text-white px-4 py-2 text-sm font-semibold shadow-card hover:shadow-teal hover:scale-[1.02] transition-all duration-[120ms] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 btn-motion"
            >
              <Sparkles size={14} aria-hidden="true" />
              {t('newSession')}
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div
          role="tablist"
          aria-label="Dashboard sections"
          className="flex gap-1 border-b border-pulse-200 dark:border-pulse-700"
        >
          {([
            { id: 'sessions', label: t('sessions') },
            { id: 'insights', label: t('insights') },
            { id: 'teams',    label: t('teams') },
            { id: 'templates', label: t('templates') },
          ] as const).map(({ id, label }) => (
            <button
              key={id}
              role="tab"
              id={`tab-${id}`}
              aria-controls={`tabpanel-${id}`}
              aria-selected={activeTab === id}
              onClick={() => setActiveTab(id)}
              className={[
                'px-5 py-3 text-sm font-medium rounded-t-md -mb-px border border-b-0 min-h-[44px]',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2',
                'tab-transition',
                activeTab === id
                  ? 'border-pulse-200 dark:border-pulse-700 bg-white dark:bg-pulse-900 text-pulse-900 dark:text-pulse-100'
                  : 'border-transparent text-pulse-500 dark:text-pulse-400 hover:text-pulse-800 dark:hover:text-pulse-200',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Sessions tab */}
        {activeTab === 'sessions' && (
          <div
            role="tabpanel"
            id="tabpanel-sessions"
            aria-labelledby="tab-sessions"
            className="space-y-6"
          >
            {/* New session trigger */}
            <button
              type="button"
              onClick={() => setWizardOpen(true)}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-pulse-200 bg-white text-pulse-700 px-4 py-3 font-medium hover:border-teal-400 hover:text-teal-700 hover:bg-teal-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 btn-motion transition-colors"
            >
              <Sparkles size={16} aria-hidden="true" />
              {t('newSession')}
            </button>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">{t('draftAndLive')}</h2>
                <DensitySwitcher density={density} onChange={setDensity} />
              </div>
              {state.status === 'loading' ? (
                <SessionListSkeleton rows={3} />
              ) : state.status === 'error' ? (
                <p role="alert" className="text-sm text-red-600">
                  {state.error.message}
                </p>
              ) : state.sessions.length === 0 ? (
                <p className="text-sm text-pulse-500">{t('noSessionsYet')}</p>
              ) : (() => {
                const q = search.trim().toLowerCase()
                const filtered = state.sessions.filter((s) => {
                  if (statusFilter !== 'all' && s.status !== statusFilter) return false
                  if (!q) return true
                  return (
                    s.title.toLowerCase().includes(q) ||
                    s.code.toLowerCase().includes(q) ||
                    new Date(s.created_at).toLocaleString().toLowerCase().includes(q)
                  )
                })
                return (
                  <div className="space-y-2">
                    {/* Search + filter bar */}
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-pulse-400">
                          <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
                        </svg>
                        <input
                          type="search"
                          aria-label={t('searchSessions')}
                          placeholder={t('searchPlaceholder')}
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          className="w-full rounded-lg border border-pulse-200 bg-white py-2 pl-9 pr-3 text-sm text-pulse-800 placeholder:text-pulse-400 focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-200"
                        />
                      </div>
                      <select
                        aria-label={t('filterByStatus')}
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as 'all' | 'draft' | 'live')}
                        className="rounded-lg border border-pulse-200 bg-white px-3 py-2 text-sm text-pulse-800 focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-200"
                      >
                        <option value="all">{t('allStatuses')}</option>
                        <option value="draft">{t('draft')}</option>
                        <option value="live">{t('live')}</option>
                      </select>
                    </div>
                    <p className="text-xs text-pulse-400">
                      {filtered.length} of {state.sessions.length} session{state.sessions.length !== 1 ? 's' : ''} visible
                    </p>
                    {filtered.length === 0 ? (
                      <p className="text-sm text-pulse-500 py-4 text-center">{t('noMatchingSearch')}</p>
                    ) : (
                      <ul className="divide-y divide-pulse-200 rounded-xl border border-pulse-200">
                        {filtered.map((s, i) => (
                          <li
                            key={s.id}
                            className={`animate-list-item ${density === 'compact' ? 'p-2' : density === 'spacious' ? 'p-6' : 'p-4'}`}
                            style={{ '--stagger-index': i } as React.CSSProperties}
                          >
                            {/* Title row */}
                            <div className="flex items-center justify-between gap-4">
                              <div>
                                <Link
                                  to={
                                    s.status === 'live'
                                      ? `/sessions/${s.id}/present`
                                      : s.status === 'closed' || s.status === 'archived'
                                      ? `/sessions/${s.id}/results`
                                      : `/sessions/${s.id}/launchpad`
                                  }
                                  className="block group focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 rounded"
                                >
                                  <span className="font-medium text-pulse-800 group-hover:text-teal-600">
                                    {s.title}
                                  </span>
                                  <p className="text-xs text-pulse-500 mt-0.5">
                                    code <code className="font-mono text-[0.95em] tracking-wide">{s.code}</code> · {new Date(s.created_at).toLocaleString()}
                                  </p>
                                </Link>
                              </div>
                              <span
                                className={
                                  'text-xs uppercase tracking-wider rounded-full px-2 py-0.5 ' +
                                  (s.status === 'draft'
                                    ? 'bg-pulse-100 text-pulse-700'
                                    : s.status === 'live'
                                    ? 'relative bg-teal-100 text-teal-700 font-semibold before:w-1.5 before:h-1.5 before:rounded-full before:bg-teal-500 before:inline-block before:mr-1'
                                    : 'bg-violet-50 text-violet-700')
                                }
                              >
                                {s.status}
                              </span>
                            </div>

                            {/* Action buttons row */}
                            <div className="flex flex-wrap items-center gap-2 mt-3">
                              {/* Post-session review */}
                              <Link
                                to={`/sessions/${s.id}/results`}
                                className="inline-flex items-center gap-1 rounded-md border border-pulse-200 bg-white px-2.5 py-1 text-xs font-medium text-pulse-700 hover:border-teal-400 hover:text-teal-700 hover:bg-teal-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 transition-colors"
                              >
                                {t('postSessionReview')}
                              </Link>

                              {/* Export Excel/CSV */}
                              <button
                                type="button"
                                disabled={actionLoading[s.id] === 'export'}
                                onClick={() => handleExportCSV(s.id, s.title)}
                                className="inline-flex items-center gap-1 rounded-md border border-pulse-200 bg-white px-2.5 py-1 text-xs font-medium text-pulse-700 hover:border-teal-400 hover:text-teal-700 hover:bg-teal-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 transition-colors disabled:opacity-50"
                              >
                                {t('exportExcel')}
                              </button>

                              {/* Koppel aan PowerPoint */}
                              <button
                                type="button"
                                disabled
                                title="Coming soon"
                                className="inline-flex items-center gap-1 rounded-md border border-pulse-200 bg-white px-2.5 py-1 text-xs font-medium text-pulse-400 cursor-not-allowed opacity-60"
                              >
                                Koppel aan PowerPoint
                              </button>

                              {/* Duplicate */}
                              <button
                                type="button"
                                disabled={!!actionLoading[s.id]}
                                onClick={() => void handleDuplicate(s.id)}
                                className="inline-flex items-center gap-1 rounded-md border border-pulse-200 bg-white px-2.5 py-1 text-xs font-medium text-pulse-700 hover:border-teal-400 hover:text-teal-700 hover:bg-teal-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 transition-colors disabled:opacity-50"
                              >
                                {actionLoading[s.id] === 'duplicate' ? t('duplicating') : t('duplicate')}
                              </button>

                              {/* Save as template */}
                              <button
                                type="button"
                                disabled={!!actionLoading[s.id]}
                                onClick={() => void handleSaveAsTemplate(s.id, s.title)}
                                className="inline-flex items-center gap-1 rounded-md border border-pulse-200 bg-white px-2.5 py-1 text-xs font-medium text-pulse-700 hover:border-teal-400 hover:text-teal-700 hover:bg-teal-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 transition-colors disabled:opacity-50"
                              >
                                {actionLoading[s.id] === 'template' ? t('saving') : t('template')}
                              </button>

                              {/* Delete (with inline confirm) */}
                              {confirmDeleteId === s.id ? (
                                <span className="inline-flex items-center gap-1">
                                  <span className="text-xs text-red-600 font-medium">{t('confirmDelete')}</span>
                                  <button
                                    type="button"
                                    disabled={actionLoading[s.id] === 'delete'}
                                    onClick={() => void handleDelete(s.id)}
                                    className="inline-flex items-center rounded-md border border-red-300 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 transition-colors disabled:opacity-50"
                                  >
                                    {actionLoading[s.id] === 'delete' ? t('deleting') : t('yes')}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteId(null)}
                                    className="inline-flex items-center rounded-md border border-pulse-200 bg-white px-2 py-1 text-xs font-medium text-pulse-600 hover:bg-pulse-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-pulse-500 transition-colors"
                                  >
                                    {t('cancel')}
                                  </button>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  disabled={!!actionLoading[s.id]}
                                  onClick={() => setConfirmDeleteId(s.id)}
                                  className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-600 hover:border-red-400 hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 transition-colors disabled:opacity-50"
                                >
                                  {t('delete')}
                                </button>
                              )}

                              {/* Inline feedback */}
                              {actionFeedback[s.id] && (
                                <span className={`text-xs font-medium ${actionFeedback[s.id].isError ? 'text-red-600' : 'text-teal-600'}`}>
                                  {actionFeedback[s.id].message}
                                </span>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )
              })()}
            </section>
          </div>
        )}

        {/* Insights tab */}
        {activeTab === 'insights' && (
          <div
            role="tabpanel"
            id="tabpanel-insights"
            aria-labelledby="tab-insights"
            className="space-y-6"
          >
            <AINarrative />

            <section aria-labelledby="insight-themes-heading" className="space-y-space-3">
              <h2 id="insight-themes-heading" className="text-heading-s font-semibold dark:text-pulse-100">
                {t('topThemes')}
              </h2>

              {planGated ? (
                <div className="rounded-lg border border-violet-200 bg-violet-50 dark:bg-violet-900/20 dark:border-violet-700 p-5 space-y-3">
                  <p className="text-body-s text-violet-800 dark:text-violet-300 font-medium">
                    {t('aiInsightsPlanRequired')}
                  </p>
                  <p className="text-body-s text-violet-700 dark:text-violet-400">
                    {t('upgradeForInsights')}
                  </p>
                  <Link
                    to="/pricing"
                    className="inline-flex items-center gap-1.5 rounded-md bg-violet-600 text-white px-4 py-2 text-sm font-medium hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
                  >
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
                  <p className="text-body-s text-pulse-500 dark:text-pulse-400">
                    No insights generated yet. Analyze your closed sessions to surface themes.
                  </p>
                  <div className="space-y-2">
                    {closedSessions.slice(0, 3).map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => void analyzeSession(s.id)}
                        className="w-full text-left flex items-center justify-between gap-3 p-3 rounded-lg border border-pulse-200 hover:border-teal-400 hover:bg-teal-50 dark:border-pulse-700 dark:hover:border-teal-600 dark:hover:bg-teal-900/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 transition-colors"
                      >
                        <span className="text-sm font-medium text-pulse-800 dark:text-pulse-200">{s.title}</span>
                        <span className="text-xs text-teal-600 dark:text-teal-400 font-medium flex items-center gap-1">
                          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2l2.09 6.26L20 10l-5.91 1.74L12 18l-2.09-5.26L4 11l5.91-1.74L12 2z" />
                          </svg>
                          Analyze
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <ul className={density === 'compact' ? 'space-y-1' : density === 'spacious' ? 'space-y-5' : 'space-y-3'}>
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
            </section>
          </div>
        )}

        {/* Teams tab */}
        {activeTab === 'teams' && (
          <div
            role="tabpanel"
            id="tabpanel-teams"
            aria-labelledby="tab-teams"
            className="space-y-4"
          >
            <h2 className="text-xl font-semibold">{t('yourTeams')}</h2>
            {teamsLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="h-16 rounded-xl bg-pulse-200 skeleton-shimmer" aria-hidden="true" />
                ))}
              </div>
            ) : teams.length === 0 ? (
              <p className="text-sm text-pulse-500">{t('noTeamsYet')}</p>
            ) : (
              <ul className="divide-y divide-pulse-200 rounded-xl border border-pulse-200">
                {teams.map((team) => (
                  <li key={team.id} className={`flex items-center justify-between gap-4 ${density === 'compact' ? 'p-2' : density === 'spacious' ? 'p-6' : 'p-4'}`}>
                    <div>
                      <p className="font-medium text-pulse-800">{team.name}</p>
                      <p className="text-xs text-pulse-400 mt-0.5 capitalize">{team.plan} plan</p>
                    </div>
                    <Link
                      to={`/teams/${team.id}/settings`}
                      className="text-sm text-teal-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 rounded"
                    >
                      Settings →
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Templates tab */}
        {activeTab === 'templates' && (
          <div
            role="tabpanel"
            id="tabpanel-templates"
            aria-labelledby="tab-templates"
            className="space-y-4"
          >
            <h2 className="text-xl font-semibold">{t('startFromTemplate')}</h2>
            {templatesLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-32 rounded-xl bg-pulse-200 skeleton-shimmer" aria-hidden="true" />
                ))}
              </div>
            ) : templates.length === 0 ? (
              <p className="text-sm text-pulse-500">{t('noTemplatesAvailable')}</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {templates.map((tmpl) => (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => setModal({ open: true, template: tmpl })}
                    className="text-left p-4 rounded-xl border border-pulse-200 hover:border-teal-300 hover:bg-teal-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 transition-colors"
                  >
                    <h3 className="font-medium text-pulse-900">{tmpl.name}</h3>
                    <p className="text-sm text-pulse-500 mt-1">{tmpl.description}</p>
                    <p className="text-xs text-pulse-400 mt-2">{tmpl.questions.length} questions</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Template confirmation modal */}
        {modal.open && modal.template && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            role="dialog"
            aria-labelledby="modal-title"
            aria-modal="true"
          >
            <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 animate-page-enter space-y-4">
              <h2 id="modal-title" className="text-xl font-semibold">
                {t('createFromTemplate', { name: modal.template.name })}
              </h2>
              <p className="text-sm text-pulse-600">{modal.template.description}</p>
              {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setModal({ open: false, template: null })}
                  disabled={creatingFromTemplate}
                  className="px-4 py-2 rounded-lg border border-pulse-300 hover:bg-pulse-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
                >
                  {t('cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleCreateFromTemplate}
                  disabled={creatingFromTemplate}
                  className="px-4 py-2 rounded-lg bg-teal-600 text-white hover:brightness-110 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
                >
                  {creatingFromTemplate ? t('creating') : t('create')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <SessionWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onSessionCreated={() => { void refresh() }}
      />
    </MainLayout>
  )
}

function PlanBadge({ plan }: { plan: string }) {
  const styles: Record<string, { dot: string; bg: string; text: string }> = {
    free:    { dot: 'bg-pulse-400',   bg: 'bg-pulse-100',   text: 'text-pulse-600' },
    starter: { dot: 'bg-teal-500',    bg: 'bg-teal-50',     text: 'text-teal-700' },
    team:    { dot: 'bg-violet-500',  bg: 'bg-violet-50',   text: 'text-violet-700' },
  }
  const style = styles[plan] ?? styles.free
  const label = plan.charAt(0).toUpperCase() + plan.slice(1)
  return (
    <Link
      to="/pricing"
      className={`inline-flex items-center gap-1.5 rounded-full border border-transparent px-3 py-1.5 text-sm font-medium ${style.bg} ${style.text} hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2`}
      title="View pricing plans"
    >
      <span className={`h-2 w-2 rounded-full shrink-0 ${style.dot}`} aria-hidden="true" />
      {label}
    </Link>
  )
}

function DensitySwitcher({ density, onChange }: { density: Density; onChange: (d: Density) => void }) {
  const options: { value: Density; label: string; title: string }[] = [
    { value: 'compact', label: '▤', title: 'Compact' },
    { value: 'comfortable', label: '▥', title: 'Comfortable' },
    { value: 'spacious', label: '▦', title: 'Spacious' },
  ]
  return (
    <div
      role="group"
      aria-label="List density"
      className="flex rounded-md border border-pulse-200 dark:border-pulse-700 overflow-hidden"
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          title={opt.title}
          aria-pressed={density === opt.value}
          onClick={() => onChange(opt.value)}
          className={[
            'px-2.5 py-1 text-sm leading-none focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500 transition-colors',
            density === opt.value
              ? 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300'
              : 'text-pulse-500 hover:bg-pulse-50 dark:hover:bg-pulse-800 dark:text-pulse-400',
          ].join(' ')}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
