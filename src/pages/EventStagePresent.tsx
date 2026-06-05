import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, getAuthToken } from '../api/client'
import { useT } from '../i18n'
import { useTownhallSession, type TownhallItemStatus } from '../hooks/useTownhallSession'
import { TownhallQuestionCard } from '../ui/TownhallQuestionCard'

type LinkedSession = {
  id: string
  code: string
  title: string
  status: string
  sessionMode: string
  joinPath: string
}

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

type ActiveSlot = {
  slotId: string
  slotTitle: string
  trackId: string
  trackLabel: string
  session: LinkedSession | null
}

type PresenterData = {
  title: string
  eventCode: string
  attendeeUrl: string
  suiteStatus: string
  liveSessionCount: number
  tracks: AgendaTrack[]
  presenter: { slideDeckUrl: string | null; activeSlotId: string | null }
  feed: Array<{ id: string; message: string; createdAt: number }>
  activeSlot: ActiveSlot | null
}

const QA_TABS: TownhallItemStatus[] = ['pending', 'approved']

/** Event presenter shell: slide deck, talk switcher, live feed, Q&A panel. */
export default function EventStagePresent() {
  const { teamId, wsId } = useParams<{ teamId: string; wsId: string }>()
  const t = useT('stage')
  const [data, setData] = useState<PresenterData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [slideUrl, setSlideUrl] = useState('')
  const [savingSlides, setSavingSlides] = useState(false)
  const [feedMessage, setFeedMessage] = useState('')
  const [qaTab, setQaTab] = useState<TownhallItemStatus>('pending')

  const load = useCallback(async () => {
    if (!teamId || !wsId) return
    const res = await api<PresenterData>(`/api/teams/${teamId}/workspaces/${wsId}/present`)
    if (!res.ok) {
      setError(res.error.message)
      return
    }
    setData(res.data)
    setSlideUrl(res.data.presenter.slideDeckUrl ?? '')
    setError(null)
  }, [teamId, wsId])

  useEffect(() => {
    void load()
    const timer = setInterval(() => void load(), 12_000)
    return () => clearInterval(timer)
  }, [load])

  async function switchTalk(slotId: string) {
    if (!teamId || !wsId) return
    const res = await api<PresenterData>(`/api/teams/${teamId}/workspaces/${wsId}/present`, {
      method: 'PUT',
      body: { activeSlotId: slotId },
    })
    if (res.ok) setData(res.data)
  }

  async function saveSlideDeck(e: React.FormEvent) {
    e.preventDefault()
    if (!teamId || !wsId) return
    setSavingSlides(true)
    const res = await api<PresenterData>(`/api/teams/${teamId}/workspaces/${wsId}/present`, {
      method: 'PUT',
      body: { slideDeckUrl: slideUrl.trim() || null },
    })
    setSavingSlides(false)
    if (res.ok) setData(res.data)
  }

  async function postFeed(e: React.FormEvent) {
    e.preventDefault()
    if (!teamId || !wsId || !feedMessage.trim()) return
    const res = await api(`/api/teams/${teamId}/workspaces/${wsId}/suite/feed`, {
      method: 'POST',
      body: { message: feedMessage.trim() },
    })
    if (res.ok) {
      setFeedMessage('')
      await load()
    }
  }

  if (error) return <div className="p-8 text-center text-red-600">{error}</div>
  if (!data) return <div className="p-8 text-center text-pulse-500">…</div>

  const activeId = data.presenter.activeSlotId ?? data.activeSlot?.slotId ?? null
  const showQa = data.activeSlot?.session?.sessionMode === 'townhall'
  const qaSessionId = showQa ? data.activeSlot?.session?.id : undefined

  return (
    <div className="flex min-h-screen flex-col bg-pulse-50 dark:bg-pulse-950">
      <header className="border-b border-pulse-200 bg-white px-5 py-4 dark:border-pulse-800 dark:bg-pulse-900">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div>
            <Link
              to={`/teams/${teamId}/workspaces/${wsId}/event`}
              className="text-xs text-teal-600 hover:underline"
            >
              ← {t('present.back')}
            </Link>
            <h1 className="text-lg font-bold text-pulse-900 dark:text-pulse-100">{data.title}</h1>
            <p className="text-xs text-pulse-500">
              {t('present.liveSessions', { count: data.liveSessionCount })}
              {data.suiteStatus === 'live' && (
                <span className="ml-2 rounded-full bg-teal-100 px-2 py-0.5 font-bold uppercase text-teal-700 dark:bg-teal-900/40 dark:text-teal-300">
                  {t('agenda.eventLive')}
                </span>
              )}
            </p>
          </div>
          <a
            href={data.attendeeUrl}
            className="text-sm font-mono text-teal-700 dark:text-teal-400"
          >
            qesto.cc{data.attendeeUrl}
          </a>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-7xl flex-1 gap-4 p-4 lg:grid-cols-[220px_1fr_300px]">
        <TalkSwitcher
          tracks={data.tracks}
          activeSlotId={activeId}
          onSelect={(id) => void switchTalk(id)}
          t={t}
        />

        <main className="flex flex-col gap-4">
          <section className="rounded-xl border border-pulse-200 bg-white p-4 dark:border-pulse-700 dark:bg-pulse-900/40">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-pulse-500">
              {t('present.slides')}
            </h2>
            <form onSubmit={(e) => void saveSlideDeck(e)} className="mb-3 flex gap-2">
              <input
                type="url"
                value={slideUrl}
                onChange={(e) => setSlideUrl(e.target.value)}
                placeholder={t('present.slideUrlPlaceholder')}
                className="flex-1 rounded-md border border-pulse-300 px-3 py-2 text-sm dark:border-pulse-600 dark:bg-pulse-800"
              />
              <button
                type="submit"
                disabled={savingSlides}
                className="rounded-md bg-pulse-800 px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-pulse-600"
              >
                {savingSlides ? '…' : t('present.slideSave')}
              </button>
            </form>
            {data.presenter.slideDeckUrl ? (
              <iframe
                title={t('present.slides')}
                src={data.presenter.slideDeckUrl}
                className="aspect-video w-full rounded-lg border border-pulse-200 dark:border-pulse-700"
                allowFullScreen
              />
            ) : (
              <p className="rounded-lg border border-dashed border-pulse-300 px-4 py-12 text-center text-sm text-pulse-400 dark:border-pulse-600">
                {t('present.slidesEmpty')}
              </p>
            )}
          </section>

          {data.activeSlot && (
            <section className="rounded-xl border border-teal-200 bg-teal-50/50 p-4 dark:border-teal-800 dark:bg-teal-900/20">
              <h2 className="text-sm font-bold text-teal-800 dark:text-teal-200">{t('present.nowPlaying')}</h2>
              <p className="font-semibold text-pulse-900 dark:text-pulse-100">{data.activeSlot.slotTitle}</p>
              <p className="text-xs text-pulse-500">
                {data.activeSlot.trackLabel}
                {data.activeSlot.session ? ` · ${data.activeSlot.session.title}` : ''}
              </p>
              {data.activeSlot.session && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <Link
                    to={`/sessions/${data.activeSlot.session.id}/present`}
                    className="rounded-md bg-teal-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-700"
                  >
                    {t('present.openSession')}
                  </Link>
                  {data.activeSlot.session.sessionMode === 'townhall' && (
                    <Link
                      to={`/sessions/${data.activeSlot.session.id}/townhall`}
                      className="rounded-md border border-teal-400 px-3 py-1.5 text-xs font-medium text-teal-700 dark:text-teal-300"
                    >
                      {t('present.openQaConsole')}
                    </Link>
                  )}
                </div>
              )}
            </section>
          )}
        </main>

        <aside className="flex flex-col gap-4">
          <section className="rounded-xl border border-pulse-200 bg-white p-4 dark:border-pulse-700 dark:bg-pulse-900/40">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-pulse-500">{t('feed.title')}</h2>
            <form onSubmit={(e) => void postFeed(e)} className="mb-3 flex gap-2">
              <input
                value={feedMessage}
                onChange={(e) => setFeedMessage(e.target.value)}
                placeholder={t('suite.feedPlaceholder')}
                className="flex-1 rounded-md border border-pulse-300 px-2 py-1.5 text-sm dark:border-pulse-600 dark:bg-pulse-800"
              />
              <button
                type="submit"
                disabled={!feedMessage.trim()}
                className="rounded-md bg-pulse-800 px-2 py-1.5 text-xs text-white disabled:opacity-50 dark:bg-pulse-600"
              >
                {t('suite.postFeed')}
              </button>
            </form>
            <ul className="max-h-40 space-y-1 overflow-y-auto text-sm text-pulse-700 dark:text-pulse-200" aria-live="polite">
              {data.feed.length === 0 ? (
                <li className="text-xs text-pulse-400">{t('present.feedEmpty')}</li>
              ) : (
                data.feed.slice(0, 8).map((item) => <li key={item.id}>• {item.message}</li>)
              )}
            </ul>
          </section>

          {showQa && qaSessionId && (
            <StageQaPanel sessionId={qaSessionId} tab={qaTab} onTabChange={setQaTab} t={t} />
          )}
        </aside>
      </div>
    </div>
  )
}

function TalkSwitcher({
  tracks,
  activeSlotId,
  onSelect,
  t,
}: {
  tracks: AgendaTrack[]
  activeSlotId: string | null
  onSelect: (slotId: string) => void
  t: (key: string, vars?: Record<string, string | number>) => string
}) {
  return (
    <nav aria-label={t('present.talks')} className="rounded-xl border border-pulse-200 bg-white p-3 dark:border-pulse-700 dark:bg-pulse-900/40">
      <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-pulse-500">{t('present.talks')}</h2>
      <div className="max-h-[70vh] space-y-3 overflow-y-auto">
        {tracks.length === 0 ? (
          <p className="text-xs text-pulse-400">{t('agenda.empty')}</p>
        ) : (
          tracks.map((track) => (
            <div key={track.id}>
              <p className="text-xs font-semibold text-pulse-600 dark:text-pulse-300">{track.label}</p>
              <ul className="mt-1 space-y-1">
                {[...track.slots]
                  .sort((a, b) => a.order - b.order)
                  .map((slot) => (
                    <li key={slot.id}>
                      <button
                        type="button"
                        onClick={() => onSelect(slot.id)}
                        aria-current={slot.id === activeSlotId ? 'true' : undefined}
                        className={`w-full rounded-md px-2 py-1.5 text-left text-xs ${
                          slot.id === activeSlotId
                            ? 'bg-teal-600 font-medium text-white'
                            : 'text-pulse-700 hover:bg-pulse-100 dark:text-pulse-200 dark:hover:bg-pulse-800'
                        }`}
                      >
                        {slot.title}
                      </button>
                    </li>
                  ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </nav>
  )
}

function StageQaPanel({
  sessionId,
  tab,
  onTabChange,
  t,
}: {
  sessionId: string
  tab: TownhallItemStatus
  onTabChange: (tab: TownhallItemStatus) => void
  t: (key: string, vars?: Record<string, string | number>) => string
}) {
  const presenterToken = getAuthToken() ?? undefined
  const townhall = useT('townhall')
  const { state, moderate } = useTownhallSession(sessionId, {
    enabled: true,
    ...(presenterToken ? { presenterToken } : {}),
  })

  const counts = useMemo(() => {
    const c: Record<string, number> = { pending: 0, approved: 0 }
    for (const i of state.items) {
      if (i.status === 'pending' || i.status === 'approved') c[i.status] = (c[i.status] ?? 0) + 1
    }
    return c
  }, [state.items])

  const visible = state.items.filter((i) => i.status === tab)

  return (
    <section className="flex flex-1 flex-col rounded-xl border border-violet-200 bg-white p-4 dark:border-violet-800 dark:bg-pulse-900/40">
      <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-violet-600 dark:text-violet-300">
        {t('present.qaPanel')}
      </h2>
      {state.connection !== 'open' && (
        <p className="mb-2 text-xs text-amber-600">{townhall('connection.reconnecting')}</p>
      )}
      <div className="mb-2 flex gap-1" role="tablist">
        {QA_TABS.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => onTabChange(key)}
            className={`rounded px-2 py-1 text-xs font-medium ${
              tab === key
                ? 'bg-violet-600 text-white'
                : 'bg-pulse-100 text-pulse-600 dark:bg-pulse-800 dark:text-pulse-300'
            }`}
          >
            {townhall(`console.${key}`)} ({counts[key] ?? 0})
          </button>
        ))}
      </div>
      <div className="max-h-64 space-y-2 overflow-y-auto" aria-live="polite">
        {visible.length === 0 ? (
          <p className="py-4 text-center text-xs text-pulse-400">{townhall('console.empty')}</p>
        ) : (
          visible.map((item) => (
            <TownhallQuestionCard key={item.id} item={item} variant="console" onModerate={moderate} t={townhall} />
          ))
        )}
      </div>
    </section>
  )
}
