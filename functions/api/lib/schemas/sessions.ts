// Proof-aware decoders for boundary crossings using Zod.
// All data from network, storage, or KV must be validated before casting.
//
// Split out of the 963-line protocol-schemas.ts (issue #687). That file is now a
// re-export barrel, so every existing import path keeps working unchanged.

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

// ── Energizer Config Validators ──────────────────────────────────────────────

export const EmojiPollConfigSchema = z.object({
  emojis: z.array(z.string()),
})

export type ValidEmojiPollConfig = z.infer<typeof EmojiPollConfigSchema>

export const QuickFingerConfigSchema = z.object({
  options: z.array(z.string()),
  correct_index: z.number(),
})

export type ValidQuickFingerConfig = z.infer<typeof QuickFingerConfigSchema>

export const TeamQuizQuestionSchema = z.object({
  prompt: z.string(),
  options: z.array(z.string()),
  correct_index: z.number(),
})

export const TeamQuizConfigSchema = z.object({
  questions: z.array(TeamQuizQuestionSchema),
  current_index: z.number(),
})

export type ValidTeamQuizConfig = z.infer<typeof TeamQuizConfigSchema>

export const WordCloudConfigSchema = z.object({
  max_words_per_participant: z.number(),
})

export type ValidWordCloudConfig = z.infer<typeof WordCloudConfigSchema>

export const BattleRoyaleConfigSchema = z.object({
  num_rounds: z.number(),
  participants: z.array(z.string()),
  scoring_multiplier: z.number(),
  elimination_threshold: z.number(),
})

export type ValidBattleRoyaleConfig = z.infer<typeof BattleRoyaleConfigSchema>

export const BracketConfigSchema = z.object({
  bracket_size: z.union([z.literal(4), z.literal(8), z.literal(16)]),
  participants: z.array(z.string()),
  match_format: z.union([z.literal('single_elimination'), z.literal('double_elimination')]),
})

export type ValidBracketConfig = z.infer<typeof BracketConfigSchema>

// Permissive envelope: proves the value is a non-null object without
// checking kind-specific fields. Kind-specific validation must be done
// separately via the per-kind schemas above.
export const EnergizerConfigEnvelopeSchema = z.record(z.string(), z.unknown())

export type ValidEnergizerConfigEnvelope = z.infer<typeof EnergizerConfigEnvelopeSchema>

// ── Energizer Validators ────────────────────────────────────────────────────

export const EnergizerSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  kind: z.enum(['quick_finger', 'team_quiz', 'emoji_poll', 'word_cloud']),
  prompt: z.string().min(1),
  state: z.enum(['draft', 'active', 'completed']),
  createdAt: z.number().positive(),
})

export type ValidEnergizer = z.infer<typeof EnergizerSchema>
