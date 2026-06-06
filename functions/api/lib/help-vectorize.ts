/**
 * Help document embedding + Vectorize similarity/upsert (Week 2).
 * Mirrors insights-vectorize.ts pattern for help knowledge base.
 */

import type { Env } from '../types'
import { sanitizeEmbedText } from './ai/prompt-sanitize'
import { validateData, AiBatchEmbeddingResponseSchema } from './protocol-schemas'
import { withTimeout } from './shared/async'

export type HelpVectorizeBindings = Pick<Env, 'AI' | 'HELP_VECTORIZE'>

export const HELP_EMBED_MODEL = '@cf/baai/bge-m3' as const
export const HELP_EMBED_DIM = 1024 // bge-m3 outputs 1024 dims — must match the qesto-help index
export const HELP_SIMILARITY_TOP_K = 3
export const HELP_SIMILARITY_MIN_SCORE = 0.70
export const HELP_EMBED_TIMEOUT_MS = 10_000
export const HELP_VECTORIZE_TIMEOUT_MS = 5_000

function firstVector(result: unknown): number[] | undefined {
  // Validate envelope with Zod, but return the original vector reference.
  const validated = validateData(result, AiBatchEmbeddingResponseSchema)
  if (!validated) return undefined
  const raw = result as { data?: unknown }
  const first = Array.isArray(raw.data) ? raw.data[0] : undefined
  if (!Array.isArray(first) || first.length !== HELP_EMBED_DIM) return undefined
  return first.every((v) => typeof v === 'number') ? (first as number[]) : undefined
}


export interface HelpDocument {
  id: string
  title: string
  content: string
  topic: string
  scope: string
}

export interface HelpQueryMatch {
  documentId: string
  title: string
  topic: string
  scope: string
  relevance: number
}

/** Embed user question; query Vectorize for similar help documents filtered by plan scope. */
export async function embedAndFindSimilarDocuments(
  env: HelpVectorizeBindings,
  params: {
    question: string
    userScope: 'free' | 'starter' | 'team'
  },
): Promise<{ vector?: number[]; similarDocuments: HelpQueryMatch[] }> {
  const question = sanitizeEmbedText(params.question)
  if (!question) return { similarDocuments: [] }

  const embedResult = await withTimeout(
    env.AI.run(HELP_EMBED_MODEL, { text: question }),
    HELP_EMBED_TIMEOUT_MS,
    'Help question embedding',
  )
  const vector = firstVector(embedResult)
  if (!vector) {
    return { similarDocuments: [] }
  }

  const queryResult = await withTimeout(
    env.HELP_VECTORIZE.query(vector, {
      topK: HELP_SIMILARITY_TOP_K,
      returnMetadata: 'all',
    }),
    HELP_VECTORIZE_TIMEOUT_MS,
    'Help document similarity query',
  )

  const similarDocuments: HelpQueryMatch[] = []
  const scopeHierarchy: Record<string, number> = { free: 0, starter: 1, team: 2 }
  const userScopeLevel = scopeHierarchy[params.userScope] || 2

  const matches = queryResult.matches.filter((m) => (m.score ?? 0) > HELP_SIMILARITY_MIN_SCORE)
  for (const match of matches) {
    const meta = match.metadata as Record<string, string> | undefined
    if (!meta?.document_id || !meta?.title) continue

    // Plan scope filtering: user can see docs <= their scope level
    const docScope = meta.scope as string
    const docScopeLevel = scopeHierarchy[docScope] ?? 2
    if (docScopeLevel > userScopeLevel) continue // Skip premium docs for free users

    similarDocuments.push({
      documentId: meta.document_id,
      title: meta.title,
      topic: meta.topic || 'general',
      scope: docScope,
      relevance: match.score ?? 0,
    })
  }

  return { vector, similarDocuments }
}

/** Upsert help document embedding into Vectorize for future similarity search. */
export async function upsertHelpVector(
  env: HelpVectorizeBindings,
  params: {
    documentId: string
    title: string
    topic: string
    scope: 'free' | 'starter' | 'team'
    content?: string
    existingVector?: number[]
  },
): Promise<void> {
  let vector = params.existingVector
  if (!vector) {
    const textToEmbed = sanitizeEmbedText(`${params.title} ${params.content?.substring(0, 500) || ''}`)
    if (!textToEmbed) return
    const upsertEmbedResult = await withTimeout(
      env.AI.run(HELP_EMBED_MODEL, { text: textToEmbed }),
      HELP_EMBED_TIMEOUT_MS,
      'Help document upsert embedding',
    )
    vector = firstVector(upsertEmbedResult)
  }
  if (!vector) return

  await withTimeout(
    env.HELP_VECTORIZE.upsert([
      {
        id: params.documentId,
        values: vector,
        metadata: {
          document_id: params.documentId,
          title: params.title,
          topic: params.topic,
          scope: params.scope,
        },
      },
    ]),
    HELP_VECTORIZE_TIMEOUT_MS,
    'Help document vector upsert',
  )
}

export const __internal = { firstVector, withTimeout }
