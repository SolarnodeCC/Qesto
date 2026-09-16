// Pure reducer for SessionWizard field state (DS Days 31–60).
// Async side-effects stay in the component; this owns the mega-state surface.

import type { PollOption } from '@/types/session'
import {
  coerceQuestionKind,
  newId,
  type AIPhase,
  type Step2Mode,
  type WizardQuestion,
  type WizardStep,
} from './sessionWizard.helpers'

export type WizardState = {
  step: WizardStep
  jumpedFrom5: boolean
  title: string
  goal: string
  step2Mode: Step2Mode
  aiPhase: AIPhase
  aiConsented: boolean
  aiPrompt: string
  questions: WizardQuestion[]
  templateSeedName: string | null
  energizerId: string | null
  anonymity: 'full' | 'partial' | 'none' | 'zero_knowledge'
  votePolicy: 'once' | 'multi' | 'react'
  sessionMode: 'reflection' | 'fun'
  isPublic: boolean
  sessionId: string | null
  generatedAiGroundingHash: string | null
  creatingSession: boolean
  generating: boolean
  launching: boolean
  error: string | null
  launchError: string | null
}

export type WizardTemplateSeed = {
  id: string
  name: string
  description: string
  questions: Array<{ kind: string; prompt: string; options: PollOption[] }>
}

export type WizardAction =
  | { type: 'RESET'; template?: WizardTemplateSeed | null }
  | { type: 'SET_STEP'; step: WizardStep }
  | { type: 'SET_JUMPED_FROM_5'; value: boolean }
  | { type: 'SET_TITLE'; value: string }
  | { type: 'SET_GOAL'; value: string }
  | { type: 'SET_STEP2_MODE'; value: Step2Mode }
  | { type: 'SET_AI_PHASE'; value: AIPhase }
  | { type: 'SET_AI_CONSENTED'; value: boolean }
  | { type: 'SET_AI_PROMPT'; value: string }
  | { type: 'SET_QUESTIONS'; value: WizardQuestion[] | ((prev: WizardQuestion[]) => WizardQuestion[]) }
  | { type: 'SET_TEMPLATE_SEED_NAME'; value: string | null }
  | { type: 'SET_ENERGIZER_ID'; value: string | null }
  | { type: 'SET_ANONYMITY'; value: WizardState['anonymity'] }
  | { type: 'SET_VOTE_POLICY'; value: WizardState['votePolicy'] }
  | { type: 'SET_SESSION_MODE'; value: WizardState['sessionMode'] }
  | { type: 'SET_IS_PUBLIC'; value: boolean }
  | { type: 'SET_SESSION_ID'; value: string | null }
  | { type: 'SET_GROUNDING_HASH'; value: string | null }
  | { type: 'SET_CREATING_SESSION'; value: boolean }
  | { type: 'SET_GENERATING'; value: boolean }
  | { type: 'SET_LAUNCHING'; value: boolean }
  | { type: 'SET_ERROR'; value: string | null }
  | { type: 'SET_LAUNCH_ERROR'; value: string | null }
  | { type: 'JUMP_TO_STEP'; step: WizardStep }
  | { type: 'BACK_STEP' }
  | { type: 'BACK_TO_OVERVIEW' }
  | { type: 'ADVANCE_AFTER_JUMP_OR'; next: WizardStep }

export const WIZARD_INITIAL: WizardState = {
  step: 1,
  jumpedFrom5: false,
  title: '',
  goal: '',
  step2Mode: 'idle',
  aiPhase: 'consent',
  aiConsented: false,
  aiPrompt: '',
  questions: [],
  templateSeedName: null,
  energizerId: null,
  anonymity: 'partial',
  votePolicy: 'once',
  sessionMode: 'reflection',
  isPublic: true,
  sessionId: null,
  generatedAiGroundingHash: null,
  creatingSession: false,
  generating: false,
  launching: false,
  error: null,
  launchError: null,
}

function resetFromTemplate(template: WizardTemplateSeed | null | undefined): WizardState {
  if (template) {
    return {
      ...WIZARD_INITIAL,
      title: template.name,
      goal: template.description,
      step2Mode: 'template',
      templateSeedName: template.name,
      questions: template.questions.map((q) => ({
        id: newId(),
        kind: coerceQuestionKind(q.kind),
        prompt: q.prompt,
        options: q.options.map((o) => ({ id: o.id || newId(), label: o.label })),
        fromAI: false,
        dismissed: false,
        accepted: true,
      })),
    }
  }
  return { ...WIZARD_INITIAL }
}

export function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'RESET':
      return resetFromTemplate(action.template)
    case 'SET_STEP':
      return { ...state, step: action.step }
    case 'SET_JUMPED_FROM_5':
      return { ...state, jumpedFrom5: action.value }
    case 'SET_TITLE':
      return { ...state, title: action.value }
    case 'SET_GOAL':
      return { ...state, goal: action.value }
    case 'SET_STEP2_MODE':
      return { ...state, step2Mode: action.value }
    case 'SET_AI_PHASE':
      return { ...state, aiPhase: action.value }
    case 'SET_AI_CONSENTED':
      return { ...state, aiConsented: action.value }
    case 'SET_AI_PROMPT':
      return { ...state, aiPrompt: action.value }
    case 'SET_QUESTIONS': {
      const next =
        typeof action.value === 'function' ? action.value(state.questions) : action.value
      return { ...state, questions: next }
    }
    case 'SET_TEMPLATE_SEED_NAME':
      return { ...state, templateSeedName: action.value }
    case 'SET_ENERGIZER_ID':
      return { ...state, energizerId: action.value }
    case 'SET_ANONYMITY':
      return { ...state, anonymity: action.value }
    case 'SET_VOTE_POLICY':
      return { ...state, votePolicy: action.value }
    case 'SET_SESSION_MODE':
      return { ...state, sessionMode: action.value }
    case 'SET_IS_PUBLIC':
      return { ...state, isPublic: action.value }
    case 'SET_SESSION_ID':
      return { ...state, sessionId: action.value }
    case 'SET_GROUNDING_HASH':
      return { ...state, generatedAiGroundingHash: action.value }
    case 'SET_CREATING_SESSION':
      return { ...state, creatingSession: action.value }
    case 'SET_GENERATING':
      return { ...state, generating: action.value }
    case 'SET_LAUNCHING':
      return { ...state, launching: action.value }
    case 'SET_ERROR':
      return { ...state, error: action.value }
    case 'SET_LAUNCH_ERROR':
      return { ...state, launchError: action.value }
    case 'JUMP_TO_STEP':
      return { ...state, jumpedFrom5: true, step: action.step }
    case 'BACK_STEP':
      return { ...state, step: Math.max(1, state.step - 1) as WizardStep }
    case 'BACK_TO_OVERVIEW':
      return { ...state, jumpedFrom5: false, step: 5 }
    case 'ADVANCE_AFTER_JUMP_OR':
      if (state.jumpedFrom5) return { ...state, step: 5, jumpedFrom5: false }
      return { ...state, step: action.next }
    default:
      return state
  }
}
