import { describe, expect, it } from 'vitest'
import {
  mintFederationInvite,
  verifyFederationInvite,
  inviteAdmitsTenant,
  clampInviteTtl,
  INVITE_DEFAULT_TTL,
  INVITE_MAX_TTL,
} from '../../functions/api/lib/connect-invite'

const TEST_INVITE_SECRET = 'test-connect-invite-secret'
const HOST = { teamId: 'host-team', isSovereign: false }

describe('CONNECT-INVITE-01 — TTL clamping', () => {
  it('defaults to 7d when unset/invalid', () => {
    expect(clampInviteTtl(undefined)).toBe(INVITE_DEFAULT_TTL)
    expect(clampInviteTtl(0)).toBe(INVITE_DEFAULT_TTL)
    expect(clampInviteTtl(-5)).toBe(INVITE_DEFAULT_TTL)
    expect(clampInviteTtl(Number.NaN)).toBe(INVITE_DEFAULT_TTL)
  })

  it('clamps above the 30d maximum', () => {
    expect(clampInviteTtl(INVITE_MAX_TTL + 99999)).toBe(INVITE_MAX_TTL)
  })

  it('passes a valid TTL through (floored)', () => {
    expect(clampInviteTtl(3600.9)).toBe(3600)
  })
})

describe('CONNECT-INVITE-01 — mint + verify round-trip', () => {
  it('mints a verifiable targeted invite', async () => {
    const minted = await mintFederationInvite(TEST_INVITE_SECRET, HOST, {
      sid: 'sess-1',
      invitee: 'guest-team',
      scope: 'participate',
      now: 1000,
      jti: 'inv-1',
    })
    expect(minted.ok).toBe(true)
    if (!minted.ok) return
    expect(minted.claims.host).toBe('host-team')
    expect(minted.claims.invitee).toBe('guest-team')
    expect(minted.claims.exp).toBe(1000 + INVITE_DEFAULT_TTL)

    const verified = await verifyFederationInvite(TEST_INVITE_SECRET, minted.token, { now: 2000 })
    expect(verified.ok).toBe(true)
    if (verified.ok) expect(verified.claims.jti).toBe('inv-1')
  })

  it('defaults invitee to null (open invite) and scope to participate', async () => {
    const minted = await mintFederationInvite(TEST_INVITE_SECRET, HOST, { sid: 'sess-2', now: 1000 })
    expect(minted.ok).toBe(true)
    if (!minted.ok) return
    expect(minted.claims.invitee).toBeNull()
    expect(minted.claims.scope).toBe('participate')
  })
})

describe('CONNECT-INVITE-01 — sovereign exclusion at mint (ADR-0059)', () => {
  it('refuses to mint for a sovereign host — returns a violation, not a token', async () => {
    const r = await mintFederationInvite(TEST_INVITE_SECRET, { teamId: 'gov', isSovereign: true }, { sid: 's' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('sovereign_federation_excluded')
    expect('token' in r).toBe(false)
  })
})

describe('CONNECT-INVITE-01 — verification failures', () => {
  it('rejects a tampered payload (bad signature)', async () => {
    const minted = await mintFederationInvite(TEST_INVITE_SECRET, HOST, { sid: 'sess-3', now: 1000 })
    if (!minted.ok) throw new Error('mint failed')
    const tampered = 'x' + minted.token.slice(1)
    const r = await verifyFederationInvite(TEST_INVITE_SECRET, tampered, { now: 2000 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('bad_signature')
  })

  it('rejects the wrong secret', async () => {
    const minted = await mintFederationInvite(TEST_INVITE_SECRET, HOST, { sid: 'sess-4', now: 1000 })
    if (!minted.ok) throw new Error('mint failed')
    const r = await verifyFederationInvite('other-secret', minted.token, { now: 2000 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('bad_signature')
  })

  it('rejects an expired invite', async () => {
    const minted = await mintFederationInvite(TEST_INVITE_SECRET, HOST, { sid: 'sess-5', ttl: 100, now: 1000 })
    if (!minted.ok) throw new Error('mint failed')
    const r = await verifyFederationInvite(TEST_INVITE_SECRET, minted.token, { now: 1000 + 101 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('expired')
  })

  it('rejects malformed tokens', async () => {
    for (const bad of ['', 'no-dot', '.', 'abc.']) {
      const r = await verifyFederationInvite(TEST_INVITE_SECRET, bad)
      expect(r.ok).toBe(false)
    }
  })
})

describe('CONNECT-INVITE-01 — tenant admission', () => {
  it('open invite admits any tenant', async () => {
    const minted = await mintFederationInvite(TEST_INVITE_SECRET, HOST, { sid: 's', invitee: null, now: 1 })
    if (!minted.ok) throw new Error('mint failed')
    expect(inviteAdmitsTenant(minted.claims, 'anyone')).toBe(true)
  })

  it('targeted invite admits only the named tenant', async () => {
    const minted = await mintFederationInvite(TEST_INVITE_SECRET, HOST, { sid: 's', invitee: 'guest', now: 1 })
    if (!minted.ok) throw new Error('mint failed')
    expect(inviteAdmitsTenant(minted.claims, 'guest')).toBe(true)
    expect(inviteAdmitsTenant(minted.claims, 'intruder')).toBe(false)
  })
})
