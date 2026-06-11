import { describe, expect, it } from 'vitest'
import {
  deliberateReducer,
  DELIBERATE_INITIAL,
  type DeliberateReceipt,
  type DeliberateVerifyResult,
} from '../../src/hooks/useDeliberateSession'

const receipt = (over: Partial<DeliberateReceipt> = {}): DeliberateReceipt => ({
  sessionId: 'sess-1',
  sessionFingerprint: 'fp-abc123',
  ballotNonce: 'nonce-xyz',
  commitment: 'commit-abc',
  choice: 'Yes',
  leafIndex: 3,
  issuedAt: '2026-06-11T10:00:00Z',
  verifyPath: '/api/sessions/sess-1/deliberate/verify',
  ...over,
})

const verifyOk = (over: Partial<DeliberateVerifyResult> = {}): DeliberateVerifyResult => ({
  verified: true,
  commitmentValid: true,
  inLedger: true,
  ledgerCommitmentMatch: true,
  leafIndex: 3,
  merkleRoot: 'root-abc',
  ...over,
})

describe('cast flow', () => {
  it('transitions idle → casting on cast_start', () => {
    const s = deliberateReducer(DELIBERATE_INITIAL, { type: 'cast_start' })
    expect(s.phase.kind).toBe('casting')
  })

  it('transitions casting → cast_done with receipt on cast_ok', () => {
    const casting = deliberateReducer(DELIBERATE_INITIAL, { type: 'cast_start' })
    const s = deliberateReducer(casting, { type: 'cast_ok', receipt: receipt() })
    expect(s.phase.kind).toBe('cast_done')
    if (s.phase.kind === 'cast_done') {
      expect(s.phase.receipt.ballotNonce).toBe('nonce-xyz')
    }
  })

  it('transitions to cast_error on cast_err', () => {
    const casting = deliberateReducer(DELIBERATE_INITIAL, { type: 'cast_start' })
    const s = deliberateReducer(casting, { type: 'cast_err', message: 'already voted' })
    expect(s.phase.kind).toBe('cast_error')
    if (s.phase.kind === 'cast_error') {
      expect(s.phase.message).toBe('already voted')
    }
  })
})

describe('verify flow', () => {
  it('transitions cast_done → verifying on verify_start', () => {
    const withReceipt = deliberateReducer(
      deliberateReducer(DELIBERATE_INITIAL, { type: 'cast_start' }),
      { type: 'cast_ok', receipt: receipt() },
    )
    const s = deliberateReducer(withReceipt, { type: 'verify_start' })
    expect(s.phase.kind).toBe('verifying')
  })

  it('is a no-op when phase is idle', () => {
    const s = deliberateReducer(DELIBERATE_INITIAL, { type: 'verify_start' })
    expect(s.phase.kind).toBe('idle')
  })

  it('transitions verifying → verified on verify_ok', () => {
    const withReceipt = deliberateReducer(
      deliberateReducer(DELIBERATE_INITIAL, { type: 'cast_start' }),
      { type: 'cast_ok', receipt: receipt() },
    )
    const verifying = deliberateReducer(withReceipt, { type: 'verify_start' })
    const s = deliberateReducer(verifying, { type: 'verify_ok', result: verifyOk() })
    expect(s.phase.kind).toBe('verified')
    if (s.phase.kind === 'verified') {
      expect(s.phase.result.verified).toBe(true)
    }
  })

  it('transitions verifying → verify_error on verify_err', () => {
    const withReceipt = deliberateReducer(
      deliberateReducer(DELIBERATE_INITIAL, { type: 'cast_start' }),
      { type: 'cast_ok', receipt: receipt() },
    )
    const verifying = deliberateReducer(withReceipt, { type: 'verify_start' })
    const s = deliberateReducer(verifying, { type: 'verify_err', message: 'commitment mismatch' })
    expect(s.phase.kind).toBe('verify_error')
    if (s.phase.kind === 'verify_error') {
      expect(s.phase.message).toBe('commitment mismatch')
    }
  })

  it('preserves receipt across verify_err', () => {
    const r = receipt({ ballotNonce: 'unique-nonce' })
    const withReceipt = deliberateReducer(
      deliberateReducer(DELIBERATE_INITIAL, { type: 'cast_start' }),
      { type: 'cast_ok', receipt: r },
    )
    const verifying = deliberateReducer(withReceipt, { type: 'verify_start' })
    const s = deliberateReducer(verifying, { type: 'verify_err', message: 'ledger miss' })
    if (s.phase.kind === 'verify_error') {
      expect(s.phase.receipt.ballotNonce).toBe('unique-nonce')
    }
  })
})

describe('tally flow', () => {
  it('sets tallyLoading on tally_start', () => {
    const s = deliberateReducer(DELIBERATE_INITIAL, { type: 'tally_start' })
    expect(s.tallyLoading).toBe(true)
    expect(s.tallyError).toBeNull()
  })

  it('stores tally and clears loading on tally_ok', () => {
    const loading = deliberateReducer(DELIBERATE_INITIAL, { type: 'tally_start' })
    const s = deliberateReducer(loading, {
      type: 'tally_ok',
      tally: {
        voteCount: 10,
        commitmentCount: 10,
        tally: { Yes: 7, No: 3 },
        merkleRoot: 'root-x',
        ledger: [],
      },
    })
    expect(s.tallyLoading).toBe(false)
    expect(s.tally?.voteCount).toBe(10)
    expect(s.tally?.tally.Yes).toBe(7)
  })

  it('stores error and clears loading on tally_err', () => {
    const loading = deliberateReducer(DELIBERATE_INITIAL, { type: 'tally_start' })
    const s = deliberateReducer(loading, { type: 'tally_err', message: 'session not closed' })
    expect(s.tallyLoading).toBe(false)
    expect(s.tallyError).toBe('session not closed')
  })
})
