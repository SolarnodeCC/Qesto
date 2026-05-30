import { z } from 'zod'

const LiveQuestionSchema = z.object({
  id: z.string(),
  kind: z.string(),
  prompt: z.string(),
  options: z.array(z.string()).optional(),
})

const LiveSessionSummarySchema = z.object({
  id: z.string(),
  code: z.string(),
  title: z.string(),
  status: z.string(),
})

const ServerEnvelopeSchema = z.object({
  type: z.string(),
  data: z.record(z.string(), z.unknown()),
})

export type ParsedServerEnvelope = z.infer<typeof ServerEnvelopeSchema>

export function parseServerEnvelope(raw: unknown): ParsedServerEnvelope | null {
  const envelope = ServerEnvelopeSchema.safeParse(raw)
  if (!envelope.success) return null
  return envelope.data
}

export const LIVE_PROTOCOL_V3 = 3

export function parseResultsDelta(data: Record<string, unknown>) {
  const questionId = typeof data.questionId === 'string' ? data.questionId : null
  const delta = data.delta
  if (!questionId || typeof delta !== 'object' || delta === null) return null
  return { questionId, delta: delta as Record<string, number> }
}

export function parseInitPayload(data: Record<string, unknown>) {
  const session = LiveSessionSummarySchema.safeParse(data.session)
  const role = z.enum(['presenter', 'voter']).safeParse(data.role)
  const voterId = z.string().safeParse(data.voterId)
  if (!session.success || !role.success || !voterId.success) return null
  return {
    session: session.data,
    role: role.data,
    voterId: voterId.data,
    question: data.question != null ? LiveQuestionSchema.safeParse(data.question).data ?? null : null,
    questionIndex: typeof data.questionIndex === 'number' ? data.questionIndex : 0,
    questionTotal: typeof data.questionTotal === 'number' ? data.questionTotal : 0,
    results: data.results as { counts: Record<string, number>; total: number },
    participants: typeof data.participants === 'number' ? data.participants : 0,
    energizer: data.energizer ?? null,
    sentiment: data.sentiment ?? null,
  }
}
