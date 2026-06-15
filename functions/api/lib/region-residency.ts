/**
 * SOVEREIGN-00 / SOVEREIGN-REGIONS-01 (ADR-0058) — per-region edge residency.
 *
 * Config-as-data region registry (no per-region code forks). Each region is a
 * hard data-residency boundary: session/KV data resolved for `eu-001` must never
 * be keyed into `uk-001` or `ca-001`. Enforcement lives in pure helpers so the
 * boundary is unit-testable and identical on every call site (worker, route, DO).
 */

export const SOVEREIGN_REGION_IDS = ['eu-001', 'uk-001', 'ca-001'] as const
export type SovereignRegionId = (typeof SOVEREIGN_REGION_IDS)[number]

/** Default region for tenants without an explicit residency binding (EU-first, ADR-0058). */
export const DEFAULT_REGION_ID: SovereignRegionId = 'eu-001'

export type SovereignRegion = {
  id: SovereignRegionId
  label: string
  /** ISO-ish data-boundary tag surfaced to DPO / compliance posture. */
  residencyZone: 'eu' | 'uk' | 'ca'
  /** KV key prefix — every persisted key for this region carries it (no cross-region collision). */
  kvPrefix: string
  /** Human jurisdiction label for the compliance posture surface. */
  jurisdiction: string
}

/** Region registry — config only. Adding a region is a data edit, never a code fork. */
export const SOVEREIGN_REGIONS: Readonly<Record<SovereignRegionId, SovereignRegion>> = {
  'eu-001': { id: 'eu-001', label: 'EU (Frankfurt)', residencyZone: 'eu', kvPrefix: 'r:eu-001', jurisdiction: 'European Union (GDPR)' },
  'uk-001': { id: 'uk-001', label: 'UK (London)', residencyZone: 'uk', kvPrefix: 'r:uk-001', jurisdiction: 'United Kingdom (UK GDPR)' },
  'ca-001': { id: 'ca-001', label: 'Canada (Toronto)', residencyZone: 'ca', kvPrefix: 'r:ca-001', jurisdiction: 'Canada (PIPEDA)' },
}

export function isSovereignRegion(value: unknown): value is SovereignRegionId {
  return typeof value === 'string' && (SOVEREIGN_REGION_IDS as readonly string[]).includes(value)
}

/** Resolve a region id to its config, falling back to the default region. */
export function resolveRegion(regionId: string | null | undefined): SovereignRegion {
  if (isSovereignRegion(regionId)) return SOVEREIGN_REGIONS[regionId]
  return SOVEREIGN_REGIONS[DEFAULT_REGION_ID]
}

/**
 * Region-namespaced KV key. The region prefix is prepended so a read/write for one
 * region can never collide with another, even under a shared KV binding.
 */
export function regionKvKey(regionId: string | null | undefined, key: string): string {
  return `${resolveRegion(regionId).kvPrefix}:${key}`
}

export type RegionResidencyViolation = {
  ok: false
  code: 'cross_region_data_leak'
  message: string
  expected: SovereignRegionId
  actual: string
}

/**
 * SOVEREIGN-00 — hard boundary check. Returns `{ ok: true }` only when the data
 * region matches the tenant's bound region; otherwise a typed violation the caller
 * MUST deny on (never silently coerce — a mismatch is a residency incident).
 */
export function assertSameRegion(
  tenantRegion: string | null | undefined,
  dataRegion: string | null | undefined,
): { ok: true; region: SovereignRegionId } | RegionResidencyViolation {
  const tenant = resolveRegion(tenantRegion).id
  const data = resolveRegion(dataRegion).id
  if (tenant !== data) {
    return {
      ok: false,
      code: 'cross_region_data_leak',
      message: `Data region ${data} does not match tenant residency ${tenant}`,
      expected: tenant,
      actual: data,
    }
  }
  return { ok: true, region: tenant }
}

/** Public-facing region catalog (no internal kvPrefix leakage). */
export function publicRegionCatalog(): Array<Pick<SovereignRegion, 'id' | 'label' | 'residencyZone' | 'jurisdiction'>> {
  return SOVEREIGN_REGION_IDS.map((id) => {
    const r = SOVEREIGN_REGIONS[id]
    return { id: r.id, label: r.label, residencyZone: r.residencyZone, jurisdiction: r.jurisdiction }
  })
}
