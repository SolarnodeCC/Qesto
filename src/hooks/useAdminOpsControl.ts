import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'

export type DeployRow = {
  id: string
  version: string
  environment: string
  sha: string | null
  status: 'deployed' | 'rolled_back' | 'rollback_requested'
  created_at: number
  rolled_back_at: number | null
}
export type RunnerStatus = { online: boolean; last_heartbeat_at: number | null; runner_id: string | null }

export type CronJobStatus = {
  key: string
  label: string
  schedule: string
  last_status: string | null
  last_run_at: number | null
  next_run_at: number
  missed: boolean
}

export type SecretRotation = {
  name: string
  last_rotated_at: number | null
  expires_at: number | null
  last_used_at: number | null
  rotation_requested_at: number | null
  status: 'ok' | 'expiring' | 'expired' | 'unknown'
}

export type Incident = {
  id: string
  severity: 1 | 2 | 3
  title: string
  status: 'open' | 'closed'
  linked_metric: string | null
  postmortem: string | null
  created_at: number
  closed_at: number | null
}

export type BackupStatus = { last_backup_at: number | null; status: string; size_bytes?: number }

/**
 * Module 4 — OPS control. Loads all operational read views and exposes the
 * audited operator actions. Cron is polled every 30s so a missed-run flag
 * surfaces promptly (AC: ≤ 1 min).
 */
export function useAdminOpsControl() {
  const [deploys, setDeploys] = useState<DeployRow[]>([])
  const [runner, setRunner] = useState<RunnerStatus | null>(null)
  const [cron, setCron] = useState<CronJobStatus[]>([])
  const [secrets, setSecrets] = useState<SecretRotation[]>([])
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [backup, setBackup] = useState<BackupStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadDeploys = useCallback(async () => {
    const res = await api<{ deploys: DeployRow[]; runner: RunnerStatus }>('/api/admin/ops/deploys')
    if (res.ok) { setDeploys(res.data.deploys); setRunner(res.data.runner) } else setError(res.error.message)
  }, [])
  const loadCron = useCallback(async () => {
    const res = await api<{ jobs: CronJobStatus[] }>('/api/admin/ops/cron')
    if (res.ok) setCron(res.data.jobs)
  }, [])
  const loadSecrets = useCallback(async () => {
    const res = await api<{ secrets: SecretRotation[] }>('/api/admin/ops/secrets')
    if (res.ok) setSecrets(res.data.secrets)
  }, [])
  const loadIncidents = useCallback(async () => {
    const res = await api<{ incidents: Incident[] }>('/api/admin/ops/incidents')
    if (res.ok) setIncidents(res.data.incidents)
  }, [])
  const loadBackup = useCallback(async () => {
    const res = await api<{ backup: BackupStatus }>('/api/admin/ops/backups')
    if (res.ok) setBackup(res.data.backup)
  }, [])

  useEffect(() => {
    void loadDeploys(); void loadCron(); void loadSecrets(); void loadIncidents(); void loadBackup()
    const id = setInterval(() => { void loadCron() }, 30_000)
    return () => clearInterval(id)
  }, [loadDeploys, loadCron, loadSecrets, loadIncidents, loadBackup])

  const rollback = useCallback(async (id: string) => {
    const res = await api(`/api/admin/ops/deploys/${id}/rollback`, { method: 'POST', body: { confirm: true } })
    await loadDeploys()
    return res
  }, [loadDeploys])
  const triggerCron = useCallback(async (key: string) => {
    const res = await api(`/api/admin/ops/cron/${key}/trigger`, { method: 'POST', body: {} })
    await loadCron()
    return res
  }, [loadCron])
  const rotateSecret = useCallback(async (name: string) => {
    const res = await api(`/api/admin/ops/secrets/${encodeURIComponent(name)}/rotate`, { method: 'POST', body: { confirm: true } })
    await loadSecrets()
    return res
  }, [loadSecrets])
  const createIncident = useCallback(async (severity: 1 | 2 | 3, title: string, linked_metric?: string) => {
    const res = await api('/api/admin/ops/incidents', { method: 'POST', body: { severity, title, ...(linked_metric ? { linked_metric } : {}) } })
    await loadIncidents()
    return res
  }, [loadIncidents])
  const closeIncident = useCallback(async (id: string, postmortem?: string) => {
    const res = await api(`/api/admin/ops/incidents/${id}/close`, { method: 'POST', body: postmortem ? { postmortem } : {} })
    await loadIncidents()
    return res
  }, [loadIncidents])
  const restoreBackup = useCallback(async () => {
    return api('/api/admin/ops/backups/restore', { method: 'POST', body: { confirm: true } })
  }, [])

  return {
    deploys, runner, cron, secrets, incidents, backup, error,
    rollback, triggerCron, rotateSecret, createIncident, closeIncident, restoreBackup,
  }
}
