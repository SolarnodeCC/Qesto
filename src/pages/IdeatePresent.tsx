import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api, getAuthToken } from '../api/client'
import { useT } from '../i18n'
import { ideasForCluster, unclusteredIdeas, useIdeateSession } from '../hooks/useIdeateSession'
import { IdeateIdeaCard } from '../ui/IdeateIdeaCard'

type IdeateConfig = {
  sessionId: string
  title: string
  code: string
  status: string
  dotVoteLimit: number
}

const CLUSTER_COLORS = [
  'border-teal-400 bg-teal-50 dark:bg-teal-900/20',
  'border-violet-400 bg-violet-50 dark:bg-violet-900/20',
  'border-amber-400 bg-amber-50 dark:bg-amber-900/20',
  'border-sky-400 bg-sky-50 dark:bg-sky-900/20',
]

export default function IdeatePresent() {
  const { id } = useParams<{ id: string }>()
  const presenterToken = getAuthToken() ?? undefined
  const t = useT('ideate')
  const [config, setConfig] = useState<IdeateConfig | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const live = config?.status === 'live' || config?.status === 'energizing'
  const { state, submit } = useIdeateSession(id, {
    enabled: !!id && live,
    ...(presenterToken ? { presenterToken } : {}),
  })

  const refreshConfig = useCallback(async () => {
    if (!id) return
    const res = await api<IdeateConfig>(`/api/sessions/${encodeURIComponent(id)}/ideate/config`)
    if (res.ok) setConfig(res.data)
    else setLoadError(res.error.message)
  }, [id])

  useEffect(() => {
    void refreshConfig()
  }, [refreshConfig])

  async function handleStart() {
    if (!id) return
    setStarting(true)
    setStartError(null)
    const res = await api(`/api/sessions/${encodeURIComponent(id)}/start`, { method: 'POST' })
    setStarting(false)
    if (!res.ok) {
      setStartError(res.error.message)
      return
    }
    await refreshConfig()
  }

  if (loadError) return <div className="p-8 text-center text-red-600">{loadError}</div>
  if (!config) return <div className="p-8 text-center text-pulse-500">…</div>

  const activeIdeas = state.ideas.filter((i) => i.status === 'active')

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-5 py-6">
      <header>
        <h1 className="text-lg font-bold text-pulse-900 dark:text-pulse-100">{config.title}</h1>
        <p className="text-sm text-pulse-500">{t('present.subtitle')}</p>
      </header>

      {!live && (
        <section className="rounded-lg border border-teal-200 bg-teal-50 p-5 dark:border-teal-800 dark:bg-teal-900/20">
          <p className="text-sm text-teal-800 dark:text-teal-200">{t('present.draftHint')}</p>
          <button
            type="button"
            onClick={() => void handleStart()}
            disabled={starting}
            className="mt-3 rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {starting ? t('present.starting') : t('present.start')}
          </button>
          {startError && <p className="mt-2 text-sm text-red-600">{startError}</p>}
        </section>
      )}

      {live && (
        <section className="rounded-lg border border-pulse-200 bg-pulse-50 p-4 dark:border-pulse-700 dark:bg-pulse-900/30">
          <p className="text-sm text-pulse-700 dark:text-pulse-300">
            {t('present.joinAt')}{' '}
            <span className="font-mono font-semibold">qesto.cc/i/{config.code}</span>
          </p>
        </section>
      )}

      {live && (
        <div className="space-y-4" aria-live="polite">
          <h2 className="text-sm font-bold uppercase tracking-wide text-pulse-500">{t('clusters.title')}</h2>
          {state.clusters.length === 0 ? (
            <p className="text-sm text-pulse-400">{t('clusters.waiting')}</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {state.clusters.map((cluster, idx) => (
                <section
                  key={cluster.id}
                  className={`rounded-xl border-2 p-4 ${CLUSTER_COLORS[idx % CLUSTER_COLORS.length]}`}
                >
                  <h3 className="font-semibold text-pulse-900 dark:text-pulse-100">{cluster.label}</h3>
                  <p className="mb-3 text-xs text-pulse-500">
                    {t('clusters.count', { count: cluster.ideaIds.length })}
                  </p>
                  <div className="space-y-2">
                    {ideasForCluster(activeIdeas, cluster.id).map((idea) => (
                      <IdeateIdeaCard key={idea.id} idea={idea} variant="present" t={t} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}

          {unclusteredIdeas(activeIdeas).length > 0 && (
            <section className="space-y-2">
              <h3 className="text-sm font-medium text-pulse-600">{t('clusters.uncategorized')}</h3>
              {unclusteredIdeas(activeIdeas).map((idea) => (
                <IdeateIdeaCard key={idea.id} idea={idea} variant="present" t={t} />
              ))}
            </section>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault()
              const body = (e.currentTarget.elements.namedItem('idea') as HTMLTextAreaElement).value.trim()
              if (body.length < 2) return
              submit(body)
              ;(e.currentTarget.elements.namedItem('idea') as HTMLTextAreaElement).value = ''
            }}
            className="space-y-2"
          >
            <textarea
              name="idea"
              rows={2}
              placeholder={t('submit.placeholder')}
              className="w-full rounded-md border border-pulse-200 px-3 py-2 text-sm dark:border-pulse-600 dark:bg-pulse-800"
            />
            <button type="submit" className="rounded-md bg-pulse-800 px-4 py-2 text-sm text-white dark:bg-pulse-600">
              {t('submit.button')}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
