import { useState, useCallback, type FormEvent } from 'react'
import { GripVertical, Loader2, Pencil, Plus, Sparkles, X } from 'lucide-react'
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

const KIND_BADGE: Record<string, string> = {
  poll:    'bg-teal-50  text-teal-800  dark:bg-teal-900/30  dark:text-teal-300',
  ranking: 'bg-violet-50 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
  open:    'bg-pulse-100 text-pulse-700 dark:bg-pulse-800/40 dark:text-pulse-300',
  consent: 'bg-amber-50  text-amber-800  dark:bg-amber-900/30  dark:text-amber-300',
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

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editPrompt, setEditPrompt] = useState('')
  const [editKind, setEditKind] = useState<Question['kind']>('poll')
  const [editOptions, setEditOptions] = useState<PollOption[]>([])
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const [addingQuestion, setAddingQuestion] = useState(false)
  const [addPrompt, setAddPrompt] = useState('')
  const [addKind, setAddKind] = useState<Question['kind']>('poll')
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  const [aiTopic, setAiTopic] = useState('')
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  const startEdit = useCallback((q: Question) => {
    setEditingId(q.id); setEditPrompt(q.prompt); setEditKind(q.kind); setEditOptions(q.options); setEditError(null)
  }, [])
  const cancelEdit = useCallback(() => { setEditingId(null); setEditError(null) }, [])

  const saveEdit = useCallback(async () => {
    if (!editingId) return
    setEditSaving(true); setEditError(null)
    const res = await api<unknown>(
      `/api/sessions/${encodeURIComponent(sessionId)}/questions/${encodeURIComponent(editingId)}`,
      { method: 'PATCH', body: { kind: editKind, prompt: editPrompt.trim(), options: editOptions } },
    )
    setEditSaving(false)
    if (!res.ok) { setEditError(t('edit_error')); return }
    setEditingId(null); await onChanged()
  }, [editingId, editKind, editPrompt, editOptions, sessionId, onChanged, t])

  async function handleAddQuestion() {
    if (!addPrompt.trim() || addSaving) return
    setAddSaving(true); setAddError(null)
    const res = await api<unknown>(
      `/api/sessions/${encodeURIComponent(sessionId)}/questions`,
      { method: 'POST', body: { kind: addKind, prompt: addPrompt.trim() } },
    )
    setAddSaving(false)
    if (!res.ok) { setAddError(t('edit_error')); return }
    setAddPrompt(''); setAddKind('poll'); setAddingQuestion(false); await onChanged()
  }

  async function handleAIGenerate(e: FormEvent) {
    e.preventDefault()
    if (aiGenerating) return
    setAiGenerating(true); setAiError(null)
    const topic = aiTopic.trim() || sessionTitle
    const res = await api<{ questions: Array<{ kind: string; prompt: string; options?: Array<{ label: string }> }>; confidence: number }>(
      `/api/sessions/${encodeURIComponent(sessionId)}/questions/generate`,
      { method: 'POST', body: { sessionTitle, sessionGoal: topic, focusArea: aiTopic.trim() || undefined } },
    )
    if (!res.ok) { setAiGenerating(false); setAiError(res.error.message); return }
    for (const q of res.data.questions) {
      const kind = (QUESTION_KINDS.includes(q.kind as Question['kind']) ? q.kind : 'poll') as Question['kind']
      await api<unknown>(
        `/api/sessions/${encodeURIComponent(sessionId)}/questions`,
        { method: 'POST', body: { kind, prompt: q.prompt, options: q.options ?? [] } },
      )
    }
    setAiGenerating(false); setAiTopic(''); await onChanged()
  }

  return (
    <section
      aria-label={t('questions_count', { count: orderedQuestions.length })}
      className="rounded-xl border border-[var(--color-border,#E5E5E5)] dark:border-[#1E2A45] bg-white dark:bg-[#151C2E] shadow-card overflow-hidden"
    >
      {/* Card header */}
      <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-[var(--color-border,#E5E5E5)] dark:border-[#1E2A45]">
        <span className="text-sm font-semibold text-[var(--text-primary,#0A0F1E)] dark:text-[#F0F2F8]">
          {t('questions_count', { count: orderedQuestions.length })}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { setAddingQuestion(true); setAiTopic('') }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border,#E5E5E5)] dark:border-[#2A3858] px-2.5 py-1.5 text-xs font-semibold text-violet-700 dark:text-violet-400 hover:border-violet-300 hover:bg-violet-50 dark:hover:bg-violet-900/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 transition-colors"
          >
            <Sparkles size={13} aria-hidden="true" />{t('ai_generate_button')}
          </button>
          <button
            type="button"
            onClick={() => setAddingQuestion(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border,#E5E5E5)] dark:border-[#2A3858] bg-[var(--color-bg-subtle,#FAFAFA)] dark:bg-[#1C2540] px-2.5 py-1.5 text-xs font-semibold text-[var(--text-secondary,#525252)] dark:text-[#A8B3CC] hover:border-teal-400 hover:text-teal-700 dark:hover:border-teal-500 dark:hover:text-teal-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 transition-colors"
          >
            <Plus size={13} aria-hidden="true" />{t('add_question_inline')}
          </button>
        </div>
      </div>

      {reorderError && (
        <p role="alert" className="px-5 py-2 text-sm text-red-600 dark:text-red-400 border-b border-red-100 dark:border-red-900/40 bg-red-50 dark:bg-red-900/20">
          {reorderError}
        </p>
      )}

      {/* Empty state + AI panel (no questions yet) */}
      {orderedQuestions.length === 0 && (
        <div className="px-5 py-4 space-y-4">
          <p className="text-sm text-[var(--text-muted,#737373)] dark:text-[#6B7A99]">{t('no_questions_hint')}</p>
          <div className="rounded-xl border border-violet-100 dark:border-violet-900/40 bg-violet-50/60 dark:bg-violet-900/10 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-violet-500 shrink-0" aria-hidden="true" />
              <p className="text-sm font-semibold text-violet-800 dark:text-violet-200">{t('ai_generate_heading')}</p>
            </div>
            <form onSubmit={(e) => void handleAIGenerate(e)} className="space-y-2">
              <input type="text" value={aiTopic} onChange={(e) => setAiTopic(e.target.value)}
                {...inputHint(t('ai_topic_hint', { title: sessionTitle }))} maxLength={160} disabled={aiGenerating}
                className={LAUNCHPAD_AI_TOPIC_CLASS} />
              {aiError && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{aiError}</p>}
              <button type="submit" disabled={aiGenerating}
                className="inline-flex items-center gap-2 rounded-lg bg-violet-600 text-white text-sm font-medium px-3 py-1.5 hover:bg-violet-700 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-1 transition-colors">
                {aiGenerating
                  ? <><Loader2 size={13} className="animate-spin" aria-hidden="true" />{t('ai_generating')}</>
                  : <><Sparkles size={13} aria-hidden="true" />{t('ai_generate_button')}</>}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Question rows */}
      {orderedQuestions.length > 0 && (
        <ul className="divide-y divide-[var(--color-border,#E5E5E5)] dark:divide-[#1E2A45]">
          {orderedQuestions.map((q, index) => (
            <li
              key={q.id}
              draggable
              onDragStart={() => onDragStart(index)}
              onDragOver={(e) => onDragOver(e, index)}
              onDrop={() => onDrop(index)}
              onDragEnd={onDragEnd}
              className={[
                'transition-colors',
                dragOverIndex === index && dragIndex !== index ? 'bg-teal-50 dark:bg-teal-500/10' : '',
                dragIndex === index ? 'opacity-50' : '',
              ].join(' ')}
            >
              {editingId === q.id ? (
                <div className="px-5 py-4 space-y-3">
                  <div className="space-y-1">
                    <label htmlFor={`edit-prompt-${q.id}`} className="text-xs font-medium text-[var(--text-muted,#737373)]">{t('edit_prompt_label')}</label>
                    <textarea id={`edit-prompt-${q.id}`} value={editPrompt} onChange={(e) => setEditPrompt(e.target.value)} rows={2}
                      className="w-full rounded-lg border border-pulse-300 dark:border-[#2A3858] dark:bg-[#1C2540] dark:text-[#F0F2F8] px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500" />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor={`edit-kind-${q.id}`} className="text-xs font-medium text-[var(--text-muted,#737373)]">{t('edit_kind_label')}</label>
                    <KindPicker id={`edit-kind-${q.id}`} value={editKind} onChange={setEditKind} />
                  </div>
                  {editError && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{editError}</p>}
                  <div className="flex gap-2">
                    <button type="button" onClick={() => void saveEdit()} disabled={editSaving || editPrompt.trim().length === 0}
                      className="px-3 py-1.5 rounded-lg bg-teal-600 text-white text-sm font-medium hover:brightness-110 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500">
                      {editSaving ? '…' : t('save_question')}
                    </button>
                    <button type="button" onClick={cancelEdit} disabled={editSaving}
                      className="px-3 py-1.5 rounded-lg border border-pulse-300 dark:border-[#2A3858] text-sm text-pulse-700 dark:text-[#A8B3CC] hover:bg-pulse-50 dark:hover:bg-[#1E2A45] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500">
                      {t('cancel_edit')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 px-[18px] py-[13px] cursor-grab active:cursor-grabbing">
                  <span title={t('drag_handle_label')} className="shrink-0">
                    <GripVertical size={16} className="text-pulse-300 dark:text-pulse-600" aria-hidden="true" />
                  </span>
                  <span className="font-mono text-xs text-[var(--text-muted,#737373)] dark:text-[#6B7A99] w-4 shrink-0">{index + 1}</span>
                  <span className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${KIND_BADGE[q.kind] ?? KIND_BADGE.poll}`}>
                    {q.kind}
                  </span>
                  <span className="flex-1 text-sm text-[var(--text-primary,#0A0F1E)] dark:text-[#F0F2F8] truncate">{q.prompt}</span>
                  <button type="button" onClick={() => startEdit(q)} aria-label={t('edit_question')}
                    className="shrink-0 text-pulse-400 hover:text-teal-600 dark:text-pulse-600 dark:hover:text-teal-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded transition-colors">
                    <Pencil size={15} aria-hidden="true" />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Inline add form */}
      {addingQuestion && (
        <div className="px-5 py-4 border-t border-teal-100 dark:border-teal-900/40 bg-teal-50/30 dark:bg-teal-500/5 space-y-3">
          <div className="space-y-1">
            <label htmlFor="add-prompt" className="text-xs font-medium text-[var(--text-muted,#737373)]">{t('edit_prompt_label')}</label>
            <textarea id="add-prompt" value={addPrompt} onChange={(e) => setAddPrompt(e.target.value)} rows={2} autoFocus
              className="w-full rounded-lg border border-pulse-300 dark:border-[#2A3858] dark:bg-[#1C2540] dark:text-[#F0F2F8] px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500" />
          </div>
          <div className="space-y-1">
            <label htmlFor="add-kind" className="text-xs font-medium text-[var(--text-muted,#737373)]">{t('edit_kind_label')}</label>
            <KindPicker id="add-kind" value={addKind} onChange={setAddKind} />
          </div>
          {addError && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{addError}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => void handleAddQuestion()} disabled={addSaving || addPrompt.trim().length === 0}
              className="px-3 py-1.5 rounded-lg bg-teal-600 text-white text-sm font-medium hover:brightness-110 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500">
              {addSaving ? '…' : t('save_question')}
            </button>
            <button type="button" onClick={() => { setAddingQuestion(false); setAddPrompt(''); setAddError(null) }} disabled={addSaving}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-pulse-300 dark:border-[#2A3858] text-sm text-pulse-700 dark:text-[#A8B3CC] hover:bg-pulse-50 dark:hover:bg-[#1E2A45] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500">
              <X size={13} aria-hidden="true" />{t('cancel_edit')}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
