import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useAdminMetrics } from '../hooks/useAdminMetrics'
import { useAdminKpis } from '../hooks/useAdminKpis'
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

const TABS: Array<{ id: AdminTab; label: string }> = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'users', label: 'Gebruikers' },
  { id: 'ops', label: 'OPS' },
  { id: 'analytics', label: 'Analytics' },
]

export default function AdminDashboard() {
  const auth = useAuth()
  const t = useT('admin')
  const { liveMetrics, historicalData, loading: metricsLoading, error: metricsError, exportCSV } = useAdminMetrics()
  const { kpis } = useAdminKpis()
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
    <MainLayout navSlot={navSlot} mainClassName="min-h-screen max-w-6xl mx-auto p-8 space-y-8">
      <header>
        <Heading level="l">Admin</Heading>
        <Body size="s" className="text-pulse-500 mt-space-2">{t('realtimePlatformObservability')}</Body>
      </header>

      {/* Tab bar */}
      <div
        role="tablist"
        aria-label="Admin sections"
        className="flex gap-1 border-b border-pulse-200"
      >
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            role="tab"
            id={`tab-${id}`}
            aria-controls={`tabpanel-${id}`}
            aria-selected={activeTab === id}
            onClick={() => setActiveTab(id)}
            className={[
              'px-5 py-3 text-sm font-medium rounded-t-md -mb-px border border-b-0 min-h-[44px]',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2',
              activeTab === id
                ? 'border-pulse-200 bg-white text-pulse-900'
                : 'border-transparent text-pulse-500 hover:text-pulse-800',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Dashboard tab */}
      {activeTab === 'dashboard' && (
        <div role="tabpanel" id="tabpanel-dashboard" aria-labelledby="tab-dashboard" className="space-y-8">
          {/* Platform KPI totals */}
          {kpis && (
            <Section>
              <Heading level="m">{t('realtimePlatformObservability')}</Heading>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-space-4">
                <MetricCard label="Live sessies" value={kpis.live_sessions} />
                <MetricCard label="Totaal gebruikers" value={kpis.total_users} />
                <MetricCard label="Sessies vandaag" value={kpis.sessions_today} />
                <MetricCard label="Sessies deze maand" value={kpis.sessions_this_month} />
                <MetricCard label="Sessies totaal" value={kpis.total_sessions} />
                <MetricCard label="Gesch. AI-kosten" value={`€${(kpis.ai_cost_estimate_cents / 100).toFixed(2)}`} />
              </div>
            </Section>
          )}

          {/* Live Metrics */}
          <Section>
            <Heading level="m">{t('liveLast5min')}</Heading>
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
                <MetricCard label={t('p95Latency')} value={`${liveMetrics.p95_latency_ms}ms`} alert={liveMetrics.p95_latency_ms > 500} />
                <MetricCard label={t('errorRate')} value={`${(liveMetrics.error_rate * 100).toFixed(1)}%`} alert={liveMetrics.error_rate > 0.05} />
              </div>
            ) : null}
            {liveMetrics?.stub && <Caption className="text-amber-600">⚠ Stub data (metrics KV not ready)</Caption>}
          </Section>

          {/* Historical Data + Export */}
          <Section>
            <div className="flex items-center justify-between">
              <Heading level="m">{t('historicalData')}</Heading>
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

            {metricsLoading && !historicalData ? (
              <ResultsSectionSkeleton bars={6} />
            ) : metricsError ? (
              <Body className="text-signal-error">{metricsError}</Body>
            ) : historicalData && historicalData.length > 0 ? (
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
                        <td className="py-space-2">{row.route || '(all)'}</td>
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
            <Heading level="m">Audit Log</Heading>
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
