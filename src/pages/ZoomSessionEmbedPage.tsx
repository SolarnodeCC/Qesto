/**
 * ZOOM-EMBED-01 — host embed surface for Zoom side-by-side (S72).
 */
import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'

type EmbedData = {
  sessionId: string
  sessionCode: string
  title: string
  zoomConnected: boolean
  syncState: string
  embedUrl: string | null
  oauthPath: string | null
}

export default function ZoomSessionEmbedPage() {
  const { id } = useParams<{ id: string }>()
  const [search] = useSearchParams()
  const teamId = search.get('teamId') ?? undefined
  const [data, setData] = useState<EmbedData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    const q = teamId ? `?teamId=${encodeURIComponent(teamId)}` : ''
    void api<EmbedData>(`/api/integrations/zoom/sessions/${id}/embed${q}`)
      .then((res) => {
        if (res.ok) setData(res.data)
        else setError(res.error.message)
      })
      .catch(() => setError('Failed to load Zoom embed'))
  }, [id, teamId])

  if (error) {
    return (
      <main className="min-h-screen bg-[var(--color-bg)] p-6 text-pulse-800 dark:text-[#F0F2F8]">
        <p role="alert">{error}</p>
        <Link to={`/sessions/${id}/launchpad`} className="mt-4 inline-block text-teal-600 dark:text-teal-400">
          Back to launchpad
        </Link>
      </main>
    )
  }

  if (!data) {
    return (
      <main className="min-h-screen bg-[var(--color-bg)] p-6" aria-busy="true">
        <div className="h-8 w-48 rounded-lg bg-pulse-200 dark:bg-pulse-800 skeleton-shimmer" />
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[var(--color-bg)] p-4 md:p-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-pulse-900 dark:text-[#F0F2F8]">{data.title}</h1>
          <p className="text-sm text-pulse-500 dark:text-[#6B7A99]">
            Zoom sync: <span className="font-medium">{data.syncState}</span>
          </p>
        </div>
        <Link
          to={`/sessions/${id}/launchpad`}
          className="rounded-lg border border-pulse-200 dark:border-[#2A3858] px-3 py-2 text-sm dark:text-[#A8B3CC]"
        >
          Launchpad
        </Link>
      </header>

      {!data.zoomConnected ? (
        <section className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4">
          <p className="text-sm text-amber-800 dark:text-amber-200">Connect Zoom in team settings to enable in-meeting embed.</p>
          {data.oauthPath && (
            <a
              href={data.oauthPath}
              className="mt-3 inline-block rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white"
            >
              Connect Zoom
            </a>
          )}
        </section>
      ) : (
        <section
          className="rounded-xl border border-pulse-200 dark:border-[#1E2A45] bg-white dark:bg-[#151C2E] p-6 min-h-[320px] flex flex-col items-center justify-center"
          aria-label="Zoom meeting companion"
        >
          <p className="text-pulse-600 dark:text-[#9AA8C7] text-center max-w-md">
            Session <strong className="text-pulse-900 dark:text-[#F0F2F8]">{data.sessionCode}</strong> is linked.
            Present from Qesto launchpad; participants join via code while you host in Zoom.
          </p>
          <p className="mt-4 text-xs text-pulse-400 dark:text-[#6B7A99]">Code: {data.sessionCode}</p>
        </section>
      )}
    </main>
  )
}
