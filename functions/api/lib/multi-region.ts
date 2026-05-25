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

export const MULTI_REGION_FAILOVER_KV_KEY = 'multi-region:failover:active'

/**
 * Logical write region (ADR-0022 Phase 2). Single D1 binding until replica bindings ship.
 * When failover is active, writes target the first configured read replica.
 */
export function resolveWriteRegion(
  cfg: MultiRegionConfig,
  failoverActive: boolean,
): RegionCode {
  if (failoverActive && cfg.readReplicas.length > 0) {
    return cfg.readReplicas[0]!
  }
  return cfg.primary
}

export async function isMultiRegionFailoverActive(kv: KVNamespace | undefined): Promise<boolean> {
  if (!kv) return false
  const raw = await kv.get(MULTI_REGION_FAILOVER_KV_KEY)
  return raw === 'true' || raw === '1'
}

export async function setMultiRegionFailoverActive(kv: KVNamespace, active: boolean): Promise<void> {
  if (active) {
    await kv.put(MULTI_REGION_FAILOVER_KV_KEY, 'true')
  } else {
    await kv.delete(MULTI_REGION_FAILOVER_KV_KEY)
  }
}

export type MultiRegionRoutingSnapshot = {
  colo: string | null
  readRegion: RegionCode
  writeRegion: RegionCode
  failoverActive: boolean
  config: MultiRegionConfig
}

export async function getMultiRegionRoutingSnapshot(
  env: {
    MULTI_REGION_ENABLED?: string
    MULTI_REGION_PRIMARY?: string
    MULTI_REGION_REPLICAS?: string
    MULTI_REGION_STATE_KV?: KVNamespace
  },
  colo: string | null | undefined,
): Promise<MultiRegionRoutingSnapshot> {
  const config = getMultiRegionConfig(env)
  const failoverActive = await isMultiRegionFailoverActive(env.MULTI_REGION_STATE_KV)
  const readRegion = resolveReadRegion(colo, config)
  const writeRegion = resolveWriteRegion(config, failoverActive)
  return { colo: colo ?? null, readRegion, writeRegion, failoverActive, config }
}
