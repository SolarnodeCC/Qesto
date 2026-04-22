import { useState, useEffect, useRef, useCallback, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import QRCode from 'react-qr-code'
import { useAuth } from '../hooks/useAuth'
import { useSession, type Question, type PollOption } from '../hooks/useSessions'
import { useT } from '../i18n'
import { api } from '../api/client'
import MainLayout from '../layouts/MainLayout'
import { LaunchpadPreFlightSkeleton } from '../components/SkeletonLoader'

type PreFlightItem = {
  key: 'title' | 'question' | 'consent'
  label: string
  valid: boolean
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
  const [codeCopied, setCodeCopied] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

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

      const raw = await fetch(`/api/sessions/${encodeURIComponent(id)}/questions/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionIds: next.map((q) => q.id) }),
      }).catch(() => null)
      if (!raw?.ok) {
        setReorderError(t('reorder_error'))
        setOrderedQuestions(data?.questions ?? next)
      }
    },
    [dragIndex, orderedQuestions, id, data?.questions, t],
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
    const res = await api<unknown>(`/api/sessions/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: { question: { kind: editKind, prompt: editPrompt.trim(), options: editOptions } },
    })
    setEditSaving(false)
    if (!res.ok) {
      setEditError(t('edit_error'))
      return
    }
    setEditingId(null)
    await reload()
  }, [id, editingId, editKind, editPrompt, editOptions, reload, t])

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

  if (data.session.status !== 'draft') {
    return (
      <MainLayout mainClassName="min-h-screen max-w-2xl mx-auto p-8 space-y-4">
        <p role="alert" className="text-sm text-amber-600">
          {t('session_already', { status: data.session.status })}
        </p>
        <Link to="/dashboard" className="text-teal-600 hover:underline">
          {t('back_link')}
        </Link>
      </MainLayout>
    )
  }

  function formatElapsed(seconds: number): string {
    const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
    const ss = String(seconds % 60).padStart(2, '0')
    return `${mm}:${ss}`
  }

  const hasTitle = data.session.title.trim().length > 0

  const preFlightItems: PreFlightItem[] = [
    {
      key: 'title',
      label: t('preflight_title'),
      valid: hasTitle,
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

  const allValid = preFlightItems.every((item) => item.valid)

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
    setAiGenerating(false)
    if (!res.ok) {
      setAiError(res.error.message)
      return
    }
    setAiTopic('')
    await reload()
  }

  async function handleStart() {
    if (!id || !allValid) return
    setStarting(true)
    setStartError(null)
    const res = await api<{ session: unknown; question: unknown }>(
      `/api/sessions/${encodeURIComponent(id)}/start`,
      { method: 'POST' },
    )
    setStarting(false)
    if (!res.ok) {
      setStartError(res.error.message)
      return
    }
    navigate(`/sessions/${id}/present`)
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
    <MainLayout navSlot={navSlot} mainClassName="min-h-screen max-w-2xl mx-auto p-8 space-y-6">
      <header className="space-y-1">
        <h1 tabIndex={-1} className="text-3xl font-semibold focus:outline-none">
          {t('title')}
        </h1>
        <p className="text-pulse-500 font-medium">{data.session.title}</p>
      </header>

      {/* Join code + QR code block */}
      <section
        aria-labelledby="join-code-heading"
        className="rounded-lg border border-pulse-200 bg-pulse-50 p-space-5 space-y-space-4 shadow-card dark:bg-pulse-800 dark:border-pulse-700"
      >
        <h2 id="join-code-heading" className="text-caption font-medium text-pulse-500 uppercase tracking-wider dark:text-pulse-400">
          {t('join_code_heading')}
        </h2>

        <div className="flex flex-col sm:flex-row items-center gap-space-5">
          {/* Join code display + copy */}
          <div className="flex-1 space-y-space-3">
            <div className="flex items-center gap-space-3">
              <code
                className="text-5xl font-mono font-bold tracking-widest text-pulse-900 dark:text-pulse-50 select-all"
                aria-label={`${t('join_code_heading')}: ${data.session.code}`}
              >
                {data.session.code}
              </code>
              <button
                type="button"
                onClick={handleCopyCode}
                aria-label={codeCopied ? t('join_code_copied_label') : t('join_code_copy_label')}
                className="inline-flex items-center justify-center w-11 h-11 rounded-md border border-pulse-300 text-pulse-500 hover:border-teal-500 hover:text-teal-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 transition-colors dark:border-pulse-600 dark:text-pulse-400 dark:hover:border-teal-500 dark:hover:text-teal-400"
              >
                {codeCopied ? (
                  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-teal-600">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
            <p className="text-body-s text-pulse-500">
              {t('join_hint')}
            </p>

            {/* Elapsed timer — visible once session is live (LAUNCHPAD-02) */}
            {data.session.started_at !== null && (
              <div className="flex flex-col gap-space-1 pt-space-2 border-t border-pulse-100">
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
          </div>

          {/* QR code — scan to join */}
          <div
            aria-label={t('qr_aria_label')}
            className="flex-shrink-0 rounded-lg border border-pulse-200 dark:border-pulse-600 bg-white dark:bg-white p-2 shadow-sm"
          >
            <QRCode
              value={`${window.location.origin}/j/${data.session.code}`}
              size={120}
              style={{ display: 'block' }}
            />
          </div>
        </div>
      </section>

      {/* Questions — drag-to-reorder + inline editor (LAUNCHPAD-02) */}
      <section className="space-y-space-3">
        <h2 className="text-heading-s font-semibold dark:text-pulse-100">
          {t('questions_count', { count: orderedQuestions.length })}
        </h2>

        {reorderError && (
          <p role="alert" className="text-sm text-red-600">{reorderError}</p>
        )}

        {orderedQuestions.length === 0 ? (
          <div className="space-y-4">
            <p className="text-body-s text-pulse-500 dark:text-pulse-400">{t('no_questions_hint')}</p>
            {/* AI quick-generate — surface AI when no questions exist */}
            <div className="rounded-lg border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30 p-space-4 space-y-space-3">
              <div className="flex items-center gap-2">
                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-violet-500 flex-shrink-0">
                  <path d="M12 2l1.8 5.4 5.7 0-4.6 3.4 1.8 5.4L12 13l-4.7 3.2 1.8-5.4L4.5 7.4l5.7 0z" />
                </svg>
                <p className="text-sm font-semibold text-violet-800 dark:text-violet-200">{t('ai_generate_heading')}</p>
              </div>
              <form onSubmit={(e) => void handleAIGenerate(e)} className="space-y-space-2">
                <input
                  type="text"
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  placeholder={t('ai_topic_placeholder', { title: data.session.title })}
                  maxLength={160}
                  disabled={aiGenerating}
                  className="w-full rounded-md border border-violet-300 dark:border-violet-700 dark:bg-pulse-800 dark:text-pulse-100 px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:opacity-60 placeholder:text-pulse-400"
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
          <ul className="space-y-space-2">
            {orderedQuestions.map((q, index) => (
              <li
                key={q.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={() => void handleDrop(index)}
                onDragEnd={handleDragEnd}
                className={[
                  'rounded-md border dark:bg-pulse-800 transition-colors',
                  dragOverIndex === index && dragIndex !== index
                    ? 'border-teal-400 bg-teal-50 dark:bg-teal-900/20'
                    : 'border-pulse-200 dark:border-pulse-700',
                  dragIndex === index ? 'opacity-50' : '',
                ].join(' ')}
              >
                {editingId === q.id ? (
                  <div className="p-space-3 space-y-space-3">
                    <div className="space-y-1">
                      <label htmlFor={`edit-prompt-${q.id}`} className="text-caption text-pulse-500">{t('edit_prompt_label')}</label>
                      <textarea
                        id={`edit-prompt-${q.id}`}
                        value={editPrompt}
                        onChange={(e) => setEditPrompt(e.target.value)}
                        rows={2}
                        className="w-full rounded-md border border-pulse-300 dark:border-pulse-600 dark:bg-pulse-700 dark:text-pulse-100 px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor={`edit-kind-${q.id}`} className="text-caption text-pulse-500">{t('edit_kind_label')}</label>
                      <select
                        id={`edit-kind-${q.id}`}
                        value={editKind}
                        onChange={(e) => setEditKind(e.target.value as Question['kind'])}
                        className="rounded-md border border-pulse-300 dark:border-pulse-600 dark:bg-pulse-700 dark:text-pulse-100 px-2 py-1.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                      >
                        <option value="poll">Poll</option>
                        <option value="ranking">Ranking</option>
                        <option value="open">Open</option>
                        <option value="consent">Consent</option>
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
                        className="px-3 py-1.5 rounded-md border border-pulse-300 dark:border-pulse-600 text-sm text-pulse-700 dark:text-pulse-300 hover:bg-pulse-50 dark:hover:bg-pulse-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                      >
                        {t('cancel_edit')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-space-3 flex items-center gap-space-3">
                    {/* Drag handle */}
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
                      <p className="text-body-s font-medium text-pulse-900 dark:text-pulse-100 truncate">{q.prompt}</p>
                      <p className="text-caption text-pulse-500 dark:text-pulse-400 mt-0.5">{q.kind}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => startEdit(q)}
                      aria-label={t('edit_question')}
                      className="flex-shrink-0 text-pulse-400 hover:text-teal-600 dark:text-pulse-500 dark:hover:text-teal-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded transition-colors"
                    >
                      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
      </section>

      {/* Pre-flight checklist */}
      <section className="rounded-lg border border-pulse-200 dark:border-pulse-700 dark:bg-pulse-800 p-space-4 space-y-space-3 shadow-card">
        <h2 className="font-semibold dark:text-pulse-100">{t('checklist_title')}</h2>
        <ul className="space-y-space-2">
          {preFlightItems.map((item) => (
            <li key={item.key} className="flex items-center gap-space-3">
              <div
                className={`w-5 h-5 rounded-pill border-2 flex items-center justify-center flex-shrink-0 ${
                  item.valid
                    ? 'bg-teal-100 border-teal-500 dark:bg-teal-900/40 dark:border-teal-500'
                    : 'bg-red-50 border-red-300 dark:bg-red-900/30 dark:border-red-500'
                }`}
              >
                {item.valid && <div className="w-2.5 h-2.5 bg-teal-600 dark:bg-teal-400 rounded-pill" />}
                {!item.valid && <div className="w-2 h-2.5 bg-red-400" />}
              </div>
              <span className={item.valid ? 'text-pulse-900 dark:text-pulse-100' : 'text-red-600 dark:text-red-400'}>
                {item.label}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Action buttons */}
      <div className="space-y-space-3">
        <button
          type="button"
          onClick={handleStart}
          disabled={!allValid || starting}
          className="w-full inline-flex items-center justify-center gap-space-2 rounded-lg bg-gradient-to-br from-teal-500 to-violet-600 text-white px-space-5 py-space-3 text-body-m font-semibold hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 shadow-teal transition-all btn-motion"
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
              {t('start_button')}
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleShare}
          disabled={sharing}
          className="w-full inline-flex items-center justify-center rounded-md border border-pulse-300 dark:border-pulse-600 text-pulse-700 dark:text-pulse-300 hover:border-teal-500 hover:text-teal-700 dark:hover:border-teal-500 dark:hover:text-teal-400 px-space-4 py-space-2 font-medium disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 transition-colors"
        >
          {sharing ? t('sharing') : t('share_button')}
        </button>
      </div>

      {startError && (
        <p role="alert" className="text-sm text-red-600">
          {startError}
        </p>
      )}
    </MainLayout>
  )
}
