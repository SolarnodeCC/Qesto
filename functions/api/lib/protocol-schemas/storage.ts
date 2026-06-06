// Proof-aware decoders for persisted KV/D1 data, templates, caches, and tokens.

import { z } from 'zod'

// ── Database Result Validators ───────────────────────────────────────────────

// Loose poll option for parsing *already-persisted* KV/wire data. Distinct
// from domain-schemas' PollOptionInputSchema, which strictly validates inbound
// request payloads.
export const StoredPollOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
})

export type ValidPollOption = z.infer<typeof StoredPollOptionSchema>

export const PollOptionArraySchema = z.array(StoredPollOptionSchema)

export type ValidPollOptionArray = z.infer<typeof PollOptionArraySchema>

export const StringArraySchema = z.array(z.string())

export type ValidStringArray = z.infer<typeof StringArraySchema>

export const CachedQuestionsSchema = z.object({
  questions: z.unknown(),
  confidence: z.number().optional(),
})

export type ValidCachedQuestions = z.infer<typeof CachedQuestionsSchema>

// ── Template Validators ──────────────────────────────────────────────────────

export const TemplateIdArraySchema = z.array(z.string())

export type ValidTemplateIdArray = z.infer<typeof TemplateIdArraySchema>

export const CustomerTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  questions: z.array(z.object({
    id: z.string().optional(),
    position: z.number().optional(),
    kind: z.string(),
    prompt: z.string(),
    options_json: z.string().optional(),
  })),
})

export type ValidCustomerTemplate = z.infer<typeof CustomerTemplateSchema>

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
