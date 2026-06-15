import { describe, expect, it } from 'vitest'
import { clusterThemes, detectAnomaly, invokeCopilotTool } from '../../functions/api/lib/copilot-tools'
import { emptyLiveContext } from '../../functions/api/lib/copilot-live-context'

describe('copilot-tools (COPILOT-TOOLS-01)', () => {
  const ctx = {
    ...emptyLiveContext('sess-1'),
    isLive: true,
    connections: 20,
    participationRate: 0.15,
    optionTallies: [
      { label: 'Option A', votes: 10 },
      { label: 'Option B', votes: 5 },
    ],
    mood: 'concerning' as const,
    moodSampleSize: 8,
  }

  it('clusters themes deterministically from tallies', () => {
    const out = clusterThemes(ctx)
    expect(out.themes[0]?.label).toBe('Option A')
    expect(out.themes[0]?.votes).toBe(10)
  })

  it('detects participation and mood anomalies', () => {
    const out = detectAnomaly(ctx)
    expect(out.detected).toBe(true)
    expect(out.kind).toBe('mood_concerning')
  })

  it('invokes recommend_followup with prior clusters', () => {
    const clusters = clusterThemes(ctx)
    const out = invokeCopilotTool('recommend_followup', ctx, { clusters }) as { title: string }
    expect(out.title).toContain('Option A')
  })
})
