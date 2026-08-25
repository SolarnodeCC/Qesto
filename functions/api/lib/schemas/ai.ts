// Proof-aware decoders for boundary crossings using Zod.
// All data from network, storage, or KV must be validated before casting.
//
// Split out of the 963-line protocol-schemas.ts (issue #687). That file is now a
// re-export barrel, so every existing import path keeps working unchanged.

import { z } from 'zod'

// ── Insights Cache Validators ───────────────────────────────────────────────────

export const InsightThemeSchema = z.object({
  theme: z.string(),
  count: z.number().int().nonnegative(),
  examples: z.array(z.string()).min(0).max(8),
})

export type ValidInsightTheme = z.infer<typeof InsightThemeSchema>

export const CachedInsightsSchema = z.object({
  themes: z.array(InsightThemeSchema),
  trend: z.object({
    '7d': z.number(),
    '30d': z.number(),
  }),
  cached_at: z.number(),
})

export type ValidCachedInsights = z.infer<typeof CachedInsightsSchema>

// ── AI & Vector Validators ───────────────────────────────────────────────────

export const AiEmbeddingResponseSchema = z.object({
  data: z.array(z.number()),
})

export type ValidAiEmbeddingResponse = z.infer<typeof AiEmbeddingResponseSchema>

export const AiBatchEmbeddingResponseSchema = z.object({
  data: z.array(z.array(z.number())).optional(),
})

export type ValidAiBatchEmbeddingResponse = z.infer<typeof AiBatchEmbeddingResponseSchema>

export const VectorMetadataSchema = z.record(z.string(), z.unknown())

export type ValidVectorMetadata = z.infer<typeof VectorMetadataSchema>

// ── AI coaching response (Workers AI JSON boundary) ─────────────────────────

export const CoachingAiResponseSchema = z.object({
  headline: z.string().min(1),
  bullets: z.array(z.string()).min(1),
  confidence: z.number().min(0).max(1).optional(),
  followUps: z.array(z.string()).max(3).optional(),
})

export type ValidCoachingAiResponse = z.infer<typeof CoachingAiResponseSchema>
