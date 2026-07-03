import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { insightsExportToCsv } from '../../functions/api/lib/team-insights-export'
import { escapeCsvCell } from '../../functions/api/lib/csv'
import { computeFacilitatorScorecard } from '../../functions/api/lib/team-insights-scorecard'

describe('team-insights-export (INSIGHTS-07)', () => {
  // Freeze the clock so fixed 2026 fixture dates keep a stable relationship to the
  // relative window(s) resolved from "now" — otherwise these pass only by wall-clock
  // coincidence and drift into failure over time.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-07-03T12:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('sanitizes formula-injection prefixes in CSV cells', () => {
    expect(escapeCsvCell('=SUM(A1)')).toBe(`"'=SUM(A1)"`)
    expect(escapeCsvCell('+cmd')).toBe(`"'+cmd"`)
    expect(escapeCsvCell('normal')).toBe('"normal"')
  })

  it('builds CSV with section rows', () => {
    const bundle = {
      teamId: 'team-1',
      window: '30d' as const,
      exportedAt: '2026-06-04T00:00:00Z',
      recurringThemes: [{ label: 'Morale', sessionCount: 3, firstSeen: '2026-06-01', lastSeen: '2026-06-03', score: 0.5 }],
      engagement: { points: [], summary: { sessionCount: 0, avgConfidence: 0, avgVotes: 0 } },
      scorecard: computeFacilitatorScorecard([], '30d'),
    }
    const csv = insightsExportToCsv(bundle)
    expect(csv).toContain('recurring_theme')
    expect(csv).not.toMatch(/\n=/)
  })
})
