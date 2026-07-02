import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useCountUp } from '../hooks/useCountUp'
import { useT } from '../i18n'
import type { PollOption, SessionStatus } from '@/types/session'
import { api, type ApiError } from '../api/client'
import { csvRow } from '@api/lib/csv'
import MainLayout from '../layouts/MainLayout'
import { ResultsSectionSkeleton } from '../components/SkeletonLoader'
import SessionTitleField from '../components/SessionTitleField'
import SimilarSessionsResultsPanel from '../components/insights/SimilarSessionsResultsPanel'
import { StatusBadge } from '../ui/StatusBadge'

// Word-cloud sizing: frequency maps to font size only; colour is a single
// AA-compliant token (RES-A11Y) so size — not random hue — carries meaning.
function getResultFontSize(count: number, maxCount: number): number {
  const ratio = maxCount > 1 ? (count - 1) / (maxCount - 1) : 0
  return Math.round(18 + ratio * 32)
}

// A single tally row. The bar width already transitions via CSS; useCountUp
// tweens the visible count/percent so the numbers move with the bar (Finding 5
// #1). aria-label uses the final values so assistive tech is never read a
// mid-tween number.
function ResultRow({
  label,
  count,
  pct,
  barPct,
  isWinner,
  winnerSuffix,
}: {
  label: string
  count: number
  pct: number
  barPct: number
  isWinner: boolean
  winnerSuffix: string
}) {
  const shownCount = useCountUp(count)
  const shownPct = useCountUp(pct)
  return (
    <li className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className={isWinner ? 'font-semibold text-teal-700 dark:text-teal-400' : ''}>
          {label}
          {isWinner ? winnerSuffix : ''}
        </span>
        <span className="font-medium tabular-nums">
          {shownCount} ({shownPct}%)
        </span>
      </div>
      <div
        role="img"
        aria-label={`${label}: ${count} votes, ${pct}%`}
        className="h-3 bg-pulse-100 rounded-full overflow-hidden"
      >
        <div
          className={
            'h-full transition-[width] duration-500 ' +
            (isWinner ? 'bg-gradient-to-r from-teal-500 to-violet-500' : 'bg-pulse-500')
          }
          style={{ width: `${barPct}%` }}
        />
      </div>
    </li>
  )
}

type ResultsPayload = {
  session: {
    id: string
    title: string
    status: SessionStatus
    code: string
    closed_at: number | null
  }
  question: {
    id: string
    kind: string
    prompt: string
    options: PollOption[]
  } | null
  results: {
    counts: Record<string, number>
    total: number
    source: 'live' | 'persisted'
  }
}

type State =
  | { status: 'loading' }
  | { status: 'ready'; data: ResultsPayload }
  | { status: 'error'; error: ApiError }

function toCsv(rows: string[][]): string {
  return rows.map((row) => csvRow(row)).join('\n')
}

export default function Results() {
  const auth = useAuth()
  const t = useT('results')
  const { id } = useParams<{ id: string }>()
  const [state, setState] = useState<State>({ status: 'loading' })

  const load = useCallback(async () => {
    if (!id) return
    setState({ status: 'loading' })
    const res = await api<ResultsPayload>(`/api/sessions/${encodeURIComponent(id)}/results`)
    if (res.ok) setState({ status: 'ready', data: res.data })
    else setState({ status: 'error', error: res.error })
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  if (auth.status === 'loading') {
    return (
      <MainLayout mainClassName="min-h-screen max-w-3xl mx-auto p-8 space-y-6">
        <ResultsSectionSkeleton bars={4} />
      </MainLayout>
    )
  }
  if (auth.status === 'anonymous') return <Navigate to="/login" replace />

  if (state.status === 'loading') {
    return (
      /* LAYOUT-SKELETON-01: geometric skeleton prevents layout shift while data loads */
      <MainLayout mainClassName="min-h-screen max-w-3xl mx-auto p-8 space-y-6">
        <ResultsSectionSkeleton bars={4} />
      </MainLayout>
    )
  }
  if (state.status === 'error') {
    return (
      <MainLayout mainClassName="min-h-screen max-w-2xl mx-auto p-8 space-y-4">
        <p role="alert" className="text-sm text-red-600">
          {state.error.message}
        </p>
        <Link to="/dashboard" className="text-teal-600 hover:underline">
          ← {t('back')}
        </Link>
      </MainLayout>
    )
  }

  const { session, question, results } = state.data
  const rows =
    question?.options.map((o) => ({
      id: o.id,
      label: o.label,
      count: results.counts[o.id] ?? 0,
    })) ?? []
  const max = rows.reduce((m, r) => Math.max(m, r.count), 0)
  const winner = rows.length > 0 ? rows.reduce((best, r) => (r.count > best.count ? r : best), rows[0]) : null

  const STATUS_KEY: Record<string, string> = {
    live: 'status_live', closed: 'status_closed', draft: 'status_draft', archived: 'status_archived',
  }
  const statusLabel = STATUS_KEY[session.status] ? t(STATUS_KEY[session.status]) : session.status
  const sourceLabel = t('source_label', { source: results.source === 'live' ? t('source_live') : t('source_persisted') })

  function handleExport() {
    if (!question) return
    const header = [t('csv.option'), t('csv.votes'), t('csv.percent')]
    const body = rows.map((r) => [
      r.label,
      String(r.count),
      results.total === 0 ? '0%' : `${Math.round((r.count / results.total) * 100)}%`,
    ])
    const csv = toCsv([header, ...body])
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${session.code}-results.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const navSlot = (
    <Link
      to="/dashboard"
      className="text-sm text-teal-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 rounded"
    >
      ← {t('dashboard_nav')}
    </Link>
  )

  return (
    <MainLayout navSlot={navSlot} mainClassName="min-h-screen max-w-3xl mx-auto density-pad-8 density-stack-6">
      {/* animate-page-enter: content fades in on load (LAYOUT-MOTION-01) */}
      <div className="animate-page-enter density-stack-6">
      <header className="space-y-1">
        <div className="flex items-center justify-between">
          <SessionTitleField
            sessionId={session.id}
            title={session.title}
            editable={session.status === 'closed' || session.status === 'archived'}
            saveErrorLabel={t('title_save_error')}
            savingLabel={t('title_saving')}
            onSaved={(nextTitle) => {
              setState((prev) =>
                prev.status === 'ready'
                  ? { ...prev, data: { ...prev.data, session: { ...prev.data.session, title: nextTitle } } }
                  : prev,
              )
            }}
            className="flex-1 min-w-0"
          />
          <StatusBadge status={session.status} label={statusLabel} />
        </div>
        <p className="text-sm text-pulse-500">
          {t('join_code')} <code className="font-mono">{session.code}</code>
          {session.closed_at
            ? ` · ${t('closed_at', { date: new Date(session.closed_at).toLocaleString() })}`
            : results.source === 'live'
            ? ` · ${t('live_snapshot')}`
            : ''}
        </p>
      </header>

      {!question ? (
        <p className="text-sm text-pulse-500">{t('no_question')}</p>
      ) : results.total === 0 ? (
        <section className="rounded-xl border border-pulse-200 density-pad-5 space-y-3">
          <h2 className="text-xl font-semibold">{question.prompt}</h2>
          <p className="text-sm text-pulse-500">{t('no_votes')}</p>
        </section>
      ) : question.kind === 'word_cloud' || question.kind === 'open' ? (() => {
        const allEntries = Object.entries(results.counts)
        const topEntries = allEntries.slice(0, 25)
        const maxCount = Math.max(...topEntries.map(e => e[1]), 1)
        return (
          <section className="rounded-xl border border-pulse-200 density-pad-5 space-y-4">
            <h2 className="text-xl font-semibold">{question.prompt}</h2>
            <div className="flex flex-wrap gap-x-3 gap-y-2 items-baseline justify-start py-3">
              {topEntries.map(([word, count]) => (
                <span
                  key={word}
                  style={{ fontSize: `${getResultFontSize(count, maxCount)}px` }}
                  className="font-bold leading-tight text-pulse-800 dark:text-[#F0F2F8]"
                  title={`${word}: ${count}`}
                >
                  {word}
                </span>
              ))}
            </div>
            <p className="text-xs text-pulse-500">
              {t('total_responses_label', { count: results.total })}{' '}
              {allEntries.length > 25 ? t('showing_top', { shown: 25, total: allEntries.length }) : ''} · {sourceLabel}
            </p>
          </section>
        )
      })() : (
        <section className="rounded-xl border border-pulse-200 density-pad-5 space-y-4">
          <h2 className="text-xl font-semibold">{question.prompt}</h2>
          <ul className="space-y-3">
            {rows.map((r) => {
              const pct = results.total === 0 ? 0 : Math.round((r.count / results.total) * 100)
              const barPct = max === 0 ? 0 : Math.round((r.count / max) * 100)
              const isWinner = !!(winner && r.id === winner.id && r.count > 0)
              return (
                <ResultRow
                  key={r.id}
                  label={r.label}
                  count={r.count}
                  pct={pct}
                  barPct={barPct}
                  isWinner={isWinner}
                  winnerSuffix={` · ${t('winner')}`}
                />
              )
            })}
          </ul>
          <p className="text-xs text-pulse-500">
            {t('total_votes_label', { count: results.total })} · {sourceLabel}
          </p>
        </section>
      )}

      {(session.status === 'closed' || session.status === 'archived') && (
        <SimilarSessionsResultsPanel sessionId={session.id} />
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleExport}
          disabled={!question || results.total === 0}
          className="inline-flex items-center rounded-lg border border-pulse-300 dark:border-[#2A3858] text-pulse-700 dark:text-[#A8B3CC] hover:border-teal-500 hover:text-teal-700 dark:hover:border-teal-600 dark:hover:text-teal-400 px-4 py-2 font-medium disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 btn-motion"
        >
          {t('export_csv')}
        </button>
        <button
          type="button"
          onClick={() => void load()}
          className="text-sm text-teal-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 rounded"
        >
          {t('refresh')}
        </button>
      </div>
      </div>{/* end animate-page-enter */}
    </MainLayout>
  )
}
