/**
 * Draft types for AI-CONTEXT-01 — see knowledge-base/architecture/AI_CONTEXT_SPEC.md
 */
import type { Anonymity, PlanTier } from '../../types'

export type SessionAIContext = {
  sessionId: string
  teamId: string | null
  plan: PlanTier
  anonymity: Anonymity
  locale: string
  model: string
  promptVersion: string
}

export type AIOverride = Partial<Pick<SessionAIContext, 'model' | 'promptVersion' | 'locale'>>

export type AIPipelineResult<T> =
  | { ok: true; data: T; model: string; durationMs: number }
  | { ok: false; code: 'ai_unavailable' | 'ai_timeout' | 'ai_rate_limited'; message: string }
