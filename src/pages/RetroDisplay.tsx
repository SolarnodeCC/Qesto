import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api/client'
import { useT } from '../i18n'
import { itemsByColumn, useRetroSession, type RetroColumn } from '../hooks/useRetroSession'
import { RetroItemCard } from '../ui/RetroItemCard'

type Lookup =
  | { status: 'loading' }
  | { status: 'ready'; sessionId: string; title: string }
  | { status: 'error'; message: string }

const COLUMNS: RetroColumn[] = ['went_well', 'didnt_go_well', 'actions']

/** Big-screen retro board for team rooms. */
export default function RetroDisplay() {
  const { code } = useParams<{ code: string }>()
  const [lookup, setLookup] = useState<Lookup>({ status: 'loading' })

  useEffect(() => {
    if (!code) return
    let cancelled = false
    ;(async () => {
      const res = await api<{ id: string; title: string }>(`/api/sessions/by-code/${encodeURIComponent(code.toUpperCase())}`)
      if (cancelled) return
      if (res.ok) setLookup({ status: 'ready', sessionId: res.data.id, title: res.data.title })
      else setLookup({ status: 'error', message: res.error.message })
    })()
    return () => {
      cancelled = true
    }
  }, [code])

  if (lookup.status !== 'ready') {
    return <div className="fixed inset-0 flex items-center justify-center bg-[#0f1117] text-white/60">…</div>
  }
  return <Screen sessionId={lookup.sessionId} title={lookup.title} code={code ?? ''} />
}

function Screen({ sessionId, title, code }: { sessionId: string; title: string; code: string }) {
  const t = useT('retro')
  const { state } = useRetroSession(sessionId)

  return (
    <div className="fixed inset-0 flex flex-col bg-[#0f1117] p-8 text-white">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">{title}</h1>
        <span className="inline-flex items-center gap-2 text-sm text-teal-400">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-teal-400" />
          {t('display.badge')}
        </span>
      </header>

      <div className="grid flex-1 gap-6 md:grid-cols-3">
        {COLUMNS.map((col) => {
          const items = itemsByColumn(state.items, col)
          return (
            <section key={col} className="flex flex-col rounded-2xl bg-white/5 p-5">
              <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-teal-300">{t(`column.${col}`)}</h2>
              <div className="flex-1 space-y-3 overflow-y-auto">
                {items.length === 0 ? (
                  <p className="text-white/30">{t('column.empty')}</p>
                ) : (
                  items.map((item) => <RetroItemCard key={item.id} item={item} variant="display" t={t} />)
                )}
              </div>
            </section>
          )
        })}
      </div>

      <footer className="mt-6 text-center text-white/50">
        {t('display.join')} <span className="font-semibold text-white">qesto.cc/r/{code}</span>
      </footer>
    </div>
  )
}
