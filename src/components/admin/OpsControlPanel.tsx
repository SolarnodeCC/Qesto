import { useState } from 'react'
import { useAdminOpsControl, type Incident } from '../../hooks/useAdminOpsControl'
import { Heading, Body, Caption, Button, Card, TextInput } from '../../ui/components'

// Platformbeheer Module 4 — operational control. Every destructive action
// (rollback, restore, secret rotation) goes through an inline confirm step.

function fmt(ts: number | null) {
  return ts ? new Date(ts).toLocaleString() : '—'
}

const SEV_CHIP: Record<1 | 2 | 3, string> = {
  1: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  2: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  3: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
}

/** Generic confirm-then-act button for destructive operations. */
function ConfirmButton({ label, confirmLabel, onConfirm }: { label: string; confirmLabel: string; onConfirm: () => Promise<unknown> }) {
  const [armed, setArmed] = useState(false)
  const [busy, setBusy] = useState(false)
  if (!armed) {
    return <Button variant="danger" size="sm" onClick={() => setArmed(true)}>{label}</Button>
  }
  return (
    <span className="inline-flex gap-1">
      <Button
        variant="danger"
        size="sm"
        disabled={busy}
        onClick={async () => { setBusy(true); await onConfirm(); setBusy(false); setArmed(false) }}
      >
        {busy ? '…' : confirmLabel}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setArmed(false)}>Cancel</Button>
    </span>
  )
}

function IncidentCreator({ onCreate }: { onCreate: (sev: 1 | 2 | 3, title: string) => Promise<unknown> }) {
  const [title, setTitle] = useState('')
  const [sev, setSev] = useState<1 | 2 | 3>(2)
  const [busy, setBusy] = useState(false)
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={sev}
        onChange={(e) => setSev(Number(e.target.value) as 1 | 2 | 3)}
        className="border border-pulse-300 dark:border-[#2A3858] rounded-md px-2 py-1.5 text-body-s bg-white dark:bg-[#1C2540] text-pulse-900 dark:text-[#F0F2F8]"
        aria-label="Severity"
      >
        <option value={1}>SEV1</option>
        <option value={2}>SEV2</option>
        <option value={3}>SEV3</option>
      </select>
      <TextInput value={title} onChange={setTitle} hintText="Incident title…" className="flex-1 min-w-[200px]" />
      <Button
        variant="primary"
        size="sm"
        disabled={busy || !title.trim()}
        onClick={async () => { setBusy(true); await onCreate(sev, title.trim()); setTitle(''); setBusy(false) }}
      >
        {busy ? '…' : 'Open incident'}
      </Button>
    </div>
  )
}

function IncidentRow({ incident, onClose }: { incident: Incident; onClose: (id: string) => Promise<unknown> }) {
  const [pm, setPm] = useState('')
  const [closing, setClosing] = useState(false)
  return (
    <div className="py-2 space-y-1">
      <div className="flex items-center gap-2">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${SEV_CHIP[incident.severity]}`}>SEV{incident.severity}</span>
        <span className="flex-1 text-sm text-pulse-800 dark:text-[#A8B3CC]">{incident.title}</span>
        <span className="text-xs text-pulse-400">{incident.status}</span>
      </div>
      {incident.status === 'open' && (
        <div className="flex flex-wrap items-center gap-2">
          <TextInput value={pm} onChange={setPm} hintText="Postmortem note (optional)…" className="flex-1 min-w-[200px]" />
          <Button variant="secondary" size="sm" disabled={closing} onClick={async () => { setClosing(true); await onClose(incident.id); setClosing(false) }}>
            {closing ? '…' : 'Close'}
          </Button>
        </div>
      )}
      {incident.postmortem && <Caption className="text-pulse-500">{incident.postmortem}</Caption>}
    </div>
  )
}

export default function OpsControlPanel() {
  const ops = useAdminOpsControl()

  return (
    <div className="space-y-6">
      {ops.error && <Body size="s" className="text-red-600">{ops.error}</Body>}

      {/* Cron — missed runs first */}
      <section className="space-y-3">
        <Heading level="m" className="border-l-4 border-teal-500 pl-3">Cron jobs</Heading>
        <Card className="divide-y divide-pulse-100 dark:divide-[#1E2A45] p-0">
          {ops.cron.map((j) => (
            <div key={j.key} className="flex items-center gap-3 px-4 py-3">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${j.missed ? 'bg-red-500' : j.last_status === 'failure' ? 'bg-amber-500' : 'bg-green-500'}`} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-pulse-900 dark:text-[#F0F2F8]">{j.label}</div>
                <div className="text-xs text-pulse-500 dark:text-[#8A96B0] font-mono">{j.schedule} · last {fmt(j.last_run_at)} {j.missed && <span className="text-red-600 font-semibold">· MISSED</span>}</div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => ops.triggerCron(j.key)}>Trigger</Button>
            </div>
          ))}
        </Card>
      </section>

      {/* Deploys + runner */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Heading level="m" className="border-l-4 border-teal-500 pl-3">Deploys</Heading>
          {ops.runner && (
            <span className={`text-xs px-2 py-0.5 rounded ${ops.runner.online ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              NAS runner {ops.runner.online ? 'online' : 'offline'} · {fmt(ops.runner.last_heartbeat_at)}
            </span>
          )}
        </div>
        <Card className="divide-y divide-pulse-100 dark:divide-[#1E2A45] p-0">
          {ops.deploys.length === 0 ? (
            <div className="px-4 py-3"><Body size="s" className="text-pulse-500 dark:text-[#8A96B0]">No deploy history recorded.</Body></div>
          ) : ops.deploys.map((d) => (
            <div key={d.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-pulse-900 dark:text-[#F0F2F8]">{d.version} <span className="text-xs text-pulse-400">({d.environment})</span></div>
                <div className="text-xs text-pulse-500 font-mono">{d.sha ?? ''} · {d.status} · {fmt(d.created_at)}</div>
              </div>
              {d.status === 'deployed' && (
                <ConfirmButton label="Rollback" confirmLabel="Confirm rollback" onConfirm={() => ops.rollback(d.id)} />
              )}
            </div>
          ))}
        </Card>
      </section>

      {/* Secrets rotation tracker */}
      <section className="space-y-3">
        <Heading level="m" className="border-l-4 border-teal-500 pl-3">Secrets &amp; tokens</Heading>
        <Card className="divide-y divide-pulse-100 dark:divide-[#1E2A45] p-0">
          {ops.secrets.length === 0 ? (
            <div className="px-4 py-3"><Body size="s" className="text-pulse-500 dark:text-[#8A96B0]">No tracked secrets. (Values are never shown — metadata only.)</Body></div>
          ) : ops.secrets.map((s) => (
            <div key={s.name} className="flex items-center gap-3 px-4 py-3">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${s.status === 'expired' ? 'bg-red-500' : s.status === 'expiring' ? 'bg-amber-500' : s.status === 'ok' ? 'bg-green-500' : 'bg-pulse-300'}`} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-mono text-pulse-900 dark:text-[#F0F2F8]">{s.name}</div>
                <div className="text-xs text-pulse-500">rotated {fmt(s.last_rotated_at)} · expires {fmt(s.expires_at)}{s.rotation_requested_at ? ' · rotation requested' : ''}</div>
              </div>
              <ConfirmButton label="Rotate" confirmLabel="Confirm rotate" onConfirm={() => ops.rotateSecret(s.name)} />
            </div>
          ))}
        </Card>
      </section>

      {/* Incidents */}
      <section className="space-y-3">
        <Heading level="m" className="border-l-4 border-teal-500 pl-3">Incidents</Heading>
        <Card className="space-y-2">
          <IncidentCreator onCreate={ops.createIncident} />
          <div className="divide-y divide-pulse-100 dark:divide-[#1E2A45]">
            {ops.incidents.length === 0 ? (
              <Body size="s" className="text-pulse-500 dark:text-[#8A96B0] pt-2">No incidents.</Body>
            ) : ops.incidents.map((i) => <IncidentRow key={i.id} incident={i} onClose={ops.closeIncident} />)}
          </div>
        </Card>
      </section>

      {/* Backups */}
      <section className="space-y-3">
        <Heading level="m" className="border-l-4 border-teal-500 pl-3">Backups</Heading>
        <Card className="flex items-center justify-between gap-3">
          <Body size="s" className="text-pulse-600 dark:text-[#A8B3CC]">
            Last D1 backup: {fmt(ops.backup?.last_backup_at ?? null)} · status {ops.backup?.status ?? 'unknown'}
          </Body>
          <ConfirmButton label="Restore…" confirmLabel="Confirm restore" onConfirm={() => ops.restoreBackup()} />
        </Card>
      </section>
    </div>
  )
}
