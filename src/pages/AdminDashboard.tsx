import { useEffect, useState, type ReactNode } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Activity, BarChart3, LayoutDashboard, Radar, Users } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useAdminMetrics, type HistoricalBucket } from '../hooks/useAdminMetrics'
import { useAdminKpis } from '../hooks/useAdminKpis'
import { useAdminOps, type OpsSummary } from '../hooks/useAdminOps'
import { useQuotaUsage } from '../hooks/useQuotaUsage'
import { useT } from '../i18n'
import AppShellLayout, { type DashboardSection } from '../layouts/AppShellLayout'
import { ResultsSectionSkeleton } from '../components/SkeletonLoader'
import { Heading, Body, Caption, Button, Card, MetricCard, StatCard, Section, SkeletonCard } from '../ui/components'
import AuditLogViewer from '../components/AuditLogViewer'
import AdminUsersTab from '../components/admin/AdminUsersTab'
import AdminOpsTab from '../components/admin/AdminOpsTab'
import AdminAnalyticsTab from '../components/admin/AdminAnalyticsTab'
import PlatformOverviewPanel from '../components/admin/PlatformOverviewPanel'
import ObservabilityPanel from '../components/admin/ObservabilityPanel'
import BuildStamp from '../components/BuildStamp'

const SUPERUSER_EMAIL = (import.meta.env.VITE_SUPERUSER_EMAIL as string | undefined) ?? ''

type AdminTab = 'dashboard' | 'observability' | 'users' | 'ops' | 'analytics'

const TAB_CONFIG: Array<{
  id: AdminTab
  labelKey: string
  // Literal label override — used for tabs without an i18n key yet (Module 2).
  label?: string
  icon: ReactNode
}> = [
  { id: 'dashboard', labelKey: 'dashboard', icon: <LayoutDashboard size={16} aria-hidden="true" /> },
  { id: 'observability', labelKey: 'observability', label: 'Observability', icon: <Radar size={16} aria-hidden="true" /> },
  { id: 'users', labelKey: 'users', icon: <Users size={16} aria-hidden="true" /> },
  { id: 'ops', labelKey: 'ops', icon: <Activity size={16} aria-hidden="true" /> },
  { id: 'analytics', labelKey: 'analytics', icon: <BarChart3 size={16} aria-hidden="true" /> },
]

function defaultHistoricalRange() {
  const endDate = new Date()
  const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000)
  return { startDate, endDate }
}

function PlatformHealthStrip({
  ops,
  t,
  onViewOps,
}: {
  ops: OpsSummary | null
  t: (key: string) => string
  onViewOps?: () => void
}) {
  if (!ops) return null

  const styles = {
    healthy: { wrap: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800', text: 'text-green-700 dark:text-green-400', dot: 'bg-green-500', pulse: true },
    degraded: { wrap: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800', text: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500', pulse: false },
    down: { wrap: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800', text: 'text-red-700 dark:text-red-400', dot: 'bg-red-500', pulse: false },
  }
  const labels = {
    healthy: t('allSystemsOperational'),
    degraded: t('partialDegradation'),
    down: t('majorOutage'),
  }
  const s = styles[ops.status]

  return (
    <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border px-4 py-2.5 ${s.wrap}`}>
      <div className="flex items-center gap-2.5">
        <span className={`w-2 h-2 rounded-full shrink-0 ${s.dot} ${s.pulse ? 'animate-pulse' : ''}`} />
        <span className={`text-sm font-semibold ${s.text}`}>{labels[ops.status]}</span>
        <span className="text-xs text-pulse-500 dark:text-[#8A96B0]">
          {new Date(ops.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        {(ops.sev1 > 0 || ops.sev2 > 0 || ops.sev3 > 0) && (
          <div className="flex gap-3 text-xs font-semibold">
            {ops.sev1 > 0 && <span className="text-red-600 dark:text-red-400">SEV1: {ops.sev1}</span>}
            {ops.sev2 > 0 && <span className="text-amber-600 dark:text-amber-400">SEV2: {ops.sev2}</span>}
            {ops.sev3 > 0 && <span className="text-teal-600 dark:text-teal-400">SEV3: {ops.sev3}</span>}
          </div>
        )}
        {onViewOps && (
          <button
            type="button"
            onClick={onViewOps}
            className="text-xs font-medium text-violet-600 dark:text-violet-400 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 rounded"
          >
            {t('viewOps')}
          </button>
        )}
      </div>
    </div>
  )
}

function LatencySparkline({ data, emptyLabel }: { data: HistoricalBucket[]; emptyLabel: string }) {
  const points = data
    .filter((d) => d.route === null)
    .sort((a, b) => a.bucket_ts - b.bucket_ts)
    .slice(-40)

  if (points.length < 2) {
    return (
      <div className="flex items-center justify-center h-[100px] text-body-s text-pulse-500 dark:text-[#3A4A6B]">
        {emptyLabel}
      </div>
    )
  }

  const W = 400
  const H = 100
  const PL = 38
  const PR = 8
  const PT = 10
  const PB = 22
  const chartW = W - PL - PR
  const chartH = H - PT - PB

  const vals = points.map((p) => p.p95_ms)
  const maxVal = Math.max(...vals, 1)
  const minVal = Math.min(...vals)
  const range = maxVal - minVal || 1

  const toX = (i: number) => PL + (i / (points.length - 1)) * chartW
  const toY = (v: number) => PT + chartH - ((v - minVal) / range) * chartH

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(p.p95_ms).toFixed(1)}`).join(' ')
  const areaPath = [linePath, `L ${toX(points.length - 1).toFixed(1)} ${(PT + chartH).toFixed(1)}`, `L ${toX(0).toFixed(1)} ${(PT + chartH).toFixed(1)} Z`].join(' ')

  const last = points[points.length - 1]
  const lineColor = last.p95_ms > 500 ? '#ef4444' : '#14b8a6'

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-label="P95 latency trend">
      <defs>
        <linearGradient id="lat-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={lineColor} stopOpacity="0.25" />
          <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#lat-grad)" />
      <path d={linePath} fill="none" stroke={lineColor} strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx={toX(points.length - 1)} cy={toY(last.p95_ms)} r="3" fill={lineColor} />
      <text x={toX(points.length - 1) - 5} y={toY(last.p95_ms) - 6} textAnchor="end" fontSize="10" fill={lineColor} fontWeight="600">{last.p95_ms}ms</text>
      <text x={PL - 3} y={PT + 4} textAnchor="end" fontSize="9" fill="#94a3b8">{maxVal}ms</text>
      <text x={PL - 3} y={PT + chartH} textAnchor="end" fontSize="9" fill="#94a3b8">{minVal}ms</text>
      <text x={PL} y={H - 5} fontSize="9" fill="#94a3b8">{new Date(points[0].bucket_ts).toLocaleDateString()}</text>
      <text x={W - PR} y={H - 5} textAnchor="end" fontSize="9" fill="#94a3b8">{new Date(last.bucket_ts).toLocaleDateString()}</text>
    </svg>
  )
}

function computeTrend(
  data: HistoricalBucket[],
  key: 'p95_ms' | 'error_count',
): { value: number; direction: 'up' | 'down' } | undefined {
  const agg = data.filter((d) => d.route === null).sort((a, b) => a.bucket_ts - b.bucket_ts)
  if (agg.length < 4) return undefined
  const half = Math.floor(agg.length / 2)
  const avg = (arr: HistoricalBucket[]) =>
    arr.reduce((s, d) => (key === 'p95_ms' ? s + d.p95_ms : s + (d.request_count > 0 ? d.error_count / d.request_count : 0)), 0) / arr.length
  const older = avg(agg.slice(0, half))
  const newer = avg(agg.slice(half))
  if (older === 0) return undefined
  const pct = ((newer - older) / older) * 100
  return { value: Math.abs(pct), direction: pct >= 0 ? 'up' : 'down' }
}

function formatDateInput(d: Date): string {
  return d.toISOString().split('T')[0]!
}

export default function AdminDashboard() {
  const auth = useAuth()
  const t = useT('admin')
  const navigate = useNavigate()
  const initialRange = defaultHistoricalRange()
  const {
    liveMetrics,
    historicalData,
    liveLoading,
    historicalLoading,
    error: metricsError,
    historicalError,
    fetchHistorical,
    exportCSV,
  } = useAdminMetrics()
  const { kpis } = useAdminKpis()
  const { ops } = useAdminOps()
  const [startDate, setStartDate] = useState(initialRange.startDate)
  const [endDate, setEndDate] = useState(initialRange.endDate)
  const [exporting, setExporting] = useState(false)
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard')

  const userId = auth.status === 'authenticated' ? auth.user.id : undefined
  void useQuotaUsage(userId)

  useEffect(() => {
    void fetchHistorical(initialRange.startDate, initialRange.endDate)
  }, [fetchHistorical])

  if (auth.status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--color-bg)]">
        <div className="h-8 w-48 rounded-lg bg-pulse-200 dark:bg-pulse-800 skeleton-shimmer" aria-hidden="true" />
      </div>
    )
  }

  if (auth.status === 'anonymous') return <Navigate to="/login" replace />
  if (auth.user.email !== SUPERUSER_EMAIL) return <Navigate to="/dashboard" replace />

  const isSuperuser = true

  const latencyTrend = computeTrend(historicalData, 'p95_ms')
  const errorTrend = computeTrend(historicalData, 'error_count')

  const dateRangeLabel = t('dateRangeLabel', {
    start: startDate.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
    end: endDate.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }),
  })

  function handleSectionChange(section: DashboardSection) {
    navigate('/dashboard')
    if (section !== 'home') {
      requestAnimationFrame(() => {
        document.getElementById(`section-${section}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    }
  }

  function applyHistoricalRange() {
    void fetchHistorical(startDate, endDate)
  }

  return (
    <AppShellLayout
      activeSection="home"
      onSectionChange={handleSectionChange}
      isSuperuser={isSuperuser}
    >
      <div className="max-w-6xl mx-auto px-6 lg:px-10 py-10 animate-page-enter space-y-6">
        <header>
          <Heading level="l">{t('platformAdminTitle')}</Heading>
          <Body size="s" className="text-pulse-500 dark:text-[#8A96B0] mt-space-2">{t('realtimePlatformObservability')}</Body>
        </header>

        <div
          role="tablist"
          aria-label="Admin sections"
          className="flex flex-wrap gap-1 rounded-xl bg-pulse-100 dark:bg-[#0F1526] p-1 w-full sm:w-auto overflow-x-auto"
        >
          {TAB_CONFIG.map(({ id, labelKey, label, icon }) => (
            <button
              key={id}
              role="tab"
              id={`tab-${id}`}
              aria-controls={`tabpanel-${id}`}
              aria-selected={activeTab === id}
              onClick={() => setActiveTab(id)}
              className={[
                'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg min-h-[44px] transition-all duration-150 shrink-0',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1',
                activeTab === id
                  ? 'bg-white dark:bg-[#1C2540] text-pulse-900 dark:text-[#F0F2F8] shadow-sm'
                  : 'text-pulse-500 dark:text-[#8A96B0] hover:text-pulse-800 dark:hover:text-[#A8B3CC]',
              ].join(' ')}
            >
              {icon}
              {label ?? t(labelKey)}
            </button>
          ))}
        </div>

        {activeTab === 'dashboard' && (
          <div role="tabpanel" id="tabpanel-dashboard" aria-labelledby="tab-dashboard" className="space-y-6">
            <PlatformHealthStrip ops={ops} t={t} onViewOps={() => setActiveTab('ops')} />

            <PlatformOverviewPanel onNavigate={(tab) => setActiveTab(tab)} />

            {kpis && (
              <Section>
                <Heading level="m" className="border-l-4 border-teal-500 pl-3">{t('platformOverview')}</Heading>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                  <StatCard label={t('liveSessions')} value={kpis.live_sessions} colour="text-teal-600" />
                  <StatCard label={t('totalUsers')} value={kpis.total_users} colour="text-purple-600" />
                  <StatCard label={t('sessionsToday')} value={kpis.sessions_today} colour="text-green-600" />
                  <StatCard label={t('sessionsThisMonth')} value={kpis.sessions_this_month} colour="text-blue-600" />
                  <StatCard label={t('totalSessions')} value={kpis.total_sessions} colour="text-amber-500" />
                  <StatCard label={t('estimatedAICosts')} value={`€${(kpis.ai_cost_estimate_cents / 100).toFixed(2)}`} colour="text-teal-600" />
                </div>
              </Section>
            )}

            <Section>
              <Heading level="m" className="border-l-4 border-teal-500 pl-3">{t('liveLast5min')}</Heading>
              {liveLoading && !liveMetrics ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <SkeletonCard key={i} />
                  ))}
                </div>
              ) : metricsError && !liveMetrics ? (
                <Body className="text-signal-error">{metricsError}</Body>
              ) : liveMetrics ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  <MetricCard label={t('activeSessions')} value={liveMetrics.active_sessions} />
                  <MetricCard label={t('participants')} value={liveMetrics.total_participants} />
                  <MetricCard label={t('revenue24h')} value={`€${(liveMetrics.revenue_24h_cents / 100).toFixed(2)}`} />
                  <MetricCard
                    label={t('p95Latency')}
                    value={`${liveMetrics.p95_latency_ms}ms`}
                    alert={liveMetrics.p95_latency_ms > 500}
                    {...(latencyTrend ? { trend: { ...latencyTrend, inverted: true as const } } : {})}
                  />
                  <MetricCard
                    label={t('errorRate')}
                    value={`${(liveMetrics.error_rate * 100).toFixed(1)}%`}
                    alert={liveMetrics.error_rate > 0.05}
                    {...(errorTrend ? { trend: { ...errorTrend, inverted: true as const } } : {})}
                  />
                </div>
              ) : null}
              {liveMetrics?.isSynthetic && <Caption className="text-amber-600">{t('syntheticMetricsWarning')}</Caption>}
            </Section>

            <Section>
              <Heading level="m" className="border-l-4 border-teal-500 pl-3">{t('p95LatencyTrend')}</Heading>
              <Body size="s" className="text-pulse-500 dark:text-[#8A96B0] mb-2">{dateRangeLabel}</Body>
              <Card>
                <LatencySparkline data={historicalData} emptyLabel={t('noDataInRange')} />
              </Card>
            </Section>

            <Section>
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
                <div>
                  <Heading level="m" className="border-l-4 border-teal-500 pl-3">{t('historicalData')}</Heading>
                  <Body size="s" className="text-pulse-500 dark:text-[#8A96B0] mt-1">{dateRangeLabel}</Body>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="date"
                    value={formatDateInput(startDate)}
                    onChange={(e) => setStartDate(new Date(e.target.value))}
                    className="text-body-s border border-pulse-300 dark:border-[#2A3858] rounded-md px-3 py-1.5 bg-white dark:bg-[#1C2540] text-pulse-900 dark:text-[#F0F2F8] min-h-[44px]"
                    aria-label="Start date"
                  />
                  <input
                    type="date"
                    value={formatDateInput(endDate)}
                    onChange={(e) => setEndDate(new Date(e.target.value))}
                    className="text-body-s border border-pulse-300 dark:border-[#2A3858] rounded-md px-3 py-1.5 bg-white dark:bg-[#1C2540] text-pulse-900 dark:text-[#F0F2F8] min-h-[44px]"
                    aria-label="End date"
                  />
                  <Button variant="secondary" size="sm" onClick={applyHistoricalRange} disabled={historicalLoading}>
                    {t('applyDateRange')}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={async () => {
                      setExporting(true)
                      await exportCSV(startDate, endDate)
                      setExporting(false)
                    }}
                    disabled={exporting}
                  >
                    {exporting ? t('exporting') : t('exportCsv')}
                  </Button>
                </div>
              </div>

              {historicalLoading && historicalData.length === 0 ? (
                <ResultsSectionSkeleton bars={6} />
              ) : historicalError ? (
                <Body className="text-signal-error">{historicalError}</Body>
              ) : historicalData.length > 0 ? (
                <Card className="overflow-x-auto max-h-[480px] overflow-y-auto">
                  <table className="w-full text-body-s">
                    <thead className="sticky top-0 bg-white dark:bg-[#1C2540] z-10">
                      <tr className="border-b border-pulse-200 dark:border-[#1E2A45]">
                        <th className="text-left py-2 px-2 font-medium text-pulse-600 dark:text-[#8A96B0]">{t('timestamp')}</th>
                        <th className="text-left py-2 px-2 font-medium text-pulse-600 dark:text-[#8A96B0]">{t('route')}</th>
                        <th className="text-right py-2 px-2 font-medium text-pulse-600 dark:text-[#8A96B0]">p50</th>
                        <th className="text-right py-2 px-2 font-medium text-pulse-600 dark:text-[#8A96B0]">p95</th>
                        <th className="text-right py-2 px-2 font-medium text-pulse-600 dark:text-[#8A96B0]">p99</th>
                        <th className="text-right py-2 px-2 font-medium text-pulse-600 dark:text-[#8A96B0]">{t('errorPercent')}</th>
                        <th className="text-right py-2 px-2 font-medium text-pulse-600 dark:text-[#8A96B0]">{t('requests')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-pulse-100 dark:divide-[#1E2A45]">
                      {historicalData.map((row, idx) => (
                        <tr key={`${row.bucket_ts}-${row.route ?? 'all'}-${idx}`} className="hover:bg-pulse-50 dark:hover:bg-[#0F1526]">
                          <td className="py-2 px-2 text-pulse-700 dark:text-[#A8B3CC]">{new Date(row.bucket_ts).toLocaleString()}</td>
                          <td className="py-2 px-2 font-mono text-xs text-pulse-500 dark:text-[#8A96B0]">{row.route ?? '(all)'}</td>
                          <td className="text-right py-2 px-2">{row.p50_ms}ms</td>
                          <td className="text-right py-2 px-2 font-medium">{row.p95_ms}ms</td>
                          <td className="text-right py-2 px-2">{row.p99_ms}ms</td>
                          <td className="text-right py-2 px-2">{((row.error_count / (row.request_count || 1)) * 100).toFixed(1)}%</td>
                          <td className="text-right py-2 px-2 text-pulse-500">{row.request_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              ) : (
                <Body className="text-pulse-500">{t('noDataInRange')}</Body>
              )}
            </Section>

            <Section>
              <Heading level="m" className="border-l-4 border-teal-500 pl-3">{t('auditLog')}</Heading>
              <AuditLogViewer />
            </Section>
          </div>
        )}

        {activeTab === 'observability' && (
          <div role="tabpanel" id="tabpanel-observability" aria-labelledby="tab-observability">
            <ObservabilityPanel />
          </div>
        )}

        {activeTab === 'users' && (
          <div role="tabpanel" id="tabpanel-users" aria-labelledby="tab-users">
            <AdminUsersTab />
          </div>
        )}

        {activeTab === 'ops' && (
          <div role="tabpanel" id="tabpanel-ops" aria-labelledby="tab-ops">
            <AdminOpsTab />
          </div>
        )}

        {activeTab === 'analytics' && (
          <div role="tabpanel" id="tabpanel-analytics" aria-labelledby="tab-analytics">
            <AdminAnalyticsTab />
          </div>
        )}

        <BuildStamp />
      </div>
    </AppShellLayout>
  )
}
