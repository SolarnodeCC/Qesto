/**
 * Shared embedding envelope validation for all Vectorize paths (REV-37).
 *
 * Every index (DECISIONS/HELP/KB) uses 1024-dim bge-m3 vectors; this replaces
 * the per-file copies of the same envelope check.
 */
import { validateData, AiBatchEmbeddingResponseSchema } from './protocol-schemas'

export const BGE_M3_EMBED_DIM = 1024

/**
 * Validate a Workers AI batch-embedding response and return the first vector.
 * Validates the envelope with Zod but returns the original vector reference —
 * avoids accidental copying and keeps behavior stable for callers/tests.
 */
export function firstEmbeddingVector(result: unknown, dim: number = BGE_M3_EMBED_DIM): number[] | undefined {
  const validated = validateData(result, AiBatchEmbeddingResponseSchema)
  if (!validated) return undefined
  const raw = result as { data?: unknown }
  const first = Array.isArray(raw.data) ? raw.data[0] : undefined
  if (!Array.isArray(first) || first.length !== dim) return undefined
  return first.every((v) => typeof v === 'number') ? (first as number[]) : undefined
}
