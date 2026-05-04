import { useAdminAnalytics, type DailyBucket } from '../../hooks/useAdminAnalytics'
import { Heading, Body, Card, SkeletonCard } from '../../ui/components'

function downloadCsv(filename: string, rows: string[][]): void {
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`
  const csv = rows.map((row) => row.map(escape).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

// ─── Simple inline SVG bar chart ─────────────────────────────────────────────

function BarChart({ data, label }: { data: DailyBucket[]; label: string }) {
  const W = 400
  const H = 120
  const PAD_LEFT = 8
  const PAD_RIGHT = 8
  const PAD_TOP = 8
  const PAD_BOTTOM = 28
  const chartW = W - PAD_LEFT - PAD_RIGHT
  const chartH = H - PAD_TOP - PAD_BOTTOM

  const maxCount = Math.max(...data.map((d) => d.count), 1)
  const barW = data.length > 0 ? (chartW / data.length) * 0.7 : 0
  const gap = data.length > 0 ? (chartW / data.length) * 0.3 : 0

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[120px] text-pulse-300 text-body-s">
        Geen data
      </div>
    )
  }

  const firstDay = data[0]?.day ?? ''
  const lastDay = data[data.length - 1]?.day ?? ''

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-label={label}>
      {data.map((d, i) => {
        const barH = Math.max(2, (d.count / maxCount) * chartH)
        const x = PAD_LEFT + i * (barW + gap)
        const y = PAD_TOP + chartH - barH
        return (
          <rect
            key={d.day}
            x={x}
            y={y}
            width={barW}
            height={barH}
            rx="2"
            className="fill-teal-500 opacity-80"
          >
            <title>{d.day}: {d.count}</title>
          </rect>
        )
      })}
      {/* x-axis labels */}
      <text x={PAD_LEFT} y={H - 4} fontSize="10" className="fill-pulse-400">{firstDay}</text>
      <text x={W - PAD_RIGHT} y={H - 4} fontSize="10" textAnchor="end" className="fill-pulse-400">{lastDay}</text>
    </svg>
  )
}

// ─── Donut chart (consent rate) ───────────────────────────────────────────────

function ConsentDonut({ rate }: { rate: number }) {
  const r = 36
  const circ = 2 * Math.PI * r
  const filled = circ * rate
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="96" height="96" viewBox="0 0 96 96" aria-label={`Consent rate ${Math.round(rate * 100)}%`}>
        <circle cx="48" cy="48" r={r} fill="none" stroke="var(--pulse-200)" strokeWidth="10" />
        <circle
          cx="48" cy="48" r={r}
          fill="none"
          stroke="var(--teal-500)"
          strokeWidth="10"
          strokeDasharray={`${filled} ${circ - filled}`}
          strokeLinecap="round"
          transform="rotate(-90 48 48)"
        />
        <text x="48" y="53" textAnchor="middle" fontSize="14" fontWeight="600" className="fill-pulse-800">
          {Math.round(rate * 100)}%
        </text>
      </svg>
      <Body size="s" className="text-pulse-400">Consent rate</Body>
    </div>
  )
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({ value, label, colour = 'text-teal-600' }: { value: number; label: string; colour?: string }) {
  return (
    <Card className="text-center space-y-1">
      <p className={`text-heading-m font-bold ${colour}`}>{value}</p>
      <Body size="s" className="text-pulse-400">{label}</Body>
    </Card>
  )
}

// ─── Status row ───────────────────────────────────────────────────────────────

function StatusRow({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-pulse-100 last:border-0">
      <Body size="s" className="text-teal-600">{label}</Body>
      <Body size="s" className="font-medium text-pulse-600">{count}</Body>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AdminAnalyticsTab() {
  const { analytics, loading, error } = useAdminAnalytics()

  if (loading && !analytics) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    )
  }

  if (error) return <Body className="text-red-600">{error}</Body>
  if (!analytics) return null

  const a = analytics
  const costEur = (a.ai_cost_estimate_cents / 100).toFixed(2)

  const exportAnalytics = () => {
    downloadCsv('qesto-admin-analytics.csv', [
      ['section', 'metric', 'value'],
      ['overview', 'sessions_today', String(a.sessions_today)],
      ['overview', 'decisions_today', String(a.decisions_today)],
      ['overview', 'sessions_this_month', String(a.sessions_this_month)],
      ['overview', 'decisions_this_month', String(a.decisions_this_month)],
      ['quality', 'consent_rate', String(a.consent_rate)],
      ['quality', 'avg_participants', String(a.avg_participants)],
      ['usage', 'ai_cost_estimate_cents', String(a.ai_cost_estimate_cents)],
      ['usage', 'total_sessions_created', String(a.total_sessions_created)],
      ['usage', 'total_decisions_processed', String(a.total_decisions_processed)],
      ...a.sessions_per_day.map((bucket) => ['sessions_per_day', bucket.day, String(bucket.count)]),
      ...a.decisions_per_day.map((bucket) => ['decisions_per_day', bucket.day, String(bucket.count)]),
      ...Object.entries(a.session_status).map(([status, count]) => ['session_status', status, String(count)]),
    ])
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl" aria-hidden="true">📊</span>
          <Heading level="m">Analytics</Heading>
        </div>
        <button
          type="button"
          onClick={exportAnalytics}
          className="self-start rounded-md border border-pulse-300 px-3 py-2 text-sm font-medium text-pulse-700 hover:border-teal-400 hover:text-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
        >
          Export CSV
        </button>
      </div>

      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        <Body size="s" className="text-green-600 font-medium">Live updates actief</Body>
      </div>

      {/* Top KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard value={a.sessions_today} label="Sessies vandaag" colour="text-teal-600" />
        <KpiCard value={a.decisions_today} label="Beslissingen vandaag" colour="text-purple-600" />
        <KpiCard value={a.sessions_this_month} label="Sessies deze maand" colour="text-green-600" />
        <KpiCard value={a.decisions_this_month} label="Beslissingen deze maand" colour="text-amber-500" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <Heading level="s" className="mb-1">Sessies per dag</Heading>
          <Body size="s" className="text-teal-600 mb-3">Afgelopen 14 dagen</Body>
          <BarChart data={a.sessions_per_day} label="Sessies per dag" />
        </Card>
        <Card>
          <Heading level="s" className="mb-1">Beslissingen per dag</Heading>
          <Body size="s" className="text-teal-600 mb-3">Afgelopen 14 dagen</Body>
          <BarChart data={a.decisions_per_day} label="Beslissingen per dag" />
        </Card>
      </div>

      {/* Decision quality + Session status + Action items */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="flex flex-col items-center justify-center gap-4">
          <Heading level="s">Beslissing kwaliteit</Heading>
          <ConsentDonut rate={a.consent_rate} />
          <Body size="s" className="text-pulse-400 text-center">
            Gemiddeld {a.avg_participants.toFixed(1)} deelnemers per beslissing
          </Body>
        </Card>

        <Card>
          <Heading level="s" className="mb-4">Sessie-status</Heading>
          <StatusRow label="Actief" count={a.session_status.live} />
          <StatusRow label="Draft" count={a.session_status.draft} />
          <StatusRow label="Gesloten" count={a.session_status.closed} />
          <StatusRow label="Archief" count={a.session_status.archived} />
        </Card>

        <Card>
          <Heading level="s" className="mb-4">Actiepunten</Heading>
          <StatusRow label="Open" count={0} />
          <StatusRow label="In uitvoering" count={0} />
          <StatusRow label="Afgerond" count={0} />
        </Card>
      </div>

      {/* Cost & usage */}
      <Card>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <Heading level="s" className="mb-4">Kosten &amp; verbruik</Heading>
            <div className="space-y-3">
              <div>
                <Body size="s" className="text-pulse-400">Sessies aangemaakt</Body>
                <p className="text-heading-s font-semibold text-pulse-900">{a.total_sessions_created}</p>
              </div>
              <div>
                <Body size="s" className="text-pulse-400">Beslissingen verwerkt</Body>
                <p className="text-heading-s font-semibold text-pulse-900">{a.total_decisions_processed}</p>
              </div>
              <div>
                <Body size="s" className="text-pulse-400">Gesch. AI-kosten (maand)</Body>
                <p className="text-heading-s font-semibold text-teal-600">&lt; €{costEur}</p>
                <Body size="s" className="text-pulse-300">Workers AI embeddings ~€0.00001/beslissing</Body>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
