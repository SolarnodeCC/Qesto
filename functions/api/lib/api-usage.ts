/**
 * API-PLAT-USAGE-METER-01 — per-team API request counters (KV, 24h windows).
 */
import { readKvJson, writeKvJson } from './kv'

export type ApiUsageSnapshot = {
  teamId: string
  windowStart: number
  requestCount: number
  lastRequestAt: number
}

const WINDOW_SEC = 86400

export function apiUsageKvKey(teamId: string, windowStart: number): string {
  return `api:usage:${teamId}:${windowStart}`
}

export async function recordApiUsage(kv: KVNamespace, teamId: string): Promise<ApiUsageSnapshot> {
  const windowStart = Math.floor(Date.now() / 1000 / WINDOW_SEC) * WINDOW_SEC
  const key = apiUsageKvKey(teamId, windowStart)
  const prev = (await readKvJson<ApiUsageSnapshot>(kv, key)) ?? {
    teamId,
    windowStart,
    requestCount: 0,
    lastRequestAt: 0,
  }
  const next: ApiUsageSnapshot = {
    teamId,
    windowStart,
    requestCount: prev.requestCount + 1,
    lastRequestAt: Date.now(),
  }
  await writeKvJson(kv, key, next, { expirationTtl: WINDOW_SEC * 2 })
  return next
}

export async function getApiUsageForTeam(kv: KVNamespace, teamId: string): Promise<ApiUsageSnapshot> {
  const windowStart = Math.floor(Date.now() / 1000 / WINDOW_SEC) * WINDOW_SEC
  const key = apiUsageKvKey(teamId, windowStart)
  return (
    (await readKvJson<ApiUsageSnapshot>(kv, key)) ?? {
      teamId,
      windowStart,
      requestCount: 0,
      lastRequestAt: 0,
    }
  )
}
