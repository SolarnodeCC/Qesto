/**
 * captions.ts — CAPTIONS-PIPELINE-01 ingest route (ADR-0051 §3).
 *
 * POST /api/sessions/:id/captions/ingest
 *   The ONLY audio entry point. Presenter-authed + planMiddleware + the
 *   `liveCaptions` (Team-tier) entitlement. Runs OFF the SessionRoom DO:
 *     audio chunk → ASR → conditional MT (once per distinct active remote locale)
 *     → push the assembled segment into the DO for broadcast
 *     → 202 { ok, data: { id, isFinal }, trace_id }
 *
 *   Privacy moat (ADR-0051 §6): no external fetch, no audio/transcript persisted.
 *   The audio bytes are a request-scoped buffer dropped when the handler returns;
 *   nothing is written to D1/KV/R2, and only trace ids + timing reach AE — never
 *   transcript text.
 */
import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import { planMiddleware, type PlanVariables } from '../middleware/plan'
import { featureAllowed, denyFeature } from '../lib/entitlements'
import { fetchSession } from './sessions/shared'
import { requireFound } from '../lib/session-lifecycle'
import { errorResponse } from '../lib/error-handler'
import { getSessionRoomStub } from './sessions/shared'
import { assembleSegment } from '../lib/captions-pipeline'
import { isCaptionLocale, type CaptionLocale } from '../lib/captions-config'
import { ulid } from '../lib/ulid'
import { writeEvent } from '../lib/observability'
import { logEvent } from '../lib/log'
import type { Env } from '../types'
import type { ParentApp } from './parent-app'

type Vars = AuthVariables & PlanVariables

// Segment metadata travels as query params (the body is the raw audio chunk).
// `seq` is the monotonic chunk index; `final` marks a finalized (translatable)
// segment vs an in-flight partial. `id` lets a partial and its finalization share
// a segment id (overlay replaces in place); minted server-side when absent.
const MetaSchema = z.object({
  sourceLocale: z.enum(['en', 'nl', 'es', 'de', 'fr']),
  seq: z.coerce.number().int().nonnegative(),
  final: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  id: z.string().min(1).max(64).optional(),
})

// Upper bound on a single chunk (~1–2s Opus/webm ≈ tens of KB; cap well above).
const MAX_AUDIO_BYTES = 2_000_000

export function mountCaptionRoutes(parent: ParentApp) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()
  app.use('*', authMiddleware)
  app.use('*', planMiddleware)

  app.post('/sessions/:id/captions/ingest', async (c) => {
    const trace_id = c.get('trace_id')
    const user = c.get('user')
    const id = c.req.param('id')
    const startMs = Date.now()

    // Plan gate (ADR-0051 §5): liveCaptions is Team-tier; enforced at ingest.
    if (!featureAllowed(c.get('planQuotas'), 'liveCaptions')) {
      return c.json({ ok: false, error: denyFeature(c.get('plan'), 'liveCaptions'), trace_id }, 403)
    }

    // Presenter ownership: fetchSession scopes by owner_id, so only the host can ingest.
    const loaded = requireFound(await fetchSession(c.env.DB, id, user.sub))
    if (!loaded.ok) {
      return errorResponse(c, loaded.error.status, loaded.error.code, loaded.error.message)
    }

    const meta = MetaSchema.safeParse({
      sourceLocale: c.req.query('sourceLocale'),
      seq: c.req.query('seq'),
      final: c.req.query('final'),
      id: c.req.query('id'),
    })
    if (!meta.success) {
      return errorResponse(c, 400, 'validation', 'Invalid caption metadata')
    }
    const sourceLocale = meta.data.sourceLocale as CaptionLocale

    // Read the raw audio chunk into a request-scoped buffer (never persisted).
    const buf = await c.req.arrayBuffer()
    if (buf.byteLength === 0) {
      return errorResponse(c, 400, 'validation', 'Empty audio chunk')
    }
    if (buf.byteLength > MAX_AUDIO_BYTES) {
      return errorResponse(c, 413, 'payload_too_large', 'Audio chunk too large')
    }
    const audio = [...new Uint8Array(buf)]

    const segmentId = meta.data.id ?? ulid()
    const isFinal = meta.data.final === true

    // Read the distinct active caption-locale set from the DO to bound MT fan-out.
    const room = await getSessionRoomStub(c.env, id)
    let activeLocales: CaptionLocale[] = []
    try {
      const res = await room.fetch('https://do.internal/captions/active-locales')
      if (res.ok) {
        const body = (await res.json()) as { locales?: string[] }
        activeLocales = (body.locales ?? []).filter(isCaptionLocale)
      }
    } catch (err) {
      // DO unreachable → translate to nothing (source-only); never error the chunk.
      logEvent({ event: 'captions.active_locales_fault', traceId: trace_id, errorClass: err instanceof Error ? err.name : 'Unknown' })
    }

    const assembled = await assembleSegment(c.env, {
      audio,
      sourceLocale,
      activeLocales,
      id: segmentId,
      ts: Date.now(),
      isFinal,
    })

    if (!assembled.ok) {
      // ASR unavailable (breaker open / empty) — degrade to "captions paused";
      // 202 with a paused flag rather than erroring the session.
      writeEvent(c.env.METRICS_AE, { name: 'captions.asr_unavailable', sessionId: id, plan: c.get('plan') })
      return c.json({ ok: true, data: { id: segmentId, isFinal, paused: true }, trace_id }, 202)
    }

    // Push the assembled segment into the DO for locale-addressed broadcast.
    try {
      await room.fetch('https://do.internal/captions/broadcast', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(assembled.payload),
      })
    } catch (err) {
      logEvent({ event: 'captions.broadcast_fault', traceId: trace_id, errorClass: err instanceof Error ? err.name : 'Unknown' })
      return errorResponse(c, 502, 'broadcast_failed', 'Caption broadcast failed')
    }

    // AE: trace + timing + locale fan-out width only — NEVER transcript text.
    writeEvent(c.env.METRICS_AE, {
      name: 'captions.segment',
      sessionId: id,
      plan: c.get('plan'),
      detail: `final:${isFinal} locales:${activeLocales.length} ms:${Date.now() - startMs}`,
    })

    return c.json({ ok: true, data: { id: segmentId, isFinal }, trace_id }, 202)
  })

  parent.route('/api', app)
}
