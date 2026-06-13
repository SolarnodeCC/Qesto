/**
 * captions-pipeline.ts — CAPTIONS-PIPELINE-01 orchestration (ADR-0051 §1).
 *
 * Pure, model-agnostic assembly of one caption segment from one audio chunk:
 *   audio → ASR (transcribeAudio) → conditional MT (translateText) once per
 *   distinct ENABLED remote target locale → { source text + per-locale variants }.
 *
 * The fan-out-once discipline (§2) lives here: MT is called exactly once per
 * distinct active remote locale (never per participant), and skipped entirely
 * when no remote locale is active. An unenabled source→target pair is dropped
 * from the variant map so the DO degrades it to source captions.
 *
 * No audio or transcript is persisted — the audio buffer is the caller's
 * request-scoped argument and is dropped when this returns.
 */
import type { Env } from '../types'
import { transcribeAudio, translateText } from './ai/captions-ai'
import { type CaptionLocale, mtTargetsFor } from './captions-config'
import type { CaptionBroadcastPayload } from './session-room-captions-handler'

export type AssembleSegmentInput = {
  audio: number[] | Uint8Array
  sourceLocale: CaptionLocale
  /** Distinct active caption locales across connected sockets (from the DO). */
  activeLocales: CaptionLocale[]
  /** Stable segment id; a partial and its finalization share it. */
  id: string
  /** Segment start time (unix ms). */
  ts: number
  /** false = partial (source-only, low latency); true = finalized (translated). */
  isFinal: boolean
}

export type AssembleSegmentResult =
  | { ok: true; payload: CaptionBroadcastPayload }
  | { ok: false; reason: 'asr_unavailable' | 'empty' }

/**
 * Run ASR then conditional MT and assemble the broadcast payload.
 *
 * - ASR null (breaker open / invalid output / empty) → `asr_unavailable`
 *   (caller degrades to "captions paused" for this chunk, no broadcast).
 * - Partials (isFinal:false) are source-only — MT is skipped to keep latency low
 *   (ADR-0051 §2 partial-vs-final, implementation-tunable).
 * - Finals translate once per distinct ENABLED remote locale; a failed/breaker-open
 *   MT call drops that variant so the DO degrades it to source.
 */
export async function assembleSegment(
  env: Env,
  input: AssembleSegmentInput,
): Promise<AssembleSegmentResult> {
  const transcript = await transcribeAudio(env, input.audio)
  if (!transcript) return { ok: false, reason: 'asr_unavailable' }

  const sourceText = transcript.text
  const variants: Partial<Record<CaptionLocale, string>> = {}

  // Fan-out once per distinct ENABLED remote locale — only for finalized segments.
  if (input.isFinal) {
    const targets = mtTargetsFor(input.sourceLocale, input.activeLocales)
    for (const target of targets) {
      const translated = await translateText(env, sourceText, input.sourceLocale, target)
      // null (breaker open / invalid) → drop variant → DO degrades to source.
      if (translated) variants[target] = translated.text
    }
  }

  return {
    ok: true,
    payload: {
      id: input.id,
      ts: input.ts,
      isFinal: input.isFinal,
      sourceLocale: input.sourceLocale,
      sourceText,
      variants,
    },
  }
}
