/**
 * SOVEREIGN-POSTURE-01 (ADR-0058) — per-tenant compliance posture matrix.
 *
 * Surfaces a tenant's compliance claims (FedRAMP, GDPR, regional residency cert,
 * federation exclusion) as a checkmark matrix the tenant admin can read. Pure
 * derivation from tenant config + the region registry so the posture is always
 * consistent with the enforced boundary (region-residency + sovereign-exclusion),
 * never a hand-maintained marketing claim.
 */
import { resolveRegion, type SovereignRegionId } from './region-residency'

export type ComplianceClaim = 'fedramp' | 'gdpr' | 'residency_cert' | 'federation_excluded'

export type ClaimStatus = 'yes' | 'no' | 'partial'

export type PostureCell = {
  claim: ComplianceClaim
  status: ClaimStatus
  /** Short human-readable basis for the status (audit-friendly). */
  evidence: string
}

export type TenantComplianceConfig = {
  teamId: string
  regionId: SovereignRegionId | string | null | undefined
  isSovereign: boolean
  /** FedRAMP boundary enabled (S89 ADR-0052). */
  fedrampModerate?: boolean
}

export type SovereignPosture = {
  teamId: string
  region: { id: string; label: string; jurisdiction: string }
  cells: PostureCell[]
}

export function buildSovereignPosture(config: TenantComplianceConfig): SovereignPosture {
  const region = resolveRegion(config.regionId)
  const gdpr = region.residencyZone === 'eu' || region.residencyZone === 'uk'

  const cells: PostureCell[] = [
    {
      claim: 'fedramp',
      status: config.fedrampModerate ? 'yes' : 'no',
      evidence: config.fedrampModerate
        ? 'FedRAMP Moderate boundary enabled (ADR-0052)'
        : 'FedRAMP boundary not enabled for this tenant',
    },
    {
      claim: 'gdpr',
      status: gdpr ? 'yes' : 'partial',
      evidence: gdpr
        ? `Data resident in ${region.jurisdiction}`
        : `Region ${region.id} outside EU/UK GDPR zone; DPA still applies`,
    },
    {
      claim: 'residency_cert',
      status: config.isSovereign ? 'yes' : 'partial',
      evidence: config.isSovereign
        ? `Hard residency boundary in ${region.label} (sovereign tier)`
        : 'Standard residency; no sovereign hard-boundary guarantee',
    },
    {
      claim: 'federation_excluded',
      status: config.isSovereign ? 'yes' : 'no',
      evidence: config.isSovereign
        ? 'Cross-tenant federation + partner egress disabled (SOVEREIGN-EXCLUSION-01)'
        : 'Federation/egress available per plan',
    },
  ]

  return {
    teamId: config.teamId,
    region: { id: region.id, label: region.label, jurisdiction: region.jurisdiction },
    cells,
  }
}
