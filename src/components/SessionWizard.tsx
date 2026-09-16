import { useEffect, useReducer, useRef } from 'react'
import { X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { getLanguageHeader, useT } from '../i18n'
import { api, getAuthToken } from '../api/client'
import { apiUrl } from '../config/api'
import type { PollOption } from '@/types/session'
import {
  newId,
  isQuestionValid,
  parseSseEvent,
  coerceQuestionKind,
  ENERGIZER_BACKEND_KIND,
  ENERGIZER_DEFAULT_PROMPT,
  type WizardStep,
  type WizardQuestion,
  type GeneratedQuestion,
  type GenerateQuestionsSsePayload,
  type QuestionSsePayload,
} from './sessionWizard.helpers'
import { wizardReducer, WIZARD_INITIAL } from './sessionWizard.reducer'
import { SessionWizardStep1 } from './session-wizard/SessionWizardStep1'
import { SessionWizardStep2 } from './session-wizard/SessionWizardStep2'
import { SessionWizardStep3 } from './session-wizard/SessionWizardStep3'
import { SessionWizardStep4 } from './session-wizard/SessionWizardStep4'
import { SessionWizardStep5 } from './session-wizard/SessionWizardStep5'
import { SessionWizardFooter } from './session-wizard/SessionWizardFooter'

export interface SessionWizardProps {
  open: boolean
  onClose: () => void
  onSessionCreated?: () => void
  initialTemplate?: {
    id: string
    name: string
    description: string
    questions: Array<{
      kind: string
      prompt: string
      options: PollOption[]
    }>
  } | null
}

export default function SessionWizard({ open, onClose, onSessionCreated, initialTemplate = null }: SessionWizardProps) {
  const navigate = useNavigate()
  const t = useT('wizard')
  const [state, dispatch] = useReducer(wizardReducer, WIZARD_INITIAL)

  const {
    step, jumpedFrom5, title, goal, step2Mode, aiPhase, aiConsented, aiPrompt,
    questions, templateSeedName, energizerId, anonymity, votePolicy, sessionMode,
    isPublic, sessionId, generatedAiGroundingHash, creatingSession, launching,
    error, launchError,
  } = state

  const headingRef = useRef<HTMLHeadingElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    dispatch({ type: 'RESET', template: initialTemplate })
  }, [open, initialTemplate])

  useEffect(() => {
    if (open) headingRef.current?.focus()
  }, [step, open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const step1Valid = title.trim().length > 0 && goal.trim().length > 0
  const activeQuestions = questions.filter((q) => !q.dismissed)
  const step2Valid = step2Mode !== 'idle' && activeQuestions.length > 0 && activeQuestions.every(isQuestionValid)

  async function handleNextFromStep1() {
    if (!step1Valid) return
    dispatch({ type: 'SET_ERROR', value: null })
    if (!sessionId) {
      dispatch({ type: 'SET_CREATING_SESSION', value: true })
      const activeTeamId = localStorage.getItem('activeTeamId') ?? undefined
      const res = await api<{ session: { id: string }; questions: unknown[] }>('/api/sessions', {
        method: 'POST',
        body: { title: title.trim(), ...(activeTeamId ? { teamId: activeTeamId } : {}) },
        idempotencyKey: crypto.randomUUID(),
      })
      dispatch({ type: 'SET_CREATING_SESSION', value: false })
      if (!res.ok) { dispatch({ type: 'SET_ERROR', value: res.error.message }); return }
      dispatch({ type: 'SET_SESSION_ID', value: res.data.session.id })
    } else {
      const patchRes = await api<unknown>(`/api/sessions/${encodeURIComponent(sessionId)}`, {
        method: 'PATCH',
        body: { title: title.trim() },
      })
      if (!patchRes.ok) { dispatch({ type: 'SET_ERROR', value: patchRes.error.message }); return }
    }
    dispatch({ type: 'ADVANCE_AFTER_JUMP_OR', next: 2 })
  }

  async function handleGenerate() {
    if (!sessionId) return
    dispatch({ type: 'SET_GENERATING', value: true })
    dispatch({ type: 'SET_AI_PHASE', value: 'generating' })
    dispatch({ type: 'SET_ERROR', value: null })
    dispatch({ type: 'SET_GROUNDING_HASH', value: null })
    try {
      const headers: Record<string, string> = {
        'content-type': 'application/json',
        'accept-language': getLanguageHeader(),
      }
      const token = getAuthToken()
      if (token) headers.authorization = `Bearer ${token}`

      const response = await fetch(apiUrl(`/api/sessions/${encodeURIComponent(sessionId)}/ai/generate`), {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({
          sessionTitle: title.trim(),
          sessionGoal: goal.trim(),
          focusArea: aiPrompt.trim() || undefined,
        }),
      })

      if (!response.ok || !response.body) throw new Error(t('step2.ai_error'))

      const toWizardQuestion = (q: GeneratedQuestion): WizardQuestion => ({
        id: q.id ?? newId(),
        kind: coerceQuestionKind(q.kind),
        prompt: q.prompt,
        options: (q.options ?? []).map((o) => ({ id: o.id ?? newId(), label: o.label })),
        fromAI: true,
        dismissed: false,
        accepted: false,
      })

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let payload: GenerateQuestionsSsePayload | null = null
      let streamedCount = 0

      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n')
        let boundary = buffer.indexOf('\n\n')
        while (boundary !== -1) {
          const chunk = buffer.slice(0, boundary)
          buffer = buffer.slice(boundary + 2)
          const parsed = parseSseEvent(chunk)
          if (parsed?.event === 'ready') {
            const readyData = parsed.data as { groundingHash?: unknown }
            if (typeof readyData.groundingHash === 'string') {
              dispatch({ type: 'SET_GROUNDING_HASH', value: readyData.groundingHash })
            }
          }
          if (parsed?.event === 'question') {
            const data = parsed.data as QuestionSsePayload
            if (data?.question) {
              if (streamedCount === 0) {
                dispatch({ type: 'SET_QUESTIONS', value: [] })
                dispatch({ type: 'SET_AI_PHASE', value: 'review' })
              }
              streamedCount++
              dispatch({
                type: 'SET_QUESTIONS',
                value: (prev) => [...prev, toWizardQuestion(data.question)],
              })
            }
          }
          if (parsed?.event === 'questions') payload = parsed.data as GenerateQuestionsSsePayload
          if (parsed?.event === 'error') throw new Error(t('step2.ai_error'))
          boundary = buffer.indexOf('\n\n')
        }
      }

      if (!payload) throw new Error(t('step2.ai_error'))
      dispatch({ type: 'SET_GROUNDING_HASH', value: payload.groundingHash })
      if (streamedCount === 0) {
        dispatch({ type: 'SET_QUESTIONS', value: payload.questions.map(toWizardQuestion) })
      }
      dispatch({ type: 'SET_AI_PHASE', value: 'review' })
    } catch {
      dispatch({ type: 'SET_ERROR', value: t('step2.ai_error') })
      dispatch({ type: 'SET_AI_PHASE', value: 'chat' })
    } finally {
      dispatch({ type: 'SET_GENERATING', value: false })
    }
  }

  function handleNextFromStep2() {
    if (!step2Valid) return
    dispatch({ type: 'ADVANCE_AFTER_JUMP_OR', next: 3 })
  }

  function handleStep3Select(id: string) {
    dispatch({ type: 'SET_ENERGIZER_ID', value: id })
    dispatch({ type: 'ADVANCE_AFTER_JUMP_OR', next: 4 })
  }

  function handleStep3Skip() {
    dispatch({ type: 'ADVANCE_AFTER_JUMP_OR', next: 4 })
  }

  async function handleLaunch() {
    if (!sessionId) return
    dispatch({ type: 'SET_LAUNCHING', value: true })
    dispatch({ type: 'SET_LAUNCH_ERROR', value: null })

    const usedAiQuestions = activeQuestions.some((q) => q.fromAI)
    const optionsBody: Record<string, unknown> = { anonymity, vote_policy: votePolicy, session_mode: sessionMode, is_public: isPublic ? 1 : 0 }
    if (usedAiQuestions) {
      optionsBody.ai_generated = true
      optionsBody.ai_consent_at = Date.now()
      if (generatedAiGroundingHash) optionsBody.ai_grounding_hash = generatedAiGroundingHash
      optionsBody.ai_accepted_count = questions.filter((q) => q.fromAI && q.accepted).length
      optionsBody.ai_dismissed_count = questions.filter((q) => q.fromAI && q.dismissed).length
    }
    const acceptedAiCount = usedAiQuestions ? questions.filter((q) => q.fromAI && q.accepted).length : 0
    const dismissedAiCount = usedAiQuestions ? questions.filter((q) => q.fromAI && q.dismissed).length : 0

    const optionsRes = await api<unknown>(`/api/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'PATCH',
      body: optionsBody,
    })
    if (!optionsRes.ok) {
      dispatch({ type: 'SET_LAUNCH_ERROR', value: (optionsRes as { ok: false; error: { message: string } }).error.message })
      dispatch({ type: 'SET_LAUNCHING', value: false })
      return
    }

    if (activeQuestions.length > 0) {
      const questionsBody = activeQuestions.map((q) => {
        const filledOptions = q.options.filter((o) => o.label.trim())
        const body: Record<string, unknown> = { kind: q.kind, prompt: q.prompt }
        if (filledOptions.length >= 2) body.options = filledOptions
        return body
      })
      const res = await api<unknown>(`/api/sessions/${encodeURIComponent(sessionId)}/questions/batch`, {
        method: 'POST',
        body: { questions: questionsBody },
      })
      if (!res.ok) {
        dispatch({ type: 'SET_LAUNCH_ERROR', value: (res as { ok: false; error: { message: string } }).error.message })
        dispatch({ type: 'SET_LAUNCHING', value: false })
        return
      }
    }

    if (energizerId) {
      const backendKind = ENERGIZER_BACKEND_KIND[energizerId]
      if (backendKind) {
        const res = await api<unknown>(`/api/sessions/${encodeURIComponent(sessionId)}/energizers`, {
          method: 'POST',
          body: { kind: backendKind, prompt: ENERGIZER_DEFAULT_PROMPT[energizerId] ?? energizerId },
        })
        if (!res.ok) {
          dispatch({ type: 'SET_LAUNCH_ERROR', value: (res as { ok: false; error: { message: string } }).error.message })
          dispatch({ type: 'SET_LAUNCHING', value: false })
          return
        }
      }
    }

    await api<unknown>('/api/sessions/journey-events', {
      method: 'POST',
      body: { event: 'wizard.completed', sessionId },
    })
    if (usedAiQuestions) {
      await api<unknown>('/api/sessions/journey-events', {
        method: 'POST',
        body: { event: 'ai.suggestions_resolved', sessionId, count: acceptedAiCount, value: dismissedAiCount },
      })
    }

    dispatch({ type: 'SET_LAUNCHING', value: false })
    onSessionCreated?.()
    navigate(`/sessions/${sessionId}/launchpad`)
    onClose()
  }

  function jumpToStep(target: WizardStep) {
    dispatch({ type: 'JUMP_TO_STEP', step: target })
  }

  const STEP_LABELS: Record<WizardStep, string> = {
    1: t('steps.1'),
    2: t('steps.2'),
    3: t('steps.3'),
    4: t('steps.4'),
    5: t('steps.5'),
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-backdrop-enter"
      role="dialog"
      aria-modal="true"
      aria-label={t('a11y.modal_label')}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        ref={dialogRef}
        className="bg-white dark:bg-[var(--color-surface-elevated)] rounded-2xl shadow-elevated w-full max-w-lg max-h-[90vh] flex flex-col animate-modal-enter"
      >
        <div className="flex items-center justify-between px-8 pt-6 pb-4 border-b border-pulse-200 dark:border-[var(--color-border)] flex-shrink-0">
          <div className="space-y-1">
            <h2 ref={headingRef} tabIndex={-1} className="text-xl font-semibold focus:outline-none dark:text-[var(--text-primary)]">
              {STEP_LABELS[step]}
            </h2>
            <p className="text-caption text-pulse-500 dark:text-[var(--text-muted)]" aria-live="polite">
              {t('a11y.progress_label', { current: step, total: 5 })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('a11y.close_label')}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-pulse-500 dark:text-[var(--text-muted)] hover:text-pulse-800 hover:bg-pulse-100 dark:hover:text-[var(--text-primary)] dark:hover:bg-[var(--color-border)] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="px-8 pt-3 pb-0 flex-shrink-0">
          <div className="flex gap-1" role="list" aria-label="Progress steps">
            {([1, 2, 3, 4, 5] as WizardStep[]).map((s) => (
              <div
                key={s}
                role="listitem"
                className={[
                  'h-1.5 flex-1 rounded-pill transition-colors',
                  s < step ? 'bg-teal-500' : s === step ? 'bg-teal-400' : 'bg-pulse-200 dark:bg-[var(--color-border)]',
                ].join(' ')}
                aria-label={`Step ${s}${s === step ? ' (current)' : s < step ? ' (complete)' : ''}`}
              />
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-4">
          {step === 1 && (
            <SessionWizardStep1
              title={title}
              goal={goal}
              onTitleChange={(v) => dispatch({ type: 'SET_TITLE', value: v })}
              onGoalChange={(v) => dispatch({ type: 'SET_GOAL', value: v })}
              error={error}
            />
          )}
          {step === 2 && (
            <SessionWizardStep2
              step2Mode={step2Mode}
              onModeChange={(v) => dispatch({ type: 'SET_STEP2_MODE', value: v })}
              aiPhase={aiPhase}
              onAiPhaseChange={(v) => dispatch({ type: 'SET_AI_PHASE', value: v })}
              aiConsented={aiConsented}
              onAiConsentChange={(v) => dispatch({ type: 'SET_AI_CONSENTED', value: v })}
              aiPrompt={aiPrompt}
              onAiPromptChange={(v) => dispatch({ type: 'SET_AI_PROMPT', value: v })}
              questions={questions}
              onQuestionsChange={(v) => dispatch({ type: 'SET_QUESTIONS', value: v })}
              activeQuestions={activeQuestions}
              templateSeedName={templateSeedName}
              onTemplateSeedNameChange={(v) => dispatch({ type: 'SET_TEMPLATE_SEED_NAME', value: v })}
              onGenerate={handleGenerate}
              error={error}
              title={title}
              goal={goal}
            />
          )}
          {step === 3 && (
            <SessionWizardStep3
              energizerId={energizerId}
              onSelect={handleStep3Select}
              onSkip={handleStep3Skip}
            />
          )}
          {step === 4 && (
            <SessionWizardStep4
              anonymity={anonymity}
              onAnonymityChange={(v) => dispatch({ type: 'SET_ANONYMITY', value: v })}
              votePolicy={votePolicy}
              onVotePolicyChange={(v) => dispatch({ type: 'SET_VOTE_POLICY', value: v })}
              sessionMode={sessionMode}
              onSessionModeChange={(v) => dispatch({ type: 'SET_SESSION_MODE', value: v })}
              isPublic={isPublic}
              onIsPublicChange={(v) => dispatch({ type: 'SET_IS_PUBLIC', value: v })}
            />
          )}
          {step === 5 && (
            <SessionWizardStep5
              title={title}
              goal={goal}
              templateSeedName={templateSeedName}
              activeQuestions={activeQuestions}
              energizerId={energizerId}
              anonymity={anonymity}
              votePolicy={votePolicy}
              sessionMode={sessionMode}
              launchError={launchError}
              onJumpToStep={jumpToStep}
            />
          )}
        </div>

        <SessionWizardFooter
          step={step}
          jumpedFrom5={jumpedFrom5}
          step1Valid={step1Valid}
          step2Valid={step2Valid}
          creatingSession={creatingSession}
          launching={launching}
          activeQuestionsCount={activeQuestions.length}
          onBack={() => dispatch({ type: 'BACK_STEP' })}
          onBackToOverview={() => dispatch({ type: 'BACK_TO_OVERVIEW' })}
          onNextStep1={handleNextFromStep1}
          onNextStep2={handleNextFromStep2}
          onNextStep34={() => {
            const next = (step + 1) as WizardStep
            dispatch({ type: 'ADVANCE_AFTER_JUMP_OR', next })
          }}
          onLaunch={handleLaunch}
        />
      </div>
    </div>
  )
}
