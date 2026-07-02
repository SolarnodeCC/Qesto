import { useT } from '../../i18n'

export interface Step4Props {
  anonymity: 'full' | 'partial' | 'none' | 'zero_knowledge'
  onAnonymityChange: (v: 'full' | 'partial' | 'none' | 'zero_knowledge') => void
  votePolicy: 'once' | 'multi' | 'react'
  onVotePolicyChange: (v: 'once' | 'multi' | 'react') => void
  sessionMode: 'reflection' | 'fun'
  onSessionModeChange: (v: 'reflection' | 'fun') => void
  isPublic: boolean
  onIsPublicChange: (v: boolean) => void
}

export function SessionWizardStep4({
  anonymity,
  onAnonymityChange,
  votePolicy,
  onVotePolicyChange,
  sessionMode,
  onSessionModeChange,
  isPublic,
  onIsPublicChange,
}: Step4Props) {
  const t = useT('wizard')
  return (
    <div className="space-y-5">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium dark:text-[var(--text-primary)]">{t('step4.anonymity.label')}</legend>
        <div className="flex gap-2 flex-wrap">
          {(['full', 'partial', 'none', 'zero_knowledge'] as const).map((val) => (
            <button
              key={val}
              type="button"
              onClick={() => onAnonymityChange(val)}
              className={[
                'px-3 py-1.5 rounded-lg border text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500',
                anonymity === val
                  ? 'border-teal-500 dark:border-teal-400 bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-300'
                  : 'border-pulse-300 dark:border-[var(--color-border-strong)] hover:border-teal-300',
              ].join(' ')}
            >
              {t(`step4.anonymity.${val}`)}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium dark:text-[var(--text-primary)]">{t('step4.votePolicy.label')}</legend>
        <div className="flex gap-2 flex-wrap">
          {(['once', 'multi', 'react'] as const).map((val) => (
            <button
              key={val}
              type="button"
              onClick={() => onVotePolicyChange(val)}
              className={[
                'px-3 py-1.5 rounded-lg border text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500',
                votePolicy === val
                  ? 'border-teal-500 dark:border-teal-400 bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-300'
                  : 'border-pulse-300 dark:border-[var(--color-border-strong)] hover:border-teal-300',
              ].join(' ')}
            >
              {t(`step4.votePolicy.${val}`)}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium dark:text-[var(--text-primary)]">{t('step4.mode.label')}</legend>
        <div className="flex gap-2 flex-wrap">
          {([
            { val: 'reflection' as const, label: t('step4.mode.reflection_title') },
            { val: 'fun' as const, label: t('step4.mode.fun_title') },
          ]).map(({ val, label }) => (
            <button
              key={val}
              type="button"
              onClick={() => onSessionModeChange(val)}
              className={[
                'px-3 py-1.5 rounded-lg border text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500',
                sessionMode === val
                  ? 'border-teal-500 dark:border-teal-400 bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-300'
                  : 'border-pulse-300 dark:border-[var(--color-border-strong)] hover:border-teal-300',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>
        {sessionMode === 'fun' && (
          <p className="text-caption text-pulse-500">{t('step4.mode.fun_desc')}</p>
        )}
      </fieldset>

      <div className="flex items-start gap-3 pt-2 border-t border-pulse-100 dark:border-white/10">
        <button
          type="button"
          role="switch"
          aria-checked={isPublic}
          onClick={() => onIsPublicChange(!isPublic)}
          className={[
            'relative shrink-0 mt-0.5 w-10 h-6 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500',
            isPublic ? 'bg-teal-500' : 'bg-pulse-300 dark:bg-white/20',
          ].join(' ')}
        >
          <span
            className={[
              'block w-4 h-4 rounded-full bg-white shadow transition-transform absolute top-1',
              isPublic ? 'translate-x-5' : 'translate-x-1',
            ].join(' ')}
          />
        </button>
        <div>
          <p className="text-sm font-medium dark:text-[var(--text-primary)]">{t('step4.isPublic.label')}</p>
          <p className="text-caption text-pulse-500">{t('step4.isPublic.description')}</p>
        </div>
      </div>
    </div>
  )
}
