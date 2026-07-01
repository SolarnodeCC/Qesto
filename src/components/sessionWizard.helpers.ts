// Pure types and helpers for SessionWizard, extracted from SessionWizard.tsx
// (R-05). No React, no side effects — safe to unit-test and share across the
// wizard's sub-components.

import type { PollOption, WizardQuestionKind } from '@/types/session'

// ─── Types ────────────────────────────────────────────────────────────────────

export type WizardStep = 1 | 2 | 3 | 4 | 5
export type Step2Mode = 'idle' | 'manual' | 'ai' | 'template'
export type AIPhase = 'consent' | 'chat' | 'generating' | 'review'

export interface WizardQuestion {
  id: string
  kind: WizardQuestionKind
  prompt: string
  options: PollOption[]
  fromAI: boolean
  dismissed: boolean
  accepted: boolean
}

export interface GeneratedQuestion {
  id?: string
  kind: string
  prompt: string
  options?: { id?: string; label: string }[]
}

export type GenerateQuestionsSsePayload = {
  questions: GeneratedQuestion[]
  confidence: number
  groundingHash: string
}

// Incremental SSE event: one question emitted the moment it finishes generating.
export type QuestionSsePayload = {
  question: GeneratedQuestion
  index: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function newId() {
  return crypto.randomUUID().slice(0, 8)
}

export const NO_OPTIONS_KINDS = new Set<WizardQuestionKind>(['open', 'word_cloud', 'likert', 'slider'])

export function emptyQuestion(kind: WizardQuestionKind = 'poll'): WizardQuestion {
  const defaultOptions = [
    { id: newId(), label: '' },
    { id: newId(), label: '' },
  ]
  return { id: newId(), kind, prompt: '', options: NO_OPTIONS_KINDS.has(kind) ? [] : defaultOptions, fromAI: false, dismissed: false, accepted: false }
}

export function isQuestionValid(q: WizardQuestion): boolean {
  if (q.dismissed) return false
  if (!q.prompt.trim()) return false
  if (NO_OPTIONS_KINDS.has(q.kind)) return true
  const filled = q.options.filter((o) => o.label.trim())
  return filled.length >= 2
}

export function kindLabel(kind: WizardQuestionKind): string {
  const labels: Record<WizardQuestionKind, string> = {
    poll: 'Multiple choice',
    ranking: 'Ranking',
    open: 'Open text',
    multi_select: 'Multi-select',
    likert: 'Likert scale',
    slider: 'Slider',
    upvote: 'Upvote',
    word_cloud: 'Word cloud',
    reaction: 'Reaction',
  }
  return labels[kind] ?? kind
}

export function parseSseEvent(raw: string): { event: string; data: unknown } | null {
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

/** Coerces unknown API kind strings to a wizard-safe {@link WizardQuestionKind} (defaults to `poll`). */
export function coerceQuestionKind(kind: string): WizardQuestionKind {
  if (kind === 'wordcloud') return 'word_cloud'
  return (['poll', 'ranking', 'open', 'multi_select', 'likert', 'slider', 'upvote', 'word_cloud'].includes(kind)
    ? kind
    : 'poll') as WizardQuestionKind
}

export const ENERGIZER_FORMATS = [
  { id: 'emoji-poll', name: 'Emoji Poll', desc: 'Quick mood check via emojis' },
  { id: 'snelste-vinger', name: 'Quick Finger', desc: 'Who is fastest with the right answer?' },
  { id: 'team-quiz', name: 'Team Quiz', desc: 'Short competitive quiz to warm up' },
  { id: 'woordenwolk', name: 'Word Cloud', desc: 'Participants type one word, visible together' },
]

export const ENERGIZER_BACKEND_KIND: Record<string, string> = {
  'emoji-poll': 'emoji_poll',
  'snelste-vinger': 'quick_finger',
  'team-quiz': 'team_quiz',
  'woordenwolk': 'word_cloud',
}

export const ENERGIZER_DEFAULT_PROMPT: Record<string, string> = {
  'emoji-poll': 'How are you feeling right now?',
  'snelste-vinger': 'Quick Finger — edit this question in the Launchpad',
  'team-quiz': 'Team Quiz — edit your questions in the Launchpad',
  'woordenwolk': 'Word Cloud — participants type one word',
}
