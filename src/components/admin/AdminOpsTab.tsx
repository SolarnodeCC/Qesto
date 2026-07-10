import { useAdminOps, useAdminOpsCorrelation, type ServiceStatus } from '../../hooks/useAdminOps'
import { useKbSyncStatus } from '../../hooks/useKbSyncStatus'
import { Heading, Body, Card, SkeletonCard } from '../../ui/components'
import { SloDashboardPanel } from '../SloDashboardPanel'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: ServiceStatus }) {
  const colour = status === 'healthy' ? 'bg-green-500' : status === 'degraded' ? 'bg-amber-500' : 'bg-red-500'
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${colour}`} />
}

function GlobalStatusBanner({ status, updatedAt }: { status: ServiceStatus; updatedAt: number }) {
  const styles = {
    healthy: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    degraded: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
    down: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
  }
  const label = { healthy: 'All systems operational', degraded: 'Partial outage', down: 'Major outage' }
  const textColour = { healthy: 'text-green-700 dark:text-green-400', degraded: 'text-amber-700 dark:text-amber-400', down: 'text-red-700 dark:text-red-400' }
  const dotColour = { healthy: 'bg-green-500', degraded: 'bg-amber-500', down: 'bg-red-500' }

  return (
    <Card className={`${styles[status]} border`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`w-3 h-3 rounded-full ${dotColour[status]} ${status === 'healthy' ? 'animate-pulse' : ''}`} />
          <p className={`text-heading-s font-semibold ${textColour[status]}`}>{label[status]}</p>
        </div>
        <Body size="s" className="text-pulse-500 dark:text-[#8A96B0]">
          Updated {new Date(updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Body>
      </div>
    </Card>
  )
}

function SevCard({ label, count, colour }: { label: string; count: number; colour: string }) {
  return (
    <Card className="space-y-2">
      <Body size="s" className="text-pulse-500 dark:text-[#8A96B0] font-medium uppercase tracking-wide text-xs">{label}</Body>
      <p className={`text-heading-l font-bold ${colour}`}>{count}</p>
    </Card>
  )
}

function ServiceRow({ name, status }: { name: string; status: ServiceStatus }) {
  const statusText = { healthy: 'Operational', degraded: 'Degraded', down: 'Down' }
  const textColor = { healthy: 'text-green-600 dark:text-green-400', degraded: 'text-amber-600 dark:text-amber-400', down: 'text-red-600 dark:text-red-400' }
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-pulse-100 dark:border-[#1E2A45] last:border-0">
      <div className="flex items-center gap-3">
        <StatusDot status={status} />
        <Body size="s">{name}</Body>
      </div>
      <Body size="s" className={`font-medium ${textColor[status]}`}>{statusText[status]}</Body>
    </div>
  )
}

// ─── Health Correlation ───────────────────────────────────────────────────────

function HealthCorrelationSection() {
  const { correlation, loading } = useAdminOpsCorrelation()

  if (loading && !correlation) {
    return (
      <Card>
        <Heading level="s" className="mb-3 border-l-4 border-teal-500 pl-3">Health correlation — last 24h</Heading>
        <Body size="s" className="text-pulse-500 dark:text-[#8A96B0]">Loading…</Body>
      </Card>
    )
  }

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <Heading level="s" className="border-l-4 border-teal-500 pl-3">Health correlation — last 24h</Heading>
        <Body size="s" className="text-pulse-500 dark:text-[#8A96B0] text-xs">Energizer activity vs WebSocket health</Body>
      </div>
      {!correlation || correlation.length === 0 ? (
        <Body size="s" className="text-pulse-500 dark:text-[#8A96B0]">No correlation data available for this period.</Body>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-pulse-100 dark:border-[#1E2A45]">
                <th className="py-2 pr-4 text-left font-medium text-pulse-500 dark:text-[#8A96B0]">Hour (UTC)</th>
                <th className="py-2 pr-4 text-right font-medium text-pulse-500 dark:text-[#8A96B0]">Activations</th>
                <th className="py-2 pr-4 text-right font-medium text-pulse-500 dark:text-[#8A96B0]">Answers</th>
                <th className="py-2 pr-4 text-right font-medium text-pulse-500 dark:text-[#8A96B0]">Reconnects</th>
                <th className="py-2 text-right font-medium text-pulse-500 dark:text-[#8A96B0]">WS Errors</th>
              </tr>
            </thead>
            <tbody>
              {correlation.map((row) => (
                <tr key={row.hour} className="border-b border-pulse-100 dark:border-[#1E2A45] last:border-0">
                  <td className="py-2 pr-4 font-mono text-xs text-pulse-600 dark:text-[#A8B3CC]">
                    {row.hour.slice(11, 16)}
                  </td>
                  <td className="py-2 pr-4 text-right font-semibold">{row.energizer_activations}</td>
                  <td className="py-2 pr-4 text-right">{row.energizer_answers}</td>
                  <td className="py-2 pr-4 text-right">{row.ws_reconnects}</td>
                  <td className={`py-2 text-right font-medium ${row.ws_errors > 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
                    {row.ws_errors}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AdminOpsTab() {
  const { ops, loading, error } = useAdminOps()
  const { status: kbSync, loading: kbLoading } = useKbSyncStatus()

  if (loading && !ops) {
    return (
      <div className="space-y-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    )
  }

  if (error) return <Body className="text-red-600">{error}</Body>
  if (!ops) return null

  const pct = (rate: number) => `${(rate * 100).toFixed(1)}%`

  return (
    <div className="space-y-8">
      <GlobalStatusBanner status={ops.status} updatedAt={ops.updated_at} />

      {/* SEV counters + impact */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SevCard label="SEV1 — Critical" count={ops.sev1} colour="text-red-600 dark:text-red-400" />
        <SevCard label="SEV2 — High" count={ops.sev2} colour="text-amber-500 dark:text-amber-400" />
        <SevCard label="SEV3 — Medium" count={ops.sev3} colour="text-teal-600 dark:text-teal-400" />
        <Card className="space-y-2">
          <Body size="s" className="text-pulse-500 dark:text-[#8A96B0] font-medium uppercase tracking-wide text-xs">Impact (24h)</Body>
          <Body size="s">Sessions: <span className="font-semibold">{ops.impact_sessions}</span></Body>
          <Body size="s">Users: <span className="font-semibold">{ops.impact_users}</span></Body>
        </Card>
      </div>

      {/* Service health + Realtime reliability + KB sync */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card>
          <Heading level="s" className="mb-4 border-l-4 border-teal-500 pl-3">Service health</Heading>
          <ServiceRow name="D1 Database" status={ops.services.d1} />
          <ServiceRow name="Sessions KV" status={ops.services.sessions_kv} />
          <ServiceRow name="Session Rooms (DO)" status={ops.services.session_rooms} />
          <ServiceRow name="Workers AI" status={ops.services.workers_ai} />
        </Card>

        <Card>
          <Heading level="s" className="mb-4 border-l-4 border-teal-500 pl-3">Realtime reliability</Heading>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-1 border-b border-pulse-100 dark:border-[#1E2A45]">
              <Body size="s" className="text-pulse-600 dark:text-[#A8B3CC]">WebSocket error rate</Body>
              <Body size="s" className="font-semibold">{pct(ops.realtime.ws_error_rate)}</Body>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-pulse-100 dark:border-[#1E2A45]">
              <Body size="s" className="text-pulse-600 dark:text-[#A8B3CC]">Reconnect rate</Body>
              <Body size="s" className="font-semibold">{pct(ops.realtime.reconnect_rate)}</Body>
            </div>
            <div className="flex justify-between items-center py-1">
              <Body size="s" className="text-pulse-600 dark:text-[#A8B3CC]">Vote P95 latency</Body>
              <Body size="s" className="font-semibold">
                {ops.realtime.vote_p95_ms !== null
                  ? `${ops.realtime.vote_p95_ms}ms`
                  : '—'}
              </Body>
            </div>
          </div>
        </Card>

        <Card>
          <Heading level="s" className="mb-4 border-l-4 border-indigo-500 pl-3">Knowledge base sync</Heading>
          {kbLoading ? (
            <Body size="s" className="text-pulse-500 dark:text-[#8A96B0]">Loading…</Body>
          ) : kbSync?.last_sync_at ? (
            <div className="space-y-3">
              <div className="flex justify-between items-start py-1 border-b border-pulse-100 dark:border-[#1E2A45]">
                <Body size="s" className="text-pulse-600 dark:text-[#A8B3CC]">Last updated</Body>
                <Body size="s" className="font-semibold text-right">
                  {new Date(kbSync.last_sync_at).toLocaleString()}
                </Body>
              </div>
              {kbSync.vectors_upserted !== undefined && (
                <div className="flex justify-between items-center py-1 border-b border-pulse-100 dark:border-[#1E2A45]">
                  <Body size="s" className="text-pulse-600 dark:text-[#A8B3CC]">Vectors</Body>
                  <Body size="s" className="font-semibold">{kbSync.vectors_upserted}</Body>
                </div>
              )}
              {kbSync.documents_upserted !== undefined && (
                <div className="flex justify-between items-center py-1 border-b border-pulse-100 dark:border-[#1E2A45]">
                  <Body size="s" className="text-pulse-600 dark:text-[#A8B3CC]">Documents</Body>
                  <Body size="s" className="font-semibold">{kbSync.documents_upserted}</Body>
                </div>
              )}
              {kbSync.chunks_upserted !== undefined && (
                <div className="flex justify-between items-center py-1">
                  <Body size="s" className="text-pulse-600 dark:text-[#A8B3CC]">Chunks</Body>
                  <Body size="s" className="font-semibold">{kbSync.chunks_upserted}</Body>
                </div>
              )}
            </div>
          ) : (
            <Body size="s" className="text-pulse-500 dark:text-[#8A96B0]">No sync data available</Body>
          )}
        </Card>
      </div>

      {/* Health correlation */}
      <HealthCorrelationSection />

      {/* Issue pulse */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <Heading level="s" className="border-l-4 border-teal-500 pl-3">Issue pulse</Heading>
          <div className="flex gap-3 text-xs text-pulse-500 dark:text-[#8A96B0]">
            <span>Errors: <strong className="text-pulse-700 dark:text-[#A8B3CC]">{ops.issues.filter(i => i.action.includes('error')).reduce((s, i) => s + i.count, 0)}</strong></span>
            <span>Info: <strong className="text-pulse-700 dark:text-[#A8B3CC]">{ops.issues.filter(i => !i.action.includes('error')).reduce((s, i) => s + i.count, 0)}</strong></span>
          </div>
        </div>
        {ops.issues.length === 0 ? (
          <Body size="s" className="text-pulse-500">No issue data in this period.</Body>
        ) : (
          <div className="space-y-1">
            {ops.issues.map((issue) => (
              <div key={issue.action} className="flex items-center justify-between py-1.5 border-b border-pulse-100 dark:border-[#1E2A45] last:border-0">
                <Body size="s" className="font-mono text-pulse-600 dark:text-[#A8B3CC]">{issue.action}</Body>
                <Body size="s" className="font-semibold">{issue.count}</Body>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="space-y-3">
        <Heading level="m">SLO error budgets</Heading>
        <SloDashboardPanel />
      </Card>
    </div>
  )
}
