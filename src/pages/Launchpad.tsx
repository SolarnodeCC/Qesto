import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useSession } from '../hooks/useSessions'
import { useT } from '../i18n'
import { api, apiRetry } from '../api/client'
import MainLayout from '../layouts/MainLayout'
import { LaunchpadPreFlightSkeleton } from '../components/SkeletonLoader'
import SessionTitleField from '../components/SessionTitleField'
import PreFlightStrip, { type PreFlightItem } from '../components/launchpad/PreFlightStrip'
import JoinCodePanel from '../components/launchpad/JoinCodePanel'
import EnergizerPanel, { type AnyEnergizer } from '../components/launchpad/EnergizerPanel'
import QuestionList from '../components/launchpad/QuestionList'

type PreFlightResponse = {
  ready: boolean
  checks: Array<{
    id: string
    label: string
    pass: boolean
    message?: string
  }>
}

export default function Launchpad() {
  const auth = useAuth()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { data, loading, error, reload } = useSession(id)
  const t = useT('launchpad')

  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const startingRef = useRef(false)

  const [preFlight, setPreFlight] = useState<PreFlightResponse | null>(null)
  const [preFlightLoading, setPreFlightLoading] = useState(false)
  const [preFlightError, setPreFlightError] = useState<string | null>(null)

  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [orderedQuestions, setOrderedQuestions] = useState(data?.questions ?? [])
  const [reorderError, setReorderError] = useState<string | null>(null)

  const [energizers, setEnergizers] = useState<AnyEnergizer[]>([])
  const [energizerVersion, setEnergizerVersion] = useState(0)

  // Fetch energizers
  useEffect(() => {
    if (!id) return
    let cancelled = false
    void (async () => {
      const res = await api<{ energizers: AnyEnergizer[] }>(
        `/api/sessions/${encodeURIComponent(id)}/energizers`,
      )
      if (!cancelled && res.ok) setEnergizers(res.data.energizers)
    })()
    return () => { cancelled = true }
  }, [id, energizerVersion])

  // Sync question order when session data loads
  useEffect(() => {
    if (data?.questions) setOrderedQuestions(data.questions)
  }, [data?.questions])

  // Journey event
  useEffect(() => {
    if (!id || data?.session.status !== 'draft') return
    void api<unknown>('/api/sessions/journey-events', {
      method: 'POST',
      body: { event: 'launchpad.opened', sessionId: id },
    })
  }, [id, data?.session.status])

  const refreshPreFlight = useCallback(async () => {
    if (!id || data?.session.status !== 'draft') return
    setPreFlightLoading(true)
    setPreFlightError(null)
    const res = await api<PreFlightResponse>(`/api/sessions/${encodeURIComponent(id)}/preflight`)
    setPreFlightLoading(false)
    if (res.ok) { setPreFlight(res.data); return }
    setPreFlight(null)
    setPreFlightError(res.error.message)
  }, [id, data?.session.status])

  useEffect(() => {
    void refreshPreFlight()
  }, [refreshPreFlight, data?.questions.length, data?.session.title])

  const handleDragStart = useCallback((index: number) => setDragIndex(index), [])

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault()
    setDragOverIndex(index)
  }, [])

  const handleDrop = useCallback(async (dropIndex: number) => {
    if (dragIndex === null || dragIndex === dropIndex || !id) {
      setDragIndex(null); setDragOverIndex(null); return
    }
    const next = [...orderedQuestions]
    const [moved] = next.splice(dragIndex, 1)
    next.splice(dropIndex, 0, moved)
    setOrderedQuestions(next)
    setDragIndex(null); setDragOverIndex(null); setReorderError(null)

    const res = await api<unknown>(`/api/sessions/${encodeURIComponent(id)}/questions/reorder`, {
      method: 'PUT',
      body: { questionIds: next.map((q) => q.id) },
    })
    if (!res.ok) {
      setReorderError(t('reorder_error'))
      setOrderedQuestions(data?.questions ?? next)
    }
    void refreshPreFlight()
  }, [dragIndex, orderedQuestions, id, data?.questions, refreshPreFlight, t])

  const handleDragEnd = useCallback(() => {
    setDragIndex(null); setDragOverIndex(null)
  }, [])

  const handleQuestionChanged = useCallback(async () => {
    await reload()
    await refreshPreFlight()
  }, [reload, refreshPreFlight])

  async function handleStart() {
    if (!id || !allValid || startingRef.current) return
    startingRef.current = true
    setStarting(true); setStartError(null)
    try {
      const res = await apiRetry<{ session: unknown; question: unknown }>(
        `/api/sessions/${encodeURIComponent(id)}/start`, { method: 'POST' },
      )
      if (!res.ok) { setStartError(res.error.message); return }
      navigate(`/sessions/${id}/present`)
    } finally {
      startingRef.current = false; setStarting(false)
    }
  }

  async function handleTransitionToLive() {
    if (!id || startingRef.current) return
    startingRef.current = true
    setStarting(true); setStartError(null)
    try {
      const res = await api<{ session: unknown }>(
        `/api/sessions/${encodeURIComponent(id)}/transition-to-live`, { method: 'POST' },
      )
      if (!res.ok) { setStartError(res.error.message); return }
      await reload()
    } finally {
      startingRef.current = false; setStarting(false)
    }
  }

  // Auth / data guards
  if (auth.status === 'loading') {
    return (
      <MainLayout mainClassName="min-h-screen flex items-center justify-center p-8 text-pulse-500">
        {t('loading')}
      </MainLayout>
    )
  }
  if (auth.status === 'anonymous') return <Navigate to="/login" replace />

  if (loading) {
    return (
      <MainLayout mainClassName="min-h-screen max-w-2xl mx-auto p-8">
        <LaunchpadPreFlightSkeleton />
      </MainLayout>
    )
  }

  if (error || !data) {
    return (
      <MainLayout mainClassName="min-h-screen max-w-2xl mx-auto p-8 space-y-4">
        <p role="alert" className="text-red-600">
          {error?.message ?? t('session_not_found')}
        </p>
        <Link to="/dashboard" className="text-teal-600 hover:underline">
          {t('back_link')}
        </Link>
      </MainLayout>
    )
  }

  if (data.session.status === 'live') return <Navigate to={`/sessions/${id}/present`} replace />
  if (data.session.status === 'closed' || data.session.status === 'archived') {
    return <Navigate to={`/sessions/${id}/results`} replace />
  }

  // Pre-flight items
  function localizePreFlightLabel(check: PreFlightResponse['checks'][number]): string {
    if (check.id === 'title_set') return t('preflight_title')
    if (check.id === 'has_questions') return t('preflight_question')
    if (check.id === 'questions_valid') return t('preflight_questions_valid')
    if (check.id === 'ai_consent') return t('preflight_consent')
    return check.label
  }

  const localPreFlightItems: PreFlightItem[] = [
    { key: 'title', label: t('preflight_title'), valid: data.session.title.trim().length > 0 },
    { key: 'question', label: t('preflight_question'), valid: data.questions.length > 0 },
    { key: 'consent', label: t('preflight_consent'), valid: true },
  ]

  const preFlightItems: PreFlightItem[] = preFlight
    ? preFlight.checks.map((check) => {
        const item: PreFlightItem = { key: check.id, label: localizePreFlightLabel(check), valid: check.pass }
        if (check.message !== undefined) item.message = check.message
        return item
      })
    : localPreFlightItems

  const allValid = !preFlightLoading && (preFlight ? preFlight.ready : localPreFlightItems.every((i) => i.valid))

  const isLaunchReady = allValid
  const statusLabel = data.session.status === 'energizing'
    ? t('status_energizing') ?? 'Energizing'
    : isLaunchReady
      ? t('status_ready') ?? 'Draft · launch-ready'
      : t('status_draft') ?? 'Draft'

  const navSlot = (
    <Link
      to="/dashboard"
      className="inline-flex items-center gap-1.5 text-sm text-teal-700 dark:text-teal-400 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 rounded"
    >
      <ArrowLeft size={14} aria-hidden="true" />
      {t('back_to_dashboard')}
    </Link>
  )

  return (
    <MainLayout navSlot={navSlot} mainClassName="min-h-screen p-4 sm:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="space-y-3">
          <SessionTitleField
            sessionId={id!}
            title={data.session.title}
            editable={data.session.status === 'draft'}
            label={t('session_title_label')}
            saveErrorLabel={t('title_save_error')}
            savingLabel={t('title_saving')}
            onSaved={() => { void reload(); void refreshPreFlight() }}
          />
          {/* Status pill */}
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pulse-100 dark:bg-[#1C2540] text-xs font-semibold text-[var(--text-secondary,#525252)] dark:text-[#A8B3CC]">
            <span className={`w-1.5 h-1.5 rounded-full ${isLaunchReady ? 'bg-green-500' : 'bg-pulse-400'}`} aria-hidden="true" />
            {statusLabel}
          </span>
        </header>

        <PreFlightStrip
          items={preFlightItems}
          loading={preFlightLoading}
          error={preFlightError}
        />

        <div className="flex flex-col lg:flex-row gap-6 items-start">
          <JoinCodePanel
            session={{
              code: data.session.code,
              title: data.session.title,
              status: data.session.status,
              started_at: data.session.started_at,
            }}
            starting={starting}
            startError={startError}
            allValid={allValid}
            onStart={() => void handleStart()}
            onTransitionToLive={() => void handleTransitionToLive()}
          />

          <div className="flex-1 min-w-0 space-y-6">
            <EnergizerPanel
              energizers={energizers}
              sessionId={id!}
              onEnergizerChange={() => setEnergizerVersion((v) => v + 1)}
            />

            <QuestionList
              sessionId={id!}
              sessionTitle={data.session.title}
              orderedQuestions={orderedQuestions}
              reorderError={reorderError}
              dragIndex={dragIndex}
              dragOverIndex={dragOverIndex}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={(i) => void handleDrop(i)}
              onDragEnd={handleDragEnd}
              onChanged={handleQuestionChanged}
            />
          </div>
        </div>
      </div>
    </MainLayout>
  )
}
