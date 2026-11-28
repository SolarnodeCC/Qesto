/**
 * Requirement: knowledge-base/specifications/domain/SPEC_BACKEND.md §4 AI — insights GET is read-only with a stable themes shape (DX-INSIGHTS-01/02).
 */
// A2 — GET /api/sessions/:id/insights is read-only and its themes are always
// strings; the dashboard hook tolerates legacy `{ theme }` objects.
import { describe, expect, it } from 'vitest'
import { normaliseInsightsPayload } from '../../functions/api/routes/insights'
import { normaliseRaw } from '../../src/hooks/useInsights'

describe('normaliseInsightsPayload (server)', () => {
  it('passes through the analyze payload', () => {
    const p = normaliseInsightsPayload('s1', {
      session_id: 's1', themes: ['Pace', 'Clarity'], follow_ups: [], generated_at: 5, model: 'm',
      similar_sessions: [{ title: 'Past', score: 0.9 }, { bad: true }],
    })
    expect(p?.themes).toEqual(['Pace', 'Clarity'])
    expect(p?.similar_sessions).toEqual([{ title: 'Past', score: 0.9 }])
  })

  it('flattens legacy { theme } objects to strings', () => {
    const p = normaliseInsightsPayload('s1', { themes: [{ theme: 'Pace', count: 3 }, { theme: '' }, 7] })
    expect(p?.themes).toEqual(['Pace'])
  })

  it('returns null when there is no payload', () => {
    expect(normaliseInsightsPayload('s1', null)).toBeNull()
    expect(normaliseInsightsPayload('s1', { insights: null })).toBeNull()
  })
})

describe('normaliseRaw (dashboard hook)', () => {
  it('never yields a non-string theme (previous crash: theme.toLowerCase)', () => {
    const raw = normaliseRaw('s1', { themes: [{ theme: 'Pace', count: 2, examples: [] }, 'Clarity', null] })
    expect(raw?.themes).toEqual(['Pace', 'Clarity'])
    for (const t of raw!.themes) expect(() => t.toLowerCase()).not.toThrow()
  })

  it('rejects payloads without a themes array', () => {
    expect(normaliseRaw('s1', { insights: null })).toBeNull()
    expect(normaliseRaw('s1', 'nope')).toBeNull()
  })
})
