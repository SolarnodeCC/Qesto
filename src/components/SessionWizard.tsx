import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getLanguageHeader, useT } from '../i18n'
import { api, getAuthToken } from '../api/client'
import { apiUrl } from '../config/api'
import { WizardAIGenerationSkeleton } from './SkeletonLoader'
import AIBadge from './AIBadge'
import type { PollOption, WizardQuestionKind } from '@/types/session'

// ─── Types ────────────────────────────────────────────────────────────────────

type WizardStep = 1 | 2 | 3 | 4 | 5
type Step2Mode = 'idle' | 'manual' | 'ai' | 'template'
type AIPhase = 'consent' | 'chat' | 'generating' | 'review'

interface WizardQuestion {
  id: string
  kind: WizardQuestionKind
  prompt: string
  options: PollOption[]
  fromAI: boolean
  dismissed: boolean
  accepted: boolean
}

interface GeneratedQuestion {
  id?: string
  kind: string
  prompt: string
  options?: { id?: string; label: string }[]
}

type GenerateQuestionsSsePayload = {
  questions: GeneratedQuestion[]
  confidence: number
  groundingHash: string
}

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function newId() {
  return crypto.randomUUID().slice(0, 8)
}

const NO_OPTIONS_KINDS = new Set<WizardQuestionKind>(['open', 'word_cloud', 'likert', 'slider'])

function emptyQuestion(kind: WizardQuestionKind = 'poll'): WizardQuestion {
  const defaultOptions = [
    { id: newId(), label: '' },
    { id: newId(), label: '' },
  ]
  return { id: newId(), kind, prompt: '', options: NO_OPTIONS_KINDS.has(kind) ? [] : defaultOptions, fromAI: false, dismissed: false, accepted: false }
}

function isQuestionValid(q: WizardQuestion): boolean {
  if (q.dismissed) return false
  if (!q.prompt.trim()) return false
  if (NO_OPTIONS_KINDS.has(q.kind)) return true
  const filled = q.options.filter((o) => o.label.trim())
  return filled.length >= 2
}

function kindLabel(kind: WizardQuestionKind): string {
  const labels: Record<WizardQuestionKind, string> = {
    poll: 'Multiple choice',
    ranking: 'Ranking',
    open: 'Open text',
    multi_select: 'Multi-select',
    likert: 'Likert scale',
    slider: 'Slider',
    upvote: 'Upvote',
    word_cloud: 'Word cloud',
  }
  return labels[kind] ?? kind
}

function parseSseEvent(raw: string): { event: string; data: unknown } | null {
  let event = 'message'
  const dataLines: string[] = []
  for (const line of raw.split('\n')) {
    if (line.startsWith('event:')) event = line.slice('event:'.length).trim()
    if (line.startsWith('data:')) dataLines.push(line.slice('data:'.length).trim())
  }
  if (dataLines.length === 0) return null
  try {
    const data: unknown = JSON.parse(dataLines.join('\n'))
    return { event, data }
  } catch {
    return null
  }
}

function normalizeQuestionKind(kind: string): WizardQuestionKind {
  if (kind === 'wordcloud') return 'word_cloud'
  return (['poll', 'ranking', 'open', 'multi_select', 'likert', 'slider', 'upvote', 'word_cloud'].includes(kind)
    ? kind
    : 'poll') as WizardQuestionKind
}

const ENERGIZER_FORMATS = [
  { id: 'emoji-poll', name: 'Emoji Poll', desc: 'Quick mood check via emojis' },
  { id: 'snelste-vinger', name: 'Quick Finger', desc: 'Who is fastest with the right answer?' },
  { id: 'team-quiz', name: 'Team Quiz', desc: 'Short competitive quiz to warm up' },
  { id: 'woordenwolk', name: 'Word Cloud', desc: 'Participants type one word, visible together' },
]

// ─── Sub-component: Question editor ──────────────────────────────────────────

function QuestionEditor({
  question,
  onChange,
  onDismiss,
}: {
  question: WizardQuestion
  onChange: (q: WizardQuestion) => void
  onDismiss?: () => void
}) {
  const t = useT('wizard')
  function setKind(kind: WizardQuestionKind) {
    const updated = { ...question, kind }
    if (NO_OPTIONS_KINDS.has(kind)) {
      updated.options = []
    } else if (NO_OPTIONS_KINDS.has(question.kind)) {
      updated.options = [
        { id: newId(), label: '' },
        { id: newId(), label: '' },
      ]
    }
    onChange(updated)
  }

  function setPrompt(prompt: string) {
    onChange({ ...question, prompt })
  }

  function setOptionLabel(idx: number, label: string) {
    const options = question.options.map((o, i) => (i === idx ? { ...o, label } : o))
    onChange({ ...question, options })
  }

  function addOption() {
    const max = question.kind === 'ranking' ? 8 : 5
    if (question.options.length >= max) return
    onChange({ ...question, options: [...question.options, { id: newId(), label: '' }] })
  }

  function removeOption(idx: number) {
    if (question.options.length <= 2) return
    const options = question.options.filter((_, i) => i !== idx)
    onChange({ ...question, options })
  }

  const maxOpts = question.kind === 'ranking' ? 8 : 5
  const valid = isQuestionValid(question)

  return (
    <div className="rounded-lg border border-pulse-200 dark:border-[#1E2A45] bg-white dark:bg-[#151C2E] p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {question.fromAI && <AIBadge variant="generated" />}
          <span className={`text-caption font-medium ${valid ? 'text-teal-600' : 'text-amber-500'}`}>
            {valid ? '✓ Valid' : '⚠ Incomplete'}
          </span>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Remove this question"
            className="text-pulse-400 hover:text-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded p-0.5"
          >
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Kind selector */}
      <div className="flex gap-2 flex-wrap">
        {(['poll', 'multi_select', 'ranking', 'upvote', 'open', 'word_cloud', 'likert', 'slider'] as WizardQuestionKind[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={[
              'px-3 py-1 rounded-pill text-caption font-medium border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500',
              question.kind === k
                ? 'bg-teal-50 dark:bg-teal-500/10 border-teal-400 dark:border-teal-400 text-teal-700 dark:text-teal-300'
                : 'border-pulse-300 dark:border-[#2A3858] text-pulse-600 dark:text-[#A8B3CC] hover:border-teal-300',
            ].join(' ')}
          >
            {kindLabel(k)}
          </button>
        ))}
      </div>

      {/* Prompt */}
      <textarea
        value={question.prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Type your question…"
        rows={2}
        className="w-full rounded-lg border border-pulse-300 dark:border-[#2A3858] bg-transparent dark:bg-[#1C2540] px-3 py-2 text-sm resize-none focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200 dark:focus:ring-teal-900"
        aria-label="Question text"
      />

      {/* Options */}
      {!NO_OPTIONS_KINDS.has(question.kind) && (
        <div className="space-y-2">
          {question.options.map((opt, idx) => (
            <div key={opt.id} className="flex items-center gap-2">
              <span className="text-caption text-pulse-400 w-5 text-right select-none">{idx + 1}.</span>
              <input
                type="text"
                value={opt.label}
                onChange={(e) => setOptionLabel(idx, e.target.value)}
                placeholder={`Option ${idx + 1}`}
                className="flex-1 rounded-md border border-pulse-300 dark:border-[#2A3858] bg-transparent dark:bg-[#1C2540] px-2 py-1.5 text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-300"
                aria-label={`Option ${idx + 1}`}
              />
              <button
                type="button"
                onClick={() => removeOption(idx)}
                disabled={question.options.length <= 2}
                aria-label={`Remove option ${idx + 1}`}
                className="text-pulse-400 hover:text-red-500 disabled:opacity-30 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded p-0.5"
              >
                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
          {question.options.length < maxOpts && (
            <button
              type="button"
              onClick={addOption}
              className="text-caption text-teal-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded"
            >
              + Add option
            </button>
          )}
          <p className="text-caption text-pulse-400">
            {question.kind === 'ranking' ? `${question.options.length}/8 items` : `${question.options.length}/5 options`}
            {question.options.length < 2 && ' — add at least 2'}
          </p>
        </div>
      )}
      {question.kind === 'likert' && (
        <p className="text-caption text-pulse-400 italic">{t('step2.auto_scale_hint')}</p>
      )}
      {question.kind === 'slider' && (
        <p className="text-caption text-pulse-400 italic">{t('step2.auto_slider_hint')}</p>
      )}
      {(question.kind === 'word_cloud' || question.kind === 'open') && (
        <p className="text-caption text-pulse-400 italic">{t('step2.free_text_hint')}</p>
      )}
    </div>
  )
}

// ─── Sub-component: AI suggestion chip ───────────────────────────────────────

function AIChip({
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
        <p className="text-sm text-pulse-800 dark:text-pulse-200 line-clamp-2">{question.prompt || <em className="text-pulse-400">{t('step2.chip_empty')}</em>}</p>
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
              : 'text-pulse-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/20',
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
          className="p-1.5 rounded-md text-pulse-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
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
          className="p-1.5 rounded-md text-pulse-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        >
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}

// ─── Main wizard ──────────────────────────────────────────────────────────────

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

  // Reset when opened
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

  // Focus heading on step change
  useEffect(() => {
    if (open) headingRef.current?.focus()
  }, [step, open])

  // Escape to close
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  // ── Step 1 validation
  const step1Valid = title.trim().length > 0 && goal.trim().length > 0

  // ── Step 2 validation
  const activeQuestions = questions.filter((q) => !q.dismissed)
  const step2Valid = step2Mode !== 'idle' && activeQuestions.length > 0 && activeQuestions.every(isQuestionValid)

  // ── Advance from step 1 → create session
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
      if (!res.ok) {
        setError(res.error.message)
        return
      }
      setSessionId(res.data.session.id)
    } else {
      const patchRes = await api<unknown>(`/api/sessions/${encodeURIComponent(sessionId)}`, {
        method: 'PATCH',
        body: { title: title.trim() },
      })
      if (!patchRes.ok) {
        setError(patchRes.error.message)
        return
      }
    }

    if (jumpedFrom5) { setStep(5); setJumpedFrom5(false) } else { setStep(2) }
  }

  // ── AI generate questions
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

      if (!response.ok) {
        throw new Error(t('step2.ai_error'))
      }
      if (!response.body) {
        throw new Error(t('step2.ai_error'))
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let payload: GenerateQuestionsSsePayload | null = null

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
          if (parsed?.event === 'questions') {
            payload = parsed.data as GenerateQuestionsSsePayload
          }
          if (parsed?.event === 'error') {
            throw new Error(t('step2.ai_error'))
          }
          boundary = buffer.indexOf('\n\n')
        }
      }

      if (!payload) throw new Error(t('step2.ai_error'))
      setGeneratedAiGroundingHash(payload.groundingHash)
      const generated: WizardQuestion[] = payload.questions.map((q) => ({
        id: q.id ?? newId(),
        kind: normalizeQuestionKind(q.kind),
        prompt: q.prompt,
        options: (q.options ?? []).map((o) => ({ id: o.id ?? newId(), label: o.label })),
        fromAI: true,
        dismissed: false,
        accepted: false,
      }))

      setQuestions(generated)
      setAiPhase('review')
    } catch {
      setError(t('step2.ai_error'))
      setAiPhase('chat')
    } finally {
      setGenerating(false)
    }
  }

  function dismissQuestion(id: string) {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, dismissed: true } : q)))
  }

  function acceptQuestion(id: string) {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, accepted: !q.accepted } : q)))
  }

  function updateQuestion(updated: WizardQuestion) {
    setQuestions((prev) => prev.map((q) => (q.id === updated.id ? updated : q)))
  }

  function addManualQuestion() {
    setQuestions((prev) => [...prev, emptyQuestion()])
  }

  // ── Advance from step 2 → 3
  function handleNextFromStep2() {
    if (!step2Valid) return
    if (jumpedFrom5) { setStep(5); setJumpedFrom5(false) } else { setStep(3) }
  }

  // ── Launch from step 5
  async function handleLaunch() {
    if (!sessionId) return
    setLaunching(true)
    setLaunchError(null)

    // Persist session options chosen in step 4.
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

    // Save all questions via POST /questions.
    // PATCH /api/sessions/:id only accepts kind:'poll', so we always use POST
    // here to support ranking and open question kinds as the first question too.
    for (const q of activeQuestions) {
      const filledOptions = q.options.filter((o) => o.label.trim())
      const body: Record<string, unknown> = { kind: q.kind, prompt: q.prompt }
      // Only include options when there are at least 2 (open questions have none).
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

    // If user picked an energizer format, create it on the backend
    if (energizerId) {
      const kindMap: Record<string, string> = {
        'emoji-poll': 'emoji_poll',
        'snelste-vinger': 'quick_finger',
        'team-quiz': 'team_quiz',
        'woordenwolk': 'word_cloud',
      }
      const backendKind = kindMap[energizerId]
      if (backendKind) {
        const promptMap: Record<string, string> = {
          'emoji-poll': 'How are you feeling right now?',
          'snelste-vinger': 'Quick Finger — edit this question in the Launchpad',
          'team-quiz': 'Team Quiz — edit your questions in the Launchpad',
          'woordenwolk': 'Word Cloud — participants type one word',
        }
        const res = await api<unknown>(`/api/sessions/${encodeURIComponent(sessionId)}/energizers`, {
          method: 'POST',
          body: { kind: backendKind, prompt: promptMap[energizerId] ?? energizerId },
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
        body: {
          event: 'ai.suggestions_resolved',
          sessionId,
          count: acceptedAiCount,
          value: dismissedAiCount,
        },
      })
    }

    setLaunching(false)
    onSessionCreated?.()
    navigate(`/sessions/${sessionId}/launchpad`)
    onClose()
  }

  // ── Edit-jump from step 5
  function jumpToStep(target: WizardStep) {
    setJumpedFrom5(true)
    setStep(target)
  }

  // ─── Step labels
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
        className="bg-white dark:bg-[#1C2540] rounded-2xl shadow-elevated w-full max-w-lg max-h-[90vh] flex flex-col animate-modal-enter"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-pulse-200 dark:border-[#1E2A45] flex-shrink-0">
          <div className="space-y-1">
            <h2
              ref={headingRef}
              tabIndex={-1}
              className="text-xl font-semibold focus:outline-none dark:text-[#F0F2F8]"
            >
              {STEP_LABELS[step]}
            </h2>
            <p className="text-caption text-pulse-500 dark:text-[#6B7A99]" aria-live="polite">
              {t('a11y.progress_label', { current: step, total: 5 })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('a11y.close_label')}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-pulse-500 hover:text-pulse-800 hover:bg-pulse-100 dark:hover:bg-pulse-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
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

          {/* ── STEP 1: Basics ── */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <label htmlFor="wiz-title" className="text-sm font-medium dark:text-[#F0F2F8]">
                  {t('step1.label_title')}
                </label>
                <input
                  id="wiz-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t('step1.placeholder_title')}
                  maxLength={160}
                  className="w-full rounded-lg border border-pulse-300 dark:border-[#2A3858] bg-transparent dark:bg-[#1C2540] px-3 py-2 text-sm focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200 dark:focus:ring-teal-900"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="wiz-goal" className="text-sm font-medium dark:text-[#F0F2F8]">
                  {t('step1.label_goal')}
                </label>
                <textarea
                  id="wiz-goal"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder={t('step1.placeholder_goal')}
                  rows={3}
                  maxLength={400}
                  className="w-full rounded-lg border border-pulse-300 dark:border-[#2A3858] bg-transparent dark:bg-[#1C2540] px-3 py-2 text-sm resize-none focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200 dark:focus:ring-teal-900"
                />
              </div>
              {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            </div>
          )}

          {/* ── STEP 2: Questions ── */}
          {step === 2 && (
            <div className="space-y-4">
              {/* Mode selector */}
              {step2Mode === 'idle' && (
                <div className="space-y-3">
                  <p className="text-sm font-medium dark:text-[#F0F2F8]">{t('step2.mode_title')}</p>
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
                          setStep2Mode(mode.id)
                          if (mode.id === 'manual') { setQuestions([emptyQuestion()]); setTemplateSeedName(null) }
                          if (mode.id === 'ai') setAiPhase('consent')
                        }}
                        className="text-left p-3 rounded-xl border border-pulse-200 dark:border-[#1E2A45] bg-white dark:bg-[#151C2E] hover:border-teal-400 hover:bg-teal-50/50 dark:hover:bg-teal-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 transition-colors"
                      >
                        <span className="font-medium text-sm dark:text-[#F0F2F8]">{mode.icon} {mode.label}</span>
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
                    onClick={() => { setStep2Mode('idle'); setQuestions([]); setTemplateSeedName(null) }}
                    className="text-caption text-teal-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded"
                  >
                    {t('step2.back')}
                  </button>

                  {/* Consent gate */}
                  {aiPhase === 'consent' && (
                    <div className="rounded-xl border border-violet-200 dark:border-violet-800/60 bg-violet-50/50 dark:bg-violet-900/20 p-4 space-y-3">
                      <div className="flex items-start gap-2">
                        <span className="text-xl">✨</span>
                        <div>
                          <p className="font-medium text-sm dark:text-[#F0F2F8]">{t('step2.ai_consent_v2.title')}</p>
                          <p className="text-caption text-pulse-500 mt-0.5">{t('step2.ai_consent_v2.description')}</p>
                        </div>
                      </div>
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={aiConsented}
                          onChange={(e) => setAiConsented(e.target.checked)}
                          className="mt-0.5 rounded border-pulse-300 text-teal-600 focus:ring-teal-500"
                        />
                        <span className="text-sm dark:text-[#A8B3CC]">{t('step2.ai_consent_v2.checkbox')}</span>
                      </label>
                      <button
                        type="button"
                        disabled={!aiConsented}
                        onClick={() => setAiPhase('chat')}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-br from-violet-500 to-teal-500 text-white px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 btn-motion"
                      >
                        {t('step2.ai_generate_cta')}
                      </button>
                    </div>
                  )}

                  {/* Chat / refine */}
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
                          onChange={(e) => setAiPrompt(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleGenerate() }}
                          placeholder={t('step2.ai_placeholder')}
                          className="flex-1 rounded-lg border border-pulse-300 dark:border-[#2A3858] bg-transparent dark:bg-[#1C2540] px-3 py-2 text-sm focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                        />
                        <button
                          type="button"
                          onClick={handleGenerate}
                          className="px-3 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 btn-motion"
                        >
                          {t('step2.ai_send')}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={handleGenerate}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-violet-300 text-violet-600 dark:text-violet-400 px-4 py-2.5 text-sm font-medium hover:bg-violet-50 dark:hover:bg-violet-900/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 btn-motion"
                      >
                        {t('step2.ai_generate_cta')}
                      </button>
                      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
                    </div>
                  )}

                  {/* Generating skeleton */}
                  {aiPhase === 'generating' && (
                    <div>
                      <p className="text-caption text-pulse-500 mb-3">{t('step2.ai_generating')}</p>
                      <WizardAIGenerationSkeleton questionCount={3} />
                    </div>
                  )}

                  {/* Review */}
                  {aiPhase === 'review' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium dark:text-[#F0F2F8]">{t('step2.ai_review_title')}</p>
                        <button
                          type="button"
                          onClick={() => {
                            if (activeQuestions.length === 0 || window.confirm(t('step2.ai_regenerate_confirm'))) {
                              setAiPhase('chat')
                              setError(null)
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
                    onClick={() => { setStep2Mode('idle'); setQuestions([]); setTemplateSeedName(null) }}
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
                          {...(questions.filter((x) => !x.dismissed).length > 1 ? { onDismiss: () => dismissQuestion(q.id) } : {})}
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
                    onClick={() => { setStep2Mode('idle'); setQuestions([]); setTemplateSeedName(null) }}
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
                          {...(questions.filter((x) => !x.dismissed).length > 1 ? { onDismiss: () => dismissQuestion(q.id) } : {})}
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
          )}

          {/* ── STEP 3: Energizer ── */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-pulse-600 dark:text-pulse-300">{t('step3.title')}</p>
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => { if (jumpedFrom5) { setStep(5); setJumpedFrom5(false) } else setStep(4) }}
                  className="text-left p-3 rounded-xl border border-pulse-200 dark:border-[#1E2A45] bg-white dark:bg-[#151C2E] hover:border-pulse-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 transition-colors text-sm text-pulse-600 dark:text-[#A8B3CC]"
                >
                  {t('step3.no')} (skip energizer)
                </button>
              </div>
              <p className="text-sm font-medium dark:text-[#F0F2F8]">{t('step3.pick_format')}</p>
              <div className="grid grid-cols-1 gap-2">
                {ENERGIZER_FORMATS.map((fmt) => (
                  <button
                    key={fmt.id}
                    type="button"
                    onClick={() => {
                      setEnergizerId(fmt.id)
                      if (jumpedFrom5) { setStep(5); setJumpedFrom5(false) } else setStep(4)
                    }}
                    className={[
                      'text-left p-3 rounded-xl border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500',
                      energizerId === fmt.id
                        ? 'border-teal-500 dark:border-teal-400 bg-teal-50 dark:bg-teal-500/10'
                        : 'border-pulse-200 dark:border-[#1E2A45] bg-white dark:bg-[#151C2E] hover:border-teal-300',
                    ].join(' ')}
                  >
                    <span className="font-medium text-sm dark:text-[#F0F2F8]">{fmt.name}</span>
                    <p className="text-caption text-pulse-500">{fmt.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── STEP 4: Settings ── */}
          {step === 4 && (
            <div className="space-y-5">
              {/* Anonymity */}
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium dark:text-[#F0F2F8]">{t('step4.anonymity.label')}</legend>
                <div className="flex gap-2 flex-wrap">
                  {(['full', 'partial', 'none', 'zero_knowledge'] as const).map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setAnonymity(val)}
                      className={[
                        'px-3 py-1.5 rounded-lg border text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500',
                        anonymity === val
                          ? 'border-teal-500 dark:border-teal-400 bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-300'
                          : 'border-pulse-300 dark:border-[#2A3858] hover:border-teal-300',
                      ].join(' ')}
                    >
                      {t(`step4.anonymity.${val}`)}
                    </button>
                  ))}
                </div>
              </fieldset>

              {/* Vote policy */}
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium dark:text-[#F0F2F8]">{t('step4.votePolicy.label')}</legend>
                <div className="flex gap-2 flex-wrap">
                  {(['once', 'multi', 'react'] as const).map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setVotePolicy(val)}
                      className={[
                        'px-3 py-1.5 rounded-lg border text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500',
                        votePolicy === val
                          ? 'border-teal-500 dark:border-teal-400 bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-300'
                          : 'border-pulse-300 dark:border-[#2A3858] hover:border-teal-300',
                      ].join(' ')}
                    >
                      {t(`step4.votePolicy.${val}`)}
                    </button>
                  ))}
                </div>
              </fieldset>

              {/* Session mode */}
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium dark:text-[#F0F2F8]">{t('step4.mode.label')}</legend>
                <div className="flex gap-2 flex-wrap">
                  {([
                    { val: 'reflection' as const, label: t('step4.mode.reflection_title') },
                    { val: 'fun' as const, label: t('step4.mode.fun_title') },
                  ]).map(({ val, label }) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setSessionMode(val)}
                      className={[
                        'px-3 py-1.5 rounded-lg border text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500',
                        sessionMode === val
                          ? 'border-teal-500 dark:border-teal-400 bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-300'
                          : 'border-pulse-300 dark:border-[#2A3858] hover:border-teal-300',
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

              {/* Template gallery opt-out */}
              <div className="flex items-start gap-3 pt-2 border-t border-pulse-100 dark:border-white/10">
                <button
                  type="button"
                  role="switch"
                  aria-checked={isPublic}
                  onClick={() => setIsPublic(!isPublic)}
                  className={[
                    'relative shrink-0 mt-0.5 w-10 h-6 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500',
                    isPublic
                      ? 'bg-teal-500'
                      : 'bg-pulse-300 dark:bg-white/20',
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
                  <p className="text-sm font-medium dark:text-[#F0F2F8]">{t('step4.isPublic.label')}</p>
                  <p className="text-caption text-pulse-500">{t('step4.isPublic.description')}</p>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 5: Overview ── */}
          {step === 5 && (
            <div className="space-y-4">
              <p className="text-caption text-pulse-500">{t('step5.consent_text')}</p>

              {/* Basics */}
              <section className="rounded-xl border border-pulse-200 dark:border-[#1E2A45] bg-white dark:bg-[#151C2E] p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold dark:text-[#F0F2F8]">{t('step5.section_basis')}</h3>
                  <button type="button" onClick={() => jumpToStep(1)} aria-label="Edit basics" className="text-caption text-teal-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded">
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

              {/* Questions */}
              <section className="rounded-xl border border-pulse-200 dark:border-[#1E2A45] bg-white dark:bg-[#151C2E] p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold dark:text-[#F0F2F8]">{t('step5.section_questions')}</h3>
                  <button type="button" onClick={() => jumpToStep(2)} aria-label="Edit questions" className="text-caption text-teal-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded">
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

              {/* Energizer */}
              <section className="rounded-xl border border-pulse-200 dark:border-[#1E2A45] bg-white dark:bg-[#151C2E] p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold dark:text-[#F0F2F8]">{t('step5.section_energizer')}</h3>
                  <button type="button" onClick={() => jumpToStep(3)} aria-label="Edit energizer" className="text-caption text-teal-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded">
                    {t('step5.edit')} ✏️
                  </button>
                </div>
                {energizerId ? (
                  <p className="text-sm dark:text-[#A8B3CC]">{ENERGIZER_FORMATS.find((f) => f.id === energizerId)?.name ?? energizerId}</p>
                ) : (
                  <p className="text-caption text-pulse-500">{t('step5.no_energizer')}</p>
                )}
              </section>

              {/* Settings */}
              <section className="rounded-xl border border-pulse-200 dark:border-[#1E2A45] bg-white dark:bg-[#151C2E] p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold dark:text-[#F0F2F8]">{t('step5.section_settings')}</h3>
                  <button type="button" onClick={() => jumpToStep(4)} aria-label="Edit settings" className="text-caption text-teal-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded">
                    {t('step5.edit')} ✏️
                  </button>
                </div>
                <p className="text-caption text-pulse-500">
                  {t(`step4.anonymity.${anonymity}`)} · {t(`step4.votePolicy.${votePolicy}`)} · {sessionMode === 'fun' ? t('step4.mode.fun_title') : t('step4.mode.reflection_title')}
                </p>
              </section>

              {launchError && <p role="alert" className="text-sm text-red-600">{launchError}</p>}
            </div>
          )}
        </div>

        {/* Footer navigation */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-pulse-200 dark:border-[#1E2A45] bg-white dark:bg-[#151C2E] flex-shrink-0 gap-3">
          {/* Back */}
          {step > 1 && !jumpedFrom5 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s - 1) as WizardStep)}
              className="px-4 py-2 rounded-lg border border-pulse-300 dark:border-[#2A3858] dark:bg-transparent dark:text-[#A8B3CC] text-sm hover:bg-pulse-50 dark:hover:bg-[#1E2A45] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              {t('nav.back')}
            </button>
          ) : jumpedFrom5 ? (
            <button
              type="button"
              onClick={() => { setJumpedFrom5(false); setStep(5) }}
              className="px-4 py-2 rounded-lg border border-pulse-300 dark:border-[#2A3858] dark:bg-transparent dark:text-[#A8B3CC] text-sm hover:bg-pulse-50 dark:hover:bg-[#1E2A45] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              ← Overview
            </button>
          ) : (
            <div />
          )}

          {/* Primary action */}
          <div>
            {step === 1 && (
              <button
                type="button"
                onClick={handleNextFromStep1}
                disabled={!step1Valid || creatingSession}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 btn-motion"
              >
                {creatingSession ? 'Creating…' : jumpedFrom5 ? '← Overview' : t('nav.next')}
              </button>
            )}
            {step === 2 && (
              <button
                type="button"
                onClick={handleNextFromStep2}
                disabled={!step2Valid}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 btn-motion"
              >
                {jumpedFrom5 ? '← Overview' : t('nav.next')}
              </button>
            )}
            {(step === 3 || step === 4) && (
              <button
                type="button"
                onClick={() => {
                  if (jumpedFrom5) { setStep(5); setJumpedFrom5(false) } else setStep((s) => (s + 1) as WizardStep)
                }}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 btn-motion"
              >
                {jumpedFrom5 ? '← Overview' : t('nav.next')}
              </button>
            )}
            {step === 5 && (
              <button
                type="button"
                onClick={handleLaunch}
                disabled={launching || activeQuestions.length === 0}
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
      </div>
    </div>
  )
}
