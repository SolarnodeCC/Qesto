import { useT } from '../../i18n'
import { kindLabel, ENERGIZER_FORMATS, type WizardStep, type WizardQuestion } from '../sessionWizard.helpers'

export interface Step5Props {
  title: string
  goal: string
  templateSeedName: string | null
  activeQuestions: WizardQuestion[]
  energizerId: string | null
  anonymity: 'full' | 'partial' | 'none' | 'zero_knowledge'
  votePolicy: 'once' | 'multi' | 'react'
  sessionMode: 'reflection' | 'fun'
  launchError: string | null
  onJumpToStep: (step: WizardStep) => void
}

export function SessionWizardStep5({
  title,
  goal,
  templateSeedName,
  activeQuestions,
  energizerId,
  anonymity,
  votePolicy,
  sessionMode,
  launchError,
  onJumpToStep,
}: Step5Props) {
  const t = useT('wizard')
  return (
    <div className="space-y-4">
      <p className="text-caption text-pulse-500">{t('step5.consent_text')}</p>

      <section className="rounded-xl border border-pulse-200 dark:border-[#1E2A45] bg-white dark:bg-[#151C2E] p-3 space-y-1">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold dark:text-[#F0F2F8]">{t('step5.section_basis')}</h3>
          <button
            type="button"
            onClick={() => onJumpToStep(1)}
            aria-label="Edit basics"
            className="text-caption text-teal-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded"
          >
            {t('step5.edit')} ✏️
          </button>
        </div>
        <p className="text-sm dark:text-pulse-200">{title}</p>
        <p className="text-caption text-pulse-500">{goal}</p>
        {templateSeedName && (
          <p className="text-caption font-medium text-teal-700 dark:text-teal-300">
            {t('step5.template_selected')}: {templateSeedName}
          </p>
        )}
      </section>

      <section className="rounded-xl border border-pulse-200 dark:border-[#1E2A45] bg-white dark:bg-[#151C2E] p-3 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold dark:text-[#F0F2F8]">{t('step5.section_questions')}</h3>
          <button
            type="button"
            onClick={() => onJumpToStep(2)}
            aria-label="Edit questions"
            className="text-caption text-teal-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded"
          >
            {t('step5.edit')} ✏️
          </button>
        </div>
        {activeQuestions.length === 0 ? (
          <p className="text-caption text-amber-600">{t('step5.no_questions')}</p>
        ) : (
          <ul className="space-y-1.5">
            {activeQuestions.map((q) => (
              <li key={q.id} className="text-sm flex items-start gap-2">
                <span className="text-teal-600 mt-0.5">•</span>
                <span className="dark:text-[#A8B3CC]">{q.prompt || <em className="text-pulse-400">No prompt</em>}</span>
                <span className="ml-auto text-caption text-pulse-400 whitespace-nowrap">{kindLabel(q.kind)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-pulse-200 dark:border-[#1E2A45] bg-white dark:bg-[#151C2E] p-3 space-y-1">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold dark:text-[#F0F2F8]">{t('step5.section_energizer')}</h3>
          <button
            type="button"
            onClick={() => onJumpToStep(3)}
            aria-label="Edit energizer"
            className="text-caption text-teal-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded"
          >
            {t('step5.edit')} ✏️
          </button>
        </div>
        {energizerId ? (
          <p className="text-sm dark:text-[#A8B3CC]">{ENERGIZER_FORMATS.find((f) => f.id === energizerId)?.name ?? energizerId}</p>
        ) : (
          <p className="text-caption text-pulse-500">{t('step5.no_energizer')}</p>
        )}
      </section>

      <section className="rounded-xl border border-pulse-200 dark:border-[#1E2A45] bg-white dark:bg-[#151C2E] p-3 space-y-1">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold dark:text-[#F0F2F8]">{t('step5.section_settings')}</h3>
          <button
            type="button"
            onClick={() => onJumpToStep(4)}
            aria-label="Edit settings"
            className="text-caption text-teal-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded"
          >
            {t('step5.edit')} ✏️
          </button>
        </div>
        <p className="text-caption text-pulse-500">
          {t(`step4.anonymity.${anonymity}`)} · {t(`step4.votePolicy.${votePolicy}`)} · {sessionMode === 'fun' ? t('step4.mode.fun_title') : t('step4.mode.reflection_title')}
        </p>
      </section>

      {launchError && <p role="alert" className="text-sm text-red-600">{launchError}</p>}
    </div>
  )
}
