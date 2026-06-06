/**
 * STAGE-AGENDA-01 — event workspace agenda (tracks + ordered session slots).
 * Stored in workspaces.template_json for kind='event'.
 */
import { z } from 'zod'
import { generateJoinCode } from './code'
import { ulid } from './ulid'

export const AgendaSlotSchema = z.object({
  id: z.string().min(1).optional(),
  title: z.string().trim().min(1).max(200),
  sessionId: z.string().nullable().optional(),
  startsAt: z.number().int().nullable().optional(),
  durationMin: z.number().int().min(1).max(480).nullable().optional(),
  order: z.number().int().min(0),
})

export const AgendaTrackSchema = z.object({
  id: z.string().min(1).optional(),
  label: z.string().trim().min(1).max(120),
  day: z.string().trim().min(1).max(40),
  order: z.number().int().min(0),
  slots: z.array(AgendaSlotSchema),
})

export const AgendaPutSchema = z.object({
  tracks: z.array(AgendaTrackSchema).max(20),
})

export type AgendaSlot = z.infer<typeof AgendaSlotSchema> & { id: string }
export type AgendaTrack = z.infer<typeof AgendaTrackSchema> & { id: string; slots: AgendaSlot[] }

export type EventFeedItem = {
  id: string
  message: string
  trackId: string | null
  createdAt: number
}

export type EventSuiteMeta = {
  status: 'draft' | 'live' | 'closed'
  startedAt: number | null
  closedAt: number | null
  feed: EventFeedItem[]
}

export type EventPresenterMeta = {
  slideDeckUrl: string | null
  activeSlotId: string | null
}

export type EventAgendaTemplate = {
  eventCode: string
  tracks: AgendaTrack[]
  suite: EventSuiteMeta
  presenter: EventPresenterMeta
}

export function defaultEventSuite(): EventSuiteMeta {
  return { status: 'draft', startedAt: null, closedAt: null, feed: [] }
}

export type LinkedSessionInfo = {
  id: string
  code: string
  title: string
  status: string
  sessionMode: string
  joinPath: string
}

export type PublicAgendaSlot = {
  id: string
  title: string
  startsAt: number | null
  durationMin: number | null
  order: number
  session: LinkedSessionInfo | null
}

export type PublicAgendaTrack = {
  id: string
  label: string
  day: string
  order: number
}

export function defaultEventPresenter(): EventPresenterMeta {
  return { slideDeckUrl: null, activeSlotId: null }
}

export function defaultEventTemplate(): EventAgendaTemplate {
  return { eventCode: generateJoinCode(), tracks: [], suite: defaultEventSuite(), presenter: defaultEventPresenter() }
}

function parsePresenter(raw: unknown): EventPresenterMeta {
  if (!raw || typeof raw !== 'object') return defaultEventPresenter()
  const p = raw as Partial<EventPresenterMeta>
  return {
    slideDeckUrl: typeof p.slideDeckUrl === 'string' && p.slideDeckUrl.startsWith('https://') ? p.slideDeckUrl : null,
    activeSlotId: typeof p.activeSlotId === 'string' ? p.activeSlotId : null,
  }
}

function parseSuite(raw: unknown): EventSuiteMeta {
  if (!raw || typeof raw !== 'object') return defaultEventSuite()
  const s = raw as Partial<EventSuiteMeta>
  const status = s.status === 'live' || s.status === 'closed' ? s.status : 'draft'
  const feed = Array.isArray(s.feed)
    ? s.feed
        .filter((f) => f && typeof f === 'object' && typeof (f as EventFeedItem).message === 'string')
        .map((f) => {
          const item = f as EventFeedItem
          return {
            id: typeof item.id === 'string' ? item.id : ulid(),
            message: item.message.slice(0, 500),
            trackId: typeof item.trackId === 'string' ? item.trackId : null,
            createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now(),
          }
        })
        .slice(-50)
    : []
  return {
    status,
    startedAt: typeof s.startedAt === 'number' ? s.startedAt : null,
    closedAt: typeof s.closedAt === 'number' ? s.closedAt : null,
    feed,
  }
}

export function parseEventTemplate(raw: string | null | undefined): EventAgendaTemplate {
  if (!raw) return defaultEventTemplate()
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return defaultEventTemplate()
    const obj = parsed as Record<string, unknown>
    return {
      eventCode: typeof obj.eventCode === 'string' && obj.eventCode.length === 6 ? obj.eventCode : generateJoinCode(),
      tracks: normalizeTracks(obj.tracks),
      suite: parseSuite(obj.suite),
      presenter: parsePresenter(obj.presenter),
    }
  } catch {
    return defaultEventTemplate()
  }
}

function normalizeTracks(input: unknown): AgendaTrack[] {
  if (!Array.isArray(input)) return []
  const tracks: AgendaTrack[] = []
  for (const raw of input) {
    const parsed = AgendaTrackSchema.safeParse(raw)
    if (!parsed.success) continue
    tracks.push({
      id: parsed.data.id ?? ulid(),
      label: parsed.data.label,
      day: parsed.data.day,
      order: parsed.data.order,
      slots: parsed.data.slots.map((s) => ({
        id: s.id ?? ulid(),
        title: s.title,
        sessionId: s.sessionId ?? null,
        startsAt: s.startsAt ?? null,
        durationMin: s.durationMin ?? null,
        order: s.order,
      })),
    })
  }
  return tracks.sort((a, b) => a.order - b.order)
}

export function normalizeAgendaPut(body: z.infer<typeof AgendaPutSchema>): AgendaTrack[] {
  return body.tracks
    .map((t) => ({
      id: t.id ?? ulid(),
      label: t.label,
      day: t.day,
      order: t.order,
      slots: t.slots
        .map((s) => ({
          id: s.id ?? ulid(),
          title: s.title,
          sessionId: s.sessionId ?? null,
          startsAt: s.startsAt ?? null,
          durationMin: s.durationMin ?? null,
          order: s.order,
        }))
        .sort((a, b) => a.order - b.order),
    }))
    .sort((a, b) => a.order - b.order)
}

export function joinPathForMode(sessionMode: string, code: string): string {
  switch (sessionMode) {
    case 'retro':
      return `/r/${code}`
    case 'ideate':
      return `/i/${code}`
    case 'townhall':
      return `/th/${code}`
    default:
      return `/j/${code}`
  }
}

export function buildPublicAgenda(
  eventTitle: string,
  eventCode: string,
  tracks: AgendaTrack[],
  trackId: string | undefined,
  sessionsById: Map<string, LinkedSessionInfo>,
): {
  eventTitle: string
  eventCode: string
  tracks: PublicAgendaTrack[]
  activeTrackId: string
  slots: PublicAgendaSlot[]
} {
  const publicTracks = tracks.map((t) => ({
    id: t.id,
    label: t.label,
    day: t.day,
    order: t.order,
  }))
  const active = (trackId ? tracks.find((t) => t.id === trackId) : undefined) ?? tracks[0] ?? null
  const activeTrackId = active?.id ?? ''
  const slots = (active?.slots ?? [])
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((slot) => ({
      id: slot.id ?? '',
      title: slot.title,
      startsAt: slot.startsAt ?? null,
      durationMin: slot.durationMin ?? null,
      order: slot.order,
      session: slot.sessionId ? (sessionsById.get(slot.sessionId) ?? null) : null,
    }))
  return { eventTitle, eventCode, tracks: publicTracks, activeTrackId, slots }
}
