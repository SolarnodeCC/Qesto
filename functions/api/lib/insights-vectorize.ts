/**
 * Decision session embedding + Vectorize similarity/upsert (WS3).
 * Side-effect helpers for insights analyze; metrics stay in the route.
 */

import type { Env } from '../types'
import { sanitizeEmbedText } from './ai/prompt-sanitize'
import { validateData, AiBatchEmbeddingResponseSchema } from './protocol-schemas'
import { withTimeout } from './shared/async'

export type InsightsVectorizeBindings = Pick<Env, 'AI' | 'DECISIONS_VECTORIZE'>

export const DECISIONS_EMBED_MODEL = '@cf/baai/bge-m3' as const
export const DECISIONS_EMBED_DIM = 1024 // bge-m3 outputs 1024 dims — must match the qesto-decisions index
export const DECISIONS_SIMILARITY_TOP_K = 3
export const DECISIONS_SIMILARITY_MIN_SCORE = 0.75
export const DECISIONS_EMBED_TIMEOUT_MS = 10_000
export const DECISIONS_VECTORIZE_TIMEOUT_MS = 5_000

function vectorMiss(): number[] | undefined {
  return [][0] as number[] | undefined
}

function firstVector(result: unknown): number[] | undefined {
  // Validate envelope with Zod, but return the original vector reference.
  // This avoids accidental copying and keeps behavior stable for callers/tests.
  const validated = validateData(result, AiBatchEmbeddingResponseSchema)
  if (!validated) return vectorMiss()
  const raw = result as { data?: unknown }
  const first = Array.isArray(raw.data) ? raw.data[0] : undefined
  if (!Array.isArray(first) || first.length !== DECISIONS_EMBED_DIM) return vectorMiss()
  return first.every((v) => typeof v === 'number') ? (first as number[]) : vectorMiss()
}


/** Embed title + snippet of open answers; query Vectorize for similar past sessions. */
export async function embedAndFindSimilarSessionTitles(
  env: InsightsVectorizeBindings,
  params: { sessionId: string; sessionTitle: string; openResponses: string[] },
): Promise<{ vector?: number[]; similarSessionTitles: string[] }> {
  const embedText = sanitizeEmbedText(
    `${params.sessionTitle}: ${params.openResponses.slice(0, 10).join('. ')}`,
  )
  if (!embedText) return { similarSessionTitles: [] }

  const embedResult = await withTimeout(
    env.AI.run(DECISIONS_EMBED_MODEL, { text: embedText }),
    DECISIONS_EMBED_TIMEOUT_MS,
    'Decision embedding',
  )
  const vector = firstVector(embedResult)
  if (!vector) {
    return { similarSessionTitles: [] }
  }

  const queryResult = await withTimeout(
    env.DECISIONS_VECTORIZE.query(vector, {
      topK: DECISIONS_SIMILARITY_TOP_K,
      returnMetadata: 'all',
    }),
    DECISIONS_VECTORIZE_TIMEOUT_MS,
    'Decision similarity query',
  )
  const similarSessionTitles: string[] = []
  const matches = queryResult.matches.filter(
    (m) => m.id !== params.sessionId && (m.score ?? 0) > DECISIONS_SIMILARITY_MIN_SCORE,
  )
  for (const match of matches) {
    const meta = match.metadata as Record<string, string> | undefined
    if (meta?.title) similarSessionTitles.push(meta.title)
  }
  return { vector, similarSessionTitles }
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
