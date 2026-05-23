/**
 * AI-RECAP-PROV-01 — provenance block for exports and insights surfaces.
 */
import type { Session } from '../../types'

export type AiRecapProvenance = {
  model: string | null
  generated_at: number | null
  host_edited: boolean
  prompt_version: string
  ai_generated: boolean
  consent_at: number | null
}

export function buildAiRecapProvenance(session: Session): AiRecapProvenance {
  const generatedAt = session.ai_consent_at ?? (session.ai_generated ? session.created_at : null)
  return {
    model: session.ai_recap_model ?? '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    generated_at: generatedAt,
    host_edited: (session.ai_recap_edited_at ?? 0) > 0,
    prompt_version: 'v1',
    ai_generated: session.ai_generated === 1,
    consent_at: session.ai_consent_at ?? null,
  }
}
