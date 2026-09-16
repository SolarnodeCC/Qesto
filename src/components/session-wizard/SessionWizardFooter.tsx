import { Loader2, Play } from 'lucide-react'
import { useT } from '../../i18n'
import type { WizardStep } from '../sessionWizard.helpers'
import { Button } from '../../ui/components'

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
    <div className="flex items-center justify-between px-8 py-4 border-t border-pulse-200 dark:border-[var(--color-border)] bg-white dark:bg-[var(--color-surface)] flex-shrink-0 gap-3">
      {step > 1 && !jumpedFrom5 ? (
        <Button type="button" variant="secondary" onClick={onBack}>
          {t('nav.back')}
        </Button>
      ) : jumpedFrom5 ? (
        <Button type="button" variant="secondary" onClick={onBackToOverview}>
          ← Overview
        </Button>
      ) : (
        <div />
      )}

      <div>
        {step === 1 && (
          <Button
            type="button"
            onClick={onNextStep1}
            disabled={!step1Valid || creatingSession}
            className="btn-motion"
          >
            {creatingSession ? 'Creating…' : jumpedFrom5 ? '← Overview' : t('nav.next')}
          </Button>
        )}
        {step === 2 && (
          <Button
            type="button"
            onClick={onNextStep2}
            disabled={!step2Valid}
            className="btn-motion"
          >
            {jumpedFrom5 ? '← Overview' : t('nav.next')}
          </Button>
        )}
        {(step === 3 || step === 4) && (
          <Button type="button" onClick={onNextStep34} className="btn-motion">
            {jumpedFrom5 ? '← Overview' : t('nav.next')}
          </Button>
        )}
        {step === 5 && (
          <Button
            type="button"
            onClick={onLaunch}
            disabled={launching || activeQuestionsCount === 0}
            className="btn-motion shadow-teal"
          >
            {launching ? (
              <>
                <Loader2 aria-hidden="true" className="animate-spin w-4 h-4" />
                {t('step5.launching')}
              </>
            ) : (
              <>
                <Play size={16} aria-hidden="true" />
                {t('nav.launch')}
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  )
}
