/**
 * AI-COPILOT-MULTITURN-01 — facilitator copilot turn history (S76, Workers AI only).
 */
import { z } from 'zod'

export const CopilotTurnSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().max(4000),
  at: z.number().int(),
})

export type CopilotTurn = z.infer<typeof CopilotTurnSchema>

export const CopilotThreadSchema = z.object({
  sessionId: z.string(),
  turns: z.array(CopilotTurnSchema).max(20),
  updatedAt: z.number().int(),
})

export type CopilotThread = z.infer<typeof CopilotThreadSchema>

export function copilotThreadKvKey(sessionId: string): string {
  return `copilot:thread:${sessionId}`
}

export function appendTurn(thread: CopilotThread, turn: CopilotTurn): CopilotThread {
  const turns = [...thread.turns, turn].slice(-20)
  return CopilotThreadSchema.parse({ ...thread, turns, updatedAt: Date.now() })
}
