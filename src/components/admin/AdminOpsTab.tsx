import { useAdminOps, type ServiceStatus } from '../../hooks/useAdminOps'
import { Heading, Body, Card, Section, SkeletonCard } from '../../ui/components'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: ServiceStatus }) {
  const colour = status === 'healthy' ? 'bg-green-500' : status === 'degraded' ? 'bg-amber-500' : 'bg-red-500'
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${colour}`} />
}

function GlobalStatusBanner({ status, updatedAt }: { status: ServiceStatus; updatedAt: number }) {
  const styles = {
    healthy: 'bg-green-50 border-green-200',
    degraded: 'bg-amber-50 border-amber-200',
    down: 'bg-red-50 border-red-200',
  }
  const label = { healthy: 'Healthy', degraded: 'Degraded', down: 'Down' }
  const textColour = { healthy: 'text-green-700', degraded: 'text-amber-700', down: 'text-red-700' }

  return (
    <Card className={`${styles[status]} border`}>
      <div className="flex items-center justify-between">
        <div>
          <Body size="s" className="text-pulse-500">Global OPS status</Body>
          <p className={`text-heading-m font-semibold mt-1 ${textColour[status]}`}>{label[status]}</p>
          <Body size="s" className="text-pulse-400 mt-1">
            Laatste update: {new Date(updatedAt).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' })}
          </Body>
        </div>
        <div className="flex items-center gap-2 text-body-s text-green-600 font-medium">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          Live updates
        </div>
      </div>
    </Card>
  )
}

function SevCard({ label, count, colour }: { label: string; count: number; colour: string }) {
  return (
    <Card className="space-y-2">
      <Body size="s" className="text-pulse-500 font-medium uppercase tracking-wide text-xs">{label}</Body>
      <p className={`text-heading-l font-bold ${colour}`}>{count}</p>
    </Card>
  )
}

// ─── Simple bar chart (SVG, no external deps) ────────────────────────────────

function ServiceRow({ name, status }: { name: string; status: ServiceStatus }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-pulse-100 last:border-0">
      <div className="flex items-center gap-3">
        <StatusDot status={status} />
        <Body size="s">{name}</Body>
      </div>
      <Body size="s" className="text-pulse-400">—</Body>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AdminOpsTab() {
  const { ops, loading, error } = useAdminOps()

  if (loading && !ops) {
    return (
      <div className="space-y-6">
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
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="text-2xl">🧩</span>
        <Heading level="m">OPS</Heading>
      </div>

      <GlobalStatusBanner status={ops.status} updatedAt={ops.updated_at} />

      {/* SEV counters + impact */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SevCard label="SEV1" count={ops.sev1} colour="text-red-600" />
        <SevCard label="SEV2" count={ops.sev2} colour="text-amber-500" />
        <SevCard label="SEV3" count={ops.sev3} colour="text-teal-600" />
        <Card className="space-y-2">
          <Body size="s" className="text-pulse-500 font-medium uppercase tracking-wide text-xs">Impact (24u)</Body>
          <Body size="s">Sessies: <span className="font-semibold">{ops.impact_sessions}</span></Body>
          <Body size="s">Users: <span className="font-semibold">{ops.impact_users}</span></Body>
        </Card>
      </div>

      {/* Service health + Realtime reliability */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <Heading level="s" className="mb-4">Service health</Heading>
          <ServiceRow name="D1 Database" status={ops.services.d1} />
          <ServiceRow name="SESSIONS_KV" status={ops.services.sessions_kv} />
          <ServiceRow name="Session Rooms" status={ops.services.session_rooms} />
          <ServiceRow name="Workers AI" status={ops.services.workers_ai} />
        </Card>

        <Card>
          <Heading level="s" className="mb-4">Realtime reliability</Heading>
          <div className="space-y-3">
            <div className="flex justify-between">
              <Body size="s">WebSocket error-rate:</Body>
              <Body size="s" className="font-medium">{pct(ops.realtime.ws_error_rate)}</Body>
            </div>
            <div className="flex justify-between">
              <Body size="s">Reconnect-rate:</Body>
              <Body size="s" className="font-medium">{pct(ops.realtime.reconnect_rate)}</Body>
            </div>
            <div className="flex justify-between">
              <Body size="s">Vote p95:</Body>
              <Body size="s" className="font-medium">
                {ops.realtime.vote_p95_ms !== null
                  ? `${ops.realtime.vote_p95_ms}ms`
                  : '— (niet gemeten)'}
              </Body>
            </div>
          </div>
        </Card>
      </div>

      {/* Issue pulse */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <Heading level="s">Issue pulse</Heading>
          <Body size="s" className="text-pulse-400">
            Error {ops.issues.filter(i => i.action.includes('error')).reduce((s, i) => s + i.count, 0)} &middot;{' '}
            Warning {0} &middot;{' '}
            Info {ops.issues.filter(i => !i.action.includes('error')).reduce((s, i) => s + i.count, 0)}
          </Body>
        </div>
        {ops.issues.length === 0 ? (
          <Body size="s" className="text-pulse-400">Nog geen issue-data in deze periode.</Body>
        ) : (
          <div className="space-y-2">
            {ops.issues.map((issue) => (
              <div key={issue.action} className="flex items-center justify-between py-1 border-b border-pulse-100 last:border-0">
                <Body size="s" className="font-mono text-pulse-600">{issue.action}</Body>
                <Body size="s" className="font-medium">{issue.count}</Body>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
