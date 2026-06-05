/**
 * STAGE-SUITE-01 — event-level orchestration: status, live feed, per-track summary.
 */
import { z } from 'zod'
import { ulid } from './ulid'
import type { AgendaTrack, EventFeedItem, EventSuiteMeta, LinkedSessionInfo } from './event-agenda'

export const MAX_EVENT_FEED = 50

export const FeedPostSchema = z.object({
  message: z.string().trim().min(1).max(500),
  trackId: z.string().nullable().optional(),
})

export type TrackStatus = 'idle' | 'live' | 'done'

export type TrackSummary = {
  trackId: string
  label: string
  day: string
  status: TrackStatus
  slotCount: number
  linkedCount: number
  liveCount: number
  closedCount: number
  liveSlotId: string | null
  liveSessionTitle: string | null
}

export function appendFeedItem(
  suite: EventSuiteMeta,
  message: string,
  trackId: string | null = null,
  now = Date.now(),
): EventFeedItem {
  const item: EventFeedItem = { id: ulid(), message, trackId, createdAt: now }
  suite.feed = [...suite.feed, item].slice(-MAX_EVENT_FEED)
  return item
}

export function startEventSuite(suite: EventSuiteMeta, now = Date.now()): void {
  if (suite.status === 'closed') return
  suite.status = 'live'
  suite.startedAt = suite.startedAt ?? now
  suite.closedAt = null
  appendFeedItem(suite, 'Event is now live', null, now)
}

export function closeEventSuite(suite: EventSuiteMeta, now = Date.now()): void {
  if (suite.status === 'draft') return
  suite.status = 'closed'
  suite.closedAt = now
  appendFeedItem(suite, 'Event has ended', null, now)
}

function sessionIsLive(status: string): boolean {
  return status === 'live' || status === 'energizing'
}

export function computeTrackSummaries(
  tracks: AgendaTrack[],
  sessionsById: Map<string, LinkedSessionInfo>,
): TrackSummary[] {
  return tracks.map((track) => {
    const linked = track.slots.filter((s) => s.sessionId)
    let liveCount = 0
    let closedCount = 0
    let liveSlotId: string | null = null
    let liveSessionTitle: string | null = null

    for (const slot of linked) {
      const session = slot.sessionId ? sessionsById.get(slot.sessionId) : undefined
      if (!session) continue
      if (sessionIsLive(session.status)) {
        liveCount++
        if (!liveSlotId) {
          liveSlotId = slot.id ?? null
          liveSessionTitle = session.title
        }
      } else if (session.status === 'closed' || session.status === 'archived') {
        closedCount++
      }
    }

    let status: TrackStatus = 'idle'
    if (liveCount > 0) status = 'live'
    else if (linked.length > 0 && closedCount === linked.length) status = 'done'

    return {
      trackId: track.id,
      label: track.label,
      day: track.day,
      status,
      slotCount: track.slots.length,
      linkedCount: linked.length,
      liveCount,
      closedCount,
      liveSlotId,
      liveSessionTitle,
    }
  })
}

export function publicFeedItems(feed: EventFeedItem[], trackId?: string): EventFeedItem[] {
  const items = [...feed].sort((a, b) => b.createdAt - a.createdAt)
  if (!trackId) return items
  return items.filter((f) => f.trackId === null || f.trackId === trackId)
}
