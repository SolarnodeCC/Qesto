// Anonymisation gate decisions for the session→template pipeline.
//
// These are the privacy-critical verdicts that decide whether a rewritten
// customer question is safe to publish to the public gallery. They are pure and
// deterministic so the fail-closed behaviour (pipeline audit MKTP-008) can be
// eval-tested without a live model: an unparseable or ambiguous AI verdict must
// NEVER admit a question, because the downside is leaking company- or
// person-identifying text onto public, search-indexed pages.

/** Similarity score (0-100) at or below which a rewrite is sufficiently generic. */
export const SIMILARITY_REJECT_THRESHOLD = 30

/** Parse the first JSON object/array from a model response, or null. */
export function parseJsonLoose(text: string): unknown {
  const match = text.match(/\{[\s\S]*\}/) ?? text.match(/\[[\s\S]*\]/)
  if (!match) return null
  try {
    return JSON.parse(match[0])
  } catch {
    return null
  }
}

/**
 * Extract a similarity score from the model's verdict. Fail-closed: an
 * unparseable or non-numeric verdict yields 100 (maximally similar → rejected),
 * never 0.
 */
export function parseSimilarityScore(response: string): number {
  const verdict = parseJsonLoose(response) as { score?: unknown } | null
  return typeof verdict?.score === 'number' ? verdict.score : 100
}

/** True if the rewrite is generic enough to keep (score at/below threshold). */
export function similarityGateAdmits(response: string): boolean {
  return parseSimilarityScore(response) <= SIMILARITY_REJECT_THRESHOLD
}

/**
 * True only when the NER verdict explicitly reports no proper nouns. Any other
 * outcome — proper nouns found, malformed JSON, missing field — rejects the
 * question (fail-closed).
 */
export function properNounGateAdmits(response: string): boolean {
  const verdict = parseJsonLoose(response) as { hasAny?: unknown } | null
  return verdict?.hasAny === false
}
