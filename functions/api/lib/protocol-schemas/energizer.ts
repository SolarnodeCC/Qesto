// Proof-aware decoders for energizer configs and energizer records.

import { z } from 'zod'

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
