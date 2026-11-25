/**
 * KB-RAG-01 — agent grounding snippets from DECISIONS_VECTORIZE (ADR-0018).
 *
 * TENANT SAFETY (audit #4): `qesto-decisions` is a CROSS-TENANT index — one
 * vector per closed session for the whole platform. A `teamId` is therefore
 * REQUIRED, and the scope is enforced twice:
 *   1. `filter: { team_id }` on the query — server-side, cheap.
 *   2. a post-query check on `metadata.team_id` — authoritative, and still
 *      correct when the metadata index is missing (metadata indexes are not
 *      retroactive; see audit #13).
 * Callers must verify the caller's membership of that team BEFORE calling.
 */
import type { Env } from '../types'
import { runAI } from './ai/ai-gateway'
import { sanitizeEmbedText } from './ai/prompt-sanitize'
import { firstEmbeddingVector } from './embedding'
import { DECISIONS_EMBED_DIM, DECISIONS_EMBED_MODEL } from './insights-vectorize'

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
  teamId?: string | null,
): Promise<GroundingChunk[]> {
  // No tenant scope ⇒ no cross-tenant read. Fail closed rather than querying
  // the whole platform's decision memory.
  if (!teamId) return []

  const sanitized = sanitizeEmbedText(query, 500)
  if (!sanitized) return []

  const embedResult = await runAI(env as Env, DECISIONS_EMBED_MODEL, { text: sanitized })
  const vector = firstEmbeddingVector(embedResult, DECISIONS_EMBED_DIM)
  if (!vector) return []

  const matches = await env.DECISIONS_VECTORIZE.query(vector, {
    topK,
    // Vectorize v2 takes the string form; the legacy boolean throws (audit #8).
    returnMetadata: 'all',
    filter: { team_id: teamId },
  })

  const out: GroundingChunk[] = []
  for (const m of matches.matches ?? []) {
    // The metadata keys are the ones upsertInsightsSessionVector actually
    // writes: session_id / title / team_id. The previous code read `.text` and
    // `.sessionId`, which are never written, so every chunk fell back to the
    // raw vector id (audit #9).
    const meta = m.metadata as { session_id?: string; title?: string; team_id?: string } | undefined
    if (meta?.team_id !== teamId) continue
    const title = typeof meta.title === 'string' ? meta.title : ''
    if (!title) continue
    const chunk: GroundingChunk = {
      id: String(m.id),
      score: m.score ?? 0,
      text: title,
    }
    const sessionId = meta.session_id ?? (typeof m.id === 'string' ? m.id : undefined)
    if (sessionId) chunk.sessionId = sessionId
    out.push(chunk)
  }
  return out
}
