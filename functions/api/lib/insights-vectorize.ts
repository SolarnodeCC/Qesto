/**
 * Decision session embedding + Vectorize similarity/upsert (WS3).
 * Side-effect helpers for insights analyze; metrics stay in the route.
 */

import type { Env } from '../types'
import { withTimeout } from './shared/async'
import { embedVector, queryVectors } from './ai/embed-query'

export type InsightsVectorizeBindings = Pick<Env, 'AI' | 'DECISIONS_VECTORIZE'>

export const DECISIONS_EMBED_MODEL = '@cf/baai/bge-m3' as const
export const DECISIONS_EMBED_DIM = 1024 // bge-m3 outputs 1024 dims — must match the qesto-decisions index
export const DECISIONS_SIMILARITY_TOP_K = 3
export const DECISIONS_SIMILARITY_MIN_SCORE = 0.75
export const DECISIONS_EMBED_TIMEOUT_MS = 10_000
export const DECISIONS_VECTORIZE_TIMEOUT_MS = 5_000

export type SimilarSession = { title: string; score: number }

/**
 * Embed title + snippet of open answers; query Vectorize for similar past sessions.
 *
 * Tenant safety (REV-27, tightened by audit #3): `qesto-decisions` holds one
 * vector per closed session across ALL tenants. The similarity query therefore
 * runs ONLY when a `teamId` scopes it. Without one the query is skipped
 * entirely — previously it ran unfiltered and the resulting foreign session
 * titles were fed to the insights prompt as "Similar past sessions for
 * additional context". Prompt input is still disclosure: nothing stops the
 * model from echoing a title into a generated theme.
 *
 * Two layers enforce the scope, because a Vectorize metadata filter only works
 * when a metadata index exists on the property (and such indexes are not
 * retroactive — see audit #13):
 *   1. `filter: { team_id }` on the query — cheap, server-side.
 *   2. A post-query check that every match actually carries that `team_id` —
 *      authoritative, and correct even if the index is missing.
 *
 * The embedding is still produced when `teamId` is absent: callers reuse it for
 * `upsertInsightsSessionVector`, which is a write and carries no leak.
 */
export async function embedAndFindSimilarSessionTitles(
  env: InsightsVectorizeBindings,
  params: { sessionId: string; sessionTitle: string; openResponses: string[]; teamId?: string | null },
): Promise<{ vector?: number[]; similarSessionTitles: string[]; similarSessions: SimilarSession[] }> {
  const vector = await embedVector(
    env,
    DECISIONS_EMBED_MODEL,
    DECISIONS_EMBED_DIM,
    `${params.sessionTitle}: ${params.openResponses.slice(0, 10).join('. ')}`,
    DECISIONS_EMBED_TIMEOUT_MS,
    'Decision embedding',
  )
  if (!vector) {
    return { similarSessionTitles: [], similarSessions: [] }
  }

  // No tenant scope ⇒ no cross-tenant read. The vector is still returned so the
  // caller can reuse it for the upsert.
  const teamId = params.teamId
  if (!teamId) {
    return { vector, similarSessionTitles: [], similarSessions: [] }
  }

  const matches = (
    await queryVectors(
      env.DECISIONS_VECTORIZE,
      vector,
      { topK: DECISIONS_SIMILARITY_TOP_K, filter: { team_id: teamId } },
      DECISIONS_VECTORIZE_TIMEOUT_MS,
      'Decision similarity query',
    )
  ).filter((m) => m.id !== params.sessionId && (m.score ?? 0) > DECISIONS_SIMILARITY_MIN_SCORE)
  const similarSessionTitles: string[] = []
  const similarSessions: SimilarSession[] = []
  for (const match of matches) {
    const meta = match.metadata as Record<string, string> | undefined
    if (!meta?.title) continue
    // Defence in depth: never trust the server-side filter alone.
    if (meta.team_id !== teamId) continue
    similarSessionTitles.push(meta.title)
    similarSessions.push({ title: meta.title, score: match.score ?? 0 })
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
    vector = await embedVector(
      env,
      DECISIONS_EMBED_MODEL,
      DECISIONS_EMBED_DIM,
      params.sessionTitle,
      DECISIONS_EMBED_TIMEOUT_MS,
      'Decision upsert embedding',
      500,
    )
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

export const __internal = { withTimeout }
