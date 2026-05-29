import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ArrowBigUp, Star } from 'lucide-react'
import { api } from '../api/client'
import { useT } from '../i18n'
import { useTownhallSession } from '../hooks/useTownhallSession'

type Lookup =
  | { status: 'loading' }
  | { status: 'ready'; sessionId: string; title: string }
  | { status: 'error'; message: string }

/** Big-screen audience view: approved questions sorted by upvotes, spotlight highlighted. */
export default function TownhallDisplay() {
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
  const t = useT('townhall')
  const { state } = useTownhallSession(sessionId)

  return (
    <div className="fixed inset-0 flex flex-col bg-[#0f1117] p-10 text-white">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold">{title}</h1>
        <span className="inline-flex items-center gap-2 text-sm text-teal-400">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-teal-400" /> Q&amp;A
        </span>
      </header>

      <div className="flex-1 overflow-hidden">
        {state.items.length === 0 ? (
          <div className="flex h-full items-center justify-center text-white/40">{t('display.waiting')}</div>
        ) : (
          <ul className="space-y-4">
            {state.items.slice(0, 8).map((item) => (
              <li
                key={item.id}
                className={`flex items-center gap-5 rounded-2xl px-6 py-5 ${
                  item.isSpotlit ? 'bg-teal-500/20 ring-2 ring-teal-400' : 'bg-white/5'
                }`}
              >
                <span className="flex min-w-16 flex-col items-center text-teal-300">
                  <ArrowBigUp className="h-7 w-7" aria-hidden="true" />
                  <span className="text-2xl font-bold">{item.upvotes}</span>
                </span>
                <span className="flex-1 text-2xl font-medium">{item.body}</span>
                {item.isSpotlit && <Star className="h-7 w-7 text-teal-300" aria-hidden="true" />}
              </li>
            ))}
          </ul>
        )}
      </div>

      <footer className="mt-8 text-center text-white/50">
        {t('display.join')} <span className="font-semibold text-white">qesto.cc/th/{code}</span>
      </footer>
    </div>
  )
}
