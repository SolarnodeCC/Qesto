/**
 * SOVEREIGN-EXCLUSION-01 (ADR-0058 / ADR-0059) — sovereign-tier feature exclusion.
 *
 * A sovereign tenant trades reach for an airtight data boundary: it MUST NOT join
 * cross-tenant CONNECT federation (S95+) and MUST NOT egress data to partner
 * integrations. This is a hard boundary enforced as a pure guard so the S95
 * CONNECT join path, the partner-egress path, and the posture UI all share one
 * decision — and a sovereign tenant can never be silently opted in.
 *
 * Config-as-data (ADR-0058): "sovereign" is a tenant-config property, not a code
 * fork. The D1 federation-eligibility query builder here yields a clause that
 * structurally excludes sovereign tenants, so an accidental join is impossible at
 * the query layer too.
 */

export type SovereignTenantConfig = {
  teamId: string
  /** True when the tenant is on the sovereign tier (per-region residency + exclusion). */
  isSovereign: boolean
  /** Explicit partner-egress opt-out (always implied true when isSovereign). */
  egressOptOut?: boolean
}

export type ExclusionViolation = {
  ok: false
  code: 'sovereign_federation_excluded' | 'sovereign_egress_excluded'
  message: string
  teamId: string
}

export type ExclusionAllowed = { ok: true; teamId: string }

/**
 * Federation join guard. Returns a typed violation the caller MUST deny on when
 * the tenant is sovereign. Never coerces — a sovereign tenant attempting a
 * federation join is a policy event, not a no-op.
 */
export function assertFederationAllowed(config: SovereignTenantConfig): ExclusionAllowed | ExclusionViolation {
  if (config.isSovereign) {
    return {
      ok: false,
      code: 'sovereign_federation_excluded',
      message: `Sovereign tenant ${config.teamId} cannot join cross-tenant federation`,
      teamId: config.teamId,
    }
  }
  return { ok: true, teamId: config.teamId }
}

/** Partner-egress guard — sovereign OR explicit opt-out blocks any data-out. */
export function assertEgressAllowed(config: SovereignTenantConfig): ExclusionAllowed | ExclusionViolation {
  if (config.isSovereign || config.egressOptOut === true) {
    return {
      ok: false,
      code: 'sovereign_egress_excluded',
      message: `Tenant ${config.teamId} has partner egress disabled (sovereign or opt-out)`,
      teamId: config.teamId,
    }
  }
  return { ok: true, teamId: config.teamId }
}

/**
 * SQL fragment that structurally excludes sovereign tenants from a
 * federation-eligibility query. Designed to AND into the CONNECT join query
 * (S95) so the exclusion holds even if an app-layer guard is missed.
 *
 * Assumes a `teams.is_sovereign` column (0/1); callers select against it.
 */
export const FEDERATION_ELIGIBLE_SQL_FRAGMENT =
  'COALESCE(is_sovereign, 0) = 0'

/** Filter an in-memory candidate list down to federation-eligible tenants. */
export function filterFederationEligible<T extends SovereignTenantConfig>(candidates: T[]): T[] {
  return candidates.filter((t) => assertFederationAllowed(t).ok)
}
