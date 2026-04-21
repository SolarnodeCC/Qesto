import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useAdminMetrics } from '../hooks/useAdminMetrics'
import MainLayout from '../layouts/MainLayout'
import { ResultsSectionSkeleton } from '../components/SkeletonLoader'
import { Heading, Body, Caption, Button, Card, MetricCard, Section, SkeletonCard } from '../ui/components'

export default function AdminDashboard() {
  const auth = useAuth()
  const { liveMetrics, historicalData, loading, error, exportCSV } = useAdminMetrics()
  const [startDate, setStartDate] = useState(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
  const [endDate, setEndDate] = useState(new Date())
  const [exporting, setExporting] = useState(false)

  if (auth.status === 'loading') {
    return (
      <MainLayout mainClassName="min-h-screen flex items-center justify-center p-8 text-pulse-500">
        Loading…
      </MainLayout>
    )
  }

  if (auth.status === 'anonymous') return <Navigate to="/login" replace />

  const navSlot = (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-teal-600">Admin: {auth.user?.email}</span>
    </div>
  )

  return (
    <MainLayout navSlot={navSlot} mainClassName="min-h-screen max-w-6xl mx-auto p-8 space-y-8">
      <header>
        <Heading level="l">Metrics Dashboard</Heading>
        <Body size="s" className="text-pulse-500 mt-space-2">Real-time platform observability</Body>
      </header>

      {/* Live Metrics Cards */}
      <Section>
        <Heading level="m">Live (Last 5 min)</Heading>
        {loading && !liveMetrics ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-space-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : error ? (
          <Body className="text-signal-error">{error}</Body>
        ) : liveMetrics ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-space-4">
            <MetricCard label="Active Sessions" value={liveMetrics.active_sessions} />
            <MetricCard label="Participants" value={liveMetrics.total_participants} />
            <MetricCard label="24h Revenue" value={`$${(liveMetrics.revenue_24h_cents / 100).toFixed(2)}`} />
            <MetricCard label="p95 Latency" value={`${liveMetrics.p95_latency_ms}ms`} alert={liveMetrics.p95_latency_ms > 500} />
            <MetricCard label="Error Rate" value={`${(liveMetrics.error_rate * 100).toFixed(1)}%`} alert={liveMetrics.error_rate > 0.05} />
          </div>
        ) : null}
        {liveMetrics?.stub && <Caption className="text-amber-600">⚠️ Stub data (metrics KV not ready)</Caption>}
      </Section>

      {/* Historical Data + Export */}
      <Section>
        <div className="flex items-center justify-between">
          <Heading level="m">Historical (5-min buckets)</Heading>
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
              {exporting ? 'Exporting…' : 'Export CSV'}
            </Button>
          </div>
        </div>

        {loading && !historicalData ? (
          <ResultsSectionSkeleton bars={6} />
        ) : error ? (
          <Body className="text-signal-error">{error}</Body>
        ) : historicalData && historicalData.length > 0 ? (
          <Card className="overflow-x-auto">
            <table className="w-full text-body-s">
              <thead>
                <tr className="border-b border-pulse-200">
                  <th className="text-left py-space-2 font-medium text-pulse-700">Timestamp</th>
                  <th className="text-left py-space-2 font-medium text-pulse-700">Route</th>
                  <th className="text-right py-space-2 font-medium text-pulse-700">p50</th>
                  <th className="text-right py-space-2 font-medium text-pulse-700">p95</th>
                  <th className="text-right py-space-2 font-medium text-pulse-700">p99</th>
                  <th className="text-right py-space-2 font-medium text-pulse-700">Error %</th>
                  <th className="text-right py-space-2 font-medium text-pulse-700">Requests</th>
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
          <Body className="text-pulse-500">No data in range</Body>
        )}
      </Section>
    </MainLayout>
  )
}

