import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { useT } from '../i18n'

type AgendaTrack = { id: string; label: string; day: string; order: number }
type AgendaSlot = {
  id: string
  title: string
  startsAt: number | null
  durationMin: number | null
  order: number
  session: { code: string; status: string; joinPath: string; title: string } | null
}

type AgendaData = {
  eventTitle: string
  eventCode: string
  tracks: AgendaTrack[]
  activeTrackId: string
  slots: AgendaSlot[]
}

export default function EventAgendaJoin() {
  const { code } = useParams<{ code: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const t = useT('stage')
  const [data, setData] = useState<AgendaData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const trackId = searchParams.get('track') ?? undefined

  const load = useCallback(async () => {
    if (!code) return
    setLoading(true)
    const q = trackId ? `?track=${encodeURIComponent(trackId)}` : ''
    const res = await api<AgendaData>(`/api/events/${encodeURIComponent(code.toUpperCase())}/agenda${q}`)
    setLoading(false)
    if (!res.ok) {
      setError(res.error.message)
      setData(null)
      return
    }
    setError(null)
    setData(res.data)
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
    <div className="mx-auto max-w-3xl space-y-6 px-5 py-8">
      <header>
        <h1 className="text-2xl font-bold text-pulse-900 dark:text-pulse-100">{data.eventTitle}</h1>
        <p className="text-sm text-pulse-500">{t('agenda.subtitle')}</p>
      </header>

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
          <li className="text-sm text-pulse-400">{t('agenda.empty')}</li>
        ) : (
          data.slots.map((slot, idx) => (
            <li
              key={slot.id}
              className="rounded-xl border border-pulse-200 bg-white p-4 dark:border-pulse-700 dark:bg-pulse-900/30"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-pulse-400">
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
                  <span className="shrink-0 rounded-full bg-teal-100 px-2 py-0.5 text-xs font-bold uppercase text-teal-700 dark:bg-teal-900/40 dark:text-teal-300">
                    {t('agenda.live')}
                  </span>
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
    </div>
  )
}
