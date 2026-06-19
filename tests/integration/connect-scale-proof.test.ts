/**
 * QA-CONNECT-SCALE-01 (Sprint 97, P0) — CONNECT scale/isolation proof.
 *
 * ADR-0062 requires evidence that federation isolation holds at the scale CONNECT
 * GA must support: 5 tenants x 50,000 participants x 100 queries, zero cross-tenant
 * leakage. Rather than standing up live infra (the TOWNHALL-style k6 staging gate),
 * this proof reuses the existing isolation PRIMITIVES as measurement instruments —
 * `proveRegionIsolation`/`filterToRegion` (region-isolation.ts, S95) for the raw D1
 * query boundary, and `buildFederatedAggregate`/`aggregateIsSafe`
 * (federation-aggregates.ts, S96) for the cross-tenant aggregate serialised to
 * participants. That lets the proof run in CI on every PR instead of being a
 * staging-only gate, per the SPRINT97_EXECUTION.md build sequencing note.
 *
 * Evidence doc: knowledge-base/security/QA_CONNECT_SCALE_01_EVIDENCE.md
 */
import { describe, expect, it } from 'vitest'
import { proveRegionIsolation, filterToRegion, type RegionScopedRow } from '../../functions/api/lib/region-isolation'
import {
  buildFederatedAggregate,
  aggregateIsSafe,
  type TenantContribution,
} from '../../functions/api/lib/federation-aggregates'

const TENANT_COUNT = 5
const PARTICIPANTS_PER_TENANT = 50_000
const QUERY_COUNT = 100
const REGIONS = ['eu-001', 'uk-001'] as const

function tenantId(t: number): string {
  return `tenant-${t}`
}

function regionFor(t: number): string {
  return REGIONS[t % REGIONS.length]!
}

// Build the full synthetic dataset once: 5 tenants x 50k participant rows, as if
// every tenant's rows were visible in one unscoped result set — the worst case a
// D1 query without the region/tenant WHERE clause would return.
function buildAllRows(): RegionScopedRow[] {
  const rows: RegionScopedRow[] = []
  for (let t = 0; t < TENANT_COUNT; t++) {
    const team = tenantId(t)
    const region = regionFor(t)
    for (let p = 0; p < PARTICIPANTS_PER_TENANT; p++) {
      rows.push({ id: `${team}-p${p}`, regionId: region, teamId: team })
    }
  }
  return rows
}

function buildContribution(t: number): TenantContribution {
  const team = tenantId(t)
  const participantIds = Array.from({ length: PARTICIPANTS_PER_TENANT }, (_, p) => `${team}-p${p}`)
  return {
    teamId: team,
    participantIds,
    optionCounts: { yes: PARTICIPANTS_PER_TENANT / 2, no: PARTICIPANTS_PER_TENANT / 2 },
  }
}

describe.sequential('QA-CONNECT-SCALE-01 — 5 tenants x 50k participants x 100 queries, zero leakage', () => {
  const allRows = buildAllRows()
  const contributions = Array.from({ length: TENANT_COUNT }, (_, t) => buildContribution(t))

  it('the unscoped dataset is exactly 5 x 50,000 rows (sanity on the scale fixture)', () => {
    expect(allRows).toHaveLength(TENANT_COUNT * PARTICIPANTS_PER_TENANT)
  })

  it('detects every cross-tenant/cross-region row when a query is NOT scoped (negative control)', () => {
    // Worst case: a query for tenant 0 that forgot the WHERE clause and got every
    // tenant's rows back. The harness must catch all 200,000 leaked rows, proving
    // the detector itself has no blind spot at this scale before we trust it below.
    const proof = proveRegionIsolation(allRows, { region: regionFor(0), teamId: tenantId(0) })
    expect(proof.pass).toBe(false)
    expect(proof.inRegionCount).toBe(PARTICIPANTS_PER_TENANT)
    expect(proof.crossTenantCount).toBe(allRows.length - PARTICIPANTS_PER_TENANT)
  })

  it(
    '100 region+tenant-scoped queries across all 5 tenants each return zero leaked rows',
    () => {
      let totalRowsReturned = 0
      for (let q = 0; q < QUERY_COUNT; q++) {
        const t = q % TENANT_COUNT
        const scope = { region: regionFor(t), teamId: tenantId(t) }

        // Simulate the application's real query path: `regionScopedSqlFragment`'s
        // WHERE clause is what D1 enforces in production; `filterToRegion` is the
        // fail-safe in-memory mirror of that same boundary applied here to the full
        // unscoped dataset, standing in for "what the scoped D1 query would return".
        const scoped = filterToRegion(allRows, scope)
        const proof = proveRegionIsolation(scoped, scope)

        expect(proof.pass).toBe(true)
        expect(proof.leakedCount).toBe(0)
        expect(proof.crossTenantCount).toBe(0)
        expect(proof.total).toBe(PARTICIPANTS_PER_TENANT)
        expect(scoped.every((row) => row.teamId === tenantId(t))).toBe(true)

        totalRowsReturned += scoped.length
      }
      // Every one of the 100 queries saw only its own tenant's rows — never another
      // tenant's, and never a cross-region row.
      expect(totalRowsReturned).toBe(QUERY_COUNT * PARTICIPANTS_PER_TENANT)
    },
    90_000,
  )

  it(
    '100 federated cross-tenant aggregate reads (zero-knowledge) leak zero participant ids',
    () => {
      for (let q = 0; q < QUERY_COUNT; q++) {
        // Vary which subset of the 5 tenants is "currently federated" per query —
        // exercises 1-of-5 through 5-of-5 federation membership across the run.
        const memberCount = (q % TENANT_COUNT) + 1
        const members = contributions.slice(0, memberCount)
        const aggregate = buildFederatedAggregate(members, { zeroKnowledge: true })

        expect(aggregateIsSafe(aggregate, members)).toBe(true)
        expect(aggregate.perTenant).toBeUndefined()
        expect(aggregate.tenantCount).toBe(memberCount)
        expect(aggregate.totalParticipants).toBe(memberCount * PARTICIPANTS_PER_TENANT)
      }
    },
    90_000,
  )

  it(
    '100 federated cross-tenant aggregate reads (non-ZK, per-tenant counts) still leak zero participant ids',
    () => {
      for (let q = 0; q < QUERY_COUNT; q++) {
        const memberCount = (q % TENANT_COUNT) + 1
        const members = contributions.slice(0, memberCount)
        const aggregate = buildFederatedAggregate(members, { zeroKnowledge: false })

        expect(aggregateIsSafe(aggregate, members)).toBe(true)
        // Per-tenant counts are present, but counts only — never an id.
        expect(aggregate.perTenant).toHaveLength(memberCount)
        for (const pt of aggregate.perTenant ?? []) {
          expect(pt.participants).toBe(PARTICIPANTS_PER_TENANT)
        }
      }
    },
    90_000,
  )
})
