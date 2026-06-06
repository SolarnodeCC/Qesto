import { useState, useEffect, useMemo, useRef } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useSessions } from '../hooks/useSessions'
import { useInsights } from '../hooks/useInsights'
import type { SessionSummary } from '../types/session'
import { useQuotaUsage } from '../hooks/useQuotaUsage'
import { useT } from '../i18n'
import { api, getAuthToken } from '../api/client'
import AppShellLayout, { type DashboardSection } from '../layouts/AppShellLayout'
import { SessionListSkeleton } from '../components/SkeletonLoader'
import SessionWizard from '../components/SessionWizard'
import DuplicateSessionModal from '../components/DuplicateSessionModal'
import { HeroSection } from './dashboard/HeroSection'
import { RecentSessionsSection } from './dashboard/RecentSessionsSection'
import { AllSessionsSection } from './dashboard/AllSessionsSection'
import { InsightsSection } from './dashboard/InsightsSection'
import { TeamsSection } from './dashboard/TeamsSection'
import { TemplatesSection } from './dashboard/TemplatesSection'
import { TemplatePreviewModal } from './dashboard/TemplatePreviewModal'
import type { Template, TemplateModalState, StatusFilter, DashboardTeam, DuplicateModalState } from './dashboard/types'

const SUPERUSER_EMAIL = (import.meta.env.VITE_SUPERUSER_EMAIL as string | undefined) ?? ''

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
  const [teams, setTeams] = useState<DashboardTeam[]>([])
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
    void api<{ teams: DashboardTeam[] }>('/api/teams')
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
      if (configured.status === 403) { navigate('/pricing'); return }
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
            return s.title.toLowerCase().includes(q) || s.code.toLowerCase().includes(q)
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

  async function handleSaveAsTemplate(sessionId: string, title: string) {
    setActionLoading((prev) => ({ ...prev, [sessionId]: 'template' }))
    try {
      const res = await api<unknown>('/api/templates/mine', {
        method: 'POST',
        body: { sessionId, name: title },
      })
      if (res.ok) setFeedback(sessionId, 'Saved as template!', false)
      else setFeedback(sessionId, res.error.message, true)
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
    onDuplicate: (id: string, title: string) => setDuplicateModal({ sourceId: id, sourceTitle: title }),
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
        <HeroSection
          userName={userName}
          townhallFeatureEnabled={townhallFeatureEnabled}
          isTeamPlan={isTeamPlan}
          creatingTownhall={creatingTownhall}
          newMenuOpen={newMenuOpen}
          newMenuRef={newMenuRef}
          onToggleMenu={() => setNewMenuOpen((v) => !v)}
          onOpenWizard={() => setWizardOpen(true)}
          onCreateTownhall={onCreateTownhall}
          setActiveSection={setActiveSection}
        />
        <RecentSessionsSection state={state} sessions={recentSessions} cardProps={cardProps} />
        <AllSessionsSection
          state={state}
          sessions={filteredSessions}
          search={search}
          statusFilter={statusFilter}
          onSearchChange={setSearch}
          onStatusFilterChange={setStatusFilter}
          cardProps={cardProps}
        />
        <InsightsSection
          closedSessions={closedSessions}
          insightThemes={insightThemes}
          insightsLoading={insightsLoading}
          planGated={planGated}
          teams={teams}
          activeSection={activeSection}
          analyzeSession={analyzeSession}
        />
        <TeamsSection teams={teams} teamsLoading={teamsLoading} />
        <TemplatesSection
          templates={templates}
          templatesLoading={templatesLoading}
          customerTemplates={customerTemplates}
          qestoTemplates={qestoTemplates}
          qestoTopics={qestoTopics}
          onPreview={(template) => setModal({ open: true, template })}
        />
      </div>

      <TemplatePreviewModal
        modal={modal}
        onClose={() => setModal({ open: false, template: null })}
        onUse={handleUseTemplate}
        error={error}
      />

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
