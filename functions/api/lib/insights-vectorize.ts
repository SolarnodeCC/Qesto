/**
 * Decision session embedding + Vectorize similarity/upsert (WS3).
 * Side-effect helpers for insights analyze; metrics stay in the route.
 */

import type { Env } from '../types'

export type InsightsVectorizeBindings = Pick<Env, 'AI' | 'DECISIONS_VECTORIZE'>

export const DECISIONS_EMBED_MODEL = '@cf/baai/bge-m3' as const
export const DECISIONS_EMBED_DIM = 768
export const DECISIONS_SIMILARITY_TOP_K = 3
export const DECISIONS_SIMILARITY_MIN_SCORE = 0.75

function firstVector(result: unknown): number[] | undefined {
  const data = (result as { data?: number[][] })?.data?.[0]
  return data?.length === DECISIONS_EMBED_DIM ? data : undefined
}

/** Embed title + snippet of open answers; query Vectorize for similar past sessions. */
export async function embedAndFindSimilarSessionTitles(
  env: InsightsVectorizeBindings,
  params: { sessionId: string; sessionTitle: string; openResponses: string[] },
): Promise<{ vector?: number[]; similarSessionTitles: string[] }> {
  const embedText = `${params.sessionTitle}: ${params.openResponses.slice(0, 10).join('. ')}`
  const embedResult = await env.AI.run(DECISIONS_EMBED_MODEL, { text: embedText })
  const vector = firstVector(embedResult)
  if (!vector) {
    return { similarSessionTitles: [] }
  }

  const queryResult = await env.DECISIONS_VECTORIZE.query(vector, {
    topK: DECISIONS_SIMILARITY_TOP_K,
    returnMetadata: 'all',
  })
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

/** Upsert this session into Vectorize for future similarity search. Reuses embedding when provided. */
export async function upsertInsightsSessionVector(
  env: InsightsVectorizeBindings,
  params: {
    sessionId: string
    sessionTitle: string
    themeCount: number
    existingVector?: number[]
  },
): Promise<void> {
  let vector = params.existingVector
  if (!vector) {
    const upsertEmbedResult = await env.AI.run(DECISIONS_EMBED_MODEL, { text: params.sessionTitle })
    vector = firstVector(upsertEmbedResult)
  }
  if (!vector) return

  await env.DECISIONS_VECTORIZE.upsert([
    {
      id: params.sessionId,
      values: vector,
      metadata: {
        session_id: params.sessionId,
        title: params.sessionTitle,
        ts: String(Date.now()),
        theme_count: String(params.themeCount),
      },
    },
  ])
}
