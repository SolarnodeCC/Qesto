// STUDIO-SUGGEST-01 (S97) — authoring-time "next question" suggestions.
//
// After an operator drafts a question in the STUDIO authoring surface, embed the
// just-authored question text (bge-m3, 1024d) and query DECISIONS_VECTORIZE for
// semantically related historical sessions, then turn the closest matches into
// 1–3 schema-validated next-question DRAFTS the operator can accept.
//
// This is the authoring-time sibling of the LIVE facilitator co-pilot
// (lib/copilot-suggest.ts): same defensive discipline (sanitise input, Zod-
// validate output, deterministic graceful degradation), but the suggestion
// SOURCE is semantic similarity over past sessions rather than the live room
// snapshot, and there is NO generative model step — it is embedding + rank only.
//
// TENANT SAFETY (REV-27 / ADR-0045): DECISIONS_VECTORIZE is a CROSS-TENANT index
// (one vector per closed session, only metadata-filtered to a team when a
// `team_id` filter is supplied). User-visible suggestions could therefore leak
// another team's session titles if queried unfiltered. This module REQUIRES a
// `teamId` and always issues the Vectorize query with `filter: { team_id }`, so
// only the requesting team's own history can ever surface. The route verifies
// team membership before calling.
//
// The actual `c.env.AI.run(...)` embedding call is the only non-pure step; the
// prompt-free embedding + query is kept here and validation is pure/testable.

import { z } from 'zod'
import type { Env } from '../types'
import { sanitizeEmbedText } from './ai/prompt-sanitize'
import { firstEmbeddingVector } from './embedding'
import { withTimeout } from './shared/async'
import {
  DECISIONS_EMBED_MODEL,
  DECISIONS_EMBED_DIM,
  DECISIONS_EMBED_TIMEOUT_MS,
  DECISIONS_VECTORIZE_TIMEOUT_MS,
} from './insights-vectorize'
import type { AuthoringQuestionKind } from './studio-authoring'
import { ulid } from './ulid'

export type StudioSuggestBindings = Pick<Env, 'AI' | 'DECISIONS_VECTORIZE'>

/** Embedding model + dim are re-exported from the decisions pipeline so the
 *  embedding model ↔ index dimension invariant lives in exactly one place. */
export { DECISIONS_EMBED_MODEL, DECISIONS_EMBED_DIM }

/** Embedding model must emit vectors matching the qesto-decisions index (1024). */
// Asserted at module load — a mismatched constant must never reach the index.
if (DECISIONS_EMBED_DIM !== 1024) {
  throw new Error(
    `STUDIO-SUGGEST dimension invariant violated: DECISIONS_EMBED_DIM=${DECISIONS_EMBED_DIM}, expected 1024 (bge-m3)`,
  )
}

/** Pull at most this many candidate matches from Vectorize. */
export const SUGGEST_TOP_K = 5
/** Drop weak matches: only confident semantic neighbours become suggestions. */
export const SUGGEST_MIN_SCORE = 0.7
/** Hard cap on suggestions returned to the client (acceptance signal: 1–3). */
export const SUGGEST_MAX = 3
/** Bound the text fed to the embedding model. */
export const SUGGEST_EMBED_MAX_LEN = 1000

/** A single related historical session that anchors a suggestion. */
export type RelatedSession = { sessionId: string; title: string; score: number }

/**
 * A suggested next-question draft. Mirrors the AuthoringDraft shape so the client
 * can accept it through the same path it accepts /authoring/generate output, but
 * carries the anchoring session + similarity score for provenance.
 */
export const SuggestedDraftSchema = z.object({
  id: z.string().min(1),
  kind: z.literal('poll'),
  prompt: z.string().trim().min(1).max(240),
  options: z
    .array(z.object({ id: z.string().min(1), label: z.string().trim().min(1).max(160) }))
    .min(2)
    .max(10),
  /** Provenance: the historical session this suggestion was derived from. */
  source: z.object({
    sessionId: z.string().min(1),
    title: z.string().trim().min(1).max(200),
    score: z.number().min(0).max(1),
  }),
})
export type SuggestedDraft = z.infer<typeof SuggestedDraftSchema>

export type SuggestResult = {
  suggestions: SuggestedDraft[]
  /** Provenance marker: 'matches' when ≥1 neighbour was found, 'none' otherwise. */
  source: 'matches' | 'none'
}

export type SuggestInput = {
  /** Required for tenant scoping — the query is filtered to this team only. */
  teamId: string
  /** The just-authored question prompt the operator wants a follow-up for. */
  prompt: string
  /** Question kind (used only to bias copy; the suggestion is always a poll). */
  kind?: AuthoringQuestionKind | undefined
  /** Optional: exclude the current draft's anchor session from the results. */
  excludeSessionId?: string | undefined
}

function firstVector(result: unknown): number[] | undefined {
  return firstEmbeddingVector(result, DECISIONS_EMBED_DIM)
}

/** Build a deterministic, schema-shaped poll draft anchored on a related session. */
export function draftFromRelatedSession(related: RelatedSession): SuggestedDraft {
  const title = related.title.trim().slice(0, 200)
  const prompt = `Following up on "${title.slice(0, 200)}", which direction should we prioritise next?`.slice(
    0,
    240,
  )
  return {
    id: ulid(),
    kind: 'poll',
    prompt,
    options: [
      { id: ulid(), label: 'Keep the current approach' },
      { id: ulid(), label: 'Adjust based on recent feedback' },
      { id: ulid(), label: 'Explore a new direction' },
    ],
    source: { sessionId: related.sessionId, title, score: related.score },
  }
}

/**
 * Embed the authored question and query DECISIONS_VECTORIZE for related sessions
 * within the SAME team, returning up to SUGGEST_MAX validated next-question
 * drafts. Graceful degradation: empty embedding, empty/weak matches, or an AI/
 * Vectorize fault all resolve to `{ suggestions: [], source: 'none' }` rather
 * than throwing — the authoring surface always has a safe, empty result.
 */
export async function suggestNextQuestions(
  env: StudioSuggestBindings,
  input: SuggestInput,
): Promise<SuggestResult> {
  const empty: SuggestResult = { suggestions: [], source: 'none' }

  if (!input.teamId) return empty // tenant scope is mandatory — never query unfiltered
  const embedText = sanitizeEmbedText(input.prompt, SUGGEST_EMBED_MAX_LEN)
  if (!embedText) return empty

  // 1) Embed (Workers AI only) with an explicit timeout.
  let vector: number[] | undefined
  try {
    const embedResult = await withTimeout(
      env.AI.run(DECISIONS_EMBED_MODEL, { text: embedText }),
      DECISIONS_EMBED_TIMEOUT_MS,
      'Studio suggest embedding',
    )
    vector = firstVector(embedResult)
  } catch {
    return empty
  }
  if (!vector) return empty // dim mismatch / bad envelope → safe empty

  // 2) Query Vectorize — ALWAYS team-filtered for tenant safety (REV-27).
  let matches: Array<{ id?: string; score?: number; metadata?: Record<string, unknown> }>
  try {
    const queryResult = await withTimeout(
      env.DECISIONS_VECTORIZE.query(vector, {
        topK: SUGGEST_TOP_K,
        returnMetadata: 'all',
        filter: { team_id: input.teamId },
      }),
      DECISIONS_VECTORIZE_TIMEOUT_MS,
      'Studio suggest similarity query',
    )
    matches = queryResult.matches ?? []
  } catch {
    return empty
  }

  // 3) Rank + filter: drop the anchor session, drop weak matches, dedupe titles.
  const related: RelatedSession[] = []
  const seenTitles = new Set<string>()
  for (const m of matches) {
    const score = m.score ?? 0
    if (score < SUGGEST_MIN_SCORE) continue
    if (m.id && input.excludeSessionId && m.id === input.excludeSessionId) continue
    const meta = m.metadata as Record<string, unknown> | undefined
    const title = typeof meta?.title === 'string' ? meta.title.trim() : ''
    if (!title) continue
    const titleKey = title.toLowerCase()
    if (seenTitles.has(titleKey)) continue
    seenTitles.add(titleKey)
    related.push({ sessionId: m.id ?? ulid(), title, score })
    if (related.length >= SUGGEST_MAX) break
  }

  if (related.length === 0) return empty

  // 4) Build drafts + Zod-validate every one — never return unvalidated content.
  const suggestions: SuggestedDraft[] = []
  for (const r of related) {
    const parsed = SuggestedDraftSchema.safeParse(draftFromRelatedSession(r))
    if (parsed.success) suggestions.push(parsed.data)
  }

  return suggestions.length > 0
    ? { suggestions, source: 'matches' }
    : empty
}

// Exported for unit tests.
export const __internal = { firstVector, draftFromRelatedSession }
