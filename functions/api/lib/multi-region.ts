/**
 * MULTI-REGION-FOUNDATION-01 — read-replica routing design (staging-only activation in S48).
 */
export type RegionCode = 'us' | 'eu' | 'apac'

export type MultiRegionConfig = {
  enabled: boolean
  primary: RegionCode
  readReplicas: RegionCode[]
  /** Colo prefixes routed to EU replica (Cloudflare cf.colo). */
  euColos: string[]
}

const DEFAULT_EU_COLOS = ['AMS', 'LHR', 'FRA', 'CDG', 'DUB', 'ARN', 'CPH', 'MAD', 'MXP', 'ZRH']

export function getMultiRegionConfig(env: {
  MULTI_REGION_ENABLED?: string
  MULTI_REGION_PRIMARY?: string
  MULTI_REGION_REPLICAS?: string
}): MultiRegionConfig {
  const enabled = env.MULTI_REGION_ENABLED === 'true'
  const primary = (env.MULTI_REGION_PRIMARY ?? 'us') as RegionCode
  const replicas = (env.MULTI_REGION_REPLICAS ?? 'eu')
    .split(',')
    .map((r) => r.trim().toLowerCase())
    .filter(Boolean) as RegionCode[]
  return {
    enabled,
    primary,
    readReplicas: replicas.length ? replicas : ['eu'],
    euColos: DEFAULT_EU_COLOS,
  }
}

/** Resolve preferred read region from Cloudflare colo (design-time; D1 binding stays single until sharding). */
export function resolveReadRegion(colo: string | null | undefined, cfg: MultiRegionConfig): RegionCode {
  if (!cfg.enabled || !colo) return cfg.primary
  if (cfg.euColos.includes(colo.toUpperCase())) return 'eu'
  if (colo.startsWith('SIN') || colo.startsWith('HKG') || colo.startsWith('NRT')) return 'apac'
  return cfg.primary
}
