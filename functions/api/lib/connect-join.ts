/**
 * CONNECT-JOIN-01 (ADR-0062 §1–§3) — federated session join decision.
 *
 * A tenant joins another tenant's session only by presenting a valid invite
 * (CONNECT-INVITE-01). This module is the PURE decision that composes every gate
 * the join must pass, so the route, a reconnect path, and tests all share one
 * verdict — and a join can never slip past a missed check:
 *
 *   1. invite signature/expiry valid        (verifyFederationInvite — caller)
 *   2. invite not revoked                    (jti revocation list — caller passes flag)
 *   3. invite admits this tenant             (inviteAdmitsTenant)
 *   4. invitee is NOT sovereign              (assertFederationAllowed — ADR-0059)
 *   5. invitee region matches the session    (assertSameRegion — residency/isolation)
 *   6. tenant is not already a member         (idempotency)
 *
 * Side-effect free. Persistence (the D1 `connect_federation_members` row, whose
 * CHECK is the third sovereign layer) is the caller's job.
 */

import { inviteAdmitsTenant, type FederationInviteClaims } from './connect-invite'
import { assertFederationAllowed } from './sovereign-exclusion'
import { assertSameRegion } from './region-residency'

export type FederatedMember = {
  teamId: string
  scope: FederationInviteClaims['scope']
  regionId: string
  joinedAt: number
}

export type FederatedSessionState = {
  sessionId: string
  hostTeamId: string
  /** Region the federated session is bound to (host's residency). */
  regionId: string
  members: FederatedMember[]
}

/** The joining tenant's config, resolved from its team document by the caller. */
export type JoiningTenant = {
  teamId: string
  isSovereign: boolean
  regionId: string | null | undefined
}

export type JoinDenyCode =
  | 'invite_revoked'
  | 'invite_not_for_tenant'
  | 'sovereign_federation_excluded'
  | 'cross_region_data_leak'
  | 'already_member'
  | 'host_cannot_self_join'

export type JoinDecision =
  | { ok: true; member: FederatedMember }
  | { ok: false; code: JoinDenyCode; message: string }

/**
 * Decide whether `tenant` may join the federated session described by `claims`.
 * `revoked` is the result of the jti revocation lookup (CONNECT-AUDIT-01) and
 * `existingMembers` lets the decision stay idempotent. `now` is a test seam.
 */
export function evaluateJoin(args: {
  claims: FederationInviteClaims
  tenant: JoiningTenant
  hostRegionId: string | null | undefined
  revoked: boolean
  existingMembers: ReadonlyArray<{ teamId: string }>
  now?: number
}): JoinDecision {
  const { claims, tenant } = args

  if (args.revoked) {
    return { ok: false, code: 'invite_revoked', message: `Invite ${claims.jti} has been revoked` }
  }
  if (tenant.teamId === claims.host) {
    return { ok: false, code: 'host_cannot_self_join', message: 'The host tenant is already in its own session' }
  }
  if (!inviteAdmitsTenant(claims, tenant.teamId)) {
    return { ok: false, code: 'invite_not_for_tenant', message: 'This invite does not admit your tenant' }
  }

  // Sovereign exclusion on the INVITEE (the mint guard already covered the host).
  const fed = assertFederationAllowed({ teamId: tenant.teamId, isSovereign: tenant.isSovereign })
  if (!fed.ok) return { ok: false, code: 'sovereign_federation_excluded', message: fed.message }

  // Residency: a federated tenant must sit in the session's region (no cross-border join).
  const region = assertSameRegion(args.hostRegionId, tenant.regionId)
  if (!region.ok) return { ok: false, code: region.code, message: region.message }

  if (args.existingMembers.some((m) => m.teamId === tenant.teamId)) {
    return { ok: false, code: 'already_member', message: 'Tenant has already joined this session' }
  }

  return {
    ok: true,
    member: {
      teamId: tenant.teamId,
      scope: claims.scope,
      regionId: region.region,
      joinedAt: args.now ?? Date.now(),
    },
  }
}

/** Append a member idempotently (no duplicate teamId). Returns a new state. */
export function applyJoin(state: FederatedSessionState, member: FederatedMember): FederatedSessionState {
  if (state.members.some((m) => m.teamId === member.teamId)) return state
  return { ...state, members: [...state.members, member] }
}

/** Distinct tenant count in a federated session (host + joined members). */
export function federatedTenantCount(state: FederatedSessionState): number {
  const ids = new Set(state.members.map((m) => m.teamId))
  ids.add(state.hostTeamId)
  return ids.size
}
