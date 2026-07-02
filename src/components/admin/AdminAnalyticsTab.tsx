import { useAdminAnalytics, type DailyBucket } from '../../hooks/useAdminAnalytics'
import { useAdminGrowth } from '../../hooks/useAdminGrowth'
import { Heading, Body, Card, Button, SkeletonCard } from '../../ui/components'

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
      <div className="flex items-center justify-center h-[120px] text-pulse-500 text-body-s">
        No data
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
      <Body size="s" className="text-pulse-500">Consent rate</Body>
    </div>
  )
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({ value, label, colour = 'text-teal-600' }: { value: number; label: string; colour?: string }) {
  return (
    <Card className="text-center space-y-1">
      <p className={`text-heading-m font-bold ${colour}`}>{value}</p>
      <Body size="s" className="text-pulse-500 dark:text-[#8A96B0]">{label}</Body>
    </Card>
  )
}

function RateCard({ value, label }: { value: number; label: string }) {
  const pct = Math.round(value * 100)
  const colour = pct > 5 ? 'text-red-600 dark:text-red-400' : 'text-pulse-700 dark:text-[#A8B3CC]'
  return <KpiCard value={pct} label={`${label} (%)`} colour={colour} />
}

// ─── Status row ───────────────────────────────────────────────────────────────

function StatusRow({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-pulse-100 dark:border-[#1E2A45] last:border-0">
      <Body size="s" className="text-pulse-600 dark:text-[#A8B3CC]">{label}</Body>
      <Body size="s" className="font-semibold text-pulse-800 dark:text-[#F0F2F8]">{count}</Body>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

const INDUSTRY_LABELS: Record<string, string> = {
  'hr-people': 'HR & People',
  'agile-software': 'Agile / Software',
  'education-training': 'Education & Training',
  'leadership-management': 'Leadership & Management',
  'sales-customer-success': 'Sales & Customer Success',
  'healthcare': 'Healthcare',
  'general': 'General',
}

function webhookStatusColour(lastReceivedAt: string | null): { dot: string; label: string } {
  if (!lastReceivedAt) return { dot: 'bg-red-500', label: 'Never triggered' }
  const ageMs = Date.now() - new Date(lastReceivedAt).getTime()
  const days = ageMs / 86_400_000
  if (days < 7) return { dot: 'bg-green-500', label: 'Healthy' }
  if (days < 30) return { dot: 'bg-amber-400', label: 'Aging' }
  return { dot: 'bg-red-500', label: 'Not working' }
}

function GrowthEngineSection() {
  const { growth, loading } = useAdminGrowth()

  if (loading && !growth) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    )
  }

  if (!growth) return null

  const { templates, webhook } = growth
  const { dot, label: statusLabel } = webhookStatusColour(webhook.last_received_at)

  const lastReceivedDisplay = webhook.last_received_at
    ? new Date(webhook.last_received_at).toLocaleString()
    : '—'

  const lastTemplateDisplay = templates.last_created_at
    ? new Date(templates.last_created_at).toLocaleString()
    : '—'

  const industryEntries = Object.entries(templates.by_industry).sort((a, b) => b[1] - a[1])

  return (
    <div className="space-y-4">
      <Heading level="m" className="border-l-4 border-teal-500 pl-3">Growth Engine</Heading>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard value={templates.active} label="Active templates" colour="text-teal-600" />
        <KpiCard value={templates.total_uses} label="Template uses" colour="text-purple-600" />
        <KpiCard value={templates.discarded} label="Discarded by AI" colour="text-pulse-500" />
        <KpiCard value={webhook.total_received} label="Webhooks received" colour="text-green-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Webhook health */}
        <Card>
          <Heading level="s" className="mb-4">Webhook health</Heading>
          <div className="flex items-center gap-2 mb-4">
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${dot}`} aria-hidden="true" />
            <Body size="s" className="font-semibold text-pulse-800 dark:text-[#F0F2F8]">{statusLabel}</Body>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-pulse-100 dark:border-[#1E2A45]">
            <Body size="s" className="text-pulse-600 dark:text-[#A8B3CC]">Last received</Body>
            <Body size="s" className="font-semibold text-pulse-800 dark:text-[#F0F2F8]">{lastReceivedDisplay}</Body>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-pulse-100 dark:border-[#1E2A45]">
            <Body size="s" className="text-pulse-600 dark:text-[#A8B3CC]">Workflows queued</Body>
            <Body size="s" className="font-semibold text-pulse-800 dark:text-[#F0F2F8]">{webhook.total_queued}</Body>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-pulse-100 dark:border-[#1E2A45]">
            <Body size="s" className="text-pulse-600 dark:text-[#A8B3CC]">Private sessions skipped</Body>
            <Body size="s" className="font-semibold text-pulse-800 dark:text-[#F0F2F8]">{webhook.total_skipped}</Body>
          </div>
          <div className="flex items-center justify-between py-2">
            <Body size="s" className="text-pulse-600 dark:text-[#A8B3CC]">Last template created</Body>
            <Body size="s" className="font-semibold text-pulse-800 dark:text-[#F0F2F8]">{lastTemplateDisplay}</Body>
          </div>
        </Card>

        {/* Industry breakdown */}
        <Card>
          <Heading level="s" className="mb-4">Templates by industry</Heading>
          {industryEntries.length === 0 ? (
            <Body size="s" className="text-pulse-500 dark:text-[#8A96B0]">No templates yet</Body>
          ) : (
            industryEntries.map(([industry, count]) => (
              <StatusRow
                key={industry}
                label={INDUSTRY_LABELS[industry] ?? industry}
                count={count}
              />
            ))
          )}
        </Card>
      </div>
    </div>
  )
}

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
      ['engagement', 'energizer_activations', String(a.engagement.energizer_activations)],
      ['engagement', 'energizer_participants', String(a.engagement.energizer_participants)],
      ['engagement', 'energizer_completions', String(a.engagement.energizer_completions)],
      ['engagement', 'energizer_dropouts', String(a.engagement.energizer_dropouts)],
      ['engagement', 'leaderboard_participants', String(a.engagement.leaderboard_participants)],
      ['engagement', 'badges_awarded', String(a.engagement.badges_awarded)],
      ['realtime', 'ws_error_rate', String(a.engagement.ws_error_rate)],
      ['realtime', 'reconnect_rate', String(a.engagement.reconnect_rate)],
      ...a.badge_breakdown.map((badge) => ['badge_breakdown', badge.kind, String(badge.count)]),
      ...a.sessions_per_day.map((bucket) => ['sessions_per_day', bucket.day, String(bucket.count)]),
      ...a.decisions_per_day.map((bucket) => ['decisions_per_day', bucket.day, String(bucket.count)]),
      ...Object.entries(a.session_status).map(([status, count]) => ['session_status', status, String(count)]),
    ])
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Heading level="m" className="border-l-4 border-teal-500 pl-3">Analytics</Heading>
        <Button variant="secondary" size="sm" onClick={exportAnalytics}>Export CSV</Button>
      </div>

      {/* Top-line KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard value={a.sessions_today} label="Sessions today" colour="text-teal-600" />
        <KpiCard value={a.decisions_today} label="Decisions today" colour="text-purple-600" />
        <KpiCard value={a.sessions_this_month} label="Sessions this month" colour="text-green-600" />
        <KpiCard value={a.decisions_this_month} label="Decisions this month" colour="text-amber-500" />
      </div>

      {/* Energizer engagement */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard value={a.engagement.energizer_activations} label="Energizers started" colour="text-teal-600" />
        <KpiCard value={a.engagement.energizer_participants} label="Energizer participants" colour="text-green-600" />
        <KpiCard value={a.engagement.energizer_completions} label="Energizers completed" colour="text-amber-500" />
        <KpiCard value={a.engagement.energizer_dropouts} label="Drop-offs" colour="text-red-600" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <Heading level="s" className="mb-1">Sessions per day</Heading>
          <Body size="s" className="text-pulse-500 dark:text-[#8A96B0] mb-3">Last 14 days</Body>
          <BarChart data={a.sessions_per_day} label="Sessions per day" />
        </Card>
        <Card>
          <Heading level="s" className="mb-1">Decisions per day</Heading>
          <Body size="s" className="text-pulse-500 dark:text-[#8A96B0] mb-3">Last 14 days</Body>
          <BarChart data={a.decisions_per_day} label="Decisions per day" />
        </Card>
      </div>

      {/* Decision quality + Session status + Engagement */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="flex flex-col items-center justify-center gap-4">
          <Heading level="s">Decision quality</Heading>
          <ConsentDonut rate={a.consent_rate} />
          <Body size="s" className="text-pulse-500 dark:text-[#8A96B0] text-center">
            Avg {a.avg_participants.toFixed(1)} participants per decision
          </Body>
        </Card>

        <Card>
          <Heading level="s" className="mb-4">Session status</Heading>
          <StatusRow label="Live" count={a.session_status.live} />
          <StatusRow label="Draft" count={a.session_status.draft} />
          <StatusRow label="Closed" count={a.session_status.closed} />
          <StatusRow label="Archived" count={a.session_status.archived} />
        </Card>

        <Card>
          <Heading level="s" className="mb-4">Engagement</Heading>
          <StatusRow label="Leaderboard participants" count={a.engagement.leaderboard_participants} />
          <StatusRow label="Badges awarded" count={a.engagement.badges_awarded} />
          {a.badge_breakdown.slice(0, 3).map((badge) => (
            <StatusRow key={badge.kind} label={badge.kind} count={badge.count} />
          ))}
        </Card>
      </div>

      {/* Realtime health */}
      {/* privacy contract: geen vraagtekst, vrije tekst, e-mailadressen of tokens */}
      <Card>
        <Heading level="s" className="mb-4">Realtime health</Heading>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <RateCard value={a.engagement.ws_error_rate} label="WebSocket errors" />
          <RateCard value={a.engagement.reconnect_rate} label="Reconnects" />
        </div>
        <Body size="s" className="mt-4 text-pulse-500 dark:text-[#8A96B0]">
          Export contains only aggregated counters and sanitised labels — no raw content, free text, or personal identifiers.
        </Body>
      </Card>

      {/* Cost & usage */}
      <Card>
        <Heading level="s" className="mb-4">Cost &amp; usage</Heading>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div>
            <Body size="s" className="text-pulse-500 dark:text-[#8A96B0]">Sessions created</Body>
            <p className="text-heading-s font-semibold text-pulse-900 dark:text-[#F0F2F8] mt-1">{a.total_sessions_created}</p>
          </div>
          <div>
            <Body size="s" className="text-pulse-500 dark:text-[#8A96B0]">Decisions processed</Body>
            <p className="text-heading-s font-semibold text-pulse-900 dark:text-[#F0F2F8] mt-1">{a.total_decisions_processed}</p>
          </div>
          <div>
            <Body size="s" className="text-pulse-500 dark:text-[#8A96B0]">Est. AI costs (month)</Body>
            <p className="text-heading-s font-semibold text-teal-600 dark:text-teal-400 mt-1">&lt; €{costEur}</p>
            <Body size="s" className="text-pulse-500 dark:text-[#3A4A6B] mt-0.5">~€0.00001/decision</Body>
          </div>
        </div>
      </Card>

      {/* Growth Engine */}
      <GrowthEngineSection />
    </div>
  )
}
