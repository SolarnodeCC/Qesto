/**
 * MR-WRITE-FOUNDATION-01 / ADR-0027 — tenant write region hints (KV-backed).
 */
import { readKvJson, writeKvJson } from './kv'

export type HomeRegion = 'us' | 'eu' | 'apac'

export type TeamRegionConfig = {
  homeRegion: HomeRegion
  regionLock?: 'eu' | null
  updatedAt: number
}

export function teamRegionKvKey(teamId: string): string {
  return `team:region:${teamId}`
}

export async function getTeamRegionConfig(kv: KVNamespace | undefined, teamId: string): Promise<TeamRegionConfig> {
  const stored = kv ? await readKvJson<TeamRegionConfig>(kv, teamRegionKvKey(teamId)) : null
  return stored ?? { homeRegion: 'us', updatedAt: 0 }
}

export async function setTeamRegionConfig(
  kv: KVNamespace,
  teamId: string,
  config: Omit<TeamRegionConfig, 'updatedAt'>,
): Promise<void> {
  await writeKvJson(kv, teamRegionKvKey(teamId), { ...config, updatedAt: Date.now() })
}

export function isTeamInEuWriteCohort(env: { MR_WRITE_EU_COHORT?: string }, teamId: string): boolean {
  const cohort = env.MR_WRITE_EU_COHORT?.trim()
  if (!cohort) return false
  if (cohort === '*') return true
  return cohort.split(',').map((s) => s.trim()).includes(teamId)
}

export function resolveWriteBinding(
  env: { MULTI_REGION_WRITES_ENABLED?: string; MULTI_REGION_PRIMARY?: string; MR_WRITE_EU_COHORT?: string },
  teamConfig: TeamRegionConfig,
  teamId?: string,
): { binding: 'primary'; region: HomeRegion; residencyLocked: boolean; euCohort: boolean } {
  const primary = (env.MULTI_REGION_PRIMARY as HomeRegion) || 'us'
  const enabled = env.MULTI_REGION_WRITES_ENABLED === 'true'
  const euCohort = teamId ? isTeamInEuWriteCohort(env, teamId) : false
  let region: HomeRegion = enabled ? teamConfig.homeRegion : primary
  if (euCohort && teamConfig.homeRegion === 'eu') region = 'eu'
  return {
    binding: 'primary',
    region,
    residencyLocked: teamConfig.regionLock === 'eu',
    euCohort,
  }
}
