/**
 * Boundary decoders — safe wrappers for external data ingress.
 *
 * Every KV read or external JSON parse that previously used `JSON.parse(x) as T`
 * should route through one of these helpers so type safety is validated at runtime,
 * not just asserted at compile time.
 */
import { z } from 'zod'

/**
 * Parse a KV string value with a Zod schema. Returns null on any failure
 * (missing value, malformed JSON, schema mismatch) so callers only need
 * one null-check rather than try/catch + type-guard.
 */
export function decodeKvJson<T>(raw: string | null, schema: z.ZodSchema<T>): T | null {
  if (!raw) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  const result = schema.safeParse(parsed)
  return result.success ? result.data : null
}

/**
 * Parse a plain JavaScript object (e.g. from `DO.storage.get<unknown>()`)
 * with a Zod schema. Returns null on schema mismatch.
 */
export function decodeObject<T>(raw: unknown, schema: z.ZodSchema<T>): T | null {
  const result = schema.safeParse(raw)
  return result.success ? result.data : null
}

/**
 * Parse the body of an incoming HTTP request with a Zod schema.
 * Returns `{ ok: true, data }` or `{ ok: false, error }` — never throws.
 */
export async function decodeRequestBody<T>(
  req: Request,
  schema: z.ZodSchema<T>,
): Promise<{ ok: true; data: T } | { ok: false; error: z.ZodError }> {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    body = null
  }
  const result = schema.safeParse(body)
  if (result.success) return { ok: true, data: result.data }
  return { ok: false, error: result.error }
}

// ── Domain boundary schemas ────────────────────────────────────────────────
// Zod schemas for JSON payloads crossing trust boundaries (KV blobs, D1 JSON
// columns, vector metadata). Decode with `decodeKvJson` / `decodeObject`.

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

export const KbVectorMetadataSchema = z.object({
  doc_id: z.string(),
  chunk_id: z.string(),
  type: z.enum(['adr', 'spec', 'guide', 'runbook', 'experiment', 'unknown']),
  domain: z.string(),
  status: z.enum(['draft', 'proposed', 'accepted', 'deprecated']),
  tags: z.array(z.string()),
  heading_path: z.string(),
})
