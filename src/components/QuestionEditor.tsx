import { X } from 'lucide-react'
import { useT } from '../i18n'
import AIBadge from './AIBadge'
import type { WizardQuestionKind } from '@/types/session'
import { NO_OPTIONS_KINDS, newId, isQuestionValid, kindLabel, type WizardQuestion } from './sessionWizard.helpers'
import { inputHint } from '../ui/input-hint'

// ─── Sub-component: Question editor ──────────────────────────────────────────
// Extracted from SessionWizard.tsx (R-05). Fully controlled — owns no state.

export function QuestionEditor({
  question,
  onChange,
  onDismiss,
}: {
  question: WizardQuestion
  onChange: (q: WizardQuestion) => void
  onDismiss?: () => void
}) {
  const t = useT('wizard')
  function setKind(kind: WizardQuestionKind) {
    const updated = { ...question, kind }
    if (NO_OPTIONS_KINDS.has(kind)) {
      updated.options = []
    } else if (NO_OPTIONS_KINDS.has(question.kind)) {
      updated.options = [
        { id: newId(), label: '' },
        { id: newId(), label: '' },
      ]
    }
    onChange(updated)
  }

  function setPrompt(prompt: string) {
    onChange({ ...question, prompt })
  }

  function setOptionLabel(idx: number, label: string) {
    const options = question.options.map((o, i) => (i === idx ? { ...o, label } : o))
    onChange({ ...question, options })
  }

  function addOption() {
    const max = question.kind === 'ranking' ? 8 : 5
    if (question.options.length >= max) return
    onChange({ ...question, options: [...question.options, { id: newId(), label: '' }] })
  }

  function removeOption(idx: number) {
    if (question.options.length <= 2) return
    const options = question.options.filter((_, i) => i !== idx)
    onChange({ ...question, options })
  }

  const maxOpts = question.kind === 'ranking' ? 8 : 5
  const valid = isQuestionValid(question)

  return (
    <div className="rounded-lg border border-pulse-200 dark:border-[var(--color-border)] bg-white dark:bg-[var(--color-surface)] p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {question.fromAI && <AIBadge variant="generated" />}
          <span className={`caption font-medium ${valid ? 'text-teal-600' : 'text-amber-500'}`}>
            {valid ? '✓ Valid' : '⚠ Incomplete'}
          </span>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Remove this question"
            className="text-pulse-500 hover:text-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded p-0.5"
          >
            <X aria-hidden="true" size={16} />
          </button>
        )}
      </div>

      {/* Kind selector */}
      <div className="flex gap-2 flex-wrap">
        {(['poll', 'multi_select', 'ranking', 'upvote', 'open', 'word_cloud', 'likert', 'slider'] as WizardQuestionKind[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={[
              'px-3 py-1 rounded-pill caption font-medium border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500',
              question.kind === k
                ? 'bg-teal-50 dark:bg-teal-500/10 border-teal-400 dark:border-teal-400 text-teal-700 dark:text-teal-300'
                : 'border-pulse-300 dark:border-[var(--color-border-strong)] text-pulse-600 dark:text-[var(--text-secondary)] hover:border-teal-300',
            ].join(' ')}
          >
            {kindLabel(k)}
          </button>
        ))}
      </div>

      {/* Prompt */}
      <textarea
        value={question.prompt}
        onChange={(e) => setPrompt(e.target.value)}
        {...inputHint("Type your question…")}
        rows={2}
        className="w-full rounded-lg border border-pulse-300 dark:border-[var(--color-border-strong)] bg-transparent dark:bg-[var(--color-surface-elevated)] px-3 py-2 text-sm resize-none focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200 dark:focus:ring-teal-900"
        aria-label="Question text"
      />

      {/* Options */}
      {!NO_OPTIONS_KINDS.has(question.kind) && (
        <div className="space-y-2">
          {question.options.map((opt, idx) => (
            <div key={opt.id} className="flex items-center gap-2">
              <span className="caption text-pulse-500 w-5 text-right select-none">{idx + 1}.</span>
              <input
                type="text"
                value={opt.label}
                onChange={(e) => setOptionLabel(idx, e.target.value)}
                {...inputHint(`Option ${idx + 1}`)}
                className="flex-1 rounded-md border border-pulse-300 dark:border-[var(--color-border-strong)] bg-transparent dark:bg-[var(--color-surface-elevated)] px-2 py-1.5 text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-300"
                aria-label={`Option ${idx + 1}`}
              />
              <button
                type="button"
                onClick={() => removeOption(idx)}
                disabled={question.options.length <= 2}
                aria-label={`Remove option ${idx + 1}`}
                className="text-pulse-500 hover:text-red-500 disabled:opacity-30 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded p-0.5"
              >
                <X aria-hidden="true" size={14} />
              </button>
            </div>
          ))}
          {question.options.length < maxOpts && (
            <button
              type="button"
              onClick={addOption}
              className="caption text-teal-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded"
            >
              + Add option
            </button>
          )}
          <p className="caption text-pulse-500">
            {question.kind === 'ranking' ? `${question.options.length}/8 items` : `${question.options.length}/5 options`}
            {question.options.length < 2 && ' — add at least 2'}
          </p>
        </div>
      )}
      {question.kind === 'likert' && (
        <p className="caption text-pulse-500 italic">{t('step2.auto_scale_hint')}</p>
      )}
      {question.kind === 'slider' && (
        <p className="caption text-pulse-500 italic">{t('step2.auto_slider_hint')}</p>
      )}
      {(question.kind === 'word_cloud' || question.kind === 'open') && (
        <p className="caption text-pulse-500 italic">{t('step2.free_text_hint')}</p>
      )}
    </div>
  )
}
