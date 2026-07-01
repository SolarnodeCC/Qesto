import { useState } from 'react'
import { Check, Pencil, X } from 'lucide-react'
import { useT } from '../i18n'
import AIBadge from './AIBadge'
import { QuestionEditor } from './QuestionEditor'
import { kindLabel, type WizardQuestion } from './sessionWizard.helpers'

// ─── Sub-component: AI suggestion chip ───────────────────────────────────────
// Extracted from SessionWizard.tsx (R-05).

export function AIChip({
  question,
  onAccept,
  onChange,
  onDismiss,
}: {
  question: WizardQuestion
  onAccept: () => void
  onChange: (q: WizardQuestion) => void
  onDismiss: () => void
}) {
  const t = useT('wizard')
  const [expanded, setExpanded] = useState(false)

  if (expanded) {
    return (
      <div className="space-y-1">
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="caption text-teal-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded"
        >
          {t('step2.chip_collapse')}
        </button>
        <QuestionEditor question={question} onChange={onChange} onDismiss={onDismiss} />
      </div>
    )
  }

  return (
    <div
      className={[
        'flex items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors',
        question.accepted
          ? 'border-teal-300 bg-teal-50/60 dark:border-teal-700 dark:bg-teal-900/20'
          : 'border-violet-200 bg-violet-50/30 dark:border-violet-700 dark:bg-violet-900/10',
      ].join(' ')}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <AIBadge variant="generated" />
          <span className="caption text-pulse-500">{kindLabel(question.kind)}</span>
        </div>
        <p className="text-sm text-pulse-800 dark:text-pulse-200 line-clamp-2">{question.prompt || <em className="text-pulse-500">{t('step2.chip_empty')}</em>}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={onAccept}
          aria-label={t('step2.chip_accept')}
          title={t('step2.chip_accept')}
          className={[
            'p-1.5 rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500',
            question.accepted
              ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300'
              : 'text-pulse-500 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/20',
          ].join(' ')}
        >
          <Check aria-hidden="true" size={16} strokeWidth={2.5} />
        </button>
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-label={t('step2.chip_edit')}
          title={t('step2.chip_edit')}
          className="p-1.5 rounded-md text-pulse-500 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        >
          <Pencil aria-hidden="true" size={16} />
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t('step2.chip_dismiss')}
          title={t('step2.chip_dismiss')}
          className="p-1.5 rounded-md text-pulse-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        >
          <X aria-hidden="true" size={16} />
        </button>
      </div>
    </div>
  )
}
