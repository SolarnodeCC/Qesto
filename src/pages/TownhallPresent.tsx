import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getAuthToken } from '../api/client'
import { useT } from '../i18n'
import { useTownhallSession, type TownhallItemStatus } from '../hooks/useTownhallSession'
import { TownhallQuestionCard } from '../ui/TownhallQuestionCard'

const TABS: { key: TownhallItemStatus; label: string }[] = [
  { key: 'pending', label: 'console.pending' },
  { key: 'approved', label: 'console.approved' },
  { key: 'answered', label: 'console.answered' },
  { key: 'dismissed', label: 'console.dismissed' },
]

/** Host moderation console: tabbed queue with approve/dismiss/answer/spotlight. */
export default function TownhallPresent() {
  const { id } = useParams<{ id: string }>()
  const presenterToken = getAuthToken() ?? undefined
  const t = useT('townhall')
  const { state, moderate } = useTownhallSession(id, { enabled: !!id, presenterToken })
  const [tab, setTab] = useState<TownhallItemStatus>('pending')

  const counts = useMemo(() => {
    const c: Record<string, number> = { pending: 0, approved: 0, answered: 0, dismissed: 0 }
    for (const i of state.items) c[i.status] = (c[i.status] ?? 0) + 1
    return c
  }, [state.items])

  const visible = state.items.filter((i) => i.status === tab)

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-5 py-6">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-pulse-900">{t('console.title')}</h1>
        {state.connection !== 'open' && (
          <span className="text-xs text-amber-600">
            {state.connection === 'failed' ? t('connection.failed') : t('connection.reconnecting')}
          </span>
        )}
      </header>

      <div className="flex gap-1 border-b border-pulse-200" role="tablist">
        {TABS.map((tabDef) => (
          <button
            key={tabDef.key}
            role="tab"
            aria-selected={tab === tabDef.key}
            onClick={() => setTab(tabDef.key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              tab === tabDef.key ? 'border-teal-500 text-teal-700' : 'border-transparent text-pulse-500 hover:text-pulse-800'
            }`}
          >
            {t(tabDef.label)} ({counts[tabDef.key] ?? 0})
          </button>
        ))}
      </div>

      <section className="space-y-2" aria-live="polite">
        {visible.length === 0 ? (
          <p className="py-8 text-center text-sm text-pulse-400">{t('console.empty')}</p>
        ) : (
          visible.map((item) => (
            <TownhallQuestionCard key={item.id} item={item} variant="console" onModerate={moderate} t={t} />
          ))
        )}
      </section>
    </div>
  )
}
