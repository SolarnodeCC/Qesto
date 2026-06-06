/**
 * Proof-aware decoders for trust-boundary crossings (KV, D1 JSON columns, HTTP bodies).
 * Parse as unknown first, then narrow with Zod — never cast parse results directly.
 */
import { z } from 'zod'

export function parseJsonString<T>(schema: z.ZodType<T>, raw: string): T | null {
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return null
  }
  const result = schema.safeParse(value)
  return result.success ? result.data : null
}

export function parseJsonValue<T>(schema: z.ZodType<T>, value: unknown): T | null {
  const result = schema.safeParse(value)
  return result.success ? result.data : null
}

/** Theme labels stored in insights_daily.themes_json. */
export const InsightThemeEntrySchema = z.object({
  theme: z.string().optional(),
})

export const InsightThemesJsonSchema = z.array(InsightThemeEntrySchema)

export const CachedThemeLabelsSchema = z.object({
  themes: z.array(z.string()),
})

export const RetroHealthThemeSchema = z.object({
  kind: z.literal('retro_health'),
  wentWell: z.number(),
  didntGoWell: z.number(),
  actions: z.number(),
  totalCards: z.number(),
})

export const WorkspaceParticipationPointSchema = z.object({
  instanceSeq: z.number(),
  sessionId: z.string(),
  closedAt: z.number(),
  responseCount: z.number(),
})

export const WorkspaceTeamHealthPointSchema = z.object({
  instanceSeq: z.number(),
  sessionId: z.string(),
  closedAt: z.number(),
  moodScore: z.number(),
  mood: z.enum(['positive', 'neutral', 'concerning']),
  participation: z.number(),
  wentWell: z.number(),
  didntGoWell: z.number(),
  actions: z.number(),
})

export const WorkspaceTrendPayloadSchema = z.object({
  instanceCount: z.number(),
  points: z.array(WorkspaceParticipationPointSchema).optional(),
  message: z.string().optional(),
})

export const WorkspaceTeamHealthPayloadSchema = z.object({
  instanceCount: z.number(),
  points: z.array(WorkspaceTeamHealthPointSchema).optional(),
  message: z.string().optional(),
})

export const WorkspaceTrendUnionSchema = z.union([
  WorkspaceTrendPayloadSchema,
  WorkspaceTeamHealthPayloadSchema,
])

export const RetroWorkspaceTemplateSchema = z.object({
  dotVoteLimit: z.number().optional(),
})

export const IdeateWorkspaceTemplateSchema = z.object({
  dotVoteLimit: z.number().optional(),
  clusterDebounceMs: z.number().optional(),
})

export const OgImageColorSchema = z.enum(['teal', 'purple', 'orange'])

export const AIGatewayJsonResponseSchema = z.object({
  result: z.unknown().optional(),
  cached: z.boolean().optional(),
  cache_age: z.number().optional(),
})

export const KbVectorMetadataSchema = z.object({
  doc_id: z.string(),
  chunk_id: z.string(),
  type: z.enum(['adr', 'spec', 'guide', 'runbook', 'experiment', 'unknown']),
  domain: z.string(),
  // jankurai:allow HLT-001-DEAD-MARKER reason=external-kb-status-enum expires=2027-06-01
  status: z.enum(['draft', 'proposed', 'accepted', 'deprecated']),
  tags: z.array(z.string()),
  heading_path: z.string(),
})
