/**
 * COPILOT-03 — on-the-fly poll drafting from a one-line presenter intent.
 *
 * Reuses the session-wizard generator (`ai-wizard.generateQuestions`) so the
 * live facilitator copilot and the wizard share a single question-generation
 * pipeline. Architecture: ADR-0046 (live facilitator copilot).
 */
import { generateQuestions, type GeneratedQuestion } from './ai-wizard'

/** Max length of the presenter's one-line intent. */
export const DRAFT_POLL_INTENT_MAX = 280
/** Max length of an optional focus hint. */
export const DRAFT_POLL_FOCUS_MAX = 120

export type DraftPollParams = {
  sessionTitle: string
  intent: string
  focusArea?: string | undefined
  language?: string | undefined
}

export type DraftPollResult = {
  /** Primary drafted question, or null when generation yields nothing. */
  draft: GeneratedQuestion | null
  /** Additional generated questions the presenter can pick instead. */
  alternatives: GeneratedQuestion[]
  /** Generator confidence (0–1). */
  confidence: number
  source: 'ai' | 'unavailable'
}

/**
 * Draft a poll from a one-line intent by reusing the wizard generator. The
 * presenter's intent maps to the generator's `sessionGoal`; the live session
 * title grounds it. Returns the top question as `draft` and the remainder as
 * `alternatives`.
 *
 * Propagates `WizardAIError` / `WizardValidationError` from the underlying
 * generator — callers wrap this in the AI circuit breaker (ADR-0046).
 */
export async function draftPollFromIntent(
  ai: Ai,
  params: DraftPollParams,
): Promise<DraftPollResult> {
  const result = await generateQuestions(ai, {
    sessionTitle: params.sessionTitle,
    sessionGoal: params.intent,
    focusArea: params.focusArea,
    language: params.language,
  })
  const [draft, ...alternatives] = result.questions
  return {
    draft: draft ?? null,
    alternatives,
    confidence: result.confidence,
    source: draft ? 'ai' : 'unavailable',
  }
}
