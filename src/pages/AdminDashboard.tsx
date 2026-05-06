import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useAdminMetrics, type HistoricalBucket } from '../hooks/useAdminMetrics'
import { useAdminKpis } from '../hooks/useAdminKpis'
import { useAdminOps, type OpsSummary } from '../hooks/useAdminOps'
import { useT } from '../i18n'

const SUPERUSER_EMAIL = (import.meta.env.VITE_SUPERUSER_EMAIL as string | undefined) ?? ''
import MainLayout from '../layouts/MainLayout'
import { ResultsSectionSkeleton } from '../components/SkeletonLoader'
import { Heading, Body, Caption, Button, Card, MetricCard, Section, SkeletonCard } from '../ui/components'
import AuditLogViewer from '../components/AuditLogViewer'
import AdminUsersTab from '../components/admin/AdminUsersTab'
import AdminOpsTab from '../components/admin/AdminOpsTab'
import AdminAnalyticsTab from '../components/admin/AdminAnalyticsTab'
import BuildStamp from '../components/BuildStamp'

type AdminTab = 'dashboard' | 'users' | 'ops' | 'analytics'

// ─── Platform health strip ────────────────────────────────────────────────────

function PlatformHealthStrip({ ops }: { ops: OpsSummary | null }) {
  if (!ops) return null

  const styles = {
    healthy: {
      wrap: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
      text: 'text-green-700 dark:text-green-400',
      dot: 'bg-green-500',
      pulse: true,
    },
    degraded: {
      wrap: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
      text: 'text-amber-700 dark:text-amber-400',
      dot: 'bg-amber-500',
      pulse: false,
    },
    down: {
      wrap: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
      text: 'text-red-700 dark:text-red-400',
      dot: 'bg-red-500',
      pulse: false,
    },
  }

  const s = styles[ops.status]
  const label = { healthy: 'Healthy', degraded: 'Degraded', down: 'Down' }[ops.status]

  return (
    <div className={`flex items-center justify-between rounded-lg border px-4 py-2.5 ${s.wrap}`}>
      <div className="flex items-center gap-2.5">
        <span className={`w-2 h-2 rounded-full ${s.dot} ${s.pulse ? 'animate-pulse' : ''}`} />
        <span className={`text-sm font-semibold ${s.text}`}>Platform {label}</span>
        <span className="text-xs text-pulse-400 dark:text-[#6B7A99]">
          Updated {new Date(ops.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      {(ops.sev1 > 0 || ops.sev2 > 0 || ops.sev3 > 0) && (
        <div className="flex gap-3 text-xs font-semibold">
          {ops.sev1 > 0 && <span className="text-red-600 dark:text-red-400">SEV1: {ops.sev1}</span>}
          {ops.sev2 > 0 && <span className="text-amber-600 dark:text-amber-400">SEV2: {ops.sev2}</span>}
          {ops.sev3 > 0 && <span className="text-teal-600 dark:text-teal-400">SEV3: {ops.sev3}</span>}
        </div>
      )}
    </div>
  )
}

// ─── P95 latency sparkline (inline SVG, no external deps) ─────────────────────

function LatencySparkline({ data }: { data: HistoricalBucket[] }) {
  const points = data
    .filter((d) => d.route === null)
    .sort((a, b) => a.bucket_ts - b.bucket_ts)
    .slice(-40)

  if (points.length < 2) {
    return (
      <div className="flex items-center justify-center h-[100px] text-body-s text-pulse-300 dark:text-[#3A4A6B]">
        No latency data yet
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

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(p.p95_ms).toFixed(1)}`)
    .join(' ')

  const areaPath = [
    linePath,
    `L ${toX(points.length - 1).toFixed(1)} ${(PT + chartH).toFixed(1)}`,
    `L ${toX(0).toFixed(1)} ${(PT + chartH).toFixed(1)} Z`,
  ].join(' ')

  const last = points[points.length - 1]
  const isAlert = last.p95_ms > 500
  const lineColor = isAlert ? '#ef4444' : '#14b8a6'

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
      {/* last value dot + label */}
      <circle cx={toX(points.length - 1)} cy={toY(last.p95_ms)} r="3" fill={lineColor} />
      <text
        x={toX(points.length - 1) - 5}
        y={toY(last.p95_ms) - 6}
        textAnchor="end"
        fontSize="10"
        fill={lineColor}
        fontWeight="600"
      >
        {last.p95_ms}ms
      </text>
      {/* y-axis labels */}
      <text x={PL - 3} y={PT + 4} textAnchor="end" fontSize="9" fill="#94a3b8">{maxVal}ms</text>
      <text x={PL - 3} y={PT + chartH} textAnchor="end" fontSize="9" fill="#94a3b8">{minVal}ms</text>
      {/* x-axis date range */}
      <text x={PL} y={H - 5} fontSize="9" fill="#94a3b8">
        {new Date(points[0].bucket_ts).toLocaleDateString()}
      </text>
      <text x={W - PR} y={H - 5} textAnchor="end" fontSize="9" fill="#94a3b8">
        {new Date(last.bucket_ts).toLocaleDateString()}
      </text>
    </svg>
  )
}

// ─── Trend helpers ─────────────────────────────────────────────────────────────

function computeTrend(
  data: HistoricalBucket[],
  key: 'p95_ms' | 'error_count',
): { value: number; direction: 'up' | 'down' } | undefined {
  const agg = data.filter((d) => d.route === null).sort((a, b) => a.bucket_ts - b.bucket_ts)
  if (agg.length < 4) return undefined
  const half = Math.floor(agg.length / 2)
  const avg = (arr: HistoricalBucket[]) =>
    arr.reduce((s, d) => {
      if (key === 'p95_ms') return s + d.p95_ms
      return s + (d.request_count > 0 ? d.error_count / d.request_count : 0)
    }, 0) / arr.length
  const older = avg(agg.slice(0, half))
  const newer = avg(agg.slice(half))
  if (older === 0) return undefined
  const pct = ((newer - older) / older) * 100
  return { value: Math.abs(pct), direction: pct >= 0 ? 'up' : 'down' }
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const auth = useAuth()
  const t = useT('admin')
  const { liveMetrics, historicalData, loading: metricsLoading, error: metricsError, exportCSV } = useAdminMetrics()
  const { kpis } = useAdminKpis()
  const { ops } = useAdminOps()
  const [startDate, setStartDate] = useState(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
  const [endDate, setEndDate] = useState(new Date())
  const [exporting, setExporting] = useState(false)
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard')

  if (auth.status === 'loading') {
    return (
      <MainLayout mainClassName="min-h-screen flex items-center justify-center p-8 text-pulse-500">
        Loading…
      </MainLayout>
    )
  }

  if (auth.status === 'anonymous') return <Navigate to="/login" replace />
  if (auth.user?.email !== SUPERUSER_EMAIL) return <Navigate to="/dashboard" replace />

  const latencyTrend = computeTrend(historicalData, 'p95_ms')
  const errorTrend = computeTrend(historicalData, 'error_count')

  const TABS: Array<{ id: AdminTab; label: string; icon: string }> = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'users', label: t('users'), icon: '👥' },
    { id: 'ops', label: t('ops'), icon: '🧩' },
    { id: 'analytics', label: t('analytics'), icon: '📈' },
  ]

  const navSlot = (
    <div className="flex items-center gap-3">
      <Link
        to="/dashboard"
        className="text-sm font-medium text-pulse-600 hover:text-teal-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 rounded px-2 py-1"
      >
        ← {t('backToDashboard')}
      </Link>
      <span className="text-xs font-medium text-teal-600">Admin: {auth.user?.email}</span>
    </div>
  )

  return (
    <MainLayout navSlot={navSlot} mainClassName="min-h-screen max-w-6xl mx-auto p-8 space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <Heading level="l">Admin</Heading>
          <Body size="s" className="text-pulse-500 mt-space-2">{t('realtimePlatformObservability')}</Body>
        </div>
      </header>

      {/* Tab bar — pill style */}
      <div
        role="tablist"
        aria-label="Admin sections"
        className="flex gap-1 rounded-xl bg-pulse-100 dark:bg-[#0F1526] p-1 w-fit"
      >
        {TABS.map(({ id, label, icon }) => (
          <button
            key={id}
            role="tab"
            id={`tab-${id}`}
            aria-controls={`tabpanel-${id}`}
            aria-selected={activeTab === id}
            onClick={() => setActiveTab(id)}
            className={[
              'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg min-h-[40px] transition-all duration-150',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1',
              activeTab === id
                ? 'bg-white dark:bg-[#1C2540] text-pulse-900 dark:text-[#F0F2F8] shadow-sm'
                : 'text-pulse-500 dark:text-[#6B7A99] hover:text-pulse-800 dark:hover:text-[#A8B3CC]',
            ].join(' ')}
          >
            <span aria-hidden="true">{icon}</span>
            {label}
          </button>
        ))}
      </div>

      {/* Dashboard tab */}
      {activeTab === 'dashboard' && (
        <div role="tabpanel" id="tabpanel-dashboard" aria-labelledby="tab-dashboard" className="space-y-6">

          {/* Platform health banner */}
          <PlatformHealthStrip ops={ops} />

          {/* Platform KPI totals */}
          {kpis && (
            <Section>
              <Heading level="m" className="border-l-4 border-teal-500 pl-3">Platform Overview</Heading>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-space-4">
                <MetricCard label={t('liveSessions')} value={kpis.live_sessions} />
                <MetricCard label={t('totalUsers')} value={kpis.total_users} />
                <MetricCard label={t('sessionsToday')} value={kpis.sessions_today} />
                <MetricCard label={t('sessionsThisMonth')} value={kpis.sessions_this_month} />
                <MetricCard label={t('totalSessions')} value={kpis.total_sessions} />
                <MetricCard label={t('estimatedAICosts')} value={`€${(kpis.ai_cost_estimate_cents / 100).toFixed(2)}`} />
              </div>
            </Section>
          )}

          {/* Live Metrics */}
          <Section>
            <Heading level="m" className="border-l-4 border-teal-500 pl-3">{t('liveLast5min')}</Heading>
            {metricsLoading && !liveMetrics ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-space-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : metricsError ? (
              <Body className="text-signal-error">{metricsError}</Body>
            ) : liveMetrics ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-space-4">
                <MetricCard label={t('activeSessions')} value={liveMetrics.active_sessions} />
                <MetricCard label={t('participants')} value={liveMetrics.total_participants} />
                <MetricCard label={t('revenue24h')} value={`$${(liveMetrics.revenue_24h_cents / 100).toFixed(2)}`} />
                <MetricCard
                  label={t('p95Latency')}
                  value={`${liveMetrics.p95_latency_ms}ms`}
                  alert={liveMetrics.p95_latency_ms > 500}
                  trend={latencyTrend ? { ...latencyTrend, inverted: true } : undefined}
                />
                <MetricCard
                  label={t('errorRate')}
                  value={`${(liveMetrics.error_rate * 100).toFixed(1)}%`}
                  alert={liveMetrics.error_rate > 0.05}
                  trend={errorTrend ? { ...errorTrend, inverted: true } : undefined}
                />
              </div>
            ) : null}
            {liveMetrics?.stub && <Caption className="text-amber-600">⚠ Stub data (metrics KV not ready)</Caption>}
          </Section>

          {/* P95 latency trend chart */}
          <Section>
            <Heading level="m" className="border-l-4 border-teal-500 pl-3">P95 Latency Trend</Heading>
            <Card>
              <LatencySparkline data={historicalData} />
            </Card>
          </Section>

          {/* Historical Data + Export */}
          <Section>
            <div className="flex items-center justify-between">
              <Heading level="m" className="border-l-4 border-teal-500 pl-3">{t('historicalData')}</Heading>
              <div className="flex items-center gap-space-3">
                <div className="flex gap-space-2">
                  <input
                    type="date"
                    value={startDate.toISOString().split('T')[0]}
                    onChange={(e) => setStartDate(new Date(e.target.value))}
                    className="text-body-s border border-pulse-300 rounded-md px-space-2 py-space-1"
                  />
                  <input
                    type="date"
                    value={endDate.toISOString().split('T')[0]}
                    onChange={(e) => setEndDate(new Date(e.target.value))}
                    className="text-body-s border border-pulse-300 rounded-md px-space-2 py-space-1"
                  />
                </div>
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

            {metricsLoading && !historicalData.length ? (
              <ResultsSectionSkeleton bars={6} />
            ) : metricsError ? (
              <Body className="text-signal-error">{metricsError}</Body>
            ) : historicalData.length > 0 ? (
              <Card className="overflow-x-auto">
                <table className="w-full text-body-s">
                  <thead>
                    <tr className="border-b border-pulse-200">
                      <th className="text-left py-space-2 font-medium text-pulse-700">{t('timestamp')}</th>
                      <th className="text-left py-space-2 font-medium text-pulse-700">{t('route')}</th>
                      <th className="text-right py-space-2 font-medium text-pulse-700">p50</th>
                      <th className="text-right py-space-2 font-medium text-pulse-700">p95</th>
                      <th className="text-right py-space-2 font-medium text-pulse-700">p99</th>
                      <th className="text-right py-space-2 font-medium text-pulse-700">{t('errorPercent')}</th>
                      <th className="text-right py-space-2 font-medium text-pulse-700">{t('requests')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-pulse-100">
                    {historicalData.map((row, idx) => (
                      <tr key={idx} className="hover:bg-pulse-50">
                        <td className="py-space-2">{new Date(row.bucket_ts).toLocaleString()}</td>
                        <td className="py-space-2">{row.route ?? '(all)'}</td>
                        <td className="text-right py-space-2">{row.p50_ms}ms</td>
                        <td className="text-right py-space-2">{row.p95_ms}ms</td>
                        <td className="text-right py-space-2">{row.p99_ms}ms</td>
                        <td className="text-right py-space-2">{((row.error_count / (row.request_count || 1)) * 100).toFixed(1)}%</td>
                        <td className="text-right py-space-2">{row.request_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            ) : (
              <Body className="text-pulse-500">{t('noDataInRange')}</Body>
            )}
          </Section>

          {/* Audit Log */}
          <Section>
            <Heading level="m" className="border-l-4 border-teal-500 pl-3">{t('auditLog')}</Heading>
            <AuditLogViewer />
          </Section>
        </div>
      )}

      {/* Users tab */}
      {activeTab === 'users' && (
        <div role="tabpanel" id="tabpanel-users" aria-labelledby="tab-users">
          <AdminUsersTab />
        </div>
      )}

      {/* OPS tab */}
      {activeTab === 'ops' && (
        <div role="tabpanel" id="tabpanel-ops" aria-labelledby="tab-ops">
          <AdminOpsTab />
        </div>
      )}

      {/* Analytics tab */}
      {activeTab === 'analytics' && (
        <div role="tabpanel" id="tabpanel-analytics" aria-labelledby="tab-analytics">
          <AdminAnalyticsTab />
        </div>
      )}
      <div className="px-4 pb-4">
        <BuildStamp />
      </div>
    </MainLayout>
  )
}
