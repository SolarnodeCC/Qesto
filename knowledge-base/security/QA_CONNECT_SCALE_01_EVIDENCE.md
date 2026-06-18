---
id: QA_CONNECT_SCALE_01_EVIDENCE
status: passed
created: 2026-09-25
relates_to: QA-CONNECT-SCALE-01, ADR-0062, SPRINT97_EXECUTION, region-isolation.ts, federation-aggregates.ts
---

# QA-CONNECT-SCALE-01 Evidence (S97)

## Summary

This document records the **scale/isolation proof** for the v7.0-rc CONNECT GA gate: 5 tenants x
50,000 participants x 100 queries, zero cross-tenant leakage.

**Acceptance criterion** (SPRINT97_EXECUTION.md): *5-tenant × 50k × 100-query scale run produces
zero cross-tenant rows (evidence doc committed).*

## Approach

Per the S97 build-sequencing note ("built on the existing `IsolationProof` + `aggregateIsSafe`
harnesses"), this proof is a **synthetic in-memory CI test**, not a staging-only k6 load run (unlike
`TOWNHALL_SCALE_PROOF_50K.md`). The isolation guarantee CONNECT must hold is a property of the
isolation *logic* (the D1 `WHERE region_id = ? AND team_id = ?` scoping and the aggregate-builder's
identity-stripping), not of network/DO throughput — so the proof exercises that logic directly at
the full target scale, runs on every PR, and never depends on staging infra availability.

This re-uses two primitives already shipped and unit-tested in prior sprints:
- `proveRegionIsolation` / `filterToRegion` (`functions/api/lib/region-isolation.ts`, S95) — the
  region+tenant boundary a scoped D1 query enforces.
- `buildFederatedAggregate` / `aggregateIsSafe` (`functions/api/lib/federation-aggregates.ts`, S96)
  — the cross-tenant aggregate CONNECT serialises to federation members.

## Harness

**File:** `tests/integration/connect-scale-proof.test.ts`

**Fixture:** 5 tenants (`tenant-0`...`tenant-4`), each with 50,000 synthetic participant rows
(250,000 rows total), split across 2 regions (`eu-001`/`uk-001`) to also exercise the cross-region
facet, not just cross-tenant.

**Test 1 (negative control):** confirm the detector itself has no blind spot at this scale — an
intentionally **unscoped** query (as if the `WHERE` clause were missing) over the full 250,000-row
dataset is asserted to report exactly 200,000 leaked rows for any single target tenant. This
guards against a proof that trivially "passes" because it can't see leaks, not because there are
none.

**Test 2 (the gate, 100 queries):** for `q` in `0..99`, scope to tenant `q % 5` and its region, run
the same `filterToRegion` → `proveRegionIsolation` path the application's scoped D1 query stands in
for, and assert per-query: `pass === true`, `leakedCount === 0`, `crossTenantCount === 0`,
`total === 50,000`, and every returned row's `teamId` equals the scoped tenant. Across all 100
queries, exactly `100 × 50,000 = 5,000,000` rows were returned and not one belonged to a tenant
other than the one queried.

**Test 3 + 4 (100 federated aggregate reads each, ZK and non-ZK):** build the cross-tenant
`FederatedAggregate` for federation memberships ranging from 1-of-5 to 5-of-5 tenants (cycled across
the 100 iterations in each mode) and assert `aggregateIsSafe(...) === true` for every one — i.e. no
participant id from any of the up-to-250,000 contributing participants appears anywhere in the
serialised aggregate, in both zero-knowledge (no `perTenant`) and non-ZK (`perTenant` counts only,
no ids) modes.

## Evidence table

| Metric | Target | Result | Status |
|---|---|---|---|
| Tenant count | 5 | 5 | ✅ |
| Participants per tenant | 50,000 | 50,000 | ✅ |
| Total synthetic rows | 250,000 | 250,000 | ✅ |
| Region-scoped queries run | 100 | 100 | ✅ |
| Cross-tenant rows returned (scoped queries) | 0 | 0 | ✅ |
| Cross-region rows returned (scoped queries) | 0 | 0 | ✅ |
| Negative control (unscoped query) leaked rows detected | 200,000 (proves detector sees the leak) | 200,000 | ✅ |
| Federated aggregate reads (zero-knowledge) | 100 | 100 | ✅ |
| Federated aggregate reads (non-ZK) | 100 | 100 | ✅ |
| Participant-id leaks in any federated aggregate | 0 | 0 | ✅ |
| `npx vitest run tests/integration/connect-scale-proof.test.ts` | green | **5/5 passed** (~17s) | ✅ |

**Status: PASSED.** Zero cross-tenant rows across 100 region+tenant-scoped queries at 5×50k scale;
zero participant-id leaks across 200 federated aggregate reads at the same scale.

## Interpretation

- This proof validates that **the isolation primitives correctly enforce the boundary at the target
  scale** — it is a logic/regression proof, not a throughput/latency proof. It does not measure D1
  query latency or SessionRoom DO behavior under 50k concurrent connections; that is a separate,
  infra-dependent concern (the TOWNHALL-style k6 staging gate pattern) and is out of scope for this
  story, which is specifically an **isolation** gate per ADR-0062 §3/§5.
- The negative control (Test 1) is the proof's own self-check: it demonstrates the harness can
  detect a leak of this size before the positive tests are trusted to report "zero."
- Runs in CI on every PR (~17s) rather than requiring staging infra, so the gate cannot silently
  regress between staging runs.

## References

- ADR-0062 (federation trust/isolation model), §3 (residency), §5 (scale/evidence obligation)
- `SPRINT97_EXECUTION.md` — `QA-CONNECT-SCALE-01` (P0, 8 pts)
- `functions/api/lib/region-isolation.ts` (S95) — `proveRegionIsolation`, `filterToRegion`
- `functions/api/lib/federation-aggregates.ts` (S96) — `buildFederatedAggregate`, `aggregateIsSafe`
- `tests/integration/connect-scale-proof.test.ts` (this deliverable)
- `tests/unit/region-isolation.test.ts`, `tests/unit/federation-aggregates.test.ts` (unit-level
  coverage of the same primitives at small scale)

## Docs to Update

- [x] `SPRINT97_EXECUTION.md` exit-criteria checkbox for the scale-proof line (mark done on merge).
- [ ] If a future sprint adds a 6th region or changes the sovereign-region default, re-run this
  proof with the updated region set.
