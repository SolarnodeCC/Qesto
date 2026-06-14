// DELIBERATE-LEDGER-01 (ADR-0049) — shared append-only governance-vote ledger.
// These tests cover the service used by both REST casting and LIVE WebSocket
// boards so one-ballot deduplication, receipt integrity, and anonymous
// projections stay aligned across entry points.

import { describe, expect, it } from 'vitest'
import {
  aggregateLedger,
  appendBallot,
  loadLedger,
  projectLedger,
  type BallotSession,
  type LedgerRow,
} from '../../functions/api/lib/deliberate-ledger'
import { computeCommitment, merkleRoot, sessionFingerprint } from '../../functions/api/lib/deliberate-crypto'
import { D1Mock } from '../helpers/d1-mock'

const SESSION: BallotSession = { id: 'sess_deliberate_1', code: 'ABC123', created_at: 1_777_000_000_000 }
const OTHER_SESSION: BallotSession = { id: 'sess_deliberate_2', code: 'XYZ789', created_at: 1_777_000_001_000 }
const VOTER_SALT = 'test-voter-salt'

const asD1 = (db: D1Mock): D1Database => db as unknown as D1Database

describe('deliberate-ledger: load + projection', () => {
  it('loads only the requested session ledger ordered by leaf_index', async () => {
    const db = new D1Mock()
    db.deliberateBallots.set('b_late', {
      id: 'b_late',
      session_id: SESSION.id,
      ballot_nonce: 'nonce-late',
      commitment: 'b'.repeat(64),
      choice: 'reject',
      voter_hash: 'private-late',
      leaf_index: 1,
      created_at: 2,
    })
    db.deliberateBallots.set('b_other', {
      id: 'b_other',
      session_id: OTHER_SESSION.id,
      ballot_nonce: 'nonce-other',
      commitment: 'c'.repeat(64),
      choice: 'abstain',
      voter_hash: 'private-other',
      leaf_index: 0,
      created_at: 3,
    })
    db.deliberateBallots.set('b_first', {
      id: 'b_first',
      session_id: SESSION.id,
      ballot_nonce: 'nonce-first',
      commitment: 'a'.repeat(64),
      choice: 'approve',
      voter_hash: 'private-first',
      leaf_index: 0,
      created_at: 1,
    })

    const ledger = await loadLedger(asD1(db), SESSION.id)

    expect(ledger.map((row) => row.leaf_index)).toEqual([0, 1])
    expect(ledger.map((row) => row.choice)).toEqual(['approve', 'reject'])
  })

  it('projects a public ledger without voter_hash or storage-only column names', () => {
    const privateLedger: Array<LedgerRow & { voter_hash: string; id: string }> = [
      {
        id: 'b_1',
        ballot_nonce: 'nonce-1',
        commitment: 'a'.repeat(64),
        choice: 'approve',
        voter_hash: 'private-voter-hash',
        leaf_index: 4,
      },
    ]

    const projection = projectLedger(privateLedger)
    const raw = JSON.stringify(projection)

    expect(projection).toEqual([
      {
        leafIndex: 4,
        ballotNonce: 'nonce-1',
        commitment: 'a'.repeat(64),
        choice: 'approve',
      },
    ])
    expect(raw).not.toContain('voter_hash')
    expect(raw).not.toContain('private-voter-hash')
    expect(raw).not.toContain('leaf_index')
    expect(raw).not.toContain('ballot_nonce')
  })
})

describe('deliberate-ledger: appendBallot', () => {
  it('appends receipts whose commitment verifies against the stored ledger row', async () => {
    const db = new D1Mock()

    const first = await appendBallot(asD1(db), SESSION, 'voter_a', 'approve', VOTER_SALT)
    const second = await appendBallot(asD1(db), SESSION, 'voter_b', 'reject', VOTER_SALT)

    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
    if (!first.ok || !second.ok) throw new Error('expected successful ballots')

    const ledger = await loadLedger(asD1(db), SESSION.id)
    const fingerprint = await sessionFingerprint(SESSION.id, SESSION.code, SESSION.created_at)

    expect(ledger).toHaveLength(2)
    expect(ledger.map((row) => row.leaf_index)).toEqual([0, 1])
    expect(first.receipt).toMatchObject({
      sessionId: SESSION.id,
      sessionFingerprint: fingerprint,
      choice: 'approve',
      leafIndex: 0,
    })
    expect(second.receipt.leafIndex).toBe(1)
    expect(first.receipt.ballotNonce).toMatch(/^[0-9a-f]{32}$/)
    expect(first.receipt.commitment).toBe(
      await computeCommitment(fingerprint, first.receipt.ballotNonce, first.receipt.choice),
    )
    expect(ledger[0]).toMatchObject({
      ballot_nonce: first.receipt.ballotNonce,
      commitment: first.receipt.commitment,
      choice: 'approve',
      leaf_index: 0,
    })
  })

  it('rejects a second ballot from the same voter without overwriting the first choice', async () => {
    const db = new D1Mock()

    const first = await appendBallot(asD1(db), SESSION, 'voter_a', 'approve', VOTER_SALT)
    const duplicate = await appendBallot(asD1(db), SESSION, 'voter_a', 'reject', VOTER_SALT)

    expect(first.ok).toBe(true)
    expect(duplicate).toEqual({
      ok: false,
      code: 'already_voted',
      message: 'A ballot was already cast for this session',
    })
    const ledger = await loadLedger(asD1(db), SESSION.id)
    expect(ledger).toHaveLength(1)
    expect(ledger[0].choice).toBe('approve')
  })

  it('retries a stale leaf_index collision instead of corrupting ledger order', async () => {
    const db = new D1Mock()
    db.deliberateBallots.set('b_existing', {
      id: 'b_existing',
      session_id: SESSION.id,
      ballot_nonce: 'nonce-existing',
      commitment: 'a'.repeat(64),
      choice: 'approve',
      voter_hash: 'private-existing',
      leaf_index: 0,
      created_at: 1,
    })
    db.deliberateBallotCountOverrides.push(0)

    const result = await appendBallot(asD1(db), SESSION, 'voter_b', 'reject', VOTER_SALT)

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected retry to append a valid ballot')
    expect(result.receipt.leafIndex).toBe(1)
    const ledger = await loadLedger(asD1(db), SESSION.id)
    expect(ledger.map((row) => row.leaf_index)).toEqual([0, 1])
    expect(ledger.map((row) => row.choice)).toEqual(['approve', 'reject'])
  })

  it('throws after repeated leaf_index conflicts without appending a corrupt duplicate', async () => {
    const db = new D1Mock()
    db.deliberateBallots.set('b_existing', {
      id: 'b_existing',
      session_id: SESSION.id,
      ballot_nonce: 'nonce-existing',
      commitment: 'a'.repeat(64),
      choice: 'approve',
      voter_hash: 'private-existing',
      leaf_index: 0,
      created_at: 1,
    })
    db.deliberateBallotCountOverrides.push(0, 0, 0, 0, 0)

    await expect(appendBallot(asD1(db), SESSION, 'voter_b', 'reject', VOTER_SALT)).rejects.toThrow(
      'Unable to append deliberate ballot after repeated ledger index conflicts',
    )

    const ledger = await loadLedger(asD1(db), SESSION.id)
    expect(ledger).toHaveLength(1)
    expect(ledger[0]).toMatchObject({ leaf_index: 0, choice: 'approve' })
  })

  it('scopes duplicate-voter detection and leaf indexes to each session', async () => {
    const db = new D1Mock()

    const sessionA = await appendBallot(asD1(db), SESSION, 'voter_a', 'approve', VOTER_SALT)
    const sessionB = await appendBallot(asD1(db), OTHER_SESSION, 'voter_a', 'reject', VOTER_SALT)

    expect(sessionA.ok).toBe(true)
    expect(sessionB.ok).toBe(true)
    if (!sessionA.ok || !sessionB.ok) throw new Error('expected successful ballots')

    expect(sessionA.receipt.leafIndex).toBe(0)
    expect(sessionB.receipt.leafIndex).toBe(0)
    expect(await loadLedger(asD1(db), SESSION.id)).toHaveLength(1)
    expect(await loadLedger(asD1(db), OTHER_SESSION.id)).toHaveLength(1)
  })
})

describe('deliberate-ledger: aggregateLedger', () => {
  it('tallies choices and recomputes the Merkle root from public commitments', async () => {
    const commitments = ['approve-1', 'reject-1', 'approve-2'].map((value) => value.padEnd(64, '0'))
    const ledger: LedgerRow[] = [
      { ballot_nonce: 'nonce-1', commitment: commitments[0], choice: 'approve', leaf_index: 0 },
      { ballot_nonce: 'nonce-2', commitment: commitments[1], choice: 'reject', leaf_index: 1 },
      { ballot_nonce: 'nonce-3', commitment: commitments[2], choice: 'approve', leaf_index: 2 },
    ]

    const aggregate = await aggregateLedger(ledger)

    expect(aggregate).toEqual({
      voteCount: 3,
      tally: { approve: 2, reject: 1 },
      merkleRoot: await merkleRoot(commitments),
    })
  })
})
