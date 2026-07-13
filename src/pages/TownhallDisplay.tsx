import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ArrowBigUp, Star } from 'lucide-react'
import { api } from '../api/client'
import { useT } from '../i18n'
import { useTownhallSession } from '../hooks/useTownhallSession'
import BigScreenShell, { BigScreenFallback } from '../layouts/BigScreenShell'

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
    return <BigScreenFallback>…</BigScreenFallback>
  }
  return <Screen sessionId={lookup.sessionId} title={lookup.title} code={code ?? ''} />
}

function Screen({ sessionId, title, code }: { sessionId: string; title: string; code: string }) {
  const t = useT('townhall')
  const { state } = useTownhallSession(sessionId)

  return (
    <BigScreenShell title={title} badgeLabel="Q&A" code={code} pathPrefix="th" joinLabel={t('display.join')}>
      {state.items.length === 0 ? (
        <div className="flex h-full items-center justify-center text-white/40">{t('display.waiting')}</div>
      ) : (
        <ul className="space-y-4">
          {state.items.slice(0, 8).map((item) => (
            <li
              key={item.id}
              className={`flex items-center gap-6 rounded-2xl px-8 py-6 ${
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
    </BigScreenShell>
  )
}
