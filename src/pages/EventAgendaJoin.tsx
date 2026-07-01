import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { useT } from '../i18n'
import ParticipantShell from '../layouts/ParticipantShell'
import { Badge } from '../ui/components'

type AgendaTrack = { id: string; label: string; day: string; order: number }
type AgendaSlot = {
  id: string
  title: string
  startsAt: number | null
  durationMin: number | null
  order: number
  session: { code: string; status: string; joinPath: string; title: string } | null
}

type FeedItem = { id: string; message: string; createdAt: number }
type TrackSummary = { trackId: string; label: string; status: string }

type AgendaData = {
  eventTitle: string
  eventCode: string
  tracks: AgendaTrack[]
  activeTrackId: string
  slots: AgendaSlot[]
}

type FeedData = {
  eventTitle: string
  status: string
  tracks: TrackSummary[]
  feed: FeedItem[]
}

export default function EventAgendaJoin() {
  const { code } = useParams<{ code: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const t = useT('stage')
  const [data, setData] = useState<AgendaData | null>(null)
  const [feedData, setFeedData] = useState<FeedData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const trackId = searchParams.get('track') ?? undefined

  const load = useCallback(async () => {
    if (!code) return
    setLoading(true)
    const q = trackId ? `?track=${encodeURIComponent(trackId)}` : ''
    const upper = encodeURIComponent(code.toUpperCase())
    const [agendaRes, feedRes] = await Promise.all([
      api<AgendaData>(`/api/events/${upper}/agenda${q}`),
      api<FeedData>(`/api/events/${upper}/feed${q}`),
    ])
    setLoading(false)
    if (!agendaRes.ok) {
      setError(agendaRes.error.message)
      setData(null)
      setFeedData(null)
      return
    }
    setError(null)
    setData(agendaRes.data)
    setFeedData(feedRes.ok ? feedRes.data : null)
  }, [code, trackId])

  useEffect(() => {
    void load()
    const timer = setInterval(() => void load(), 15_000)
    return () => clearInterval(timer)
  }, [load])

  function selectTrack(id: string) {
    setSearchParams({ track: id })
  }

  if (loading && !data) return <div className="p-8 text-center text-pulse-500">…</div>
  if (error) return <div className="p-8 text-center text-red-600">{error}</div>
  if (!data) return null

  return (
    <ParticipantShell title={data.eventTitle} subtitle={t('agenda.subtitle')} maxWidth="3xl">
      {feedData?.status === 'live' && (
        <Badge tone="success" dot pulse className="uppercase">
          {t('agenda.eventLive')}
        </Badge>
      )}

      {feedData && feedData.feed.length > 0 && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-900/20" aria-live="polite">
          <h2 className="text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">{t('feed.title')}</h2>
          <ul className="mt-2 space-y-1 text-sm text-pulse-800 dark:text-pulse-100">
            {feedData.feed.slice(0, 5).map((item) => (
              <li key={item.id}>{item.message}</li>
            ))}
          </ul>
        </section>
      )}

      {data.tracks.length > 1 && (
        <nav aria-label={t('agenda.tracks')} className="flex flex-wrap gap-2">
          {data.tracks.map((track) => (
            <button
              key={track.id}
              type="button"
              onClick={() => selectTrack(track.id)}
              aria-current={track.id === data.activeTrackId ? 'true' : undefined}
              className={`rounded-full px-4 py-2 text-sm font-medium ${
                track.id === data.activeTrackId
                  ? 'bg-teal-600 text-white'
                  : 'bg-pulse-100 text-pulse-700 hover:bg-pulse-200 dark:bg-pulse-800 dark:text-pulse-200'
              }`}
            >
              {track.label}
              <span className="ml-1.5 text-xs opacity-80">{track.day}</span>
            </button>
          ))}
        </nav>
      )}

      <ol className="space-y-3" aria-live="polite">
        {data.slots.length === 0 ? (
          <li className="text-sm text-pulse-500">{t('agenda.empty')}</li>
        ) : (
          data.slots.map((slot, idx) => (
            <li
              key={slot.id}
              className="rounded-xl border border-pulse-200 bg-white p-4 dark:border-pulse-700 dark:bg-pulse-900/30"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-pulse-500">
                    {t('agenda.slot', { number: idx + 1 })}
                  </p>
                  <h2 className="font-semibold text-pulse-900 dark:text-pulse-100">{slot.title}</h2>
                  {slot.startsAt && (
                    <p className="mt-1 text-xs text-pulse-500">
                      {new Date(slot.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {slot.durationMin ? ` · ${slot.durationMin}m` : ''}
                    </p>
                  )}
                </div>
                {slot.session?.status === 'live' && (
                  <Badge tone="success" dot pulse className="shrink-0 uppercase">
                    {t('agenda.live')}
                  </Badge>
                )}
              </div>
              {slot.session && (slot.session.status === 'live' || slot.session.status === 'energizing') && (
                <Link
                  to={slot.session.joinPath}
                  className="mt-3 inline-flex rounded-md bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700"
                >
                  {t('agenda.join')}
                </Link>
              )}
            </li>
          ))
        )}
      </ol>
    </ParticipantShell>
  )
}
