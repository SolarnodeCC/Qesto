import { describe, expect, it } from 'vitest'
import { toInsightsInput } from '../../functions/api/lib/session-bundle'
import type { SessionBundle } from '../../functions/api/lib/session-bundle'

const BASE: SessionBundle = {
  sessionId: 'sess_01',
  sessionTitle: 'Q3 Retrospective',
  closedAt: 1_700_000_000_000,
  openResponses: ['Tooling is slow', 'Communication is great', 'CI needs work'],
  pollBreakdown: [
    {
      questionId: 'q_01',
      prompt: "What's the biggest blocker?",
      kind: 'poll',
      options: [
        { label: 'Tooling', votes: 8 },
        { label: 'Process', votes: 3 },
        { label: 'Resources', votes: 1 },
        { label: 'Other', votes: 0 },
      ],
    },
  ],
  similarSessionTitles: ['Q2 Retrospective', 'Team Sync'],
}

describe('session-bundle/toInsightsInput', () => {
  it('passes openResponses through unchanged', () => {
    const input = toInsightsInput(BASE)
    expect(input.openResponses).toEqual(BASE.openResponses)
    expect(input.sessionTitle).toBe(BASE.sessionTitle)
  })

  it('derives topLabels sorted by votes descending', () => {
    const input = toInsightsInput(BASE)
    expect(input.pollBreakdown?.[0].topLabels).toEqual(['Tooling (8)', 'Process (3)', 'Resources (1)'])
  })

  it('excludes options with zero votes from topLabels', () => {
    const input = toInsightsInput(BASE)
    const labels = input.pollBreakdown?.[0].topLabels ?? []
    expect(labels.some((l) => l.includes('Other'))).toBe(false)
  })

  it('caps topLabels to 3 even when more options have votes', () => {
    const bundle: SessionBundle = {
      ...BASE,
      pollBreakdown: [
        {
          questionId: 'q_02',
          prompt: 'Many options',
          kind: 'poll',
          options: [
            { label: 'A', votes: 10 },
            { label: 'B', votes: 9 },
            { label: 'C', votes: 8 },
            { label: 'D', votes: 7 },
            { label: 'E', votes: 6 },
          ],
        },
      ],
    }
    const input = toInsightsInput(bundle)
    expect(input.pollBreakdown?.[0].topLabels).toHaveLength(3)
    expect(input.pollBreakdown?.[0].topLabels[0]).toBe('A (10)')
  })

  it('excludes pollBreakdown entries where all options have zero votes', () => {
    const bundle: SessionBundle = {
      ...BASE,
      pollBreakdown: [
        {
          questionId: 'q_03',
          prompt: 'Empty',
          kind: 'poll',
          options: [{ label: 'None', votes: 0 }],
        },
      ],
    }
    const input = toInsightsInput(bundle)
    expect(input.pollBreakdown).toHaveLength(0)
  })

  it('passes similarSessionTitles through to InsightsInput', () => {
    const input = toInsightsInput(BASE)
    expect(input.similarSessionTitles).toEqual(['Q2 Retrospective', 'Team Sync'])
  })

  it('produces empty pollBreakdown when session has no structured questions', () => {
    const bundle: SessionBundle = { ...BASE, pollBreakdown: [] }
    const input = toInsightsInput(bundle)
    expect(input.pollBreakdown).toHaveLength(0)
  })

  it('does not mutate the source bundle options array', () => {
    const bundle: SessionBundle = JSON.parse(JSON.stringify(BASE)) as SessionBundle
    const original = bundle.pollBreakdown[0].options.map((o) => ({ ...o }))
    toInsightsInput(bundle)
    expect(bundle.pollBreakdown[0].options).toEqual(original)
  })
})
