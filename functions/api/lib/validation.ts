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

export const PatchSessionSchema = z
  .object({
    title: trimmed(1, 120).optional(),
    question: PollQuestionSchema.optional(),
  })
  .refine((v) => v.title !== undefined || v.question !== undefined, {
    message: 'at least one of { title, question } must be provided',
  })

export type PollOptionInput = z.infer<typeof PollOptionSchema>
export type PollQuestionInput = z.infer<typeof PollQuestionSchema>
export type CreateSessionInput = z.infer<typeof CreateSessionSchema>
export type PatchSessionInput = z.infer<typeof PatchSessionSchema>
