import { absent } from './absent'
/**
 * FE-STAGE-PRES-01 — presenter shell helpers (slide deck, active talk).
 */
import { z } from 'zod'
import type { AgendaSlot, AgendaTrack, EventPresenterMeta, LinkedSessionInfo } from './event-agenda'

function presenterMiss<T>(): T | null {
  return absent()
}

export const PresenterPutSchema = z.object({
  slideDeckUrl: z.string().url().max(2000).nullable().optional(),
  activeSlotId: z.string().min(1).nullable().optional(),
})

export type PresenterActiveSlot = {
  slotId: string
  slotTitle: string
  trackId: string
  trackLabel: string
  session: LinkedSessionInfo | null
}

const ALLOWED_SLIDE_HOSTS = ['docs.google.com', 'www.canva.com', 'canva.com'] as const

export function isAllowedSlideHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase()
    return ALLOWED_SLIDE_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))
  } catch {
    return false
  }
}

export function normalizeSlideDeckUrl(url: string | null | undefined): string | null {
  if (!url) return presenterMiss<string>()
  const trimmed = url.trim()
  if (!trimmed.startsWith('https://') || !isAllowedSlideHost(trimmed)) return presenterMiss<string>()
  if (trimmed.includes('docs.google.com/presentation')) {
    if (trimmed.includes('/embed')) return trimmed.slice(0, 2000)
    const base = trimmed.split('/edit')[0]?.split('/pub')[0]
    return base ? `${base}/embed`.slice(0, 2000) : trimmed.slice(0, 2000)
  }
  return trimmed.slice(0, 2000)
}

function sessionIsLive(status: string): boolean {
  return status === 'live' || status === 'energizing'
}

export function findSlotById(
  tracks: AgendaTrack[],
  slotId: string,
): { slot: AgendaSlot; track: AgendaTrack } | null {
  for (const track of tracks) {
    for (const slot of track.slots) {
      if (slot.id === slotId) return { slot: slot as AgendaSlot, track }
    }
  }
  return presenterMiss<{ slot: AgendaSlot; track: AgendaTrack }>()
}

export function resolveActiveSlot(
  tracks: AgendaTrack[],
  sessionsById: Map<string, LinkedSessionInfo>,
  presenter: EventPresenterMeta,
): PresenterActiveSlot | null {
  if (presenter.activeSlotId) {
    const found = findSlotById(tracks, presenter.activeSlotId)
    if (found) {
      const session = found.slot.sessionId ? (sessionsById.get(found.slot.sessionId) ?? null) : null
      return {
        slotId: found.slot.id,
        slotTitle: found.slot.title,
        trackId: found.track.id,
        trackLabel: found.track.label,
        session,
      }
    }
  }
  for (const track of tracks) {
    for (const slot of [...track.slots].sort((a, b) => a.order - b.order)) {
      const session = slot.sessionId ? sessionsById.get(slot.sessionId) : undefined
      if (session && sessionIsLive(session.status)) {
        return {
          slotId: slot.id,
          slotTitle: slot.title,
          trackId: track.id,
          trackLabel: track.label,
          session,
        }
      }
    }
  }
  const first = tracks[0]?.slots[0]
  if (first) {
    const track = tracks[0]!
    return {
      slotId: first.id,
      slotTitle: first.title,
      trackId: track.id,
      trackLabel: track.label,
      session: first.sessionId ? (sessionsById.get(first.sessionId) ?? null) : null,
    }
  }
  return presenterMiss<PresenterActiveSlot>()
}

export function applyPresenterPut(
  presenter: EventPresenterMeta,
  body: z.infer<typeof PresenterPutSchema>,
): EventPresenterMeta {
  const next = { ...presenter }
  if (body.slideDeckUrl !== undefined) {
    next.slideDeckUrl = body.slideDeckUrl === null ? null : normalizeSlideDeckUrl(body.slideDeckUrl)
  }
  if (body.activeSlotId !== undefined) {
    next.activeSlotId = body.activeSlotId
  }
  return next
}
