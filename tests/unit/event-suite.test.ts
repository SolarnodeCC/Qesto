import { describe, expect, it } from 'vitest'
import {
  closeEventSuite,
  computeTrackSummaries,
  publicFeedItems,
  startEventSuite,
} from '../../functions/api/lib/event-suite'
import { defaultEventSuite, type LinkedSessionInfo } from '../../functions/api/lib/event-agenda'

describe('event-suite', () => {
  it('starts and closes event suite with feed entries', () => {
    const suite = defaultEventSuite()
    startEventSuite(suite, 1000)
    const feedLen = suite.feed.length
    startEventSuite(suite, 2000)
    expect(suite.feed).toHaveLength(feedLen)
    expect(suite.status).toBe('live')
    expect(suite.feed.some((f) => f.message.includes('live'))).toBe(true)
    closeEventSuite(suite, 2000)
    expect(suite.status).toBe('closed')
    expect(suite.closedAt).toBe(2000)
  })

  it('computes per-track live status from linked sessions', () => {
    const tracks = [
      {
        id: 't1',
        label: 'Main',
        day: 'Day 1',
        order: 0,
        slots: [
          { id: 's1', title: 'Keynote', sessionId: 'sess_a', startsAt: null, durationMin: null, order: 0 },
          { id: 's2', title: 'Panel', sessionId: 'sess_b', startsAt: null, durationMin: null, order: 1 },
        ],
      },
    ]
    const sessions = new Map<string, LinkedSessionInfo>([
      ['sess_a', { id: 'sess_a', code: 'A', title: 'Keynote', status: 'live', sessionMode: 'stage', joinPath: '/j/A' }],
      ['sess_b', { id: 'sess_b', code: 'B', title: 'Panel', status: 'draft', sessionMode: 'stage', joinPath: '/j/B' }],
    ])
    const summaries = computeTrackSummaries(tracks, sessions)
    expect(summaries[0]?.status).toBe('live')
    expect(summaries[0]?.liveSessionTitle).toBe('Keynote')
  })

  it('filters public feed by track', () => {
    const feed = [
      { id: '1', message: 'Welcome', trackId: null, createdAt: 1 },
      { id: '2', message: 'Track A update', trackId: 'ta', createdAt: 2 },
      { id: '3', message: 'Track B update', trackId: 'tb', createdAt: 3 },
    ]
    const filtered = publicFeedItems(feed, 'ta')
    expect(filtered).toHaveLength(2)
    expect(filtered.some((f) => f.trackId === 'tb')).toBe(false)
    expect(filtered.some((f) => f.trackId === null)).toBe(true)
  })
})
