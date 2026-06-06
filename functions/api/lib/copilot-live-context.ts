import { absent } from './absent'
/**
 * COPILOT-01 — live-context snapshot for the facilitator copilot (ADR-0046).
 *
 * The `SessionRoom` DO exposes an aggregate, PII-free read at
 * `GET /copilot/snapshot`. This module validates that response and shapes it
 * into the context the copilot panel and (later) the suggestion engine consume.
 * Everything here is aggregate-only — no per-voter identifiers ever appear.
 */
import { z } from 'zod'

/** Shape of the DO `/copilot/snapshot` response `data` payload. */
export const CopilotSnapshotSchema = z.object({
  status: z.string(),
  currentQuestion: z
    .object({
      id: z.string(),
      kind: z.string(),
      prompt: z.string(),
      optionCount: z.number().int().nonnegative(),
    })
    .nullable(),
  responseCount: z.number().int().nonnegative(),
  voterCount: z.number().int().nonnegative(),
  participationRate: z.number().min(0).max(1),
  connections: z.number().int().nonnegative(),
  mood: z
    .object({
      mood: z.enum(['positive', 'neutral', 'concerning']),
      sampleSize: z.number().int().nonnegative(),
    })
    .nullable(),
})

export type CopilotSnapshot = z.infer<typeof CopilotSnapshotSchema>

export type CopilotLiveContext = {
  schemaVersion: 1
  sessionId: string
  isLive: boolean
  currentQuestion: { id: string; kind: string; prompt: string; optionCount: number } | null
  responseCount: number
  participantCount: number
  participationRate: number
  mood: 'positive' | 'neutral' | 'concerning' | null
  moodSampleSize: number
  generatedAt: number
}

/**
 * Parse a DO `/copilot/snapshot` response body. Returns the validated snapshot
 * or null when the body is missing/invalid (caller degrades gracefully).
 */
function snapshotMiss(): CopilotSnapshot | null {
  return absent()
}

export function parseSnapshotResponse(body: unknown): CopilotSnapshot | null {
  const envelope = body as { ok?: boolean; data?: unknown } | null
  if (!envelope?.ok) return snapshotMiss()
  const parsed = CopilotSnapshotSchema.safeParse(envelope.data)
  return parsed.success ? parsed.data : snapshotMiss()
}

/**
 * Shape a DO snapshot into the PII-free live context for the copilot. A live
 * session is one whose DO status is `live` or `energizing`.
 */
export function buildLiveContext(
  sessionId: string,
  snapshot: CopilotSnapshot,
  now: number = Date.now(),
): CopilotLiveContext {
  const isLive = snapshot.status === 'live' || snapshot.status === 'energizing'
  return {
    schemaVersion: 1,
    sessionId,
    isLive,
    currentQuestion: snapshot.currentQuestion,
    responseCount: snapshot.responseCount,
    participantCount: snapshot.voterCount,
    participationRate: snapshot.participationRate,
    mood: snapshot.mood?.mood ?? null,
    moodSampleSize: snapshot.mood?.sampleSize ?? 0,
    generatedAt: now,
  }
}

/** Context returned when the session has no live DO (draft/closed/archived). */
export function emptyLiveContext(sessionId: string, now: number = Date.now()): CopilotLiveContext {
  return {
    schemaVersion: 1,
    sessionId,
    isLive: false,
    currentQuestion: null,
    responseCount: 0,
    participantCount: 0,
    participationRate: 0,
    mood: null,
    moodSampleSize: 0,
    generatedAt: now,
  }
}
