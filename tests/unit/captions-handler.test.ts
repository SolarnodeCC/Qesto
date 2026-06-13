// CAPTIONS-PIPELINE-01 (ADR-0051) — DO handler: locale routing, active-locale
// set (MT fan-out bound), degrade-to-source, presenter gating. No inference in
// the DO; the handler only fans out small text segments to the right sockets.

import { describe, expect, it } from 'vitest'
import { CaptionsHandler, type CaptionBroadcastPayload } from '../../functions/api/lib/session-room-captions-handler'
import { MockDurableObjectState, MockWebSocket } from '../helpers/do-mock'
import type { Attachment } from '../../functions/api/lib/session-room-types'
import type { CaptionLocalePref } from '../../functions/api/lib/captions-config'

function att(role: 'presenter' | 'voter', voterId: string, captionLocale?: CaptionLocalePref): Attachment {
  return { role, voterId, ipHash: 'h', bucket: { tokens: 10, lastAt: 0 }, ...(captionLocale ? { captionLocale } : {}) }
}

function connect(state: MockDurableObjectState, a: Attachment): MockWebSocket {
  const ws = new MockWebSocket()
  ws.serializeAttachment(a)
  state.acceptWebSocket(ws, [`role:${a.role}`, `voter:${a.voterId}`])
  return ws
}

// MockWebSocket implements the slice (send/serializeAttachment/deserializeAttachment)
// the handler uses; cast at the call boundary.
const asWs = (ws: MockWebSocket) => ws as unknown as WebSocket

function ctx() {
  const state = new MockDurableObjectState()
  const handler = new CaptionsHandler(state as never)
  return { state, handler }
}

const payload = (variants: CaptionBroadcastPayload['variants']): CaptionBroadcastPayload => ({
  id: 'seg-1',
  ts: 1000,
  isFinal: true,
  sourceLocale: 'en',
  sourceText: 'hello everyone',
  variants,
})

describe('CaptionsHandler.activeLocales — distinct set bounds MT fan-out', () => {
  it('returns the DISTINCT set of remote locales, excluding off and source-only duplicates', async () => {
    const { state, handler } = ctx()
    connect(state, att('voter', 'v1', 'nl'))
    connect(state, att('voter', 'v2', 'nl')) // duplicate nl — collapses
    connect(state, att('voter', 'v3', 'es'))
    connect(state, att('voter', 'v4', 'off')) // off — excluded
    connect(state, att('voter', 'v5')) // no pref — excluded
    expect(handler.activeLocales().sort()).toEqual(['es', 'nl'])
  })

  it('is empty when every participant reads source / off (MT skipped entirely)', () => {
    const { state, handler } = ctx()
    connect(state, att('voter', 'v1', 'off'))
    connect(state, att('voter', 'v2'))
    expect(handler.activeLocales()).toEqual([])
  })
})

describe('CaptionsHandler.broadcast — per-socket locale routing', () => {
  it('addresses each socket the variant for ITS chosen locale; off gets nothing', () => {
    const { state, handler } = ctx()
    const nl = connect(state, att('voter', 'v1', 'nl'))
    const es = connect(state, att('voter', 'v2', 'es'))
    const en = connect(state, att('voter', 'v3', 'en')) // source
    const off = connect(state, att('voter', 'v4', 'off'))

    handler.broadcast(payload({ nl: 'hallo iedereen', es: 'hola a todos' }))

    expect(nl.messages()).toHaveLength(1)
    expect((nl.messages()[0] as { data: { lang: string; text: string } }).data).toMatchObject({
      lang: 'nl',
      text: 'hallo iedereen',
    })
    expect((es.messages()[0] as { data: { lang: string; text: string } }).data).toMatchObject({
      lang: 'es',
      text: 'hola a todos',
    })
    // source-locale socket gets the source text labelled source locale.
    expect((en.messages()[0] as { data: { lang: string; text: string } }).data).toMatchObject({
      lang: 'en',
      text: 'hello everyone',
    })
    // 'off' socket receives no caption.
    expect(off.messages()).toHaveLength(0)
  })

  it('degrades an UNENABLED pair to source-language captions (never errors)', () => {
    const { state, handler } = ctx()
    // nl-source -> de is NOT in CAPTION_PAIR_ENABLED; a de participant on an
    // nl-source session must fall back to the nl source text.
    const de = connect(state, att('voter', 'v1', 'de'))
    handler.broadcast({
      id: 'seg-2',
      ts: 2000,
      isFinal: true,
      sourceLocale: 'nl',
      sourceText: 'goedemorgen',
      variants: {}, // no de variant produced (pair disabled)
    })
    const msg = de.messages()[0] as { data: { lang: string; text: string } }
    expect(msg.data).toMatchObject({ lang: 'nl', text: 'goedemorgen' })
  })

  it('a single segment translated for 3 active locales is NOT re-translated per participant', () => {
    const { state, handler } = ctx()
    // 5 sockets, 2 distinct remote locales — broadcast addresses, no inference here.
    for (const v of ['a', 'b', 'c']) connect(state, att('voter', v, 'nl'))
    for (const v of ['d', 'e']) connect(state, att('voter', v, 'es'))
    handler.broadcast(payload({ nl: 'hallo', es: 'hola' }))
    // Every socket got exactly one message in its own locale.
    const all = state.getWebSockets()
    expect(all.every((ws) => ws.messages().length === 1)).toBe(true)
  })
})

describe('CaptionsHandler — presenter gating + state', () => {
  it('lets the presenter start captions and records source locale', async () => {
    const { state, handler } = ctx()
    const ws = connect(state, att('presenter', 'host'))
    await handler.handleStart(asWs(ws), att('presenter', 'host'), { sourceLocale: 'en' })
    expect(await handler.getState()).toEqual({ active: true, sourceLocale: 'en' })
  })

  it('rejects a non-presenter starting captions', async () => {
    const { state, handler } = ctx()
    const ws = connect(state, att('voter', 'v1'))
    await handler.handleStart(asWs(ws), att('voter', 'v1'), { sourceLocale: 'en' })
    expect(await handler.getState()).toBeNull()
    expect((ws.messages()[0] as { data: { code: string } }).data.code).toBe('forbidden')
  })

  it('rejects an unsupported source locale', async () => {
    const { state, handler } = ctx()
    const ws = connect(state, att('presenter', 'host'))
    await handler.handleStart(asWs(ws), att('presenter', 'host'), { sourceLocale: 'jp' })
    expect(await handler.getState()).toBeNull()
  })

  it('set_locale persists the pref on the socket attachment', async () => {
    const { state, handler } = ctx()
    const ws = connect(state, att('voter', 'v1'))
    await handler.handleSetLocale(asWs(ws), att('voter', 'v1'), { locale: 'es' })
    expect((ws.deserializeAttachment() as Attachment).captionLocale).toBe('es')
    // and it now counts toward the active-locale set.
    expect(handler.activeLocales()).toEqual(['es'])
  })

  it('set_locale rejects an unsupported locale', async () => {
    const { state, handler } = ctx()
    const ws = connect(state, att('voter', 'v1'))
    await handler.handleSetLocale(asWs(ws), att('voter', 'v1'), { locale: 'jp' })
    expect((ws.deserializeAttachment() as Attachment).captionLocale).toBeUndefined()
  })
})
