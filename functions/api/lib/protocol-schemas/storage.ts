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

// Full customer-template shape. Zod strips unknown keys on parse, so this
// schema MUST cover every persisted field — the previous minimal version
// silently deleted description/category/version/options each time a record
// was read back and re-written (pipeline audit MKTP-003 blast radius).
export const CustomerTemplateSchema = z.object({
  id: z.string(),
  type: z.literal('customer').default('customer'),
  userId: z.string().optional(),
  name: z.string(),
  description: z.string().default(''),
  category: z.string().default('custom'),
  topic: z.string().default('customer'),
  previewAlt: z.string().default(''),
  questions: z.array(z.object({
    kind: z.string(),
    prompt: z.string(),
    options: z.array(z.object({ id: z.string(), label: z.string() })).default([]),
  })),
  createdAt: z.number().optional(),
  scope: z.enum(['personal', 'team', 'organization']).optional(),
  ownedByTeamId: z.string().optional(),
  version: z.number().optional(),
  parentId: z.string().optional(),
  updatedAt: z.number().optional(),
  archivedAt: z.number().optional(),
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
