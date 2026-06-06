/**
 * RESIDENCY-ENFORCE-01 — EU tenant home region pinning (S75).
 */
import { z } from 'zod'
import type { Env } from '../types'
import { getFlag } from './flags'
import { decodeKvJson } from './boundary-decode'

export type ResidencyPin = {
  teamId: string
  homeRegion: 'eu' | 'us' | 'apac'
  enforcedAt: number
}

const ResidencyPinSchema = z.object({
  teamId: z.string(),
  homeRegion: z.enum(['eu', 'us', 'apac']),
  enforcedAt: z.number(),
})

export function residencyPinKvKey(teamId: string): string {
  return `residency:pin:${teamId}`
}

export async function getTeamResidencyPin(kv: KVNamespace, teamId: string): Promise<ResidencyPin | null> {
  const raw = await kv.get(residencyPinKvKey(teamId))
  return decodeKvJson(raw, ResidencyPinSchema)
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
  if (writeRegion !== 'eu' && getFlag(env, 'MULTI_REGION_WRITES_ENABLED')) {
    return 'EU-pinned tenants must mutate in EU write region (ADR-0036)'
  }
  return null
}
