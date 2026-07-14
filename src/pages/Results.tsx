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

type QuestionResultData = {
  id: string
  kind: string
  prompt: string
  options: PollOption[]
  counts: Record<string, number>
  total: number
}

type ResultsPayload = {
  session: {
    id: string
    title: string
    status: SessionStatus
    code: string
    closed_at: number | null
  }
  questions: QuestionResultData[]
  source: 'live' | 'persisted'
}

type State =
  | { status: 'loading' }
  | { status: 'ready'; data: ResultsPayload }
  | { status: 'error'; error: ApiError }

function toCsv(rows: string[][]): string {
  return rows.map((row) => csvRow(row)).join('\n')
}

// Renders one question's recap slice: a no-votes notice, a word cloud
// (open/word_cloud), or a tally list. Extracted so the page can loop over every
// question in the session rather than showing only the first.
function QuestionResult({
  question,
  number,
  sourceLabel,
  t,
}: {
  question: QuestionResultData
  number: number
  sourceLabel: string
  t: ReturnType<typeof useT>
}) {
  const rows = question.options.map((o) => ({
    id: o.id,
    label: o.label,
    count: question.counts[o.id] ?? 0,
  }))
  const max = rows.reduce((m, r) => Math.max(m, r.count), 0)
  const winner = rows.length > 0 ? rows.reduce((best, r) => (r.count > best.count ? r : best), rows[0]) : null

  const heading = (
    <p className="text-xs font-medium uppercase tracking-wide text-pulse-400">{t('question', { number })}</p>
  )

  if (question.total === 0) {
    return (
      <section className="rounded-xl border border-pulse-200 density-pad-5 space-y-3">
        {heading}
        <h2 className="text-xl font-semibold">{question.prompt}</h2>
        <p className="text-sm text-pulse-500">{t('no_votes')}</p>
      </section>
    )
  }

  if (question.kind === 'word_cloud' || question.kind === 'open') {
    const allEntries = Object.entries(question.counts)
    const topEntries = allEntries.slice(0, 25)
    const maxCount = Math.max(...topEntries.map((e) => e[1]), 1)
    return (
      <section className="rounded-xl border border-pulse-200 density-pad-5 space-y-4">
        {heading}
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
          {t('total_responses_label', { count: question.total })}{' '}
          {allEntries.length > 25 ? t('showing_top', { shown: 25, total: allEntries.length }) : ''} · {sourceLabel}
        </p>
      </section>
    )
  }

  return (
    <section className="rounded-xl border border-pulse-200 density-pad-5 space-y-4">
      {heading}
      <h2 className="text-xl font-semibold">{question.prompt}</h2>
      <ul className="space-y-3">
        {rows.map((r) => {
          const pct = question.total === 0 ? 0 : Math.round((r.count / question.total) * 100)
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
        {t('total_votes_label', { count: question.total })} · {sourceLabel}
      </p>
    </section>
  )
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
      <MainLayout mainClassName="min-h-screen max-w-3xl mx-auto p-12 space-y-8">
        <ResultsSectionSkeleton bars={4} />
      </MainLayout>
    )
  }
  if (auth.status === 'anonymous') return <Navigate to="/login" replace />

  if (state.status === 'loading') {
    return (
      /* LAYOUT-SKELETON-01: geometric skeleton prevents layout shift while data loads */
      <MainLayout mainClassName="min-h-screen max-w-3xl mx-auto p-12 space-y-8">
        <ResultsSectionSkeleton bars={4} />
      </MainLayout>
    )
  }
  if (state.status === 'error') {
    return (
      <MainLayout mainClassName="min-h-screen max-w-2xl mx-auto p-12 space-y-4">
        <p role="alert" className="text-sm text-red-600">
          {state.error.message}
        </p>
        <Link to="/dashboard" className="text-teal-600 hover:underline">
          ← {t('back')}
        </Link>
      </MainLayout>
    )
  }

  const { session, questions, source } = state.data
  const totalVotes = questions.reduce((sum, q) => sum + q.total, 0)

  const STATUS_KEY: Record<string, string> = {
    live: 'status_live', closed: 'status_closed', draft: 'status_draft', archived: 'status_archived',
  }
  const statusLabel = STATUS_KEY[session.status] ? t(STATUS_KEY[session.status]) : session.status
  const sourceLabel = t('source_label', { source: source === 'live' ? t('source_live') : t('source_persisted') })

  function handleExport() {
    if (questions.length === 0) return
    const header = [t('csv.question'), t('csv.option'), t('csv.votes'), t('csv.percent')]
    const body: string[][] = []
    for (const q of questions) {
      // Poll-style questions carry options; open/word_cloud store the response
      // text as the count key, so fall back to the counts map when there are
      // no options — otherwise those questions would be omitted from the CSV.
      const entries =
        q.options.length > 0
          ? q.options.map((o) => ({ label: o.label, count: q.counts[o.id] ?? 0 }))
          : Object.entries(q.counts).map(([label, count]) => ({ label, count }))
      for (const e of entries) {
        body.push([
          q.prompt,
          e.label,
          String(e.count),
          q.total === 0 ? '0%' : `${Math.round((e.count / q.total) * 100)}%`,
        ])
      }
    }
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
            : source === 'live'
            ? ` · ${t('live_snapshot')}`
            : ''}
        </p>
      </header>

      {questions.length === 0 ? (
        <p className="text-sm text-pulse-500">{t('no_question')}</p>
      ) : (
        <div className="density-stack-6">
          {questions.map((q, i) => (
            <QuestionResult key={q.id} question={q} number={i + 1} sourceLabel={sourceLabel} t={t} />
          ))}
        </div>
      )}

      {(session.status === 'closed' || session.status === 'archived') && (
        <SimilarSessionsResultsPanel sessionId={session.id} />
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleExport}
          disabled={questions.length === 0 || totalVotes === 0}
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
