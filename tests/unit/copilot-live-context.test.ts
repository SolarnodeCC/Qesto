import { describe, expect, it } from 'vitest'
import {
  buildLiveContext,
  emptyLiveContext,
  parseSnapshotResponse,
  CopilotSnapshotSchema,
} from '../../functions/api/lib/copilot-live-context'

const SNAPSHOT = {
  status: 'live',
  currentQuestion: { id: 'q1', kind: 'poll', prompt: 'Pick one', optionCount: 3 },
  responseCount: 12,
  voterCount: 20,
  participationRate: 0.6,
  connections: 21,
  mood: { mood: 'concerning' as const, sampleSize: 8 },
}

describe('copilot-live-context', () => {
  it('shapes a DO snapshot into a PII-free live context', () => {
    const ctx = buildLiveContext('s1', CopilotSnapshotSchema.parse(SNAPSHOT), 1000)
    expect(ctx.schemaVersion).toBe(1)
    expect(ctx.sessionId).toBe('s1')
    expect(ctx.isLive).toBe(true)
    expect(ctx.currentQuestion?.id).toBe('q1')
    expect(ctx.responseCount).toBe(12)
    expect(ctx.participantCount).toBe(20)
    expect(ctx.participationRate).toBeCloseTo(0.6)
    expect(ctx.mood).toBe('concerning')
    expect(ctx.moodSampleSize).toBe(8)
    expect(ctx.generatedAt).toBe(1000)
    // Aggregate-only: no per-voter identifiers leak into the context shape.
    expect(JSON.stringify(ctx)).not.toContain('voters')
  })

  it('treats energizing as live and a missing question as null', () => {
    const ctx = buildLiveContext('s2', CopilotSnapshotSchema.parse({ ...SNAPSHOT, status: 'energizing', currentQuestion: null }))
    expect(ctx.isLive).toBe(true)
    expect(ctx.currentQuestion).toBeNull()
  })

  it('marks non-live status as not live', () => {
    const ctx = buildLiveContext('s3', CopilotSnapshotSchema.parse({ ...SNAPSHOT, status: 'closed' }))
    expect(ctx.isLive).toBe(false)
  })

  it('carries no mood when the DO omits it (zero-knowledge sessions)', () => {
    const ctx = buildLiveContext('zk', CopilotSnapshotSchema.parse({ ...SNAPSHOT, mood: null }))
    expect(ctx.mood).toBeNull()
    expect(ctx.moodSampleSize).toBe(0)
  })

  it('emptyLiveContext is well-formed and not live', () => {
    const ctx = emptyLiveContext('s4', 42)
    expect(ctx.isLive).toBe(false)
    expect(ctx.responseCount).toBe(0)
    expect(ctx.mood).toBeNull()
    expect(ctx.generatedAt).toBe(42)
  })

  describe('parseSnapshotResponse', () => {
    it('parses a valid ok envelope', () => {
      expect(parseSnapshotResponse({ ok: true, data: SNAPSHOT })).not.toBeNull()
    })
    it('returns null for a non-ok or malformed envelope', () => {
      expect(parseSnapshotResponse({ ok: false })).toBeNull()
      expect(parseSnapshotResponse(null)).toBeNull()
      expect(parseSnapshotResponse({ ok: true, data: { status: 'live' } })).toBeNull()
    })
  })
})
