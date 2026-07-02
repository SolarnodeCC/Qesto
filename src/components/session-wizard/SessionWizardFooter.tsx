import { useT } from '../../i18n'
import type { WizardStep } from '../sessionWizard.helpers'

export interface WizardFooterProps {
  step: WizardStep
  jumpedFrom5: boolean
  step1Valid: boolean
  step2Valid: boolean
  creatingSession: boolean
  launching: boolean
  activeQuestionsCount: number
  onBack: () => void
  onBackToOverview: () => void
  onNextStep1: () => void
  onNextStep2: () => void
  onNextStep34: () => void
  onLaunch: () => void
}

export function SessionWizardFooter({
  step,
  jumpedFrom5,
  step1Valid,
  step2Valid,
  creatingSession,
  launching,
  activeQuestionsCount,
  onBack,
  onBackToOverview,
  onNextStep1,
  onNextStep2,
  onNextStep34,
  onLaunch,
}: WizardFooterProps) {
  const t = useT('wizard')
  return (
    <div className="flex items-center justify-between px-6 py-4 border-t border-pulse-200 dark:border-[var(--color-border)] bg-white dark:bg-[var(--color-surface)] flex-shrink-0 gap-3">
      {step > 1 && !jumpedFrom5 ? (
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 rounded-lg border border-pulse-300 dark:border-[var(--color-border-strong)] dark:bg-transparent dark:text-[var(--text-secondary)] text-sm hover:bg-pulse-50 dark:hover:bg-[var(--color-border)] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        >
          {t('nav.back')}
        </button>
      ) : jumpedFrom5 ? (
        <button
          type="button"
          onClick={onBackToOverview}
          className="px-4 py-2 rounded-lg border border-pulse-300 dark:border-[var(--color-border-strong)] dark:bg-transparent dark:text-[var(--text-secondary)] text-sm hover:bg-pulse-50 dark:hover:bg-[var(--color-border)] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        >
          ← Overview
        </button>
      ) : (
        <div />
      )}

      <div>
        {step === 1 && (
          <button
            type="button"
            onClick={onNextStep1}
            disabled={!step1Valid || creatingSession}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 btn-motion"
          >
            {creatingSession ? 'Creating…' : jumpedFrom5 ? '← Overview' : t('nav.next')}
          </button>
        )}
        {step === 2 && (
          <button
            type="button"
            onClick={onNextStep2}
            disabled={!step2Valid}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 btn-motion"
          >
            {jumpedFrom5 ? '← Overview' : t('nav.next')}
          </button>
        )}
        {(step === 3 || step === 4) && (
          <button
            type="button"
            onClick={onNextStep34}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 btn-motion"
          >
            {jumpedFrom5 ? '← Overview' : t('nav.next')}
          </button>
        )}
        {step === 5 && (
          <button
            type="button"
            onClick={onLaunch}
            disabled={launching || activeQuestionsCount === 0}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-gradient-to-br from-teal-500 to-violet-600 text-white text-sm font-semibold hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 shadow-teal btn-motion"
          >
            {launching ? (
              <>
                <svg aria-hidden="true" className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {t('step5.launching')}
              </>
            ) : (
              <>
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8l7 4-7 4z" />
                </svg>
                {t('nav.launch')}
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
