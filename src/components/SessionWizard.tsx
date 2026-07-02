import { useState, useEffect, useRef } from 'react'
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
  normalizeQuestionKind,
  ENERGIZER_BACKEND_KIND,
  ENERGIZER_DEFAULT_PROMPT,
  type WizardStep,
  type Step2Mode,
  type AIPhase,
  type WizardQuestion,
  type GeneratedQuestion,
  type GenerateQuestionsSsePayload,
  type QuestionSsePayload,
} from './sessionWizard.helpers'
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

  const [step, setStep] = useState<WizardStep>(1)
  const [jumpedFrom5, setJumpedFrom5] = useState(false)

  // Step 1
  const [title, setTitle] = useState('')
  const [goal, setGoal] = useState('')

  // Step 2
  const [step2Mode, setStep2Mode] = useState<Step2Mode>('idle')
  const [aiPhase, setAiPhase] = useState<AIPhase>('consent')
  const [aiConsented, setAiConsented] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [questions, setQuestions] = useState<WizardQuestion[]>([])
  const [templateSeedName, setTemplateSeedName] = useState<string | null>(null)

  // Step 3
  const [energizerId, setEnergizerId] = useState<string | null>(null)

  // Step 4
  const [anonymity, setAnonymity] = useState<'full' | 'partial' | 'none' | 'zero_knowledge'>('partial')
  const [votePolicy, setVotePolicy] = useState<'once' | 'multi' | 'react'>('once')
  const [sessionMode, setSessionMode] = useState<'reflection' | 'fun'>('reflection')
  const [isPublic, setIsPublic] = useState(true)

  // Async
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [generatedAiGroundingHash, setGeneratedAiGroundingHash] = useState<string | null>(null)
  const [creatingSession, setCreatingSession] = useState(false)
  const [_generating, setGenerating] = useState(false)
  const [launching, setLaunching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [launchError, setLaunchError] = useState<string | null>(null)

  const headingRef = useRef<HTMLHeadingElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    setStep(1)
    setJumpedFrom5(false)
    setTitle('')
    setGoal('')
    setStep2Mode('idle')
    setAiPhase('consent')
    setAiConsented(false)
    setAiPrompt('')
    if (initialTemplate) {
      setTitle(initialTemplate.name)
      setGoal(initialTemplate.description)
      setStep2Mode('template')
      setTemplateSeedName(initialTemplate.name)
      setQuestions(initialTemplate.questions.map((q) => ({
        id: newId(),
        kind: normalizeQuestionKind(q.kind),
        prompt: q.prompt,
        options: q.options.map((o) => ({ id: o.id || newId(), label: o.label })),
        fromAI: false,
        dismissed: false,
        accepted: true,
      })))
    } else {
      setQuestions([])
      setTemplateSeedName(null)
    }
    setEnergizerId(null)
    setAnonymity('partial')
    setVotePolicy('once')
    setSessionMode('reflection')
    setIsPublic(true)
    setSessionId(null)
    setGeneratedAiGroundingHash(null)
    setCreatingSession(false)
    setGenerating(false)
    setLaunching(false)
    setError(null)
    setLaunchError(null)
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
    setError(null)
    if (!sessionId) {
      setCreatingSession(true)
      const activeTeamId = localStorage.getItem('activeTeamId') ?? undefined
      const res = await api<{ session: { id: string }; questions: unknown[] }>('/api/sessions', {
        method: 'POST',
        body: { title: title.trim(), ...(activeTeamId ? { teamId: activeTeamId } : {}) },
        idempotencyKey: crypto.randomUUID(),
      })
      setCreatingSession(false)
      if (!res.ok) { setError(res.error.message); return }
      setSessionId(res.data.session.id)
    } else {
      const patchRes = await api<unknown>(`/api/sessions/${encodeURIComponent(sessionId)}`, {
        method: 'PATCH',
        body: { title: title.trim() },
      })
      if (!patchRes.ok) { setError(patchRes.error.message); return }
    }
    if (jumpedFrom5) { setStep(5); setJumpedFrom5(false) } else { setStep(2) }
  }

  async function handleGenerate() {
    if (!sessionId) return
    setGenerating(true)
    setAiPhase('generating')
    setError(null)
    setGeneratedAiGroundingHash(null)
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
        kind: normalizeQuestionKind(q.kind),
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
            if (typeof readyData.groundingHash === 'string') setGeneratedAiGroundingHash(readyData.groundingHash)
          }
          if (parsed?.event === 'question') {
            const data = parsed.data as QuestionSsePayload
            if (data?.question) {
              // Reveal the review list on the first card, then fill in card-by-card.
              if (streamedCount === 0) { setQuestions([]); setAiPhase('review') }
              streamedCount++
              setQuestions((prev) => [...prev, toWizardQuestion(data.question)])
            }
          }
          if (parsed?.event === 'questions') payload = parsed.data as GenerateQuestionsSsePayload
          if (parsed?.event === 'error') throw new Error(t('step2.ai_error'))
          boundary = buffer.indexOf('\n\n')
        }
      }

      if (!payload) throw new Error(t('step2.ai_error'))
      setGeneratedAiGroundingHash(payload.groundingHash)
      // When questions streamed in incrementally, the list is already populated;
      // the final payload only confirms the grounding hash. If nothing streamed
      // (fallback path), apply the authoritative full list now.
      if (streamedCount === 0) {
        setQuestions(payload.questions.map(toWizardQuestion))
      }
      setAiPhase('review')
    } catch {
      setError(t('step2.ai_error'))
      setAiPhase('chat')
    } finally {
      setGenerating(false)
    }
  }

  function handleNextFromStep2() {
    if (!step2Valid) return
    if (jumpedFrom5) { setStep(5); setJumpedFrom5(false) } else { setStep(3) }
  }

  function handleStep3Select(id: string) {
    setEnergizerId(id)
    if (jumpedFrom5) { setStep(5); setJumpedFrom5(false) } else { setStep(4) }
  }

  function handleStep3Skip() {
    if (jumpedFrom5) { setStep(5); setJumpedFrom5(false) } else { setStep(4) }
  }

  async function handleLaunch() {
    if (!sessionId) return
    setLaunching(true)
    setLaunchError(null)

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
      setLaunchError((optionsRes as { ok: false; error: { message: string } }).error.message)
      setLaunching(false)
      return
    }

    for (const q of activeQuestions) {
      const filledOptions = q.options.filter((o) => o.label.trim())
      const body: Record<string, unknown> = { kind: q.kind, prompt: q.prompt }
      if (filledOptions.length >= 2) body.options = filledOptions
      const res = await api<unknown>(`/api/sessions/${encodeURIComponent(sessionId)}/questions`, {
        method: 'POST',
        body,
      })
      if (!res.ok) {
        setLaunchError((res as { ok: false; error: { message: string } }).error.message)
        setLaunching(false)
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
          setLaunchError((res as { ok: false; error: { message: string } }).error.message)
          setLaunching(false)
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

    setLaunching(false)
    onSessionCreated?.()
    navigate(`/sessions/${sessionId}/launchpad`)
    onClose()
  }

  function jumpToStep(target: WizardStep) {
    setJumpedFrom5(true)
    setStep(target)
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
        className="bg-white dark:bg-[#1C2540] rounded-xl shadow-elevated w-full max-w-lg max-h-[90vh] flex flex-col animate-modal-enter"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-pulse-200 dark:border-[#1E2A45] flex-shrink-0">
          <div className="space-y-1">
            <h2 ref={headingRef} tabIndex={-1} className="text-xl font-semibold focus:outline-none dark:text-[#F0F2F8]">
              {STEP_LABELS[step]}
            </h2>
            <p className="text-caption text-pulse-500 dark:text-[#8A96B0]" aria-live="polite">
              {t('a11y.progress_label', { current: step, total: 5 })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('a11y.close_label')}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-pulse-500 dark:text-[#8A96B0] hover:text-pulse-800 hover:bg-pulse-100 dark:hover:text-[#F0F2F8] dark:hover:bg-[#1E2A45] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="px-6 pt-3 pb-0 flex-shrink-0">
          <div className="flex gap-1" role="list" aria-label="Progress steps">
            {([1, 2, 3, 4, 5] as WizardStep[]).map((s) => (
              <div
                key={s}
                role="listitem"
                className={[
                  'h-1.5 flex-1 rounded-pill transition-colors',
                  s < step ? 'bg-teal-500' : s === step ? 'bg-teal-400' : 'bg-pulse-200 dark:bg-[#1E2A45]',
                ].join(' ')}
                aria-label={`Step ${s}${s === step ? ' (current)' : s < step ? ' (complete)' : ''}`}
              />
            ))}
          </div>
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {step === 1 && (
            <SessionWizardStep1
              title={title}
              goal={goal}
              onTitleChange={setTitle}
              onGoalChange={setGoal}
              error={error}
            />
          )}
          {step === 2 && (
            <SessionWizardStep2
              step2Mode={step2Mode}
              onModeChange={setStep2Mode}
              aiPhase={aiPhase}
              onAiPhaseChange={setAiPhase}
              aiConsented={aiConsented}
              onAiConsentChange={setAiConsented}
              aiPrompt={aiPrompt}
              onAiPromptChange={setAiPrompt}
              questions={questions}
              onQuestionsChange={setQuestions}
              activeQuestions={activeQuestions}
              templateSeedName={templateSeedName}
              onTemplateSeedNameChange={setTemplateSeedName}
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
              onAnonymityChange={setAnonymity}
              votePolicy={votePolicy}
              onVotePolicyChange={setVotePolicy}
              sessionMode={sessionMode}
              onSessionModeChange={setSessionMode}
              isPublic={isPublic}
              onIsPublicChange={setIsPublic}
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
          onBack={() => setStep((s) => (s - 1) as WizardStep)}
          onBackToOverview={() => { setJumpedFrom5(false); setStep(5) }}
          onNextStep1={handleNextFromStep1}
          onNextStep2={handleNextFromStep2}
          onNextStep34={() => {
            if (jumpedFrom5) { setStep(5); setJumpedFrom5(false) } else setStep((s) => (s + 1) as WizardStep)
          }}
          onLaunch={handleLaunch}
        />
      </div>
    </div>
  )
}
