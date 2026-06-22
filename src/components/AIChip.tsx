import { useState } from 'react'
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
          className="text-caption text-teal-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded"
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
          <span className="text-caption text-pulse-500">{kindLabel(question.kind)}</span>
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
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-label={t('step2.chip_edit')}
          title={t('step2.chip_edit')}
          className="p-1.5 rounded-md text-pulse-500 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        >
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t('step2.chip_dismiss')}
          title={t('step2.chip_dismiss')}
          className="p-1.5 rounded-md text-pulse-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        >
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
