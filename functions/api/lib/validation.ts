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

export const DuplicateSessionSchema = z.preprocess(
  (v) => (v === null || v === undefined ? {} : v),
  z.object({
    title: trimmed(1, 120).optional(),
  }),
)

export const SessionOptionsSchema = z.object({
  anonymity: z.enum(['full', 'partial', 'none', 'zero_knowledge']).optional(),
  vote_policy: z.enum(['once', 'multi', 'react']).optional(),
  session_mode: z.enum(['reflection', 'fun']).optional(),
})

export const PatchSessionSchema = z
  .object({
    title: trimmed(1, 120).optional(),
    question: PollQuestionSchema.optional(),
    anonymity: z.enum(['full', 'partial', 'none', 'zero_knowledge']).optional(),
    vote_policy: z.enum(['once', 'multi', 'react']).optional(),
    session_mode: z.enum(['reflection', 'fun']).optional(),
    ai_generated: z.boolean().optional(),
    ai_consent_at: z.number().int().positive().optional(),
    ai_grounding_hash: z.string().min(1).max(128).optional(),
    ai_accepted_count: z.number().int().nonnegative().max(100).optional(),
    ai_dismissed_count: z.number().int().nonnegative().max(100).optional(),
    ai_recap_edited: z.boolean().optional(),
  })
  .refine(
    (v) =>
      v.title !== undefined ||
      v.question !== undefined ||
      v.anonymity !== undefined ||
      v.vote_policy !== undefined ||
      v.session_mode !== undefined ||
      v.ai_generated !== undefined ||
      v.ai_consent_at !== undefined ||
      v.ai_grounding_hash !== undefined ||
      v.ai_accepted_count !== undefined ||
      v.ai_dismissed_count !== undefined ||
      v.ai_recap_edited !== undefined,
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
export const AIQuestionSchema = z
  .object({
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
      .max(10),
  })
  .superRefine((q, ctx) => {
    if (['open', 'word_cloud', 'likert', 'slider'].includes(q.kind)) return
    if (q.options.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.too_small,
        origin: 'array',
        minimum: 2,
        inclusive: true,
        path: ['options'],
        message: 'At least 2 options are required for this question type',
      })
    }
  })

export const AIQuestionsOutputSchema = z.object({
  // The prompt asks for 3-5, and older deployed prompts may still produce
  // larger batches. Accept the range we can render without turning a
  // recoverable model variation into a 502 for the wizard.
  questions: z.array(AIQuestionSchema).min(3).max(10),
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
export type DuplicateSessionInput = z.infer<typeof DuplicateSessionSchema>
export type PatchSessionInput = z.infer<typeof PatchSessionSchema>

/** True when PATCH body only updates title (allowed for closed/archived). */
export function isPatchBodyTitleOnly(body: PatchSessionInput): boolean {
  return (
    body.title !== undefined &&
    body.question === undefined &&
    body.anonymity === undefined &&
    body.vote_policy === undefined &&
    body.session_mode === undefined &&
    body.ai_generated === undefined &&
    body.ai_consent_at === undefined &&
    body.ai_grounding_hash === undefined &&
    body.ai_accepted_count === undefined &&
      body.ai_dismissed_count === undefined &&
      body.ai_recap_edited === undefined
  )
}
export type GenerateQuestionsInput = z.infer<typeof GenerateQuestionsSchema>
export type AIQuestionInput = z.infer<typeof AIQuestionSchema>
export type AIQuestionsOutput = z.infer<typeof AIQuestionsOutputSchema>
export type ReorderQuestionsInput = z.infer<typeof ReorderQuestionsSchema>
export type AddQuestionInput = z.infer<typeof AddQuestionSchema>
export type SessionOptionsInput = z.infer<typeof SessionOptionsSchema>

// Journey event signals from the client (Sprint 19).
export const JourneyEventSchema = z.object({
  event: z.enum(['wizard.opened', 'wizard.completed', 'ai.suggestions_resolved', 'launchpad.opened']),
  sessionId: trimmed(1, 64).optional(),
  count: z.number().finite().optional(),
  value: z.number().finite().optional(),
  durationMs: z.number().finite().optional(),
})

// AI question refine input.
export const RefineQuestionsSchema = z.object({
  grounding: trimmed(1, 2000),
  feedback: trimmed(1, 800),
  previous_questions: z.array(z.unknown()).optional(),
})

// Billing subscription management.
export const BillingSubscriptionSchema = z
  .object({
    action: z.enum(['upgrade', 'downgrade', 'cancel']),
    priceId: z.string().min(1).max(255).optional(),
    subscriptionItemId: z.string().min(1).max(255).optional(),
  })
  .refine(
    (v) => v.action === 'cancel' || (v.priceId !== undefined && v.subscriptionItemId !== undefined),
    { message: 'priceId and subscriptionItemId are required for upgrade/downgrade' },
  )

// Template creation from a session.
export const CreateTemplateSchema = z.object({
  sessionId: trimmed(1, 64),
  name: trimmed(1, 120),
  description: z.string().max(400).optional(),
})

// Admin metrics export date range.
export const AdminMetricsExportSchema = z.object({
  start: z.string().datetime({ message: 'start must be ISO 8601' }),
  end: z.string().datetime({ message: 'end must be ISO 8601' }),
})

// Admin user create.
export const AdminCreateUserSchema = z.object({
  email: z.string().email(),
  display_name: z.string().max(120).optional(),
  plan: z.enum(['free', 'starter', 'team']).optional().default('free'),
  admin_role: z.enum(['admin', 'owner']).nullable().optional(),
})

// Admin user patch.
export const AdminPatchUserSchema = z
  .object({
    display_name: z.string().max(120).optional(),
    plan: z.enum(['free', 'starter', 'team']).optional(),
    admin_role: z.enum(['admin', 'owner']).nullable().optional(),
  })
  .refine(
    (v) => v.display_name !== undefined || v.plan !== undefined || v.admin_role !== undefined,
    { message: 'at least one field must be provided' },
  )
