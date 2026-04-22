import { useState, useEffect } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useSessions } from '../hooks/useSessions'
import MainLayout from '../layouts/MainLayout'
import { SessionListSkeleton } from '../components/SkeletonLoader'
import InsightThemeCard from '../components/InsightThemeCard'
import AINarrative from '../components/AINarrative'

type DashboardTab = 'sessions' | 'insights'

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

const MOCK_INSIGHT_THEMES = [
  {
    id: '1',
    title: 'Team velocity concerns',
    description:
      'Participants across multiple sessions raised concerns about sprint velocity and whether the current pace is sustainable long-term.',
    sessionCount: 4,
  },
  {
    id: '2',
    title: 'Cross-team communication gaps',
    description:
      'A recurring theme of unclear handoffs and misaligned expectations between engineering and design teams.',
    sessionCount: 3,
  },
  {
    id: '3',
    title: 'Onboarding experience',
    description:
      'New team members consistently highlight the onboarding process as an area for improvement, especially documentation quality.',
    sessionCount: 2,
  },
]

export default function Dashboard() {
  const auth = useAuth()
  const navigate = useNavigate()
  const { state, create } = useSessions()
  const [activeTab, setActiveTab] = useState<DashboardTab>('sessions')
  const [title, setTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [templates, setTemplates] = useState<Template[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(true)
  const [modal, setModal] = useState<TemplateModalState>({ open: false, template: null })
  const [creatingFromTemplate, setCreatingFromTemplate] = useState(false)

  useEffect(() => {
    // Fetch templates
    fetch('/api/templates')
      .then((res) => res.json() as Promise<TemplateResponse>)
      .then((data) => {
        if (data.ok) {
          setTemplates(data.data.templates)
        }
      })
      .catch(() => {
        // Silently fail — templates are optional
      })
      .finally(() => setTemplatesLoading(false))
  }, [])

  if (auth.status === 'loading') {
    return (
      <MainLayout mainClassName="min-h-screen max-w-3xl mx-auto p-8 space-y-8">
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

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    setCreating(true)
    setError(null)
    const res = await create(trimmed)
    setCreating(false)
    if (!res.ok) {
      setError(res.error.message)
      return
    }
    setTitle('')
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

  const navSlot = (
    <button
      type="button"
      onClick={() => void auth.logout()}
      className="text-sm text-teal-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 rounded"
    >
      Sign out
    </button>
  )

  return (
    <MainLayout navSlot={navSlot} mainClassName="min-h-screen max-w-3xl mx-auto p-8 space-y-8">
      {/* animate-page-enter: entire content fades + slides up on mount (LAYOUT-MOTION-01) */}
      <div className="animate-page-enter space-y-8">
        <div>
          <h1 tabIndex={-1} className="text-3xl font-semibold focus:outline-none">Your sessions</h1>
          <p className="text-sm text-pulse-500">Signed in as {auth.user.email}.</p>
        </div>

        {/* Tab bar */}
        <div
          role="tablist"
          aria-label="Dashboard sections"
          className="flex gap-1 border-b border-pulse-200 dark:border-pulse-700"
        >
          <button
            role="tab"
            id="tab-sessions"
            aria-controls="tabpanel-sessions"
            aria-selected={activeTab === 'sessions'}
            onClick={() => setActiveTab('sessions')}
            className={[
              'px-space-4 py-space-2 text-body-s font-medium rounded-t-md -mb-px border border-b-0',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2',
              'tab-transition',
              activeTab === 'sessions'
                ? 'border-pulse-200 dark:border-pulse-700 bg-white dark:bg-pulse-900 text-pulse-900 dark:text-pulse-100'
                : 'border-transparent text-pulse-500 dark:text-pulse-400 hover:text-pulse-800 dark:hover:text-pulse-200',
            ].join(' ')}
          >
            Sessions
          </button>
          <button
            role="tab"
            id="tab-insights"
            aria-controls="tabpanel-insights"
            aria-selected={activeTab === 'insights'}
            onClick={() => setActiveTab('insights')}
            className={[
              'px-space-4 py-space-2 text-body-s font-medium rounded-t-md -mb-px border border-b-0',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2',
              'tab-transition',
              activeTab === 'insights'
                ? 'border-pulse-200 dark:border-pulse-700 bg-white dark:bg-pulse-900 text-pulse-900 dark:text-pulse-100'
                : 'border-transparent text-pulse-500 dark:text-pulse-400 hover:text-pulse-800 dark:hover:text-pulse-200',
            ].join(' ')}
          >
            Insights
          </button>
        </div>

        {/* Sessions tab */}
        {activeTab === 'sessions' && (
          <div
            role="tabpanel"
            id="tabpanel-sessions"
            aria-labelledby="tab-sessions"
            className="space-y-6"
          >
            <form onSubmit={handleCreate} className="flex flex-col gap-3 rounded-xl border border-pulse-200 p-5">
              <label htmlFor="new-session-title" className="text-sm font-medium">
                New session
              </label>
              <input
                id="new-session-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Q2 team retro"
                maxLength={120}
                disabled={creating}
                className="border border-pulse-300 rounded-lg px-3 py-2 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
              />
              {error ? (
                <p role="alert" className="text-sm text-red-600">
                  {error}
                </p>
              ) : null}
              <button
                type="submit"
                disabled={creating || title.trim().length === 0}
                className="self-start inline-flex items-center rounded-lg bg-gradient-to-br from-teal-500 to-violet-600 text-white px-4 py-2 font-medium hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 btn-motion"
              >
                {creating ? 'Creating…' : 'Create draft'}
              </button>
            </form>

            {/* Templates section */}
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">Start from a template</h2>
              {templatesLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-32 rounded-xl bg-pulse-200 skeleton-shimmer" aria-hidden="true" />
                  ))}
                </div>
              ) : templates.length === 0 ? (
                <p className="text-sm text-pulse-500">Templates loading…</p>
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
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold">Draft &amp; live</h2>
              {state.status === 'loading' ? (
                /* LAYOUT-SKELETON-01: replace text placeholder with geometric skeleton */
                <SessionListSkeleton rows={3} />
              ) : state.status === 'error' ? (
                <p role="alert" className="text-sm text-red-600">
                  {state.error.message}
                </p>
              ) : state.sessions.length === 0 ? (
                <p className="text-sm text-pulse-500">No sessions yet. Create your first one above.</p>
              ) : (
                <ul className="divide-y divide-pulse-200 rounded-xl border border-pulse-200">
                  {state.sessions.map((s, i) => (
                    <li
                      key={s.id}
                      className="animate-list-item p-4 flex items-center justify-between gap-4"
                      style={{ '--stagger-index': i } as React.CSSProperties}
                    >
                      <div>
                        <Link
                          to={
                            s.status === 'live'
                              ? `/sessions/${s.id}/present`
                              : s.status === 'closed' || s.status === 'archived'
                              ? `/sessions/${s.id}/results`
                              : `/sessions/${s.id}`
                          }
                          className="font-medium text-pulse-800 hover:text-teal-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 rounded"
                        >
                          {s.title}
                        </Link>
                        <p className="text-xs text-pulse-500">
                          code {s.code} · {new Date(s.created_at).toLocaleString()}
                        </p>
                      </div>
                      <span
                        className={
                          'text-xs uppercase tracking-wider rounded-full px-2 py-0.5 ' +
                          (s.status === 'draft'
                            ? 'bg-pulse-100 text-pulse-600'
                            : s.status === 'live'
                            ? 'bg-teal-100 text-teal-700'
                            : 'bg-violet-100 text-violet-700')
                        }
                      >
                        {s.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
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
                Top themes
              </h2>
              <p className="text-body-s text-pulse-500 dark:text-pulse-400">
                AI-identified themes across your closed sessions. Close more sessions to see
                richer patterns.
              </p>
              <ul className="space-y-3">
                {MOCK_INSIGHT_THEMES.map((theme) => (
                  <li key={theme.id}>
                    <InsightThemeCard
                      title={theme.title}
                      description={theme.description}
                      sessionCount={theme.sessionCount}
                    />
                  </li>
                ))}
              </ul>
            </section>
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
                Create session from {modal.template.name}?
              </h2>
              <p className="text-sm text-pulse-600">{modal.template.description}</p>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setModal({ open: false, template: null })}
                  disabled={creatingFromTemplate}
                  className="px-4 py-2 rounded-lg border border-pulse-300 hover:bg-pulse-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateFromTemplate}
                  disabled={creatingFromTemplate}
                  className="px-4 py-2 rounded-lg bg-teal-600 text-white hover:brightness-110 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
                >
                  {creatingFromTemplate ? 'Creating…' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  )
}
