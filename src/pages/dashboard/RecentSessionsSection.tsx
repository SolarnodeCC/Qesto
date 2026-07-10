import { Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useT } from '../../i18n'
import type { SessionSummary } from '../../hooks/useSessions'
import type { SessionsListState } from '../../hooks/useSessions'
import type { AggregatedTheme } from '../../hooks/useInsights'
import type { DashboardSection } from '../../layouts/AppShellLayout'
import { StatusBadge } from './SessionCard'

// ── Helpers ──────────────────────────────────────────────────────────────────

function sessionLink(s: SessionSummary): string {
  if (s.status === 'live') return `/sessions/${s.id}/present`
  if (s.status === 'closed' || s.status === 'archived') return `/sessions/${s.id}/results`
  return `/sessions/${s.id}/launchpad`
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (days >= 1) return `${days}d ago`
  if (hours >= 1) return `${hours}h ago`
  if (minutes >= 1) return `${minutes}m ago`
  return 'just now'
}

// ── Skeletons ─────────────────────────────────────────────────────────────────

function ListRowSkeleton({ isFirst }: { isFirst: boolean }) {
  return (
    <div
      className={`flex items-center gap-4 px-[18px] py-[14px] ${isFirst ? '' : 'border-t border-pulse-100 dark:border-[#1E2A45]'}`}
      aria-hidden="true"
    >
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="h-4 w-3/5 rounded skeleton-shimmer bg-pulse-200 dark:bg-pulse-800" />
        <div className="h-3 w-1/3 rounded skeleton-shimmer bg-pulse-200 dark:bg-pulse-800" />
      </div>
      <div className="h-6 w-14 rounded-full skeleton-shimmer bg-pulse-200 dark:bg-pulse-800 shrink-0" />
    </div>
  )
}

// ── AI recap right panel ──────────────────────────────────────────────────────

interface AIRecapPanelProps {
  themes: AggregatedTheme[]
  loading: boolean
  onViewInsights: () => void
}

function AIRecapPanel({ themes, loading, onViewInsights }: AIRecapPanelProps) {
  const top = themes[0] ?? null
  const bars = themes.slice(0, 3)
  const totalCount = bars.reduce((s, t) => s + t.sessionCount, 0) || 1

  return (
    <div>
      <h2 className="text-lg font-semibold text-pulse-900 dark:text-[#F0F2F8] mb-4">
        Latest AI recap
      </h2>
      {/* Violet left-border accent panel — matches design reference exactly */}
      <div
        className="rounded-r-xl border border-l-0 border-pulse-200 dark:border-[#1E2A45] bg-violet-50/70 dark:bg-[#1A1036]/60"
        style={{ borderLeft: '3px solid #7C3AED' }}
      >
        <div className="px-6 py-[18px]">
          {loading ? (
            <div className="space-y-3" aria-hidden="true">
              <div className="h-4 w-2/3 rounded skeleton-shimmer bg-violet-200 dark:bg-violet-800/40" />
              <div className="h-3 w-full rounded skeleton-shimmer bg-violet-200 dark:bg-violet-800/40" />
              <div className="h-3 w-4/5 rounded skeleton-shimmer bg-violet-200 dark:bg-violet-800/40" />
              <div className="h-2 w-full rounded skeleton-shimmer bg-violet-200 dark:bg-violet-800/40 mt-4" />
              <div className="h-2 w-3/4 rounded skeleton-shimmer bg-violet-200 dark:bg-violet-800/40" />
            </div>
          ) : !top ? (
            /* Empty state */
            <div className="flex flex-col items-center text-center py-4 gap-2">
              <span className="flex items-center justify-center w-16 h-16 rounded-xl bg-violet-100 dark:bg-violet-900/30 text-violet-500">
                <Sparkles size={20} aria-hidden="true" />
              </span>
              <p className="text-sm font-semibold text-pulse-700 dark:text-[#A8B3CC]">No AI recap yet</p>
              <p className="text-xs text-pulse-500 dark:text-[#8A96B0]">
                Complete a session to generate insights
              </p>
              <button
                type="button"
                onClick={onViewInsights}
                className="mt-1 text-xs font-semibold text-violet-700 dark:text-violet-400 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 rounded"
              >
                Go to Insights →
              </button>
            </div>
          ) : (
            /* Themes found */
            <>
              {/* AI badge */}
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide border border-violet-200 dark:border-violet-700">
                  <Sparkles size={10} aria-hidden="true" />
                  AI recap
                </span>
                <span className="font-mono text-[11px] text-pulse-400 dark:text-[#8A96B0]">
                  {themes.length} theme{themes.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Top theme */}
              <div className="text-[15px] font-semibold text-pulse-900 dark:text-[#F0F2F8] mb-1 leading-snug">
                {top.title}
              </div>
              <p className="text-[13px] leading-relaxed text-pulse-600 dark:text-[#A8B3CC] mb-4 line-clamp-3">
                {top.description}
              </p>

              {/* TallyBar rows */}
              <div className="flex flex-col gap-2.5">
                {bars.map((t, i) => {
                  const pct = Math.round((t.sessionCount / totalCount) * 100)
                  return (
                    <div key={t.id}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[12px] text-pulse-700 dark:text-[#A8B3CC] truncate pr-2 leading-none">
                          {t.title}
                        </span>
                        <span className="text-[11px] font-semibold text-violet-700 dark:text-violet-300 shrink-0 leading-none">
                          {t.sessionCount}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-violet-100 dark:bg-violet-900/30 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${i === 0 ? 'bg-violet-500' : 'bg-violet-300 dark:bg-violet-600'}`}
                          style={{ width: `${Math.max(pct, 4)}%` }}
                          role="progressbar"
                          aria-valuenow={pct}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={t.title}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>

              <button
                type="button"
                onClick={onViewInsights}
                className="mt-4 text-xs font-semibold text-violet-700 dark:text-violet-400 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 rounded"
              >
                View all insights →
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

interface RecentSessionsSectionProps {
  state: SessionsListState
  sessions: SessionSummary[]
  insightThemes: AggregatedTheme[]
  insightsLoading: boolean
  setActiveSection: (s: DashboardSection) => void
}

export function RecentSessionsSection({
  state,
  sessions,
  insightThemes,
  insightsLoading,
  setActiveSection,
}: RecentSessionsSectionProps) {
  const t = useT('dashboard')
  const isLoading = state.status === 'loading'

  function scrollToInsights() {
    const el = document.getElementById('section-insights')
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActiveSection('insights')
  }

  return (
    <section aria-labelledby="recent-heading">
      {/* 2-column layout: recent sessions (1.5fr) | AI recap (1fr) */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-8 items-start">
        {/* ── Left: recent sessions list ── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2
              id="recent-heading"
              className="text-lg font-semibold text-pulse-900 dark:text-[#F0F2F8]"
            >
              {t('recentSessions')}
            </h2>
            <Link
              to="#all-sessions"
              onClick={(e) => {
                e.preventDefault()
                const el = document.getElementById('section-all-sessions')
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
              className="text-[13px] font-medium text-teal-700 dark:text-teal-400 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded"
            >
              View all
            </Link>
          </div>

          {/* List card */}
          <div className="rounded-xl border border-pulse-200 dark:border-[#1E2A45] bg-white dark:bg-[#151C2E] shadow-card overflow-hidden">
            {isLoading ? (
              [0, 1, 2, 3].map((i) => <ListRowSkeleton key={i} isFirst={i === 0} />)
            ) : state.status === 'error' ? (
              <p role="alert" className="px-6 py-4 text-sm text-red-600 dark:text-red-400">
                {state.error.message}
              </p>
            ) : sessions.length === 0 ? (
              <div className="flex flex-col items-center text-center py-16 px-8 gap-2">
                <p className="text-sm font-medium text-pulse-700 dark:text-[#A8B3CC]">
                  {t('noSessionsYet')}
                </p>
              </div>
            ) : (
              <ul role="list">
                {sessions.map((s, i) => {
                  const link = sessionLink(s)
                  return (
                    <li
                      key={s.id}
                      className={`flex items-center gap-4 px-[18px] py-[14px] hover:bg-pulse-50 dark:hover:bg-[#1C2540]/60 transition-colors ${
                        i === 0 ? '' : 'border-t border-pulse-100 dark:border-[#1E2A45]'
                      }`}
                    >
                      {/* Title + meta */}
                      <div className="flex-1 min-w-0">
                        <Link
                          to={link}
                          className="block text-[15px] font-semibold text-pulse-900 dark:text-[#F0F2F8] truncate hover:text-teal-700 dark:hover:text-teal-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded"
                        >
                          {s.title}
                        </Link>
                        <div className="flex items-center gap-3 mt-0.5 text-[12px] text-pulse-500 dark:text-[#8A96B0]">
                          <time dateTime={new Date(s.created_at).toISOString()}>
                            {relativeTime(s.created_at)}
                          </time>
                          {s.code && (
                            <>
                              <span aria-hidden="true">·</span>
                              <code className="font-mono tracking-widest text-[11px]">{s.code}</code>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Status badge */}
                      <StatusBadge status={s.status} />

                      {/* Recap shortcut (only for closed/archived) */}
                      {(s.status === 'closed' || s.status === 'archived') && (
                        <Link
                          to={`/sessions/${s.id}/results`}
                          className="flex items-center gap-1 text-[13px] font-medium text-violet-700 dark:text-violet-400 hover:text-violet-800 dark:hover:text-violet-300 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 rounded shrink-0"
                        >
                          <Sparkles size={14} aria-hidden="true" />
                          Recap
                        </Link>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>

        {/* ── Right: AI recap panel ── */}
        <AIRecapPanel
          themes={insightThemes}
          loading={insightsLoading}
          onViewInsights={scrollToInsights}
        />
      </div>
    </section>
  )
}
