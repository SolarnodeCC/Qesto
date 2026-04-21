import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useAdminMetrics } from '../hooks/useAdminMetrics'
import MainLayout from '../layouts/MainLayout'
import { ResultsSectionSkeleton } from '../components/SkeletonLoader'

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
        <h1 tabIndex={-1} className="text-3xl font-semibold focus:outline-none">
          Metrics Dashboard
        </h1>
        <p className="text-sm text-pulse-500 mt-1">Real-time platform observability</p>
      </header>

      {/* Live Metrics Cards */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Live (Last 5 min)</h2>
        {loading && !liveMetrics ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-pulse-200 p-4 h-24 bg-pulse-50 animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <p className="text-red-600 text-sm">{error}</p>
        ) : liveMetrics ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <MetricCard label="Active Sessions" value={liveMetrics.active_sessions} />
            <MetricCard label="Participants" value={liveMetrics.total_participants} />
            <MetricCard label="24h Revenue" value={`$${(liveMetrics.revenue_24h_cents / 100).toFixed(2)}`} />
            <MetricCard label="p95 Latency" value={`${liveMetrics.p95_latency_ms}ms`} alert={liveMetrics.p95_latency_ms > 500} />
            <MetricCard label="Error Rate" value={`${(liveMetrics.error_rate * 100).toFixed(1)}%`} alert={liveMetrics.error_rate > 0.05} />
          </div>
        ) : null}
        {liveMetrics?.stub && <p className="text-xs text-amber-600">⚠️ Stub data (metrics KV not ready)</p>}
      </section>

      {/* Historical Data + Export */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Historical (5-min buckets)</h2>
          <div className="flex items-center gap-3">
            <div className="flex gap-2">
              <input
                type="date"
                value={startDate.toISOString().split('T')[0]}
                onChange={(e) => setStartDate(new Date(e.target.value))}
                className="text-sm border border-pulse-300 rounded-lg px-2 py-1"
              />
              <input
                type="date"
                value={endDate.toISOString().split('T')[0]}
                onChange={(e) => setEndDate(new Date(e.target.value))}
                className="text-sm border border-pulse-300 rounded-lg px-2 py-1"
              />
            </div>
            <button
              onClick={async () => {
                setExporting(true)
                await exportCSV(startDate, endDate)
                setExporting(false)
              }}
              disabled={exporting}
              className="text-sm px-3 py-1 rounded-lg border border-teal-500 text-teal-700 hover:bg-teal-50 disabled:opacity-50"
            >
              {exporting ? 'Exporting…' : 'Export CSV'}
            </button>
          </div>
        </div>

        {loading && !historicalData ? (
          <ResultsSectionSkeleton bars={6} />
        ) : error ? (
          <p className="text-red-600 text-sm">{error}</p>
        ) : historicalData && historicalData.length > 0 ? (
          <div className="rounded-xl border border-pulse-200 p-5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-pulse-200">
                  <th className="text-left py-2 font-medium text-pulse-700">Timestamp</th>
                  <th className="text-left py-2 font-medium text-pulse-700">Route</th>
                  <th className="text-right py-2 font-medium text-pulse-700">p50</th>
                  <th className="text-right py-2 font-medium text-pulse-700">p95</th>
                  <th className="text-right py-2 font-medium text-pulse-700">p99</th>
                  <th className="text-right py-2 font-medium text-pulse-700">Error %</th>
                  <th className="text-right py-2 font-medium text-pulse-700">Requests</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pulse-100">
                {historicalData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-pulse-50">
                    <td className="py-2">{new Date(row.bucket_ts).toLocaleString()}</td>
                    <td className="py-2">{row.route || '(all)'}</td>
                    <td className="text-right">{row.p50_ms}ms</td>
                    <td className="text-right">{row.p95_ms}ms</td>
                    <td className="text-right">{row.p99_ms}ms</td>
                    <td className="text-right">{((row.error_count / (row.request_count || 1)) * 100).toFixed(1)}%</td>
                    <td className="text-right">{row.request_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-pulse-500 text-sm">No data in range</p>
        )}
      </section>
    </MainLayout>
  )
}

function MetricCard({
  label,
  value,
  alert,
}: {
  label: string
  value: string | number
  alert?: boolean
}) {
  return (
    <div className={`rounded-lg border p-4 ${alert ? 'border-red-300 bg-red-50' : 'border-pulse-200 bg-pulse-50'}`}>
      <p className="text-xs font-medium text-pulse-600">{label}</p>
      <p className={`text-xl font-semibold mt-1 ${alert ? 'text-red-700' : 'text-pulse-900'}`}>{value}</p>
    </div>
  )
}
