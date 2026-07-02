import { useT } from '../../i18n'
import { ENERGIZER_FORMATS } from '../sessionWizard.helpers'

export interface Step3Props {
  energizerId: string | null
  onSelect: (id: string) => void
  onSkip: () => void
}

export function SessionWizardStep3({ energizerId, onSelect, onSkip }: Step3Props) {
  const t = useT('wizard')
  return (
    <div className="space-y-4">
      <p className="text-sm text-pulse-600 dark:text-pulse-300">{t('step3.title')}</p>
      <div className="grid grid-cols-1 gap-2">
        <button
          type="button"
          onClick={onSkip}
          className="text-left p-3 rounded-xl border border-pulse-200 dark:border-[var(--color-border)] bg-white dark:bg-[var(--color-surface)] hover:border-pulse-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 transition-colors text-sm text-pulse-600 dark:text-[var(--text-secondary)]"
        >
          {t('step3.no')} (skip energizer)
        </button>
      </div>
      <p className="text-sm font-medium dark:text-[var(--text-primary)]">{t('step3.pick_format')}</p>
      <div className="grid grid-cols-1 gap-2">
        {ENERGIZER_FORMATS.map((fmt) => (
          <button
            key={fmt.id}
            type="button"
            onClick={() => onSelect(fmt.id)}
            className={[
              'text-left p-3 rounded-xl border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500',
              energizerId === fmt.id
                ? 'border-teal-500 dark:border-teal-400 bg-teal-50 dark:bg-teal-500/10'
                : 'border-pulse-200 dark:border-[var(--color-border)] bg-white dark:bg-[var(--color-surface)] hover:border-teal-300',
            ].join(' ')}
          >
            <span className="font-medium text-sm dark:text-[var(--text-primary)]">{fmt.name}</span>
            <p className="text-caption text-pulse-500">{fmt.desc}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
