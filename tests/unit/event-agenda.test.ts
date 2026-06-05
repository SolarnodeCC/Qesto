import { describe, expect, it } from 'vitest'
import { buildPublicAgenda, joinPathForMode, normalizeAgendaPut } from '../../functions/api/lib/event-agenda'

describe('event-agenda', () => {
  it('maps session modes to join paths', () => {
    expect(joinPathForMode('retro', 'ABC123')).toBe('/r/ABC123')
    expect(joinPathForMode('ideate', 'ABC123')).toBe('/i/ABC123')
    expect(joinPathForMode('townhall', 'ABC123')).toBe('/th/ABC123')
    expect(joinPathForMode('reflection', 'ABC123')).toBe('/j/ABC123')
  })

  it('builds public agenda for selected track', () => {
    const tracks = normalizeAgendaPut({
      tracks: [
        {
          label: 'Main',
          day: 'Day 1',
          order: 0,
          slots: [{ title: 'Keynote', order: 0, sessionId: 's1' }],
        },
        {
          label: 'Workshop',
          day: 'Day 1',
          order: 1,
          slots: [{ title: 'Breakout', order: 0, sessionId: 's2' }],
        },
      ],
    })
    const sessions = new Map([
      ['s1', { id: 's1', code: 'KEY001', title: 'Keynote', status: 'live', sessionMode: 'stage', joinPath: '/j/KEY001' }],
      ['s2', { id: 's2', code: 'BRK001', title: 'Breakout', status: 'draft', sessionMode: 'reflection', joinPath: '/j/BRK001' }],
    ])
    const agenda = buildPublicAgenda('Summit', 'EVT001', tracks, tracks[1]!.id, sessions)
    expect(agenda.activeTrackId).toBe(tracks[1]!.id)
    expect(agenda.slots).toHaveLength(1)
    expect(agenda.slots[0]?.title).toBe('Breakout')
    expect(agenda.slots[0]?.session?.status).toBe('draft')
  })
})
