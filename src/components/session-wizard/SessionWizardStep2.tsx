import { useT } from '../../i18n'
import { inputHint } from '../../ui/input-hint'
import { WizardAIGenerationSkeleton } from '../SkeletonLoader'
import { QuestionEditor } from '../QuestionEditor'
import { AIChip } from '../AIChip'
import {
  emptyQuestion,
  type Step2Mode,
  type AIPhase,
  type WizardQuestion,
} from '../sessionWizard.helpers'

export interface Step2Props {
  step2Mode: Step2Mode
  onModeChange: (mode: Step2Mode) => void
  aiPhase: AIPhase
  onAiPhaseChange: (phase: AIPhase) => void
  aiConsented: boolean
  onAiConsentChange: (v: boolean) => void
  aiPrompt: string
  onAiPromptChange: (v: string) => void
  questions: WizardQuestion[]
  onQuestionsChange: (qs: WizardQuestion[]) => void
  activeQuestions: WizardQuestion[]
  templateSeedName: string | null
  onTemplateSeedNameChange: (name: string | null) => void
  onGenerate: () => void
  error: string | null
  title: string
  goal: string
}

export function SessionWizardStep2({
  step2Mode,
  onModeChange,
  aiPhase,
  onAiPhaseChange,
  aiConsented,
  onAiConsentChange,
  aiPrompt,
  onAiPromptChange,
  questions,
  onQuestionsChange,
  activeQuestions,
  templateSeedName,
  onTemplateSeedNameChange,
  onGenerate,
  error,
  title,
  goal,
}: Step2Props) {
  const t = useT('wizard')

  function dismissQuestion(id: string) {
    onQuestionsChange(questions.map((q) => (q.id === id ? { ...q, dismissed: true } : q)))
  }

  function acceptQuestion(id: string) {
    onQuestionsChange(questions.map((q) => (q.id === id ? { ...q, accepted: !q.accepted } : q)))
  }

  function updateQuestion(updated: WizardQuestion) {
    onQuestionsChange(questions.map((q) => (q.id === updated.id ? updated : q)))
  }

  function addManualQuestion() {
    onQuestionsChange([...questions, emptyQuestion()])
  }

  function handleBackToIdle() {
    onModeChange('idle')
    onQuestionsChange([])
    onTemplateSeedNameChange(null)
  }

  const visibleCount = questions.filter((x) => !x.dismissed).length

  return (
    <div className="space-y-4">
      {/* Mode selector */}
      {step2Mode === 'idle' && (
        <div className="space-y-3">
          <p className="text-sm font-medium dark:text-[var(--text-primary)]">{t('step2.mode_title')}</p>
          <div className="grid grid-cols-1 gap-2">
            {([
              { id: 'ai', label: t('step2.ai.label'), desc: t('step2.ai.desc'), icon: '✨' },
              { id: 'manual', label: t('step2.manual.label'), desc: t('step2.manual.desc'), icon: '✏️' },
              { id: 'template', label: t('step2.template.label'), desc: t('step2.template.desc'), icon: '📋' },
            ] as const).map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => {
                  onModeChange(mode.id)
                  if (mode.id === 'manual') { onQuestionsChange([emptyQuestion()]); onTemplateSeedNameChange(null) }
                  if (mode.id === 'ai') onAiPhaseChange('consent')
                }}
                className="text-left p-3 rounded-xl border border-pulse-200 dark:border-[var(--color-border)] bg-white dark:bg-[var(--color-surface)] hover:border-teal-400 hover:bg-teal-50/50 dark:hover:bg-teal-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 transition-colors"
              >
                <span className="font-medium text-sm dark:text-[var(--text-primary)]">{mode.icon} {mode.label}</span>
                <p className="text-caption text-pulse-500 mt-0.5">{mode.desc}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* AI sub-flow */}
      {step2Mode === 'ai' && (
        <div className="space-y-4">
          <button
            type="button"
            onClick={handleBackToIdle}
            className="text-caption text-teal-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded"
          >
            {t('step2.back')}
          </button>

          {aiPhase === 'consent' && (
            <div className="rounded-xl border border-violet-200 dark:border-violet-800/60 bg-violet-50/50 dark:bg-violet-900/20 p-4 space-y-3">
              <div className="flex items-start gap-2">
                <span className="text-xl">✨</span>
                <div>
                  <p className="font-medium text-sm dark:text-[var(--text-primary)]">{t('step2.ai_consent_v2.title')}</p>
                  <p className="text-caption text-pulse-500 mt-0.5">{t('step2.ai_consent_v2.description')}</p>
                </div>
              </div>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={aiConsented}
                  onChange={(e) => onAiConsentChange(e.target.checked)}
                  className="mt-0.5 rounded border-pulse-300 text-teal-600 focus:ring-teal-500"
                />
                <span className="text-sm dark:text-[var(--text-secondary)]">{t('step2.ai_consent_v2.checkbox')}</span>
              </label>
              <button
                type="button"
                disabled={!aiConsented}
                onClick={() => onAiPhaseChange('chat')}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-br from-violet-500 to-teal-500 text-white px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 btn-motion"
              >
                {t('step2.ai_generate_cta')}
              </button>
            </div>
          )}

          {aiPhase === 'chat' && (
            <div className="space-y-3">
              <p className="text-sm text-pulse-600 dark:text-pulse-300 bg-pulse-50 dark:bg-pulse-800 rounded-lg p-3 italic">
                {title.trim()
                  ? t('step2.ai_greeting', { title: title.trim(), goal: goal.trim() })
                  : t('step2.ai_greeting_empty')}
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={aiPrompt}
                  onChange={(e) => onAiPromptChange(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') onGenerate() }}
                  {...inputHint(t('step2.ai_hint'))}
                  className="flex-1 rounded-lg border border-pulse-300 dark:border-[var(--color-border-strong)] bg-transparent dark:bg-[var(--color-surface-elevated)] px-3 py-2 text-sm focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                />
                <button
                  type="button"
                  onClick={onGenerate}
                  className="px-3 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 btn-motion"
                >
                  {t('step2.ai_send')}
                </button>
              </div>
              <button
                type="button"
                onClick={onGenerate}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-violet-300 text-violet-600 dark:text-violet-400 px-4 py-2.5 text-sm font-medium hover:bg-violet-50 dark:hover:bg-violet-900/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 btn-motion"
              >
                {t('step2.ai_generate_cta')}
              </button>
              {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            </div>
          )}

          {aiPhase === 'generating' && (
            <div>
              <p className="text-caption text-pulse-500 mb-3">{t('step2.ai_generating')}</p>
              <WizardAIGenerationSkeleton questionCount={3} />
            </div>
          )}

          {aiPhase === 'review' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium dark:text-[var(--text-primary)]">{t('step2.ai_review_title')}</p>
                <button
                  type="button"
                  onClick={() => {
                    if (activeQuestions.length === 0 || window.confirm(t('step2.ai_regenerate_confirm'))) {
                      onAiPhaseChange('chat')
                    }
                  }}
                  className="text-caption text-teal-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded"
                >
                  {t('step2.ai_review_back')}
                </button>
              </div>
              <p className="text-caption text-violet-600 dark:text-violet-400">{t('step2.ai_generated_badge')}</p>
              <div className="space-y-2">
                {questions.map((q) =>
                  q.dismissed ? null : (
                    <AIChip
                      key={q.id}
                      question={q}
                      onAccept={() => acceptQuestion(q.id)}
                      onChange={updateQuestion}
                      onDismiss={() => dismissQuestion(q.id)}
                    />
                  ),
                )}
              </div>
              {activeQuestions.length === 0 && (
                <p className="text-caption text-amber-600">{t('step2.all_dismissed')}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Manual mode */}
      {step2Mode === 'manual' && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleBackToIdle}
            className="text-caption text-teal-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded"
          >
            {t('step2.back')}
          </button>
          <div className="space-y-2">
            {questions.map((q) =>
              q.dismissed ? null : (
                <QuestionEditor
                  key={q.id}
                  question={q}
                  onChange={updateQuestion}
                  {...(visibleCount > 1 ? { onDismiss: () => dismissQuestion(q.id) } : {})}
                />
              ),
            )}
          </div>
          <button
            type="button"
            onClick={addManualQuestion}
            className="text-caption text-teal-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded"
          >
            + {t('step2.manual_add')}
          </button>
        </div>
      )}

      {/* Template mode */}
      {step2Mode === 'template' && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleBackToIdle}
            className="text-caption text-teal-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded"
          >
            {t('step2.back')}
          </button>
          {templateSeedName ? (
            <div className="rounded-xl border border-teal-200 bg-teal-50/60 dark:border-teal-800 dark:bg-teal-900/20 p-3">
              <p className="text-sm font-medium text-teal-800 dark:text-teal-200">
                {t('step2.template_seeded', { name: templateSeedName })}
              </p>
              <p className="text-caption text-teal-700 dark:text-teal-300 mt-0.5">{t('step2.template_seeded_hint')}</p>
            </div>
          ) : (
            <p className="text-sm text-pulse-500">{t('step2.template_pick_from_dashboard')}</p>
          )}
          <div className="space-y-2">
            {questions.map((q) =>
              q.dismissed ? null : (
                <QuestionEditor
                  key={q.id}
                  question={q}
                  onChange={updateQuestion}
                  {...(visibleCount > 1 ? { onDismiss: () => dismissQuestion(q.id) } : {})}
                />
              ),
            )}
          </div>
          <button
            type="button"
            onClick={addManualQuestion}
            className="text-caption text-teal-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded"
          >
            + {t('step2.manual_add')}
          </button>
        </div>
      )}
    </div>
  )
}
