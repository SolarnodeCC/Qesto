/**
 * Shared Workers AI embedding + Vectorize query primitives (ADR-0068 adjacent).
 *
 * Both `lib/insights-vectorize.ts` and `lib/help-vectorize.ts` (and future
 * indices) embed text with bge-m3 then query a Vectorize index with a timeout.
 * That transport boilerplate (sanitize → ai.run → firstEmbeddingVector →
 * index.query under withTimeout) lived duplicated in each file; it now lives
 * here. Index-specific constants, score thresholds, metadata shaping and filters
 * stay in the callers.
 */
import type { Env } from '../../types'
import { sanitizeEmbedText } from './prompt-sanitize'
import { firstEmbeddingVector } from '../embedding'
import { withTimeout } from '../shared/async'

type AiBinding = Env['AI']
type VectorizeBinding = Env['DECISIONS_VECTORIZE']

/**
 * Sanitize `rawText`, embed it with `model`, and return the first vector of
 * dimension `dim`. Returns `undefined` when the text is empty after sanitisation
 * or the embedding has no usable vector.
 */
export async function embedVector(
  ai: AiBinding,
  model: string,
  dim: number,
  rawText: string,
  timeoutMs: number,
  label: string,
  maxLen?: number,
): Promise<number[] | undefined> {
  const text = maxLen === undefined ? sanitizeEmbedText(rawText) : sanitizeEmbedText(rawText, maxLen)
  if (!text) return undefined
  const result = await withTimeout(ai.run(model, { text }), timeoutMs, label)
  return firstEmbeddingVector(result, dim)
}

/**
 * Query a Vectorize index with `topK` (+ optional metadata `filter`) under a
 * timeout, always requesting full metadata. Returns the raw matches array.
 */
export async function queryVectors(
  index: VectorizeBinding,
  vector: number[],
  options: { topK: number; filter?: Record<string, string> },
  timeoutMs: number,
  label: string,
): Promise<Awaited<ReturnType<VectorizeBinding['query']>>['matches']> {
  const result = await withTimeout(
    index.query(vector, {
      topK: options.topK,
      returnMetadata: 'all',
      ...(options.filter ? { filter: options.filter } : {}),
    }),
    timeoutMs,
    label,
  )
  return result.matches
}
