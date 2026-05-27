/**
 * RESIDENCY-ENFORCE-01 — EU tenant home region pinning (S75).
 */
import type { Env } from '../types'

export type ResidencyPin = {
  teamId: string
  homeRegion: 'eu' | 'us' | 'apac'
  enforcedAt: number
}

export function residencyPinKvKey(teamId: string): string {
  return `residency:pin:${teamId}`
}

export async function getTeamResidencyPin(kv: KVNamespace, teamId: string): Promise<ResidencyPin | null> {
  const raw = await kv.get(residencyPinKvKey(teamId))
  if (!raw) return null
  try {
    return JSON.parse(raw) as ResidencyPin
  } catch {
    return null
  }
}

export async function setTeamResidencyPin(kv: KVNamespace, pin: ResidencyPin): Promise<void> {
  await kv.put(residencyPinKvKey(pin.teamId), JSON.stringify(pin))
}

/** Returns error message if write must be blocked for residency policy. */
export async function assertResidencyAllowsMutation(
  env: Env,
  teamId: string | null | undefined,
  writeRegion: string,
): Promise<string | null> {
  if (!teamId || !env.TEAMS_KV) return null
  const pin = await getTeamResidencyPin(env.TEAMS_KV, teamId)
  if (!pin || pin.homeRegion !== 'eu') return null
  if (writeRegion !== 'eu' && env.MULTI_REGION_WRITES_ENABLED === 'true') {
    return 'EU-pinned tenants must mutate in EU write region (ADR-0036)'
  }
  return null
}
