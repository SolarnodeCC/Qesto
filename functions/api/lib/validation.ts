// Zod schemas for session/question write paths. The React client imports the
// inferred types via `z.infer<typeof Schema>` to keep the wire format in one
// place (CLAUDE.md hard rule 5).

import { z } from 'zod'

// Trim before length checks so whitespace-only inputs fail validation.
const trimmed = (min: number, max: number) =>
  z.preprocess(
    (v) => (typeof v === 'string' ? v.trim() : v),
    z.string().min(min).max(max),
  )

export const PollOptionSchema = z.object({
  id: z.string().min(1).max(32),
  label: trimmed(1, 160),
})

export const PollQuestionSchema = z.object({
  kind: z.literal('poll'),
  prompt: trimmed(1, 240),
  options: z.array(PollOptionSchema).min(2).max(10),
})

export const CreateSessionSchema = z.object({
  title: trimmed(1, 120),
})

export const SessionOptionsSchema = z.object({
  anonymity: z.enum(['full', 'partial', 'none']).optional(),
  vote_policy: z.enum(['once', 'multi', 'react']).optional(),
  session_mode: z.enum(['reflection', 'fun']).optional(),
})

export const PatchSessionSchema = z
  .object({
    title: trimmed(1, 120).optional(),
    question: PollQuestionSchema.optional(),
    anonymity: z.enum(['full', 'partial', 'none']).optional(),
    vote_policy: z.enum(['once', 'multi', 'react']).optional(),
    session_mode: z.enum(['reflection', 'fun']).optional(),
  })
  .refine(
    (v) =>
      v.title !== undefined ||
      v.question !== undefined ||
      v.anonymity !== undefined ||
      v.vote_policy !== undefined ||
      v.session_mode !== undefined,
    { message: 'at least one field must be provided' },
  )

// WIZ-AI-01/02: AI-assisted question generation input.
export const GenerateQuestionsSchema = z.object({
  sessionTitle: trimmed(1, 160),
  sessionGoal: trimmed(1, 400),
  focusArea: trimmed(1, 160).optional(),
})

// WIZ-AI validator for parsed AI output. Options default to generated ids if
// the model omits them, so we accept a looser shape here and normalise in the
// handler. kind is coerced to 'poll' for unrecognised values so a model that
// returns an unexpected kind doesn't hard-fail the whole generation.
const AI_VALID_KINDS = [
  'poll', 'ranking', 'consent', 'open',
  'multi_select', 'likert', 'upvote', 'word_cloud', 'slider',
] as const
export const AIQuestionSchema = z.object({
  kind: z.preprocess(
    (v) => (AI_VALID_KINDS.includes(v as (typeof AI_VALID_KINDS)[number]) ? v : 'poll'),
    z.enum(AI_VALID_KINDS),
  ),
  prompt: trimmed(3, 240),
  options: z
    .array(
      z.object({
        id: z.string().min(1).max(32).optional(),
        label: trimmed(1, 160),
      }),
    )
    .min(2)
    .max(10),
})

export const AIQuestionsOutputSchema = z.object({
  questions: z.array(AIQuestionSchema).min(3).max(5),
})

// LAUNCHPAD-01: reorder input.
export const ReorderQuestionsSchema = z.object({
  questionIds: z.array(z.string().min(1).max(64)).min(1).max(50),
})

// LAUNCHPAD-02: add a single question inline (append, not replace).
// Supported kinds: classic poll/ranking/open/consent plus multi_select, likert
// (5-point scale), upvote, word_cloud (free-text; no options), slider (1–10).
// `likert` and `slider` auto-populate options when omitted; `word_cloud` never
// requires options. See `autoPopulateOptions` below.
export const AddQuestionSchema = z.object({
  kind: z.enum([
    'poll',
    'ranking',
    'open',
    'consent',
    'multi_select',
    'likert',
    'upvote',
    'word_cloud',
    'slider',
  ]),
  prompt: trimmed(1, 240),
  options: z
    .array(
      z.object({
        id: z.string().min(1).max(32).optional(),
        label: trimmed(1, 160),
      }),
    )
    .max(10)
    .optional(),
})

/**
 * For kinds that ship with fixed option scales, synthesise the options when
 * the caller omits them (or sends an empty array). Other kinds are returned
 * untouched so existing poll/ranking/upvote/multi_select flows still require
 * the caller to supply options explicitly.
 */
export type QuestionKindInput = z.infer<typeof AddQuestionSchema>['kind']

export function autoPopulateOptions(
  kind: QuestionKindInput,
  options: Array<{ id?: string | undefined; label: string }> | undefined,
): Array<{ id?: string | undefined; label: string }> {
  const provided = options ?? []
  if (provided.length > 0) return provided

  if (kind === 'likert') {
    return [
      { id: '1', label: 'Strongly disagree' },
      { id: '2', label: 'Disagree' },
      { id: '3', label: 'Neutral' },
      { id: '4', label: 'Agree' },
      { id: '5', label: 'Strongly agree' },
    ]
  }
  if (kind === 'slider') {
    return Array.from({ length: 10 }, (_, i) => ({
      id: String(i + 1),
      label: String(i + 1),
    }))
  }
  // word_cloud, open, consent: free-text / no options needed.
  return provided
}

export type PollOptionInput = z.infer<typeof PollOptionSchema>
export type PollQuestionInput = z.infer<typeof PollQuestionSchema>
export type CreateSessionInput = z.infer<typeof CreateSessionSchema>
export type PatchSessionInput = z.infer<typeof PatchSessionSchema>
export type GenerateQuestionsInput = z.infer<typeof GenerateQuestionsSchema>
export type AIQuestionInput = z.infer<typeof AIQuestionSchema>
export type AIQuestionsOutput = z.infer<typeof AIQuestionsOutputSchema>
export type ReorderQuestionsInput = z.infer<typeof ReorderQuestionsSchema>
export type AddQuestionInput = z.infer<typeof AddQuestionSchema>
export type SessionOptionsInput = z.infer<typeof SessionOptionsSchema>
