import { describe, expect, it } from 'vitest'
import {
  canonicalizeEntry,
  buildAuditChain,
  verifyAuditChain,
  buildSignedAuditExport,
  verifySignedAuditExport,
  type SovereignAuditEntry,
} from '../../functions/api/lib/sovereign-audit-export'

const KEY = 'sovereign-signing-key'

const entries: SovereignAuditEntry[] = [
  { id: 'e1', ts: 1000, action: 'session.created', subjectType: 'session', subjectId: 's1', actorId: 'u1' },
  { id: 'e2', ts: 2000, action: 'vote.cast', subjectType: 'session', subjectId: 's1', actorId: null },
  { id: 'e3', ts: 3000, action: 'session.closed', subjectType: 'session', subjectId: 's1', actorId: 'u1' },
]

describe('SOVEREIGN-AUDIT-API-01 — canonicalisation + chain', () => {
  it('canonicalises with sorted keys deterministically', () => {
    const a = canonicalizeEntry(entries[0])
    expect(a).toBe(a)
    expect(a.indexOf('"action"')).toBeLessThan(a.indexOf('"ts"'))
  })

  it('builds a chain whose head verifies', async () => {
    const { chained, head } = await buildAuditChain(entries)
    expect(chained).toHaveLength(3)
    expect(chained[2].chainHash).toBe(head)
    expect(await verifyAuditChain(chained)).toBe(true)
  })

  it('detects tampering (mutated action breaks chain)', async () => {
    const { chained } = await buildAuditChain(entries)
    const tampered = chained.map((c, i) => (i === 1 ? { ...c, action: 'vote.deleted' } : c))
    expect(await verifyAuditChain(tampered)).toBe(false)
  })

  it('detects reordering', async () => {
    const { chained } = await buildAuditChain(entries)
    const reordered = [chained[1], chained[0], chained[2]]
    expect(await verifyAuditChain(reordered)).toBe(false)
  })
})

describe('SOVEREIGN-AUDIT-API-01 — signed export', () => {
  it('produces a signed, verifiable export', async () => {
    const doc = await buildSignedAuditExport({
      teamId: 't1',
      region: 'eu-001',
      entries,
      signingKey: KEY,
      now: 5000,
    })
    expect(doc.entryCount).toBe(3)
    expect(doc.region).toBe('eu-001')
    expect(await verifySignedAuditExport(doc, KEY)).toBe(true)
  })

  it('orders entries by ts ascending regardless of input order', async () => {
    const doc = await buildSignedAuditExport({
      teamId: 't1',
      region: 'eu-001',
      entries: [entries[2], entries[0], entries[1]],
      signingKey: KEY,
      now: 5000,
    })
    expect(doc.entries.map((e) => e.id)).toEqual(['e1', 'e2', 'e3'])
  })

  it('fails verification with the wrong key', async () => {
    const doc = await buildSignedAuditExport({ teamId: 't1', region: 'eu-001', entries, signingKey: KEY, now: 5000 })
    expect(await verifySignedAuditExport(doc, 'wrong-key')).toBe(false)
  })

  it('fails verification if an entry is grafted in', async () => {
    const doc = await buildSignedAuditExport({ teamId: 't1', region: 'eu-001', entries, signingKey: KEY, now: 5000 })
    doc.entries.push({
      id: 'e4',
      ts: 4000,
      action: 'forged',
      subjectType: null,
      subjectId: null,
      actorId: null,
      chainHash: 'deadbeef',
    })
    expect(await verifySignedAuditExport(doc, KEY)).toBe(false)
  })

  it('signature binds the team id (cannot graft across teams)', async () => {
    const doc = await buildSignedAuditExport({ teamId: 't1', region: 'eu-001', entries, signingKey: KEY, now: 5000 })
    const forged = { ...doc, teamId: 't2' }
    expect(await verifySignedAuditExport(forged, KEY)).toBe(false)
  })
})
