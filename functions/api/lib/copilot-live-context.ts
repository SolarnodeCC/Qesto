/**
 * COPILOT-01 — live-context snapshot for the facilitator copilot (ADR-0046).
 *
 * The `SessionRoom` DO exposes an aggregate, PII-free read at
 * `GET /copilot/snapshot`. This module validates that response and shapes it
 * into the context the copilot panel and (later) the suggestion engine consume.
 * Everything here is aggregate-only — no per-voter identifiers ever appear.
 */
import { z } from 'zod'
import { readKvText, writeKvText, deleteKv } from './kv'

/**
 * AI-462 (S87) — copilot ↔ embed handoff bridge.
 *
 * When a copilot action changes the active question / session state in a session
 * that has a live embed widget, the embed's polling loop should learn about it on
 * its *next* poll rather than waiting a full interval. We do this with a tiny,
 * short-TTL KV flag (no new DO, no new WebSocket path): after a successful
 * copilot broadcast we set `embed:notify:{sessionId}` in SESSIONS_KV; the public
 * `GET /api/embed/v1/sessions/:idOrCode/state` handler reads + clears it and
 * surfaces `copilotChanged: true` so the widget refreshes immediately.
 */
export const EMBED_NOTIFY_TTL_SECONDS = 30

/** KV key for the per-session embed-refresh flag. */
export function embedNotifyKvKey(sessionId: string): string {
  return `embed:notify:${sessionId}`
}

/**
 * True when the session has at least one non-revoked embed widget config.
 * Lightweight COUNT — never selects PII.
 */
export async function sessionHasActiveEmbedWidget(
  db: D1Database,
  sessionId: string,
): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT 1 AS hit FROM embed_widgets WHERE session_id = ?1 AND revoked_at IS NULL LIMIT 1`,
    )
    .bind(sessionId)
    .first<{ hit: number }>()
  return !!row
}

/**
 * After a successful copilot broadcast, signal any live embed widget to refresh.
 * No-op when the session has no active embed widget or SESSIONS_KV is absent.
 * Fail-safe — a flag write must never block the copilot path.
 */
export async function notifyEmbedOfCopilotChange(
  env: { DB: D1Database; SESSIONS_KV?: KVNamespace },
  sessionId: string,
): Promise<boolean> {
  try {
    if (!env.SESSIONS_KV) return false
    if (!(await sessionHasActiveEmbedWidget(env.DB, sessionId))) return false
    await writeKvText(env.SESSIONS_KV, embedNotifyKvKey(sessionId), '1', {
      expirationTtl: EMBED_NOTIFY_TTL_SECONDS,
    })
    return true
  } catch {
    return false
  }
}

/**
 * Read-and-clear the embed-refresh flag for a session. Returns true exactly once
 * per copilot change (the flag is deleted on read). Fail-safe — defaults to
 * false on any error or missing KV.
 */
export async function consumeEmbedCopilotFlag(
  env: { SESSIONS_KV?: KVNamespace },
  sessionId: string,
): Promise<boolean> {
  try {
    if (!env.SESSIONS_KV) return false
    const key = embedNotifyKvKey(sessionId)
    const flag = await readKvText(env.SESSIONS_KV, key)
    if (!flag) return false
    await deleteKv(env.SESSIONS_KV, key)
    return true
  } catch {
    return false
  }
}

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
  optionTallies: z
    .array(z.object({ label: z.string(), votes: z.number().int().nonnegative() }))
    .optional(),
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
  connections: number
  optionTallies: { label: string; votes: number }[]
  mood: 'positive' | 'neutral' | 'concerning' | null
  moodSampleSize: number
  generatedAt: number
}

/**
 * Parse a DO `/copilot/snapshot` response body. Returns the validated snapshot
 * or null when the body is missing/invalid (caller degrades gracefully).
 */
export function parseSnapshotResponse(body: unknown): CopilotSnapshot | null {
  const envelope = body as { ok?: boolean; data?: unknown } | null
  if (!envelope?.ok) return null
  const parsed = CopilotSnapshotSchema.safeParse(envelope.data)
  return parsed.success ? parsed.data : null
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
    connections: snapshot.connections,
    optionTallies: snapshot.optionTallies ?? [],
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
    connections: 0,
    optionTallies: [],
    mood: null,
    moodSampleSize: 0,
    generatedAt: now,
  }
}
