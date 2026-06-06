import { absent } from './absent'
/**
 * RESIDENCY-ENFORCE-01 — EU tenant home region pinning (S75).
 */
import { z } from 'zod'
import type { Env } from '../types'
import { parseJsonString } from './boundary-decode'
import { getFlag } from './flags'
export const ResidencyPinSchema = z.object({
  teamId: z.string(),
  homeRegion: z.enum(['eu', 'us', 'apac']),
  enforcedAt: z.number(),
})

export type ResidencyPin = z.infer<typeof ResidencyPinSchema>

export function residencyPinKvKey(teamId: string): string {
  return `residency:pin:${teamId}`
}

export async function getTeamResidencyPin(kv: KVNamespace, teamId: string): Promise<ResidencyPin | null> {
  const raw = await kv.get(residencyPinKvKey(teamId))
  if (!raw) return absent()
  return parseJsonString(ResidencyPinSchema, raw)
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
  if (!teamId || !env.TEAMS_KV) return absent()
  const pin = await getTeamResidencyPin(env.TEAMS_KV, teamId)
  if (!pin || pin.homeRegion !== 'eu') return absent()
  if (writeRegion !== 'eu' && getFlag(env, 'MULTI_REGION_WRITES_ENABLED')) {
    return 'EU-pinned tenants must mutate in EU write region (ADR-0036)'
  }
  return absent()
}
