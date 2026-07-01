/**
 * KB-RAG-01 — agent grounding snippets from DECISIONS_VECTORIZE (ADR-0018).
 */
import type { Env } from '../types'
import { runAI } from './ai/ai-gateway'
import { sanitizeEmbedText } from './ai/prompt-sanitize'
import { DECISIONS_EMBED_DIM, DECISIONS_EMBED_MODEL } from './insights-vectorize'

function firstVector(result: unknown): number[] | undefined {
  const data = (result as { data?: number[][] })?.data?.[0]
  return data?.length === DECISIONS_EMBED_DIM ? data : undefined
}

export type GroundingChunk = {
  id: string
  score: number
  text: string
  sessionId?: string
}

export async function queryDecisionGrounding(
  env: Pick<Env, 'AI' | 'DECISIONS_VECTORIZE'>,
  query: string,
  topK = 5,
): Promise<GroundingChunk[]> {
  const sanitized = sanitizeEmbedText(query, 500)
  if (!sanitized) return []

  const embedResult = await runAI(env as Env, DECISIONS_EMBED_MODEL, { text: sanitized })
  const vector = firstVector(embedResult)
  if (!vector) return []
  const matches = await env.DECISIONS_VECTORIZE.query(vector, { topK, returnMetadata: true })
  return (matches.matches ?? []).map((m) => {
    const sessionId = (m.metadata as { sessionId?: string } | undefined)?.sessionId
    const chunk: GroundingChunk = {
      id: String(m.id),
      score: m.score ?? 0,
      text: String((m.metadata as { text?: string } | undefined)?.text ?? m.id),
    }
    if (sessionId) chunk.sessionId = sessionId
    return chunk
  })
}
