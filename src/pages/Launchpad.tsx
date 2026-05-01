import { useState, useEffect, useRef, useCallback, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import QRCode from 'react-qr-code'
import { useAuth } from '../hooks/useAuth'
import { useSession, type Question, type PollOption } from '../hooks/useSessions'
import { useT } from '../i18n'
import { api } from '../api/client'
import MainLayout from '../layouts/MainLayout'
import { LaunchpadPreFlightSkeleton } from '../components/SkeletonLoader'
import EmojiPollEnergizerView, { type EmojiPollEnergizer } from '../components/EmojiPollEnergizer'
import QuickFingerEnergizerView, { type QuickFingerEnergizer } from '../components/QuickFingerEnergizer'
import TeamQuizEnergizerView, { type TeamQuizEnergizer } from '../components/TeamQuizEnergizer'
import WordCloudEnergizerView, { type WordCloudEnergizer } from '../components/WordCloudEnergizer'

type PreFlightItem = {
  key: string
  label: string
  valid: boolean
  message?: string
}

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

  const [sharing, setSharing] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const startingRef = useRef(false)
  const [codeCopied, setCodeCopied] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [preFlight, setPreFlight] = useState<PreFlightResponse | null>(null)
  const [preFlightLoading, setPreFlightLoading] = useState(false)
  const [preFlightError, setPreFlightError] = useState<string | null>(null)

  // Drag-to-reorder state
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [orderedQuestions, setOrderedQuestions] = useState<Question[]>([])
  const [reorderError, setReorderError] = useState<string | null>(null)

  // Inline editor state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editPrompt, setEditPrompt] = useState('')
  const [editKind, setEditKind] = useState<Question['kind']>('poll')
  const [editOptions, setEditOptions] = useState<PollOption[]>([])
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // AI quick-generate state
  const [aiTopic, setAiTopic] = useState('')
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  // Energizer state
  type AnyEnergizer = EmojiPollEnergizer | QuickFingerEnergizer | TeamQuizEnergizer | WordCloudEnergizer
  const [energizers, setEnergizers] = useState<AnyEnergizer[]>([])
  const [energizerVersion, setEnergizerVersion] = useState(0)

  // Fetch energizers for this session
  useEffect(() => {
    if (!id) return
    let cancelled = false
    ;(async () => {
      const res = await api<{ energizers: AnyEnergizer[] }>(
        `/api/sessions/${encodeURIComponent(id)}/energizers`,
      )
      if (!cancelled && res.ok) setEnergizers(res.data.energizers)
    })()
    return () => { cancelled = true }
  }, [id, energizerVersion])

  // Inline add-question state
  const [addingQuestion, setAddingQuestion] = useState(false)
  const [addPrompt, setAddPrompt] = useState('')
  const [addKind, setAddKind] = useState<Question['kind']>('poll')
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  // Count-up timer — starts when started_at is available (LAUNCHPAD-02)
  useEffect(() => {
    const startedAt = data?.session.started_at ?? null
    if (!startedAt) {
      setElapsed(0)
      return
    }
    function tick() {
      setElapsed(Math.floor((Date.now() - (startedAt as number)) / 1000))
    }
    tick()
    intervalRef.current = setInterval(tick, 1000)
    return () => {
      if (intervalRef.current !== null) clearInterval(intervalRef.current)
    }
  }, [data?.session.started_at])

  // Sync orderedQuestions when session data loads
  useEffect(() => {
    if (data?.questions) setOrderedQuestions(data.questions)
  }, [data?.questions])

  const refreshPreFlight = useCallback(async () => {
    if (!id || data?.session.status !== 'draft') return
    setPreFlightLoading(true)
    setPreFlightError(null)
    const res = await api<PreFlightResponse>(`/api/sessions/${encodeURIComponent(id)}/preflight`)
    setPreFlightLoading(false)
    if (res.ok) {
      setPreFlight(res.data)
      return
    }
    setPreFlight(null)
    setPreFlightError(res.error.message)
  }, [id, data?.session.status])

  useEffect(() => {
    void refreshPreFlight()
  }, [refreshPreFlight, data?.questions.length, data?.session.title])

  const handleDragStart = useCallback((index: number) => {
    setDragIndex(index)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault()
    setDragOverIndex(index)
  }, [])

  const handleDrop = useCallback(
    async (dropIndex: number) => {
      if (dragIndex === null || dragIndex === dropIndex || !id) {
        setDragIndex(null)
        setDragOverIndex(null)
        return
      }
      const next = [...orderedQuestions]
      const [moved] = next.splice(dragIndex, 1)
      next.splice(dropIndex, 0, moved)
      setOrderedQuestions(next)
      setDragIndex(null)
      setDragOverIndex(null)
      setReorderError(null)

      const res = await api<unknown>(`/api/sessions/${encodeURIComponent(id)}/questions/reorder`, {
        method: 'PUT',
        body: { questionIds: next.map((q) => q.id) },
      })
      if (!res.ok) {
        setReorderError(t('reorder_error'))
        setOrderedQuestions(data?.questions ?? next)
        void refreshPreFlight()
        return
      }
      void refreshPreFlight()
    },
    [dragIndex, orderedQuestions, id, data?.questions, refreshPreFlight, t],
  )

  const handleDragEnd = useCallback(() => {
    setDragIndex(null)
    setDragOverIndex(null)
  }, [])

  const startEdit = useCallback((q: Question) => {
    setEditingId(q.id)
    setEditPrompt(q.prompt)
    setEditKind(q.kind)
    setEditOptions(q.options)
    setEditError(null)
  }, [])

  const cancelEdit = useCallback(() => {
    setEditingId(null)
    setEditError(null)
  }, [])

  const saveEdit = useCallback(async () => {
    if (!id || !editingId) return
    setEditSaving(true)
    setEditError(null)
    const res = await api<unknown>(`/api/sessions/${encodeURIComponent(id)}/questions/${encodeURIComponent(editingId)}`, {
      method: 'PATCH',
      body: { kind: editKind, prompt: editPrompt.trim(), options: editOptions },
    })
    setEditSaving(false)
    if (!res.ok) {
      setEditError(t('edit_error'))
      return
    }
    setEditingId(null)
    await reload()
    await refreshPreFlight()
  }, [id, editingId, editKind, editPrompt, editOptions, reload, refreshPreFlight, t])

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

  if (data.session.status === 'live') {
    return <Navigate to={`/sessions/${id}/present`} replace />
  }
  if (data.session.status === 'closed' || data.session.status === 'archived') {
    return <Navigate to={`/sessions/${id}/results`} replace />
  }

  function formatElapsed(seconds: number): string {
    const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
    const ss = String(seconds % 60).padStart(2, '0')
    return `${mm}:${ss}`
  }

  const localPreFlightItems: PreFlightItem[] = [
    {
      key: 'title',
      label: t('preflight_title'),
      valid: data.session.title.trim().length > 0,
    },
    {
      key: 'question',
      label: t('preflight_question'),
      valid: data.questions.length > 0,
    },
    {
      key: 'consent',
      label: t('preflight_consent'),
      valid: true,
    },
  ]

  function localizePreFlightLabel(check: PreFlightResponse['checks'][number]): string {
    if (check.id === 'title_set') return t('preflight_title')
    if (check.id === 'has_questions') return t('preflight_question')
    if (check.id === 'questions_valid') return t('preflight_questions_valid')
    if (check.id === 'ai_consent') return t('preflight_consent')
    return check.label
  }

  const preFlightItems: PreFlightItem[] = preFlight
    ? preFlight.checks.map((check) => {
        const item: PreFlightItem = {
          key: check.id,
          label: localizePreFlightLabel(check),
          valid: check.pass,
        }
        if (check.message !== undefined) item.message = check.message
        return item
      })
    : localPreFlightItems

  const allValid = !preFlightLoading && (preFlight ? preFlight.ready : localPreFlightItems.every((item) => item.valid))

  async function handleAIGenerate(e: FormEvent) {
    e.preventDefault()
    if (!id || !data || aiGenerating) return
    setAiGenerating(true)
    setAiError(null)
    const topic = aiTopic.trim() || data.session.title
    const res = await api<{ questions: Array<{ id?: string; kind: string; prompt: string; options?: Array<{ id?: string; label: string }> }>; confidence: number }>(
      `/api/sessions/${encodeURIComponent(id)}/questions/generate`,
      {
        method: 'POST',
        body: { sessionTitle: data.session.title, sessionGoal: topic, focusArea: aiTopic.trim() || undefined },
      },
    )
    if (!res.ok) {
      setAiGenerating(false)
      setAiError(res.error.message)
      return
    }
    // Persist each generated question so they appear in the session
    for (const q of res.data.questions) {
      const kind = (['poll', 'ranking', 'consent', 'open', 'multi_select', 'likert', 'upvote', 'word_cloud', 'slider'].includes(q.kind)
        ? q.kind
        : 'poll') as Question['kind']
      await api<unknown>(`/api/sessions/${encodeURIComponent(id)}/questions`, {
        method: 'POST',
        body: { kind, prompt: q.prompt, options: q.options ?? [] },
      })
    }
    setAiGenerating(false)
    setAiTopic('')
    await reload()
    await refreshPreFlight()
  }

  async function handleAddQuestion() {
    if (!id || !addPrompt.trim() || addSaving) return
    setAddSaving(true)
    setAddError(null)
    const res = await api<unknown>(`/api/sessions/${encodeURIComponent(id)}/questions`, {
      method: 'POST',
      body: { kind: addKind, prompt: addPrompt.trim() },
    })
    setAddSaving(false)
    if (!res.ok) {
      setAddError(t('edit_error'))
      return
    }
    setAddPrompt('')
    setAddKind('poll')
    setAddingQuestion(false)
    await reload()
    await refreshPreFlight()
  }

  async function handleStart() {
    if (!id || !allValid || startingRef.current) return
    startingRef.current = true
    setStarting(true)
    setStartError(null)
    try {
      const res = await api<{ session: unknown; question: unknown }>(
        `/api/sessions/${encodeURIComponent(id)}/start`,
        { method: 'POST' },
      )
      if (!res.ok) { setStartError(res.error.message); return }
      navigate(`/sessions/${id}/present`)
    } finally {
      startingRef.current = false
      setStarting(false)
    }
  }

  async function handleCopyCode() {
    if (!data) return
    try {
      await navigator.clipboard.writeText(data.session.code)
      setCodeCopied(true)
      setTimeout(() => setCodeCopied(false), 2000)
    } catch {
      // Clipboard API not available — silently fail
    }
  }

  async function handleShare() {
    if (!data) return
    setSharing(true)
    const url = `${window.location.origin}/j/${data.session.code}`
    if (navigator.share) {
      try {
        await navigator.share({
          title: data.session.title,
          text: `Join my session: ${data.session.title}`,
          url,
        })
      } catch {
        // Cancelled by user
      }
    } else {
      try {
        await navigator.clipboard.writeText(url)
      } catch {
        // Fallback to showing the URL
      }
    }
    setSharing(false)
  }

  const navSlot = (
    <Link
      to="/dashboard"
      className="text-sm text-teal-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 rounded"
    >
      {t('back_to_dashboard')}
    </Link>
  )

  return (
    <MainLayout navSlot={navSlot} mainClassName="min-h-screen p-4 sm:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Page header */}
        <header>
          <h1 tabIndex={-1} className="text-3xl font-semibold focus:outline-none dark:text-[#F0F2F8]">
            {data.session.title}
          </h1>
          <p className="text-caption text-pulse-500 mt-1">{t('title')}</p>
        </header>

        {/* Pre-flight strip — horizontal checklist bar */}
        <section
          aria-label={t('checklist_title')}
          className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-pulse-200 dark:border-[#1E2A45] bg-pulse-50 dark:bg-[#0F1525] px-4 py-3"
        >
          {preFlightItems.map((item) => (
            <div key={item.key} className="flex items-center gap-2">
              <div
                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  item.valid
                    ? 'bg-teal-100 border-teal-500 dark:bg-teal-900/40 dark:border-teal-500'
                    : 'bg-red-50 border-red-300 dark:bg-red-900/30 dark:border-red-500'
                }`}
              >
                {item.valid && (
                  <svg aria-hidden="true" width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" className="text-teal-600 dark:text-teal-400">
                    <path d="M2 5l2.5 2.5L8 3" />
                  </svg>
                )}
              </div>
              <span className={`text-caption ${item.valid ? 'text-pulse-700 dark:text-pulse-300' : 'text-red-600 dark:text-red-400'}`}>
                {item.label}
              </span>
              {!item.valid && item.message && (
                <span className="sr-only">: {item.message}</span>
              )}
            </div>
          ))}
        </section>
        {(preFlightLoading || preFlightError) && (
          <p
            role={preFlightError ? 'alert' : 'status'}
            className={preFlightError ? 'text-sm text-amber-600' : 'text-sm text-pulse-500'}
          >
            {preFlightError ?? t('preflight_checking')}
          </p>
        )}

        {/* Two-column rails */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">

          {/* ── Left: Action rail ── */}
          <aside className="w-full lg:w-72 shrink-0 space-y-4">
            {/* Join code */}
            <section
              aria-labelledby="join-code-heading"
              className="rounded-lg border border-pulse-200 dark:border-[#1E2A45] bg-pulse-50 dark:bg-[#151C2E] p-4 space-y-3 shadow-card"
            >
              <h2 id="join-code-heading" className="text-caption font-medium text-pulse-500 uppercase tracking-wider dark:text-[#6B7A99]">
                {t('join_code_heading')}
              </h2>
              <div className="flex items-center gap-3">
                <code
                  className="text-4xl font-mono font-bold tracking-widest text-pulse-900 dark:text-pulse-50 select-all"
                  aria-label={`${t('join_code_heading')}: ${data.session.code}`}
                >
                  {data.session.code}
                </code>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  aria-label={codeCopied ? t('join_code_copied_label') : t('join_code_copy_label')}
                  className="inline-flex items-center justify-center w-9 h-9 rounded-md border border-pulse-300 text-pulse-500 hover:border-teal-500 hover:text-teal-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 transition-colors dark:border-pulse-600 dark:text-pulse-400 dark:hover:border-teal-500 dark:hover:text-teal-400"
                >
                  {codeCopied ? (
                    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-teal-600">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" />
                      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                    </svg>
                  )}
                </button>
              </div>
              {codeCopied && (
                <p role="status" aria-live="polite" className="text-caption text-teal-600 dark:text-teal-400 font-medium">
                  {t('join_code_copied_toast')}
                </p>
              )}
              <p className="text-caption text-pulse-500 dark:text-pulse-400">{t('join_hint')}</p>

              {/* Elapsed timer */}
              {data.session.started_at !== null && (
                <div className="pt-2 border-t border-pulse-100 dark:border-[#1E2A45]">
                  <p className="text-caption text-pulse-500 uppercase tracking-wider">{t('timer_label')}</p>
                  <p
                    className="font-mono text-2xl font-semibold text-teal-600"
                    aria-live="polite"
                    aria-atomic="true"
                    aria-label={`${t('timer_label')} ${formatElapsed(elapsed)}`}
                  >
                    {formatElapsed(elapsed)}
                  </p>
                </div>
              )}
            </section>

            {/* QR code */}
            <div
              aria-label={t('qr_aria_label')}
              className="flex justify-center rounded-lg border border-pulse-200 dark:border-[#1E2A45] bg-white dark:bg-[#151C2E] p-4 shadow-sm"
            >
              <QRCode
                value={`${window.location.origin}/j/${data.session.code}`}
                size={140}
                style={{ display: 'block' }}
              />
            </div>

            {/* Primary CTA — Open lobby */}
            <button
              type="button"
              onClick={handleStart}
              disabled={!allValid || starting}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-br from-teal-500 to-violet-600 text-white px-5 py-3 text-base font-semibold hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 shadow-teal transition-all btn-motion"
            >
              {starting ? (
                <>
                  <svg aria-hidden="true" className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {t('starting')}
                </>
              ) : (
                <>
                  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7L8 5z" />
                  </svg>
                  {t('open_lobby_button')}
                </>
              )}
            </button>

            {startError && (
              <p role="alert" className="text-sm text-red-600">{startError}</p>
            )}

            {/* Share button */}
            <button
              type="button"
              onClick={handleShare}
              disabled={sharing}
              className="w-full inline-flex items-center justify-center rounded-md border border-pulse-300 dark:border-pulse-600 text-pulse-700 dark:text-pulse-300 hover:border-teal-500 hover:text-teal-700 dark:hover:border-teal-500 dark:hover:text-teal-400 px-4 py-2 font-medium disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 transition-colors"
            >
              {sharing ? t('sharing') : t('share_button')}
            </button>
          </aside>

          {/* ── Right: Content rail ── */}
          <div className="flex-1 min-w-0 space-y-6">
            {/* Questions — drag-to-reorder + inline editor */}
            <section className="space-y-3">
              <h2 className="text-lg font-semibold dark:text-[#F0F2F8]">
                {t('questions_count', { count: orderedQuestions.length })}
              </h2>

              {reorderError && (
                <p role="alert" className="text-sm text-red-600">{reorderError}</p>
              )}

              {orderedQuestions.length === 0 ? (
                <div className="space-y-4">
                  <p className="text-sm text-pulse-500 dark:text-pulse-400">{t('no_questions_hint')}</p>
                  {/* AI quick-generate */}
                  <div className="rounded-lg border border-violet-200 dark:border-violet-800/60 bg-violet-50 dark:bg-violet-900/20 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-violet-500 flex-shrink-0">
                        <path d="M12 2l1.8 5.4 5.7 0-4.6 3.4 1.8 5.4L12 13l-4.7 3.2 1.8-5.4L4.5 7.4l5.7 0z" />
                      </svg>
                      <p className="text-sm font-semibold text-violet-800 dark:text-violet-200">{t('ai_generate_heading')}</p>
                    </div>
                    <form onSubmit={(e) => void handleAIGenerate(e)} className="space-y-2">
                      <input
                        type="text"
                        value={aiTopic}
                        onChange={(e) => setAiTopic(e.target.value)}
                        placeholder={t('ai_topic_placeholder', { title: data.session.title })}
                        maxLength={160}
                        disabled={aiGenerating}
                        className="w-full rounded-md border border-violet-300 dark:border-violet-700/60 dark:bg-[#1C2540] dark:text-[#F0F2F8] px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:opacity-60 placeholder:text-pulse-400"
                      />
                      {aiError && (
                        <p role="alert" className="text-xs text-red-600 dark:text-red-400">{aiError}</p>
                      )}
                      <button
                        type="submit"
                        disabled={aiGenerating}
                        className="inline-flex items-center gap-2 rounded-md bg-violet-600 text-white text-sm font-medium px-3 py-1.5 hover:bg-violet-700 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-1 transition-colors"
                      >
                        {aiGenerating ? (
                          <>
                            <svg aria-hidden="true" className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            {t('ai_generating')}
                          </>
                        ) : (
                          <>
                            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12 2l2.09 6.26L20 10l-5.91 1.74L12 18l-2.09-5.26L4 11l5.91-1.74L12 2z" />
                            </svg>
                            {t('ai_generate_button')}
                          </>
                        )}
                      </button>
                    </form>
                  </div>
                </div>
              ) : (
                <ul className="space-y-2">
                  {orderedQuestions.map((q, index) => (
                    <li
                      key={q.id}
                      draggable
                      onDragStart={() => handleDragStart(index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDrop={() => void handleDrop(index)}
                      onDragEnd={handleDragEnd}
                      className={[
                        'rounded-md border bg-white dark:bg-[#151C2E] transition-colors',
                        dragOverIndex === index && dragIndex !== index
                          ? 'border-teal-400 bg-teal-50 dark:bg-teal-500/10'
                          : 'border-pulse-200 dark:border-[#1E2A45]',
                        dragIndex === index ? 'opacity-50' : '',
                      ].join(' ')}
                    >
                      {editingId === q.id ? (
                        <div className="p-3 space-y-3">
                          <div className="space-y-1">
                            <label htmlFor={`edit-prompt-${q.id}`} className="text-caption text-pulse-500">{t('edit_prompt_label')}</label>
                            <textarea
                              id={`edit-prompt-${q.id}`}
                              value={editPrompt}
                              onChange={(e) => setEditPrompt(e.target.value)}
                              rows={2}
                              className="w-full rounded-md border border-pulse-300 dark:border-[#2A3858] dark:bg-[#1C2540] dark:text-[#F0F2F8] px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                            />
                          </div>
                          <div className="space-y-1">
                            <label htmlFor={`edit-kind-${q.id}`} className="text-caption text-pulse-500">{t('edit_kind_label')}</label>
                            <select
                              id={`edit-kind-${q.id}`}
                              value={editKind}
                              onChange={(e) => setEditKind(e.target.value as Question['kind'])}
                              className="rounded-md border border-pulse-300 dark:border-[#2A3858] dark:bg-[#1C2540] dark:text-[#F0F2F8] px-2 py-1.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                            >
                              <option value="poll">Poll</option>
                              <option value="ranking">Ranking</option>
                              <option value="open">Open</option>
                              <option value="consent">Consent</option>
                              <option value="multi_select">Multi-select</option>
                              <option value="likert">Likert</option>
                              <option value="upvote">Upvote</option>
                              <option value="word_cloud">Word cloud</option>
                              <option value="slider">Slider</option>
                            </select>
                          </div>
                          {editError && (
                            <p role="alert" className="text-sm text-red-600">{editError}</p>
                          )}
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => void saveEdit()}
                              disabled={editSaving || editPrompt.trim().length === 0}
                              className="px-3 py-1.5 rounded-md bg-teal-600 text-white text-sm font-medium hover:brightness-110 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                            >
                              {editSaving ? '…' : t('save_question')}
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              disabled={editSaving}
                              className="px-3 py-1.5 rounded-md border border-pulse-300 dark:border-[#2A3858] dark:bg-transparent text-sm text-pulse-700 dark:text-[#A8B3CC] hover:bg-pulse-50 dark:hover:bg-[#1E2A45] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                            >
                              {t('cancel_edit')}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 flex items-center gap-3">
                          <button
                            type="button"
                            aria-label={t('drag_handle_label')}
                            className="flex-shrink-0 text-pulse-400 dark:text-pulse-500 cursor-grab active:cursor-grabbing focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded"
                          >
                            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                              <circle cx="9" cy="6" r="1.5" />
                              <circle cx="15" cy="6" r="1.5" />
                              <circle cx="9" cy="12" r="1.5" />
                              <circle cx="15" cy="12" r="1.5" />
                              <circle cx="9" cy="18" r="1.5" />
                              <circle cx="15" cy="18" r="1.5" />
                            </svg>
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-pulse-900 dark:text-pulse-100 truncate">{q.prompt}</p>
                            <p className="text-caption text-pulse-500 dark:text-pulse-400 mt-0.5">{q.kind}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => startEdit(q)}
                            aria-label={t('edit_question')}
                            className="flex-shrink-0 text-pulse-400 hover:text-teal-600 dark:text-pulse-500 dark:hover:text-teal-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded transition-colors"
                          >
                            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {/* Inline add-question form */}
              {addingQuestion ? (
                <div className="mt-3 rounded-lg border border-teal-200 dark:border-teal-400/40 bg-teal-50/40 dark:bg-teal-500/10 p-3 space-y-3">
                  <div className="space-y-1">
                    <label htmlFor="add-prompt" className="text-caption text-pulse-500">{t('edit_prompt_label')}</label>
                    <textarea
                      id="add-prompt"
                      value={addPrompt}
                      onChange={(e) => setAddPrompt(e.target.value)}
                      rows={2}
                      autoFocus
                      className="w-full rounded-md border border-pulse-300 dark:border-[#2A3858] dark:bg-[#1C2540] dark:text-[#F0F2F8] px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="add-kind" className="text-caption text-pulse-500">{t('edit_kind_label')}</label>
                    <select
                      id="add-kind"
                      value={addKind}
                      onChange={(e) => setAddKind(e.target.value as Question['kind'])}
                      className="rounded-md border border-pulse-300 dark:border-[#2A3858] dark:bg-[#1C2540] dark:text-[#F0F2F8] px-2 py-1.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                    >
                      <option value="poll">Poll</option>
                      <option value="ranking">Ranking</option>
                      <option value="open">Open</option>
                      <option value="consent">Consent</option>
                      <option value="multi_select">Multi-select</option>
                      <option value="likert">Likert</option>
                      <option value="upvote">Upvote</option>
                      <option value="word_cloud">Word cloud</option>
                      <option value="slider">Slider</option>
                    </select>
                  </div>
                  {addError && <p role="alert" className="text-sm text-red-600">{addError}</p>}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void handleAddQuestion()}
                      disabled={addSaving || addPrompt.trim().length === 0}
                      className="px-3 py-1.5 rounded-md bg-teal-600 text-white text-sm font-medium hover:brightness-110 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                    >
                      {addSaving ? '…' : t('save_question')}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setAddingQuestion(false); setAddPrompt(''); setAddError(null) }}
                      disabled={addSaving}
                      className="px-3 py-1.5 rounded-md border border-pulse-300 dark:border-[#2A3858] dark:bg-transparent text-sm text-pulse-700 dark:text-[#A8B3CC] hover:bg-pulse-50 dark:hover:bg-[#1E2A45] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                    >
                      {t('cancel_edit')}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingQuestion(true)}
                  className="mt-3 text-sm text-teal-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded"
                >
                  {t('add_question_inline')}
                </button>
              )}
            </section>

            {/* Energizer panel — shown if one was attached in the wizard */}
            {energizers.length > 0 && (
              <section aria-labelledby="energizer-heading" className="space-y-3">
                <h2 id="energizer-heading" className="text-lg font-semibold dark:text-[#F0F2F8]">
                  Energizer
                </h2>
                {energizers.map((energizer) => {
                  const onActivate = () => setEnergizerVersion((v) => v + 1)
                  const onComplete = () => setEnergizerVersion((v) => v + 1)
                  if (energizer.kind === 'emoji_poll') {
                    return (
                      <EmojiPollEnergizerView key={energizer.id} sessionId={id!}
                        energizer={energizer as EmojiPollEnergizer} role="host"
                        onActivate={onActivate} onComplete={onComplete} />
                    )
                  }
                  if (energizer.kind === 'quick_finger') {
                    return (
                      <QuickFingerEnergizerView key={energizer.id} sessionId={id!}
                        energizer={energizer as QuickFingerEnergizer} role="host"
                        onActivate={onActivate} onComplete={onComplete} />
                    )
                  }
                  if (energizer.kind === 'team_quiz') {
                    return (
                      <TeamQuizEnergizerView key={energizer.id} sessionId={id!}
                        energizer={energizer as TeamQuizEnergizer} role="host"
                        onActivate={onActivate} onComplete={onComplete} />
                    )
                  }
                  if (energizer.kind === 'word_cloud') {
                    return (
                      <WordCloudEnergizerView key={energizer.id} sessionId={id!}
                        energizer={energizer as WordCloudEnergizer} role="host"
                        onActivate={onActivate} onComplete={onComplete} />
                    )
                  }
                  return null
                })}
              </section>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  )
}
