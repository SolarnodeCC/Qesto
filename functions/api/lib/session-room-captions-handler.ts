/**
 * session-room-captions-handler.ts — CAPTIONS-PIPELINE-01 (ADR-0051 §2/§3).
 *
 * The DO's caption surface. It does NO inference (ASR/MT run off the DO, in the
 * stateless ingest route, ADR-0051 §3). The DO only:
 *   - tracks presenter caption state (active + source locale) in storage,
 *   - stores each socket's chosen caption locale on its attachment,
 *   - exposes the DISTINCT-active-locale set (derived from live socket
 *     attachments) so the ingest route bounds MT fan-out (§2),
 *   - broadcasts a `caption_segment` to each socket in THAT socket's chosen
 *     variant (source or a translated locale), addressing — never per-participant
 *     inference.
 *
 * Audio/transcript are never received here and never persisted. The DO sees only
 * small typed text segments to fan out.
 */
import { LIVE_PROTOCOL_VERSION_V3 } from '../realtime'
import type { Attachment } from './session-room-types'
import {
  type CaptionLocale,
  type CaptionLocalePref,
  isCaptionLocale,
  isCaptionLocalePref,
  resolveDeliveryLocale,
} from './captions-config'

/** Presenter-set caption state, persisted in DO storage (transient broadcast meta only). */
export type CaptionState = {
  active: boolean
  sourceLocale: CaptionLocale
}

const K_CAPTIONS = 'captions:state'

/** Assembled segment the ingest route hands to the DO: source text + per-locale variants. */
export type CaptionBroadcastPayload = {
  id: string
  ts: number
  isFinal: boolean
  sourceLocale: CaptionLocale
  /** Source-language text (always present). */
  sourceText: string
  /** Translated variants by target locale (only enabled, distinct active remote locales). */
  variants: Partial<Record<CaptionLocale, string>>
}

interface StorageContext {
  storage: {
    get<T>(key: string): Promise<T | undefined>
    put<T>(key: string, value: T): Promise<void>
  }
  getWebSockets(tag?: string): WebSocket[]
}

function serverMsg(msg: object): string {
  return JSON.stringify({ v: LIVE_PROTOCOL_VERSION_V3, ...msg })
}

export class CaptionsHandler {
  constructor(private readonly ctx: StorageContext) {}

  async getState(): Promise<CaptionState | null> {
    return (await this.ctx.storage.get<CaptionState>(K_CAPTIONS)) ?? null
  }

  /** Presenter turns captions on with a fixed source locale (presenter-gated upstream). */
  async handleStart(ws: WebSocket, att: Attachment, data: { sourceLocale: string }): Promise<void> {
    if (att.role !== 'presenter') {
      ws.send(this.err('forbidden', 'Only the presenter can start captions'))
      return
    }
    if (!isCaptionLocale(data.sourceLocale)) {
      ws.send(this.err('validation', 'Unsupported source locale'))
      return
    }
    await this.ctx.storage.put<CaptionState>(K_CAPTIONS, {
      active: true,
      sourceLocale: data.sourceLocale,
    })
  }

  /** Presenter turns captions off. */
  async handleStop(ws: WebSocket, att: Attachment): Promise<void> {
    if (att.role !== 'presenter') {
      ws.send(this.err('forbidden', 'Only the presenter can stop captions'))
      return
    }
    const state = await this.getState()
    if (state) {
      await this.ctx.storage.put<CaptionState>(K_CAPTIONS, { ...state, active: false })
    }
  }

  /**
   * Participant chooses a caption locale (or 'off'). A free read-side preference
   * (not plan-gated). Persisted on the socket attachment so it survives DO
   * hibernation and feeds the distinct-active-locale set.
   */
  async handleSetLocale(ws: WebSocket, att: Attachment, data: { locale: string }): Promise<void> {
    if (!isCaptionLocalePref(data.locale)) {
      ws.send(this.err('validation', 'Unsupported caption locale'))
      return
    }
    const next: Attachment = { ...att, captionLocale: data.locale }
    ws.serializeAttachment(next)
  }

  /**
   * The DISTINCT set of caption locales across connected sockets (excluding
   * 'off'). Derived live from socket attachments — the single source of truth,
   * no separate persisted set to drift. The ingest route reads this to translate
   * once per distinct active locale (ADR-0051 §2).
   */
  activeLocales(): CaptionLocale[] {
    const set = new Set<CaptionLocale>()
    for (const ws of this.ctx.getWebSockets()) {
      const att = ws.deserializeAttachment() as Attachment | null
      const pref = att?.captionLocale
      if (pref && pref !== 'off' && isCaptionLocale(pref)) set.add(pref)
    }
    return [...set]
  }

  /**
   * Broadcast an assembled segment. Each socket receives the variant matching its
   * chosen `captionLocale`: 'off' → nothing; an enabled remote locale → its
   * translated text; anything else (incl. unenabled pairs) → source text
   * (degrade-to-source). `lang`/`text` are already in the recipient's locale.
   */
  broadcast(payload: CaptionBroadcastPayload): void {
    const { sourceLocale, sourceText, variants } = payload
    for (const ws of this.ctx.getWebSockets()) {
      const att = ws.deserializeAttachment() as Attachment | null
      const pref: CaptionLocalePref = att?.captionLocale ?? 'off'
      const deliver = resolveDeliveryLocale(sourceLocale, pref)
      if (deliver === null) continue // 'off' — no caption for this socket
      const text = deliver === sourceLocale ? sourceText : variants[deliver] ?? sourceText
      const lang = variants[deliver] !== undefined && deliver !== sourceLocale ? deliver : sourceLocale
      try {
        ws.send(
          serverMsg({
            type: 'caption_segment',
            data: { id: payload.id, ts: payload.ts, lang, text, isFinal: payload.isFinal },
            timestamp: Date.now(),
          }),
        )
      } catch {
        /* socket closed mid-broadcast — ignore */
      }
    }
  }

  private err(code: string, message: string): string {
    return JSON.stringify({ type: 'error', data: { code, message }, timestamp: Date.now() })
  }
}
