/**
 * ADR-0032 / TENANT-QUOTA-01 -- per-team API and LIVE session limits.
 */
import { readKvJson, writeKvJson } from './kv'
import { TENANT_QUOTA_TTL_SECONDS, TENANT_BURST_LOCK_TTL_SECONDS } from './constants'

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
  await kv.put(key, String(used + 1), { expirationTtl: TENANT_QUOTA_TTL_SECONDS })
}

export async function setTenantQuota(kv: KVNamespace, quota: TenantQuota): Promise<void> {
  await writeKvJson(kv, tenantQuotaKey(quota.teamId), { ...quota, updatedAt: Date.now() })
}

// ---- Overage threshold detection (ENTERPRISE-POLISH s8a) --------------------
//
// Returns the threshold level reached after the current usage count:
//   'ok'       -- below 80% of the daily API limit
//   'warn'     -- at or above 80% (trigger a proactive in-app warning)
//   'exceeded' -- at or above 100% (hard limit hit)

export type QuotaThreshold = 'ok' | 'warn' | 'exceeded'

export function getQuotaThreshold(used: number, limit: number): QuotaThreshold {
  if (limit <= 0) return 'ok'
  const pct = used / limit
  if (pct >= 1) return 'exceeded'
  if (pct >= 0.8) return 'warn'
  return 'ok'
}

/**
 * Combined increment-and-threshold helper.
 * Returns the new usage count and the threshold level reached so callers can
 * decide whether to fire a notification without an extra KV read.
 */
export async function incrementAndCheckThreshold(
  kv: KVNamespace,
  teamId: string,
): Promise<{ used: number; limit: number; threshold: QuotaThreshold }> {
  const quota = await getTenantQuota(kv, teamId)
  const dayStart = Math.floor(Date.now() / 86400000)
  const key = tenantApiUsageDayKey(teamId, dayStart)
  const prev = Number((await kv.get(key)) ?? '0')
  const used = prev + 1
  await kv.put(key, String(used), { expirationTtl: TENANT_QUOTA_TTL_SECONDS })
  return {
    used,
    limit: quota.apiRequestsPerDay,
    threshold: getQuotaThreshold(used, quota.apiRequestsPerDay),
  }
}

// KV key for tracking whether we already sent the warn/exceeded notification
// so we do not spam it on every request after the threshold is crossed.
export function tenantQuotaNotifiedKey(teamId: string, level: 'warn' | 'exceeded', dayStart: number): string {
  return `tenant:quota-notified:${teamId}:${level}:${dayStart}`
}

export async function shouldSendQuotaNotification(
  kv: KVNamespace,
  teamId: string,
  level: 'warn' | 'exceeded',
): Promise<boolean> {
  const dayStart = Math.floor(Date.now() / 86400000)
  const key = tenantQuotaNotifiedKey(teamId, level, dayStart)
  const already = await kv.get(key)
  if (already) return false
  await kv.put(key, '1', { expirationTtl: TENANT_BURST_LOCK_TTL_SECONDS })
  return true
}
