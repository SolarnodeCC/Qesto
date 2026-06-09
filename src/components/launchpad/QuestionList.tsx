import { useState, useCallback, type FormEvent } from 'react'
import { api } from '../../api/client'
import { useT } from '../../i18n'
import { inputHint } from '../../ui/input-hint'
import { LAUNCHPAD_AI_TOPIC_CLASS } from '../../ui/input-field-class'
import { KindPicker, QUESTION_KINDS } from '../../ui/kind-picker'
import type { Question, PollOption } from '../../hooks/useSessions'

type Props = {
  sessionId: string
  sessionTitle: string
  orderedQuestions: Question[]
  reorderError: string | null
  dragIndex: number | null
  dragOverIndex: number | null
  onDragStart: (index: number) => void
  onDragOver: (e: React.DragEvent, index: number) => void
  onDrop: (index: number) => void
  onDragEnd: () => void
  onChanged: () => Promise<void>
}

export default function QuestionList({
  sessionId,
  sessionTitle,
  orderedQuestions,
  reorderError,
  dragIndex,
  dragOverIndex,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onChanged,
}: Props) {
  const t = useT('launchpad')

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editPrompt, setEditPrompt] = useState('')
  const [editKind, setEditKind] = useState<Question['kind']>('poll')
  const [editOptions, setEditOptions] = useState<PollOption[]>([])
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // Inline add state
  const [addingQuestion, setAddingQuestion] = useState(false)
  const [addPrompt, setAddPrompt] = useState('')
  const [addKind, setAddKind] = useState<Question['kind']>('poll')
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  // AI generate state
  const [aiTopic, setAiTopic] = useState('')
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

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
    if (!editingId) return
    setEditSaving(true)
    setEditError(null)
    const res = await api<unknown>(
      `/api/sessions/${encodeURIComponent(sessionId)}/questions/${encodeURIComponent(editingId)}`,
      { method: 'PATCH', body: { kind: editKind, prompt: editPrompt.trim(), options: editOptions } },
    )
    setEditSaving(false)
    if (!res.ok) { setEditError(t('edit_error')); return }
    setEditingId(null)
    await onChanged()
  }, [editingId, editKind, editPrompt, editOptions, sessionId, onChanged, t])

  async function handleAddQuestion() {
    if (!addPrompt.trim() || addSaving) return
    setAddSaving(true)
    setAddError(null)
    const res = await api<unknown>(
      `/api/sessions/${encodeURIComponent(sessionId)}/questions`,
      { method: 'POST', body: { kind: addKind, prompt: addPrompt.trim() } },
    )
    setAddSaving(false)
    if (!res.ok) { setAddError(t('edit_error')); return }
    setAddPrompt('')
    setAddKind('poll')
    setAddingQuestion(false)
    await onChanged()
  }

  async function handleAIGenerate(e: FormEvent) {
    e.preventDefault()
    if (aiGenerating) return
    setAiGenerating(true)
    setAiError(null)
    const topic = aiTopic.trim() || sessionTitle
    const res = await api<{ questions: Array<{ kind: string; prompt: string; options?: Array<{ label: string }> }>; confidence: number }>(
      `/api/sessions/${encodeURIComponent(sessionId)}/questions/generate`,
      {
        method: 'POST',
        body: { sessionTitle, sessionGoal: topic, focusArea: aiTopic.trim() || undefined },
      },
    )
    if (!res.ok) { setAiGenerating(false); setAiError(res.error.message); return }
    for (const q of res.data.questions) {
      const kind = (QUESTION_KINDS.includes(q.kind as Question['kind']) ? q.kind : 'poll') as Question['kind']
      await api<unknown>(
        `/api/sessions/${encodeURIComponent(sessionId)}/questions`,
        { method: 'POST', body: { kind, prompt: q.prompt, options: q.options ?? [] } },
      )
    }
    setAiGenerating(false)
    setAiTopic('')
    await onChanged()
  }

  return (
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
                {...inputHint(t('ai_topic_hint', { title: sessionTitle }))}
                maxLength={160}
                disabled={aiGenerating}
                className={LAUNCHPAD_AI_TOPIC_CLASS}
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
              onDragStart={() => onDragStart(index)}
              onDragOver={(e) => onDragOver(e, index)}
              onDrop={() => onDrop(index)}
              onDragEnd={onDragEnd}
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
                    <KindPicker id={`edit-kind-${q.id}`} value={editKind} onChange={setEditKind} />
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
            <KindPicker id="add-kind" value={addKind} onChange={setAddKind} />
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
  )
}
