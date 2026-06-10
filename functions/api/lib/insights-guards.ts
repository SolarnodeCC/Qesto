// REV-06 — AI governance guard for insight generation.
//
// Applied by BOTH insights routes (legacy routes/insights.ts and
// routes/ai-insights/register-analyze.ts) before any AI call:
//
//  - zero_knowledge sessions never reach AI summarisation, consistent with
//    sentiment (ai/sentiment.ts) and the precompute path (sessions/shared.ts).
//  - AI-generated sessions require a recorded consent timestamp
//    (ai_consent_at) — the same rule the wizard preflight enforces at
//    creation time, re-checked here because insights can run hours later.

export type InsightsGuardInput = {
  anonymity?: string | null
  ai_generated?: number | null
  ai_consent_at?: number | null
}

export type InsightsGuardResult =
  | { allowed: true }
  | { allowed: false; code: 'zk_not_supported' | 'consent_required'; message: string }

export function checkInsightsAllowed(s: InsightsGuardInput): InsightsGuardResult {
  if (s.anonymity === 'zero_knowledge') {
    return {
      allowed: false,
      code: 'zk_not_supported',
      message: 'AI insights are disabled for zero-knowledge sessions',
    }
  }
  if ((s.ai_generated ?? 0) === 1 && !s.ai_consent_at) {
    return {
      allowed: false,
      code: 'consent_required',
      message: 'AI consent is required before insights can be generated for this session',
    }
  }
  return { allowed: true }
}

export const __internal = { checkInsightsAllowed }
