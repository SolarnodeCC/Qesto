/**
 * CONNECT-ZEROK-01 (ADR-0062 §4) — federated anonymity: aggregates only.
 *
 * A federated session shares vote/theme aggregates ACROSS the tenant boundary, but
 * never a co-tenant's participant list and never which tenant contributed which
 * idea. This module turns raw per-tenant contributions into a cross-tenant view
 * that is provably free of participant identifiers — and, under zero-knowledge mode
 * (ADR-0010), free of per-tenant attribution too.
 *
 * Pure + side-effect free. `assertNoIdentityLeak` is the guard the route and the
 * Pentest #6 federation run assert against before any aggregate is serialised.
 */

/** What one tenant contributes — INCLUDING the identifiers that must never leak. */
export type TenantContribution = {
  teamId: string
  /** Participant identifiers — used only to count; NEVER surfaced cross-tenant. */
  participantIds: ReadonlyArray<string>
  /** Vote tallies keyed by option id. */
  optionCounts: Readonly<Record<string, number>>
}

/** Per-tenant counts WITHOUT any participant identity (only valid when not ZK). */
export type PerTenantCount = { teamId: string; participants: number }

/** The cross-tenant view. Never contains participant ids. */
export type FederatedAggregate = {
  /** How many tenants are in the federation (the "3 organizations joined" line). */
  tenantCount: number
  /** Total distinct participants across all tenants (de-duplicated). */
  totalParticipants: number
  /** Combined vote tally across every tenant, by option id. */
  optionTotals: Record<string, number>
  /**
   * Per-tenant participant counts — present ONLY when zeroKnowledge is false.
   * Even then it carries counts, never participant ids or which option a tenant
   * favoured (no cross-tenant idea attribution).
   */
  perTenant?: PerTenantCount[]
}

/**
 * Build the cross-tenant aggregate. Under `zeroKnowledge`, per-tenant attribution
 * is omitted entirely (only the federation-wide totals remain). In both modes,
 * participant identifiers are dropped — they are used only to compute counts.
 */
export function buildFederatedAggregate(
  contributions: ReadonlyArray<TenantContribution>,
  opts: { zeroKnowledge: boolean },
): FederatedAggregate {
  const optionTotals: Record<string, number> = {}
  const allParticipants = new Set<string>()

  for (const c of contributions) {
    for (const id of c.participantIds) allParticipants.add(id)
    for (const [option, n] of Object.entries(c.optionCounts)) {
      optionTotals[option] = (optionTotals[option] ?? 0) + n
    }
  }

  const aggregate: FederatedAggregate = {
    tenantCount: new Set(contributions.map((c) => c.teamId)).size,
    totalParticipants: allParticipants.size,
    optionTotals,
  }

  if (!opts.zeroKnowledge) {
    aggregate.perTenant = contributions.map((c) => ({
      teamId: c.teamId,
      participants: new Set(c.participantIds).size,
    }))
  }

  return aggregate
}

/**
 * Defence-in-depth guard: confirm a built aggregate carries no participant
 * identifier from any contribution. Returns the leaked ids it found (empty ⇒ safe).
 * The route MUST treat a non-empty result as a hard failure (never serialise it).
 */
export function findIdentityLeak(
  aggregate: FederatedAggregate,
  contributions: ReadonlyArray<TenantContribution>,
): string[] {
  const participantIds = new Set<string>()
  for (const c of contributions) for (const id of c.participantIds) participantIds.add(id)
  if (participantIds.size === 0) return []

  const serialised = JSON.stringify(aggregate)
  return [...participantIds].filter((id) => serialised.includes(id))
}

/** True iff the aggregate is safe to serialise cross-tenant (no identity leak). */
export function aggregateIsSafe(
  aggregate: FederatedAggregate,
  contributions: ReadonlyArray<TenantContribution>,
): boolean {
  return findIdentityLeak(aggregate, contributions).length === 0
}
