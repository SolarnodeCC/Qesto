import { useT } from '../../i18n'
import { inputHint } from '../../ui/input-hint'

export interface Step1Props {
  title: string
  goal: string
  onTitleChange: (v: string) => void
  onGoalChange: (v: string) => void
  error: string | null
}

export function SessionWizardStep1({ title, goal, onTitleChange, onGoalChange, error }: Step1Props) {
  const t = useT('wizard')
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="wiz-title" className="text-sm font-medium dark:text-[var(--text-primary)]">
          {t('step1.label_title')}
        </label>
        <input
          id="wiz-title"
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          {...inputHint(t('step1.hint_title'))}
          maxLength={160}
          className="w-full rounded-lg border border-pulse-300 dark:border-[var(--color-border-strong)] bg-transparent dark:bg-[var(--color-surface-elevated)] px-3 py-2 text-sm focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200 dark:focus:ring-teal-900"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="wiz-goal" className="text-sm font-medium dark:text-[var(--text-primary)]">
          {t('step1.label_goal')}
        </label>
        <textarea
          id="wiz-goal"
          value={goal}
          onChange={(e) => onGoalChange(e.target.value)}
          {...inputHint(t('step1.hint_goal'))}
          rows={3}
          maxLength={400}
          className="w-full rounded-lg border border-pulse-300 dark:border-[var(--color-border-strong)] bg-transparent dark:bg-[var(--color-surface-elevated)] px-3 py-2 text-sm resize-none focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200 dark:focus:ring-teal-900"
        />
      </div>
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}
