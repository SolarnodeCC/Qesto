/**
 * Decision session embedding + Vectorize similarity/upsert (WS3).
 * Side-effect helpers for insights analyze; metrics stay in the route.
 */

import type { Env } from '../types'
import { sanitizeEmbedText } from './ai/prompt-sanitize'
import { firstEmbeddingVector } from './embedding'
import { withTimeout } from './shared/async'

export type InsightsVectorizeBindings = Pick<Env, 'AI' | 'DECISIONS_VECTORIZE'>

export const DECISIONS_EMBED_MODEL = '@cf/baai/bge-m3' as const
export const DECISIONS_EMBED_DIM = 1024 // bge-m3 outputs 1024 dims — must match the qesto-decisions index
export const DECISIONS_SIMILARITY_TOP_K = 3
export const DECISIONS_SIMILARITY_MIN_SCORE = 0.75
export const DECISIONS_EMBED_TIMEOUT_MS = 10_000
export const DECISIONS_VECTORIZE_TIMEOUT_MS = 5_000

function firstVector(result: unknown): number[] | undefined {
  return firstEmbeddingVector(result, DECISIONS_EMBED_DIM)
}


export type SimilarSession = { title: string; score: number }

/**
 * Embed title + snippet of open answers; query Vectorize for similar past sessions.
 *
 * Tenant safety (REV-27): `similarSessionTitles` only ever feeds the AI prompt.
 * The user-visible `similarSessions` list is populated ONLY when `teamId` is
 * provided, in which case the query is metadata-filtered to that team — titles
 * from other tenants can never surface in a response payload.
 */
export async function embedAndFindSimilarSessionTitles(
  env: InsightsVectorizeBindings,
  params: { sessionId: string; sessionTitle: string; openResponses: string[]; teamId?: string | null },
): Promise<{ vector?: number[]; similarSessionTitles: string[]; similarSessions: SimilarSession[] }> {
  const embedText = sanitizeEmbedText(
    `${params.sessionTitle}: ${params.openResponses.slice(0, 10).join('. ')}`,
  )
  if (!embedText) return { similarSessionTitles: [], similarSessions: [] }

  const embedResult = await withTimeout(
    env.AI.run(DECISIONS_EMBED_MODEL, { text: embedText }),
    DECISIONS_EMBED_TIMEOUT_MS,
    'Decision embedding',
  )
  const vector = firstVector(embedResult)
  if (!vector) {
    return { similarSessionTitles: [], similarSessions: [] }
  }

  const queryResult = await withTimeout(
    env.DECISIONS_VECTORIZE.query(vector, {
      topK: DECISIONS_SIMILARITY_TOP_K,
      returnMetadata: 'all',
      ...(params.teamId ? { filter: { team_id: params.teamId } } : {}),
    }),
    DECISIONS_VECTORIZE_TIMEOUT_MS,
    'Decision similarity query',
  )
  const similarSessionTitles: string[] = []
  const similarSessions: SimilarSession[] = []
  const matches = queryResult.matches.filter(
    (m) => m.id !== params.sessionId && (m.score ?? 0) > DECISIONS_SIMILARITY_MIN_SCORE,
  )
  for (const match of matches) {
    const meta = match.metadata as Record<string, string> | undefined
    if (!meta?.title) continue
    similarSessionTitles.push(meta.title)
    if (params.teamId) {
      similarSessions.push({ title: meta.title, score: match.score ?? 0 })
    }
  }
  return { vector, similarSessionTitles, similarSessions }
}

/**
 * Upsert this session into Vectorize for future similarity search. Reuses embedding
 * when provided. Returns true when a vector was written.
 *
 * ADR-0045: when `teamId` is supplied the vector is tagged with `team_id` (and
 * `closed_at`) metadata so cross-session clustering can run as a metadata-filtered
 * `query(vector, { filter: { team_id } })` over a team's recent embeddings — no
 * separate clustering index. Zero-knowledge sessions must never reach this path.
 */
export async function upsertInsightsSessionVector(
  env: InsightsVectorizeBindings,
  params: {
    sessionId: string
    sessionTitle: string
    themeCount: number
    existingVector?: number[]
    teamId?: string | null
    closedAt?: number
  },
): Promise<boolean> {
  let vector = params.existingVector
  if (!vector) {
    const title = sanitizeEmbedText(params.sessionTitle, 500)
    if (!title) return false
    const upsertEmbedResult = await withTimeout(
      env.AI.run(DECISIONS_EMBED_MODEL, { text: title }),
      DECISIONS_EMBED_TIMEOUT_MS,
      'Decision upsert embedding',
    )
    vector = firstVector(upsertEmbedResult)
  }
  if (!vector) return false

  const metadata: Record<string, string> = {
    session_id: params.sessionId,
    title: params.sessionTitle,
    ts: String(Date.now()),
    theme_count: String(params.themeCount),
  }
  if (params.teamId) metadata.team_id = params.teamId
  if (params.closedAt !== undefined) metadata.closed_at = String(params.closedAt)

  await withTimeout(
    env.DECISIONS_VECTORIZE.upsert([
      {
        id: params.sessionId,
        values: vector,
        metadata,
      },
    ]),
    DECISIONS_VECTORIZE_TIMEOUT_MS,
    'Decision vector upsert',
  )
  return true
}

export const __internal = { firstVector, withTimeout }
