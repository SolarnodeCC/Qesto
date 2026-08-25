// Proof-aware decoders for boundary crossings using Zod.
// All data from network, storage, or KV must be validated before casting.
//
// Split out of the 963-line protocol-schemas.ts (issue #687). That file is now a
// re-export barrel, so every existing import path keeps working unchanged.

import { z } from 'zod'

// ── Common Route Parameter Validators ────────────────────────────────────────

export const SessionIdSchema = z.string().ulid()
export const TeamIdSchema = z.string().ulid()
export const UserIdSchema = z.string().ulid()
export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export type ValidPagination = z.infer<typeof PaginationSchema>

// ── Integration Token Validators ─────────────────────────────────────────────

export const StoredTokenSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string().optional(),
  expires_in: z.number().optional(),
  token_type: z.string().optional(),
  scope: z.string().optional(),
  stored_at: z.number(),
  expires_at: z.number().optional(),
})

export type ValidStoredToken = z.infer<typeof StoredTokenSchema>

// Generic KV validator: parse and optionally validate with a schema
export function validateKvJson<T>(
  raw: string | null,
  schema?: z.ZodSchema<T>,
): T | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (schema) {
      return schema.parse(parsed)
    }
    return parsed as T
  } catch {
    return null
  }
}

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

// ── Cache & Rate Limit Validators ───────────────────────────────────────────

export const RateLimitCounterSchema = z.object({
  count: z.number().int().nonnegative(),
  resetAt: z.number(),
})

export type ValidRateLimitCounter = z.infer<typeof RateLimitCounterSchema>

export const CachedDataSchema = z.object({
  data: z.unknown(),
  expires_at: z.number(),
})

export type ValidCachedData = z.infer<typeof CachedDataSchema>
