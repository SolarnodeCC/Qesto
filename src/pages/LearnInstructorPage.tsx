import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { BarChart3, Download, GraduationCap } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useT } from '../i18n'
import { api } from '../api/client'
import MainLayout from '../layouts/MainLayout'
import { MetricCard } from '../components/MetricCard'

type InstructorAnalytics = {
  summary: {
    participants: number
    averagePercent: number
    medianPercent: number
    passRate: number
    passThreshold: number
  }
  distribution: Array<{ label: string; count: number }>
  difficulty: Array<{ questionId: string; difficulty: number; correctRate: number; responses: number }>
  hardestQuestionId: string | null
  easiestQuestionId: string | null
}

const DEMO_PAYLOAD = {
  configs: [{ questionId: 'q1', weight: 1, partialCredit: 'all_or_nothing' as const }],
  cohort: [
    { participantId: 'p1', responses: [{ questionId: 'q1', correct: 1, incorrect: 0, required: 1 }] },
    { participantId: 'p2', responses: [{ questionId: 'q1', correct: 1, incorrect: 0, required: 1 }] },
    { participantId: 'p3', responses: [{ questionId: 'q1', correct: 0, incorrect: 1, required: 1 }] },
    { participantId: 'p4', responses: [{ questionId: 'q1', correct: 1, incorrect: 0, required: 1 }] },
  ],
  passThreshold: 60,
}

export default function LearnInstructorPage() {
  const auth = useAuth()
  const t = useT('learn')
  const [analytics, setAnalytics] = useState<InstructorAnalytics | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function runAnalytics() {
    setLoading(true)
    setError(null)
    const res = await api<{ analytics: InstructorAnalytics }>('/api/learn/instructor/analytics', {
      method: 'POST',
      body: DEMO_PAYLOAD,
    })
    setLoading(false)
    if (res.ok) setAnalytics(res.data.analytics)
    else setError(res.error.message)
  }

  async function exportCsv() {
    setError(null)
    const res = await fetch('/api/learn/instructor/analytics', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ ...DEMO_PAYLOAD, format: 'csv' }),
    })
    if (!res.ok) {
      setError(t('instructor.export_error'))
      return
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'learn-results.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (auth.status === 'loading') {
    return (
      <MainLayout>
        <p className="text-sm text-pulse-500">{t('instructor.loading')}</p>
      </MainLayout>
    )
  }

  if (auth.status !== 'authenticated') {
    return <Navigate to="/login" replace />
  }

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto space-y-8">
        <header>
          <h1 className="inline-flex items-center gap-2 text-3xl font-bold text-pulse-900 dark:text-[#F0F2F8]" tabIndex={-1}>
            <GraduationCap size={28} aria-hidden="true" />
            {t('instructor.title')}
          </h1>
          <p className="mt-2 text-sm text-pulse-500 dark:text-[#8A96B0]">{t('instructor.subtitle')}</p>
        </header>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void runAnalytics()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:opacity-50"
          >
            <BarChart3 size={16} aria-hidden="true" />
            {loading ? t('instructor.analyzing') : t('instructor.analyze_demo')}
          </button>
          <button
            type="button"
            onClick={() => void exportCsv()}
            className="inline-flex items-center gap-2 rounded-lg border border-pulse-200 dark:border-[#2A3858] px-4 py-2 text-sm font-medium text-pulse-800 dark:text-[#F0F2F8] hover:bg-pulse-50 dark:hover:bg-[#1C2540] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <Download size={16} aria-hidden="true" />
            {t('instructor.export')}
          </button>
        </div>

        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

        {!analytics && !loading && (
          <p className="text-sm text-pulse-500">{t('instructor.empty')}</p>
        )}

        {analytics && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard label={t('instructor.participants')} value={analytics.summary.participants} icon={GraduationCap} />
              <MetricCard label={t('instructor.avgScore')} value={`${analytics.summary.averagePercent}%`} icon={BarChart3} />
              <MetricCard label={t('instructor.medianScore')} value={`${analytics.summary.medianPercent}%`} icon={BarChart3} />
              <MetricCard label={t('instructor.passRate')} value={`${Math.round(analytics.summary.passRate * 100)}%`} icon={BarChart3} />
            </div>

            <section className="rounded-xl border border-pulse-200 dark:border-[#1E2A45] bg-white dark:bg-[#151C2E] p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-pulse-500 mb-4">{t('instructor.scoreDistribution')}</h2>
              <ul className="grid gap-2 sm:grid-cols-2">
                {analytics.distribution.map((bucket) => (
                  <li key={bucket.label} className="flex items-center justify-between rounded-lg bg-pulse-50 dark:bg-[#0F1525] px-3 py-2 text-sm">
                    <span>{bucket.label}</span>
                    <span className="font-mono font-medium">{bucket.count}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-xl border border-pulse-200 dark:border-[#1E2A45] bg-white dark:bg-[#151C2E] p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-pulse-500 mb-4">{t('instructor.difficulty')}</h2>
              <ul className="space-y-2">
                {analytics.difficulty.map((q) => (
                  <li key={q.questionId} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="font-mono text-pulse-900 dark:text-[#F0F2F8]">{q.questionId}</span>
                    <span className="text-pulse-500">
                      {Math.round(q.difficulty * 100)}% {t('instructor.difficulty_index')} · {q.responses} {t('instructor.responses')}
                    </span>
                  </li>
                ))}
              </ul>
              {analytics.hardestQuestionId && (
                <p className="mt-4 text-sm text-pulse-600 dark:text-[#A8B3CC]">
                  {t('instructor.hardest')}: <span className="font-mono">{analytics.hardestQuestionId}</span>
                </p>
              )}
            </section>
          </>
        )}
      </div>
    </MainLayout>
  )
}
