/**
 * SEC-SOVEREIGN-ISOLATION-01 (ADR-0062 §3 / ADR-0058) — cross-region & cross-tenant
 * isolation PROOF harness.
 *
 * `region-residency.ts` gives us `assertSameRegion()` for a single row. CONNECT's
 * real risk is a BATCH leak: a federated/region-scoped query that returns even one
 * out-of-region or out-of-tenant row is a residency/isolation incident. This module
 * composes the per-row guard into a reproducible isolation proof that the Pentest #6
 * isolation run (S95) and the v7.0-rc scale proof (`QA-CONNECT-SCALE-01`, S97) assert
 * `leakedCount === 0` against — isolation becomes a test output, not a hope.
 *
 * Pure + side-effect free so it runs identically in unit tests, the close handler,
 * and a load-test harness.
 */

import { assertSameRegion, resolveRegion, type SovereignRegionId } from './region-residency'

/** Minimal shape a row must expose to be isolation-checkable. */
export type RegionScopedRow = {
  /** Stable id used to report a leak without dumping the whole row (no PII). */
  id: string
  /** The region the row's data belongs to. */
  regionId: string | null | undefined
  /** Owning tenant — used for the cross-tenant facet of the proof (optional). */
  teamId?: string | null
}

/** A single leaked row, reduced to non-PII identifiers for the evidence artifact. */
export type IsolationLeak = {
  id: string
  expectedRegion: SovereignRegionId
  actualRegion: SovereignRegionId
  teamId: string | null
}

export type IsolationProof = {
  /** Proof format version (bump if the artifact shape changes). */
  v: 1
  /** The region the query was scoped to. */
  expectedRegion: SovereignRegionId
  /** Tenant the query was scoped to, when a cross-tenant facet was requested. */
  expectedTeamId: string | null
  /** Total rows inspected. */
  total: number
  /** Rows correctly inside the boundary. */
  inRegionCount: number
  /** Rows that crossed the region boundary (the residency-leak count). */
  leakedCount: number
  /** Rows that crossed the tenant boundary (the isolation-leak count). */
  crossTenantCount: number
  /** Bounded sample of leaks for the evidence artifact (never the full PII set). */
  leakedSample: IsolationLeak[]
  /** The single thing the Pentest/scale gate asserts: no leak of either kind. */
  pass: boolean
}

/** How many leaks to retain in the proof sample (evidence, not a data dump). */
export const ISOLATION_LEAK_SAMPLE_LIMIT = 20

/**
 * Partition a query's returned rows into in-region vs leaked, producing a
 * reproducible isolation proof. `expectedTeamId` enables the cross-tenant facet:
 * when set, a row owned by a different tenant is counted as a cross-tenant leak
 * (federation must share aggregates, never another tenant's raw rows).
 */
export function proveRegionIsolation(
  rows: ReadonlyArray<RegionScopedRow>,
  expected: { region: string | null | undefined; teamId?: string | null },
): IsolationProof {
  const expectedRegion = resolveRegion(expected.region).id
  const expectedTeamId = expected.teamId ?? null

  let inRegionCount = 0
  let leakedCount = 0
  let crossTenantCount = 0
  const leakedSample: IsolationLeak[] = []

  for (const row of rows) {
    const check = assertSameRegion(expectedRegion, row.regionId)
    const tenantLeak = expectedTeamId !== null && (row.teamId ?? null) !== expectedTeamId

    if (check.ok && !tenantLeak) {
      inRegionCount++
      continue
    }

    if (!check.ok) leakedCount++
    if (tenantLeak) crossTenantCount++

    if (leakedSample.length < ISOLATION_LEAK_SAMPLE_LIMIT) {
      leakedSample.push({
        id: row.id,
        expectedRegion,
        actualRegion: resolveRegion(row.regionId).id,
        teamId: row.teamId ?? null,
      })
    }
  }

  return {
    v: 1,
    expectedRegion,
    expectedTeamId,
    total: rows.length,
    inRegionCount,
    leakedCount,
    crossTenantCount,
    leakedSample,
    pass: leakedCount === 0 && crossTenantCount === 0,
  }
}

/**
 * Drop every leaked row, returning only rows inside both the region and (when
 * given) the tenant boundary. Fail-safe filter for a query result before it is
 * ever serialised to a federated caller — defence in depth behind the D1 fragment.
 */
export function filterToRegion<T extends RegionScopedRow>(
  rows: ReadonlyArray<T>,
  expected: { region: string | null | undefined; teamId?: string | null },
): T[] {
  const expectedRegion = resolveRegion(expected.region).id
  const expectedTeamId = expected.teamId ?? null
  return rows.filter((row) => {
    if (!assertSameRegion(expectedRegion, row.regionId).ok) return false
    if (expectedTeamId !== null && (row.teamId ?? null) !== expectedTeamId) return false
    return true
  })
}

/**
 * SQL clause that scopes a region-partitioned query to one region (and, when a
 * tenant facet is needed, one tenant). Bind `region_id` (and `team_id`) as
 * parameters; ANDs alongside `FEDERATION_ELIGIBLE_SQL_FRAGMENT` for CONNECT.
 */
export function regionScopedSqlFragment(opts: { withTenant?: boolean } = {}): string {
  return opts.withTenant ? 'region_id = ? AND team_id = ?' : 'region_id = ?'
}
