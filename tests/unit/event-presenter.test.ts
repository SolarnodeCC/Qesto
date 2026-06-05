import { describe, expect, it } from 'vitest'
import {
  applyPresenterPut,
  normalizeSlideDeckUrl,
  resolveActiveSlot,
} from '../../functions/api/lib/event-presenter'
import { defaultEventPresenter, type AgendaTrack, type LinkedSessionInfo } from '../../functions/api/lib/event-agenda'

const tracks: AgendaTrack[] = [
  {
    id: 't1',
    label: 'Main',
    day: 'Day 1',
    order: 0,
    slots: [
      { id: 's1', title: 'Opening', sessionId: 'sess1', order: 0 },
      { id: 's2', title: 'Keynote', sessionId: 'sess2', order: 1 },
    ],
  },
]

function sessionsMap(entries: Array<[string, Partial<LinkedSessionInfo>]>): Map<string, LinkedSessionInfo> {
  const map = new Map<string, LinkedSessionInfo>()
  for (const [id, partial] of entries) {
    map.set(id, {
      id,
      code: 'ABC123',
      title: partial.title ?? id,
      status: partial.status ?? 'draft',
      sessionMode: partial.sessionMode ?? 'townhall',
      joinPath: `/th/ABC123`,
    })
  }
  return map
}

describe('normalizeSlideDeckUrl', () => {
  it('converts Google Slides edit URL to embed', () => {
    expect(
      normalizeSlideDeckUrl('https://docs.google.com/presentation/d/abc123/edit?usp=sharing'),
    ).toBe('https://docs.google.com/presentation/d/abc123/embed')
  })

  it('rejects non-https URLs', () => {
    expect(normalizeSlideDeckUrl('http://example.com/slides')).toBeNull()
  })
})

describe('resolveActiveSlot', () => {
  it('uses explicit activeSlotId when set', () => {
    const slot = resolveActiveSlot(tracks, sessionsMap([]), { ...defaultEventPresenter(), activeSlotId: 's2' })
    expect(slot?.slotId).toBe('s2')
    expect(slot?.slotTitle).toBe('Keynote')
  })

  it('falls back to first live session slot', () => {
    const slot = resolveActiveSlot(
      tracks,
      sessionsMap([
        ['sess1', { status: 'draft' }],
        ['sess2', { status: 'live', title: 'Live keynote' }],
      ]),
      defaultEventPresenter(),
    )
    expect(slot?.slotId).toBe('s2')
    expect(slot?.session?.title).toBe('Live keynote')
  })
})

describe('applyPresenterPut', () => {
  it('updates slide deck and active slot', () => {
    const next = applyPresenterPut(defaultEventPresenter(), {
      slideDeckUrl: 'https://docs.google.com/presentation/d/x/edit',
      activeSlotId: 's1',
    })
    expect(next.activeSlotId).toBe('s1')
    expect(next.slideDeckUrl).toContain('/embed')
  })
})
