// Proof-aware decoders for SAML, insights, AI/vector, webhook, and trace boundaries.

import { z } from 'zod'
import { TeamIdSchema } from './route-params'

// ── SAML Validators ──────────────────────────────────────────────────────────

export const SamlStateTokenSchema = z.object({
  teamId: z.string(),
  idpSsoUrl: z.string().url(),
  createdAt: z.number().optional(),
})

export type ValidSamlStateToken = z.infer<typeof SamlStateTokenSchema>

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

// ── Webhook Validators (HLT-031: input boundary crossing) ───────────────────

export const WebhookEventSchema = z.enum([
  'session.closed',
  'session.started',
  'session.energizer',
  'energizer.activated',
  'sentiment.threshold',
  'leaderboard.milestone',
])

export const WebhookConfigSchema = z.object({
  id: z.string().min(1),
  teamId: z.string().min(1),
  url: z.string().url(),
  secret: z.string().min(32),
  events: z.array(WebhookEventSchema).min(1),
  enabled: z.boolean(),
  createdAt: z.number().positive(),
  updatedAt: z.number().positive(),
  createdBy: z.string().min(1),
})

export type ValidWebhookConfig = z.infer<typeof WebhookConfigSchema>

export const WebhookPayloadSchema = z.object({
  event: WebhookEventSchema,
  timestamp: z.number().positive(),
  data: z.record(z.string(), z.unknown()),
})

export type ValidWebhookPayload = z.infer<typeof WebhookPayloadSchema>

// ── Integration Payload Validators ───────────────────────────────────────────

export const SlackIntegrationPayloadSchema = z.object({
  teamId: TeamIdSchema,
  webhookUrl: z.string().url(),
  events: z.array(z.string()).optional(),
  enabled: z.boolean().default(true),
})

export type ValidSlackIntegrationPayload = z.infer<typeof SlackIntegrationPayloadSchema>

// ── AI coaching response (Workers AI JSON boundary) ─────────────────────────

export const CoachingAiResponseSchema = z.object({
  headline: z.string().min(1),
  bullets: z.array(z.string()).min(1),
  confidence: z.number().min(0).max(1).optional(),
  followUps: z.array(z.string()).max(3).optional(),
})

export type ValidCoachingAiResponse = z.infer<typeof CoachingAiResponseSchema>

// ── Trace/Observability Validators ──────────────────────────────────────────

export const TraceContextSchema = z.object({
  trace_id: z.string().min(1),
  span_id: z.string().min(1).optional(),
  parent_span_id: z.string().min(1).optional(),
  sampled: z.boolean().optional(),
})

export type ValidTraceContext = z.infer<typeof TraceContextSchema>
