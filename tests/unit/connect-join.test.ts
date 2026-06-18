import { describe, expect, it } from 'vitest'
import { evaluateJoin, applyJoin, federatedTenantCount, type FederatedSessionState } from '../../functions/api/lib/connect-join'
import type { FederationInviteClaims } from '../../functions/api/lib/connect-invite'

const claims = (over: Partial<FederationInviteClaims> = {}): FederationInviteClaims => ({
  v: 1,
  jti: 'inv-1',
  sid: 'sess-1',
  host: 'host-team',
  invitee: null,
  scope: 'participate',
  iat: 1000,
  exp: 9_999_999_999,
  ...over,
})

const tenant = (over: Partial<{ teamId: string; isSovereign: boolean; regionId: string | null }> = {}) => ({
  teamId: 'guest-team',
  isSovereign: false,
  regionId: 'eu-001' as string | null,
  ...over,
})

const base = { hostRegionId: 'eu-001', revoked: false, existingMembers: [] as { teamId: string }[], now: 2000 }

describe('CONNECT-JOIN-01 — happy path', () => {
  it('admits a non-sovereign, in-region, invited tenant', () => {
    const d = evaluateJoin({ claims: claims(), tenant: tenant(), ...base })
    expect(d.ok).toBe(true)
    if (d.ok) {
      expect(d.member).toMatchObject({ teamId: 'guest-team', scope: 'participate', regionId: 'eu-001', joinedAt: 2000 })
    }
  })
})

describe('CONNECT-JOIN-01 — gate order & denials', () => {
  it('denies a revoked invite (CONNECT-AUDIT-01)', () => {
    const d = evaluateJoin({ claims: claims(), tenant: tenant(), ...base, revoked: true })
    expect(d.ok).toBe(false)
    if (!d.ok) expect(d.code).toBe('invite_revoked')
  })

  it('rejects the host trying to self-join', () => {
    const d = evaluateJoin({ claims: claims(), tenant: tenant({ teamId: 'host-team' }), ...base })
    expect(d.ok).toBe(false)
    if (!d.ok) expect(d.code).toBe('host_cannot_self_join')
  })

  it('rejects a tenant a targeted invite does not name', () => {
    const d = evaluateJoin({ claims: claims({ invitee: 'someone-else' }), tenant: tenant(), ...base })
    expect(d.ok).toBe(false)
    if (!d.ok) expect(d.code).toBe('invite_not_for_tenant')
  })

  it('denies a sovereign invitee (ADR-0059 — second guard)', () => {
    const d = evaluateJoin({ claims: claims(), tenant: tenant({ isSovereign: true }), ...base })
    expect(d.ok).toBe(false)
    if (!d.ok) expect(d.code).toBe('sovereign_federation_excluded')
  })

  it('denies a cross-region join (residency)', () => {
    const d = evaluateJoin({ claims: claims(), tenant: tenant({ regionId: 'uk-001' }), ...base })
    expect(d.ok).toBe(false)
    if (!d.ok) expect(d.code).toBe('cross_region_data_leak')
  })

  it('is idempotent — denies an already-joined tenant', () => {
    const d = evaluateJoin({ claims: claims(), tenant: tenant(), ...base, existingMembers: [{ teamId: 'guest-team' }] })
    expect(d.ok).toBe(false)
    if (!d.ok) expect(d.code).toBe('already_member')
  })
})

describe('CONNECT-JOIN-01 — state application', () => {
  const state: FederatedSessionState = { sessionId: 'sess-1', hostTeamId: 'host-team', regionId: 'eu-001', members: [] }

  it('appends a member and is idempotent on re-apply', () => {
    const member = { teamId: 'g1', scope: 'participate' as const, regionId: 'eu-001', joinedAt: 1 }
    const s1 = applyJoin(state, member)
    expect(s1.members).toHaveLength(1)
    const s2 = applyJoin(s1, member)
    expect(s2.members).toHaveLength(1)
    expect(s2).toBe(s1) // unchanged reference on no-op
  })

  it('counts distinct tenants including the host', () => {
    const s = applyJoin(applyJoin(state, { teamId: 'g1', scope: 'participate', regionId: 'eu-001', joinedAt: 1 }), {
      teamId: 'g2', scope: 'co_host', regionId: 'eu-001', joinedAt: 2,
    })
    expect(federatedTenantCount(s)).toBe(3) // host + g1 + g2
  })
})
