/**
 * Salted voter identity — DD-03.
 *
 * Requirement: knowledge-base/quality/audits/DUE_DILIGENCE_2026-09-15.md (DD-03),
 * GDPR Recital 26 / EDPB Opinion 05/2014, migration 0082_session_voter_salt.
 *
 * The identifier was `sha256(ip)[0:8]` — unsalted, 32 bits over a 32-bit input,
 * so a complete IPv4 rainbow table inverted it. These tests pin the properties
 * the keyed derivation must hold: stable inside a session, uncorrelated across
 * sessions, and not a plain digest of the address.
 */
import { describe, it, expect } from 'vitest'
import { deriveVoterIdentity, generateVoterSalt } from '../../functions/api/lib/voter'

const SALT_A = 'a'.repeat(64)
const SALT_B = 'b'.repeat(64)

function req(ip: string, ua = 'Mozilla/5.0 (Macintosh)'): Request {
  return new Request('https://qesto.cc/api/sessions/s1/ws', {
    headers: {
      'cf-connecting-ip': ip,
      'user-agent': ua,
      'accept-language': 'en-GB',
      'accept-encoding': 'gzip',
    },
  })
}

async function sha256Hex(input: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

describe('DD-03: session-salted voter identity', () => {
  it('is stable for the same voter within one session, so dedupe still works', async () => {
    const a = await deriveVoterIdentity(req('203.0.113.7'), SALT_A)
    const b = await deriveVoterIdentity(req('203.0.113.7'), SALT_A)
    expect(a.voterId).toBe(b.voterId)
  })

  it('separates distinct voters within one session', async () => {
    const a = await deriveVoterIdentity(req('203.0.113.7'), SALT_A)
    const b = await deriveVoterIdentity(req('203.0.113.8'), SALT_A)
    expect(a.voterId).not.toBe(b.voterId)
  })

  it('yields uncorrelated ids for the same IP in different sessions', async () => {
    // This is the cross-session linkage the unsalted digest could not prevent:
    // one IP produced one identifier everywhere, forever.
    const inA = await deriveVoterIdentity(req('203.0.113.7'), SALT_A)
    const inB = await deriveVoterIdentity(req('203.0.113.7'), SALT_B)
    expect(inA.voterId).not.toBe(inB.voterId)
    expect(inA.ipHash).not.toBe(inB.ipHash)
  })

  it('is not a bare digest of the IP — the pre-DD-03 rainbow table does not match', async () => {
    const ip = '203.0.113.7'
    const legacyTableEntry = (await sha256Hex(ip)).slice(0, 8)

    const identity = await deriveVoterIdentity(req(ip), SALT_A)

    // The exact inversion that worked before must now fail.
    expect(identity.voterId).not.toContain(legacyTableEntry)
    expect(identity.ipHash).not.toBe(legacyTableEntry)
  })

  it('uses the full digest rather than a brute-forceable truncation', async () => {
    const { voterId } = await deriveVoterIdentity(req('203.0.113.7'), SALT_A)
    // anon_ + 64 hex chars of HMAC-SHA256.
    expect(voterId).toMatch(/^anon_[0-9a-f]{64}$/)
  })

  it('falls back to the legacy derivation for pre-0082 sessions without disrupting them', async () => {
    const ip = '203.0.113.7'
    const legacy = await deriveVoterIdentity(req(ip), null)
    expect(legacy.voterId).toBe(`anon_${(await sha256Hex(ip)).slice(0, 8)}_${legacy.fingerprint}`)
    // Still stable, so an in-flight session keeps deduping correctly.
    expect((await deriveVoterIdentity(req(ip), null)).voterId).toBe(legacy.voterId)
  })

  it('generates 32 bytes of salt', () => {
    const salt = generateVoterSalt()
    expect(salt).toMatch(/^[0-9a-f]{64}$/)
    expect(generateVoterSalt()).not.toBe(salt)
  })
})
