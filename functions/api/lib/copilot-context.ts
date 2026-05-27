/**
 * AI-401–AI-404 — copilot context schema for multi-turn facilitation (S71).
 */
import { z } from 'zod'

export const CopilotContextSchema = z.object({
  schemaVersion: z.literal(1),
  sessionId: z.string().min(1),
  sessionTitle: z.string().max(200),
  status: z.enum(['draft', 'energizing', 'live', 'closed', 'archived']),
  anonymity: z.enum(['full', 'partial', 'none', 'zero_knowledge']),
  questionCount: z.number().int().min(0),
  participantEstimate: z.number().int().min(0).optional(),
  pollHighlights: z
    .array(
      z.object({
        prompt: z.string(),
        topLabels: z.array(z.string()).max(5),
      }),
    )
    .max(10),
  facilitatorGoals: z.array(z.string().max(200)).max(5).optional(),
  locale: z.string().max(10).optional(),
  generatedAt: z.number().int(),
})

export type CopilotContext = z.infer<typeof CopilotContextSchema>

export function copilotContextKvKey(sessionId: string): string {
  return `copilot:ctx:${sessionId}`
}

export function buildCopilotContext(input: {
  sessionId: string
  sessionTitle: string
  status: CopilotContext['status']
  anonymity: CopilotContext['anonymity']
  questionCount: number
  pollHighlights?: CopilotContext['pollHighlights']
  facilitatorGoals?: string[]
  locale?: string
}): CopilotContext {
  return CopilotContextSchema.parse({
    schemaVersion: 1,
    sessionId: input.sessionId,
    sessionTitle: input.sessionTitle,
    status: input.status,
    anonymity: input.anonymity,
    questionCount: input.questionCount,
    pollHighlights: input.pollHighlights ?? [],
    facilitatorGoals: input.facilitatorGoals,
    locale: input.locale,
    generatedAt: Date.now(),
  })
}
