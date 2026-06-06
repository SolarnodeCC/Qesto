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

type TrackSummary = {
  trackId: string
  label: string
  day: string
  status: 'idle' | 'live' | 'done'
  liveSessionTitle: string | null
  linkedCount: number
}

type SuiteData = {
  status: 'draft' | 'live' | 'closed'
  tracks: TrackSummary[]
  feed: Array<{ id: string; message: string; createdAt: number }>
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
  const [suite, setSuite] = useState<SuiteData | null>(null)
  const [tracks, setTracks] = useState<AgendaTrack[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [suiteBusy, setSuiteBusy] = useState(false)
  const [feedMessage, setFeedMessage] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  const loadSuite = useCallback(async () => {
    if (!teamId || !wsId) return
    const res = await api<SuiteData>(`/api/teams/${teamId}/workspaces/${wsId}/suite`)
    if (res.ok) setSuite(res.data)
  }, [teamId, wsId])

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
    await loadSuite()
  }, [teamId, wsId, loadSuite])

  useEffect(() => {
    void load()
  }, [load])

  function addTrack() {
    setTracks((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
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
                { id: crypto.randomUUID(), title: 'New session', sessionId: null, order: track.slots.length },
              ],
            }
          : track,
      ),
    )
  }

  async function suiteAction(path: 'start' | 'close') {
    if (!teamId || !wsId) return
    setSuiteBusy(true)
    const res = await api<SuiteData>(`/api/teams/${teamId}/workspaces/${wsId}/suite/${path}`, { method: 'POST' })
    setSuiteBusy(false)
    if (!res.ok) {
      setMessage(res.error.message)
      return
    }
    setSuite(res.data)
    setMessage(path === 'start' ? t('suite.started') : t('suite.closed'))
  }

  async function postFeed() {
    if (!teamId || !wsId || !feedMessage.trim()) return
    const res = await api(`/api/teams/${teamId}/workspaces/${wsId}/suite/feed`, {
      method: 'POST',
      body: { message: feedMessage.trim() },
    })
    if (!res.ok) {
      setMessage(res.error.message)
      return
    }
    setFeedMessage('')
    await loadSuite()
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
        {teamId && wsId && (
          <Link
            to={`/teams/${teamId}/workspaces/${wsId}/present`}
            className="inline-flex rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
          >
            {t('organizer.openPresenter')}
          </Link>
        )}
      </header>

      {suite && (
        <section className="rounded-xl border border-teal-200 bg-teal-50/50 p-4 dark:border-teal-800 dark:bg-teal-900/20 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-teal-700 dark:text-teal-300">
                {t('suite.title')}
              </h2>
              <p className="text-sm text-pulse-600 dark:text-pulse-300">
                {t('suite.status', { status: suite.status })}
              </p>
            </div>
            <div className="flex gap-2">
              {suite.status !== 'live' && suite.status !== 'closed' && (
                <button
                  type="button"
                  disabled={suiteBusy}
                  onClick={() => void suiteAction('start')}
                  className="rounded-md bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
                >
                  {t('suite.start')}
                </button>
              )}
              {suite.status === 'live' && (
                <button
                  type="button"
                  disabled={suiteBusy}
                  onClick={() => void suiteAction('close')}
                  className="rounded-md border border-pulse-300 px-3 py-2 text-sm font-medium hover:bg-pulse-50 dark:border-pulse-600"
                >
                  {t('suite.close')}
                </button>
              )}
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {suite.tracks.map((track) => (
              <div
                key={track.trackId}
                className="rounded-lg border border-pulse-200 bg-white px-3 py-2 text-sm dark:border-pulse-700 dark:bg-pulse-900/40"
              >
                <p className="font-medium text-pulse-900 dark:text-pulse-100">{track.label}</p>
                <p className="text-xs text-pulse-500">
                  {t(`suite.trackStatus.${track.status}`)}
                  {track.liveSessionTitle ? ` · ${track.liveSessionTitle}` : ''}
                </p>
              </div>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void postFeed()
            }}
            className="flex gap-2"
          >
            <input
              value={feedMessage}
              onChange={(e) => setFeedMessage(e.target.value)}
              placeholder={t('suite.feedPlaceholder')}
              className="flex-1 rounded-md border border-pulse-300 px-3 py-2 text-sm dark:border-pulse-600 dark:bg-pulse-800"
            />
            <button
              type="submit"
              disabled={!feedMessage.trim()}
              className="rounded-md bg-pulse-800 px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-pulse-600"
            >
              {t('suite.postFeed')}
            </button>
          </form>
          {suite.feed.length > 0 && (
            <ul className="max-h-40 space-y-1 overflow-y-auto text-sm text-pulse-700 dark:text-pulse-200">
              {suite.feed.map((item) => (
                <li key={item.id}>• {item.message}</li>
              ))}
            </ul>
          )}
        </section>
      )}

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
