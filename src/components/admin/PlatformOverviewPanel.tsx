import { useState } from 'react'
import {
  type ComponentHealth,
  type PlatformAlert,
  type ServiceStatus,
  useAdminPlatformOverview,
} from '../../hooks/useAdminPlatformOverview'
import { Heading, Body, Caption, Card, StatCard, SkeletonCard } from '../../ui/components'

// Platformbeheer Module 1 — the 5-second "is alles oké?" board. Self-contained:
// one polled hook, no props beyond optional quick-link navigation.

const STATUS_DOT: Record<ServiceStatus, string> = {
  healthy: 'bg-green-500',
  degraded: 'bg-amber-500',
  down: 'bg-red-500',
}

function StatusCard({ name, health }: { name: string; health: ComponentHealth }) {
  const border =
    health.status === 'down'
      ? 'border-red-300 dark:border-red-800'
      : health.status === 'degraded'
        ? 'border-amber-300 dark:border-amber-800'
        : 'border-pulse-200 dark:border-[#1E2A45]'
  return (
    <Card className={`space-y-1 border ${border}`}>
      <div className="flex items-center justify-between gap-2">
        <Caption>{name}</Caption>
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${STATUS_DOT[health.status]}`} aria-label={health.status} />
      </div>
      <div className="text-xl font-bold text-pulse-900 dark:text-[#F0F2F8]">
        {health.metric !== null ? `${health.metric}${health.unit ?? ''}` : '—'}
      </div>
      {health.detail && (
        <Body size="s" className="text-pulse-500 dark:text-[#8A96B0]">
          {health.detail}
          {health.synthetic ? ' (synthetic)' : ''}
        </Body>
      )}
    </Card>
  )
}

const SEV_STYLE: Record<1 | 2 | 3, { chip: string; label: string }> = {
  1: { chip: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', label: 'SEV1' },
  2: { chip: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', label: 'SEV2' },
  3: { chip: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400', label: 'SEV3' },
}

function AlertRow({ alert }: { alert: PlatformAlert }) {
  const s = SEV_STYLE[alert.severity]
  return (
    <div className="flex items-center gap-3 py-2">
      <span className={`text-xs font-semibold px-2 py-0.5 rounded ${s.chip}`}>{s.label}</span>
      <span className="flex-1 text-sm text-pulse-800 dark:text-[#A8B3CC]">{alert.title}</span>
      <span className="text-xs text-pulse-400 dark:text-[#5A6788] shrink-0">
        {alert.source === 'health' ? 'health probe' : 'incident'}
      </span>
    </div>
  )
}

const REVENUE_WINDOWS = [
  { key: 'window_24h_cents', label: '24h' },
  { key: 'window_7d_cents', label: '7d' },
  { key: 'window_30d_cents', label: '30d' },
] as const

export default function PlatformOverviewPanel({ onNavigate }: { onNavigate?: (tab: 'users' | 'ops' | 'analytics') => void }) {
  const { overview, loading, error } = useAdminPlatformOverview()
  const [revenueWindow, setRevenueWindow] = useState<(typeof REVENUE_WINDOWS)[number]['key']>('window_24h_cents')

  if (loading && !overview) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    )
  }

  if (error && !overview) {
    return (
      <Card className="border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
        <Body className="text-signal-error">Could not load platform overview: {error}</Body>
      </Card>
    )
  }

  if (!overview) return null

  const revenueCents = overview.business.revenue[revenueWindow]
  const isEstimateWindow = revenueWindow !== 'window_24h_cents' && overview.business.is_estimate

  return (
    <div className="space-y-8">
      {overview.degraded_sources.length > 0 && (
        <Card className="border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
          <Body size="s" className="text-amber-700 dark:text-amber-400">
            Degraded — some data sources were unavailable: {overview.degraded_sources.join(', ')}. Figures below may be
            incomplete.
          </Body>
        </Card>
      )}

      <section className="space-y-3">
        <Heading level="m" className="border-l-4 border-teal-500 pl-3">System health</Heading>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatusCard name="Workers" health={overview.components.workers} />
          <StatusCard name="D1" health={overview.components.d1} />
          <StatusCard name="Durable Objects" health={overview.components.durable_objects} />
          <StatusCard name="Workers AI" health={overview.components.workers_ai} />
          <StatusCard name="Vectorize" health={overview.components.vectorize} />
        </div>
      </section>

      <section className="space-y-3">
        <Heading level="m" className="border-l-4 border-teal-500 pl-3">Live now</Heading>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Active sessions" value={overview.live_now.active_sessions} colour="text-teal-600" />
          <StatCard label="Participants" value={overview.live_now.total_participants} colour="text-purple-600" />
          <StatCard label="WebSocket connections" value={overview.live_now.ws_connections} colour="text-blue-600" />
        </div>
        {overview.live_now.synthetic && <Caption className="text-amber-600">Live metrics source unavailable — showing zeros.</Caption>}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <Heading level="m" className="border-l-4 border-teal-500 pl-3">Business snapshot</Heading>
          <div role="group" aria-label="Revenue window" className="flex gap-1 rounded-lg bg-pulse-100 dark:bg-[#0F1526] p-1">
            {REVENUE_WINDOWS.map((w) => (
              <button
                key={w.key}
                type="button"
                onClick={() => setRevenueWindow(w.key)}
                aria-pressed={revenueWindow === w.key}
                className={[
                  'px-3 py-1 text-xs font-medium rounded-md min-h-[36px]',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500',
                  revenueWindow === w.key
                    ? 'bg-white dark:bg-[#1C2540] text-pulse-900 dark:text-[#F0F2F8] shadow-sm'
                    : 'text-pulse-500 dark:text-[#8A96B0]',
                ].join(' ')}
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Signups today" value={overview.business.signups_today} colour="text-green-600" />
          <StatCard label="Active subscriptions" value={overview.business.active_subscriptions} colour="text-purple-600" />
          <StatCard label="Total users" value={overview.business.total_users} colour="text-blue-600" />
          <StatCard
            label={`Revenue ${REVENUE_WINDOWS.find((w) => w.key === revenueWindow)!.label}${isEstimateWindow ? ' (est.)' : ''}`}
            value={`€${(revenueCents / 100).toFixed(2)}`}
            colour="text-teal-600"
          />
        </div>
        {isEstimateWindow && (
          <Caption className="text-pulse-500 dark:text-[#8A96B0]">
            7d/30d revenue is a run-rate estimate from active plans — not settled Stripe data.
          </Caption>
        )}
      </section>

      <section className="space-y-3">
        <Heading level="m" className="border-l-4 border-teal-500 pl-3">Open alerts</Heading>
        <Card>
          {overview.alerts.length === 0 ? (
            <Body size="s" className="text-pulse-500 dark:text-[#8A96B0]">No open alerts. All clear.</Body>
          ) : (
            <div className="divide-y divide-pulse-100 dark:divide-[#1E2A45]">
              {overview.alerts.map((a) => (
                <AlertRow key={a.id} alert={a} />
              ))}
            </div>
          )}
        </Card>
      </section>

      {onNavigate && (
        <section className="space-y-3">
          <Heading level="m" className="border-l-4 border-teal-500 pl-3">Quick links</Heading>
          <div className="flex flex-wrap gap-2">
            {(['users', 'ops', 'analytics'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => onNavigate(tab)}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-pulse-200 dark:border-[#2A3858] text-pulse-700 dark:text-[#A8B3CC] hover:bg-pulse-50 dark:hover:bg-[#0F1526] min-h-[44px] capitalize focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
              >
                {tab}
              </button>
            ))}
          </div>
        </section>
      )}

      <Caption className="text-pulse-400 dark:text-[#5A6788]">
        Generated {new Date(overview.generated_at).toLocaleTimeString()} · {overview.cached ? 'cached' : 'fresh'}
      </Caption>
    </div>
  )
}
