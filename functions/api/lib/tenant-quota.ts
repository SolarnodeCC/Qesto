/**
 * ADR-0032 / TENANT-QUOTA-01 — per-team API and LIVE session limits.
 */
import { readKvJson, writeKvJson } from './kv'

export type TenantQuota = {
  teamId: string
  apiRequestsPerDay: number
  maxConcurrentLiveSessions: number
  updatedAt: number
}

const DEFAULT_QUOTA: Omit<TenantQuota, 'teamId' | 'updatedAt'> = {
  apiRequestsPerDay: 50_000,
  maxConcurrentLiveSessions: 10,
}

export function tenantQuotaKey(teamId: string): string {
  return `tenant:quota:${teamId}`
}

export function tenantApiUsageDayKey(teamId: string, dayStart: number): string {
  return `tenant:api-day:${teamId}:${dayStart}`
}

export async function getTenantQuota(kv: KVNamespace | undefined, teamId: string): Promise<TenantQuota> {
  const stored = kv ? await readKvJson<TenantQuota>(kv, tenantQuotaKey(teamId)) : null
  return stored ?? { teamId, ...DEFAULT_QUOTA, updatedAt: 0 }
}

export async function checkTenantApiQuota(kv: KVNamespace | undefined, teamId: string): Promise<{ allowed: boolean; used: number; limit: number }> {
  const quota = await getTenantQuota(kv, teamId)
  if (!kv) return { allowed: true, used: 0, limit: quota.apiRequestsPerDay }
  const dayStart = Math.floor(Date.now() / 86400000)
  const key = tenantApiUsageDayKey(teamId, dayStart)
  const used = Number((await kv.get(key)) ?? '0')
  return { allowed: used < quota.apiRequestsPerDay, used, limit: quota.apiRequestsPerDay }
}

export async function incrementTenantApiUsage(kv: KVNamespace, teamId: string): Promise<void> {
  const dayStart = Math.floor(Date.now() / 86400000)
  const key = tenantApiUsageDayKey(teamId, dayStart)
  const used = Number((await kv.get(key)) ?? '0')
  await kv.put(key, String(used + 1), { expirationTtl: 86400 * 2 })
}

export async function setTenantQuota(kv: KVNamespace, quota: TenantQuota): Promise<void> {
  await writeKvJson(kv, tenantQuotaKey(quota.teamId), { ...quota, updatedAt: Date.now() })
}
