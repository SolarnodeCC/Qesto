import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/client'
import { useT } from '../i18n'

type AgendaSlot = {
  id: string
  title: string
  sessionId: string | null
  order: number
}

type AgendaTrack = {
  id: string
  label: string
  day: string
  order: number
  slots: AgendaSlot[]
}

type LinkedSession = {
  id: string
  code: string
  title: string
  status: string
}

type OrganizerData = {
  title: string
  eventCode: string
  attendeeUrl: string
  tracks: AgendaTrack[]
  sessions: LinkedSession[]
}

export default function EventAgendaOrganizer() {
  const { teamId, wsId } = useParams<{ teamId: string; wsId: string }>()
  const t = useT('stage')
  const [data, setData] = useState<OrganizerData | null>(null)
  const [tracks, setTracks] = useState<AgendaTrack[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!teamId || !wsId) return
    const res = await api<OrganizerData>(`/api/teams/${teamId}/workspaces/${wsId}/agenda`)
    if (!res.ok) {
      setError(res.error.message)
      return
    }
    setData(res.data)
    setTracks(res.data.tracks)
    setError(null)
  }, [teamId, wsId])

  useEffect(() => {
    void load()
  }, [load])

  function addTrack() {
    setTracks((prev) => [
      ...prev,
      {
        id: `track_${prev.length + 1}`,
        label: `Track ${prev.length + 1}`,
        day: 'Day 1',
        order: prev.length,
        slots: [],
      },
    ])
  }

  function addSlot(trackId: string) {
    setTracks((prev) =>
      prev.map((track) =>
        track.id === trackId
          ? {
              ...track,
              slots: [
                ...track.slots,
                { id: `slot_${track.slots.length + 1}`, title: 'New session', sessionId: null, order: track.slots.length },
              ],
            }
          : track,
      ),
    )
  }

  async function save() {
    if (!teamId || !wsId) return
    setSaving(true)
    setMessage(null)
    const res = await api(`/api/teams/${teamId}/workspaces/${wsId}/agenda`, {
      method: 'PUT',
      body: { tracks },
    })
    setSaving(false)
    if (!res.ok) {
      setMessage(res.error.message)
      return
    }
    setMessage(t('organizer.saved'))
    await load()
  }

  if (error) return <div className="p-8 text-center text-red-600">{error}</div>
  if (!data) return <div className="p-8 text-center text-pulse-500">…</div>

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-5 py-8">
      <header className="space-y-2">
        <Link to="/dashboard" className="text-sm text-teal-600 hover:underline">
          ← {t('organizer.back')}
        </Link>
        <h1 className="text-xl font-bold text-pulse-900 dark:text-pulse-100">{data.title}</h1>
        <p className="text-sm text-pulse-500">
          {t('organizer.attendeeLink')}{' '}
          <Link to={data.attendeeUrl} className="font-mono font-semibold text-teal-700 dark:text-teal-400">
            qesto.cc{data.attendeeUrl}
          </Link>
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={addTrack}
          className="rounded-md border border-pulse-300 px-3 py-2 text-sm font-medium hover:bg-pulse-50 dark:border-pulse-600"
        >
          {t('organizer.addTrack')}
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
        >
          {saving ? t('organizer.saving') : t('organizer.save')}
        </button>
      </div>

      {message && (
        <p className="text-sm text-pulse-600" role="status">
          {message}
        </p>
      )}

      <div className="space-y-6">
        {tracks.map((track) => (
          <section key={track.id} className="rounded-xl border border-pulse-200 p-4 dark:border-pulse-700">
            <div className="mb-3 flex flex-wrap gap-3">
              <input
                value={track.label}
                onChange={(e) =>
                  setTracks((prev) => prev.map((t) => (t.id === track.id ? { ...t, label: e.target.value } : t)))
                }
                className="rounded-md border border-pulse-300 px-3 py-2 text-sm dark:border-pulse-600 dark:bg-pulse-800"
                aria-label={t('organizer.trackLabel')}
              />
              <input
                value={track.day}
                onChange={(e) =>
                  setTracks((prev) => prev.map((t) => (t.id === track.id ? { ...t, day: e.target.value } : t)))
                }
                className="rounded-md border border-pulse-300 px-3 py-2 text-sm dark:border-pulse-600 dark:bg-pulse-800"
                aria-label={t('organizer.trackDay')}
              />
              <button
                type="button"
                onClick={() => addSlot(track.id)}
                className="rounded-md border border-pulse-300 px-3 py-2 text-sm hover:bg-pulse-50 dark:border-pulse-600"
              >
                {t('organizer.addSlot')}
              </button>
            </div>
            <ul className="space-y-2">
              {track.slots.map((slot) => (
                <li key={slot.id} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    value={slot.title}
                    onChange={(e) =>
                      setTracks((prev) =>
                        prev.map((tr) =>
                          tr.id === track.id
                            ? {
                                ...tr,
                                slots: tr.slots.map((s) => (s.id === slot.id ? { ...s, title: e.target.value } : s)),
                              }
                            : tr,
                        ),
                      )
                    }
                    className="flex-1 rounded-md border border-pulse-300 px-3 py-2 text-sm dark:border-pulse-600 dark:bg-pulse-800"
                  />
                  <select
                    value={slot.sessionId ?? ''}
                    onChange={(e) =>
                      setTracks((prev) =>
                        prev.map((tr) =>
                          tr.id === track.id
                            ? {
                                ...tr,
                                slots: tr.slots.map((s) =>
                                  s.id === slot.id ? { ...s, sessionId: e.target.value || null } : s,
                                ),
                              }
                            : tr,
                        ),
                      )
                    }
                    className="rounded-md border border-pulse-300 px-3 py-2 text-sm dark:border-pulse-600 dark:bg-pulse-800"
                  >
                    <option value="">{t('organizer.noSession')}</option>
                    {data.sessions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title} ({s.status})
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
