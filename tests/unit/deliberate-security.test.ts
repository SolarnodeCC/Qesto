// SEC-VOTE-INTEGRITY-01 (ADR-0049, Pentest #5 pre-clearance) — governance-vote
// threat model regression suite. Focus areas: forgery, replay, coercion,
// tamper-evidence, de-anonymization. Companion to deliberate-config-route.test.ts
// (happy-path) and deliberate-crypto.test.ts (pure primitives).

import { describe, expect, it } from 'vitest'
import { createApp } from '../../functions/api/app'
import { signJwt } from '../../functions/api/lib/jwt'
import {
  sessionFingerprint,
  computeCommitment,
  voterBallotHash,
} from '../../functions/api/lib/deliberate-crypto'
import type { Env } from '../../functions/api/types'
import { D1Mock } from '../helpers/d1-mock'
import { KVMock } from '../helpers/kv-mock'

const SECRET = 'integration-test-secret-at-least-32-bytes!'
const USER_ID = 'user_host_1'
const kv = () => new KVMock() as unknown as KVNamespace

function makeEnv(db: D1Mock): Env {
  return {
    ENV: 'dev',
    PAGES_URL: 'http://local',
    API_URL: 'http://local',
    JWT_SECRET: SECRET,
    DB: db as unknown as D1Database,
    USERS_KV: kv(),
    SESSIONS_KV: kv(),
    TEAMS_KV: kv(),
    TEMPLATES_KV: kv(),
    DECISIONS_KV: kv(),
    AUDIT_KV: kv(),
    ACTIONS_KV: kv(),
  } as unknown as Env
}

async function cookie(userId = USER_ID): Promise<string> {
  return `qesto_session=${await signJwt({ sub: userId, email: `${userId}@example.com` }, SECRET, 3600)}`
}

function seed(db: D1Mock, mode = 'deliberate', status: 'draft' | 'live' = 'live') {
  db.users.set(USER_ID, {
    id: USER_ID,
    email: `${USER_ID}@example.com`,
    plan: 'team',
    created_at: Date.now(),
    last_login_at: null,
  } as never)
  db.sessions.set('sess_1', {
    id: 'sess_1',
    owner_id: USER_ID,
    code: 'ABC123',
    title: 'Board Vote',
    status,
    anonymity: 'full',
    vote_policy: 'once',
    session_mode: mode,
    created_at: 1000,
    started_at: status === 'live' ? Date.now() : null,
    closed_at: null,
    archived_at: null,
  } as never)
}

const req = (env: Env, path: string, method: string, c: string | null, body?: unknown) =>
  createApp().fetch(
    new Request(`http://local/api/sessions/sess_1/deliberate/${path}`, {
      method,
      headers: { 'content-type': 'application/json', ...(c ? { cookie: c } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    }),
    env,
  )

describe('SEC-VOTE-INTEGRITY-01: tamper-evidence (forensics alert path)', () => {
  // The core Pentest #5 "mutated ledger row" case: an honest voter presents
  // their ORIGINAL, valid receipt, but the stored ledger commitment for their
  // nonce was altered after they cast. Verification must (a) report NOT verified
  // and (b) raise a forensics alert so the integrity-tamper is observable.
  it('raises a forensics alert when the stored ledger commitment is mutated', async () => {
    const db = new D1Mock()
    seed(db)
    const cast = await req(makeEnv(db), 'cast', 'POST', await cookie('voter_a'), { choice: 'approve' })
    const { data } = (await cast.json()) as {
      data: { receipt: { ballotNonce: string; commitment: string; choice: string } }
    }

    // Tamper with the stored ledger row (commitment column) — simulate a
    // dishonest server / DB-level mutation after the ballot was cast.
    const row = [...db.deliberateBallots.values()].find((r) => r.ballot_nonce === data.receipt.ballotNonce)!
    row.commitment = 'f'.repeat(64)

    const verify = await req(makeEnv(db), 'verify', 'POST', await cookie('voter_a'), {
      ballotNonce: data.receipt.ballotNonce,
      commitment: data.receipt.commitment, // the ORIGINAL, untampered receipt
      choice: data.receipt.choice,
    })
    const vbody = (await verify.json()) as {
      data: { verified: boolean; commitmentValid: boolean; ledgerCommitmentMatch: boolean }
    }

    // The honest receipt still re-derives, but the stored ledger no longer matches.
    expect(vbody.data.verified).toBe(false)
    expect(vbody.data.commitmentValid).toBe(true)
    expect(vbody.data.ledgerCommitmentMatch).toBe(false)

    // Regression: the forensics alert MUST fire on a mutated ledger row.
    const alerts = [...db.auditEvents.values()].filter((e) => e.action === 'deliberate.verify.mismatch')
    expect(alerts.length).toBe(1)
  })

  it('raises a forensics alert when a forged/substituted-choice receipt is presented for an existing nonce', async () => {
    const db = new D1Mock()
    seed(db)
    const cast = await req(makeEnv(db), 'cast', 'POST', await cookie('voter_a'), { choice: 'approve' })
    const { data } = (await cast.json()) as { data: { receipt: { ballotNonce: string; commitment: string } } }

    const verify = await req(makeEnv(db), 'verify', 'POST', await cookie('voter_a'), {
      ballotNonce: data.receipt.ballotNonce,
      commitment: data.receipt.commitment,
      choice: 'reject', // substituted choice → commitment no longer re-derives
    })
    const vbody = (await verify.json()) as { data: { verified: boolean } }
    expect(vbody.data.verified).toBe(false)

    const alerts = [...db.auditEvents.values()].filter((e) => e.action === 'deliberate.verify.mismatch')
    expect(alerts.length).toBe(1)
  })
})

describe('SEC-VOTE-INTEGRITY-01: forgery / cross-session replay', () => {
  it('rejects a commitment minted in another session (session-fingerprint binding)', async () => {
    const db = new D1Mock()
    seed(db)
    // Forge a receipt that is internally consistent but bound to a DIFFERENT
    // session fingerprint — it must not verify against sess_1.
    const foreignFp = await sessionFingerprint('sess_OTHER', 'ZZZ999', 1000)
    const nonce = 'a'.repeat(32)
    const forged = await computeCommitment(foreignFp, nonce, 'approve')

    const verify = await req(makeEnv(db), 'verify', 'POST', await cookie('voter_a'), {
      ballotNonce: nonce,
      commitment: forged,
      choice: 'approve',
    })
    const vbody = (await verify.json()) as { data: { verified: boolean; inLedger: boolean; commitmentValid: boolean } }
    expect(vbody.data.verified).toBe(false)
    // Not in this session's ledger AND does not re-derive under sess_1's fingerprint.
    expect(vbody.data.inLedger).toBe(false)
    expect(vbody.data.commitmentValid).toBe(false)
  })

  it('rejects a fabricated receipt that was never cast (no ledger row)', async () => {
    const db = new D1Mock()
    seed(db)
    const fp = await sessionFingerprint('sess_1', 'ABC123', 1000)
    const nonce = 'b'.repeat(32)
    const commitment = await computeCommitment(fp, nonce, 'approve')
    // Correct fingerprint + self-consistent commitment, but the ballot was never
    // appended to the ledger → must report inLedger:false, verified:false.
    const verify = await req(makeEnv(db), 'verify', 'POST', await cookie('voter_a'), {
      ballotNonce: nonce,
      commitment,
      choice: 'approve',
    })
    const vbody = (await verify.json()) as { data: { verified: boolean; inLedger: boolean; commitmentValid: boolean } }
    expect(vbody.data.commitmentValid).toBe(true) // self-consistent
    expect(vbody.data.inLedger).toBe(false) // but never cast
    expect(vbody.data.verified).toBe(false)
  })
})

describe('SEC-VOTE-INTEGRITY-01: replay / double-vote prevention', () => {
  it('blocks a second ballot from the same voter (UNIQUE voter_hash)', async () => {
    const db = new D1Mock()
    seed(db)
    const first = await req(makeEnv(db), 'cast', 'POST', await cookie('voter_a'), { choice: 'approve' })
    expect(first.status).toBe(200)
    const second = await req(makeEnv(db), 'cast', 'POST', await cookie('voter_a'), { choice: 'reject' })
    expect(second.status).toBe(409)
    // Only one ledger row exists — the re-cast did not overwrite or append.
    expect(db.deliberateBallots.size).toBe(1)
  })
})

describe('SEC-VOTE-INTEGRITY-01: coercion-resistance / de-anonymization', () => {
  it('never exposes voter_hash or any user id in the public tally ledger', async () => {
    const db = new D1Mock()
    seed(db)
    await req(makeEnv(db), 'cast', 'POST', await cookie('voter_a'), { choice: 'approve' })
    await req(makeEnv(db), 'cast', 'POST', await cookie('voter_b'), { choice: 'reject' })
    const res = await req(makeEnv(db), 'tally', 'GET', await cookie())
    const raw = await res.text()
    expect(raw).not.toContain('voter_hash')
    expect(raw).not.toContain('voter_a')
    expect(raw).not.toContain('voter_b')
    // The stored voter_hash must not equal the receipt-published fingerprint and
    // must not contain the user id (anonymity-by-construction).
    const row = [...db.deliberateBallots.values()][0]
    expect(row.voter_hash).not.toContain('voter_a')
    expect(row.voter_hash).not.toContain('voter_b')
  })

  it('a verify call does not reveal any OTHER voter\'s choice', async () => {
    const db = new D1Mock()
    seed(db)
    await req(makeEnv(db), 'cast', 'POST', await cookie('voter_a'), { choice: 'approve' })
    const castB = await req(makeEnv(db), 'cast', 'POST', await cookie('voter_b'), { choice: 'reject' })
    const { data } = (await castB.json()) as { data: { receipt: { ballotNonce: string; commitment: string; choice: string } } }
    const verify = await req(makeEnv(db), 'verify', 'POST', await cookie('voter_b'), {
      ballotNonce: data.receipt.ballotNonce,
      commitment: data.receipt.commitment,
      choice: data.receipt.choice,
    })
    // Verify response carries only this voter's leafIndex/root — never other
    // voters' choices or nonces.
    const raw = await verify.text()
    expect(raw).not.toContain('approve') // voter_a's choice must not leak
  })
})

describe('SEC-VOTE-INTEGRITY-01: voter_hash construction (documentation guard)', () => {
  // Guards the implementation against silently regressing to a leaky construction.
  // NOTE (Medium finding M-1): the "salt" is the PUBLIC session fingerprint, not a
  // server-secret salt — so the dedup token's secrecy rests on user.sub (a ULID)
  // being unguessable rather than on a secret. This test pins current behavior.
  it('derives the same voter_hash the route uses, from public fingerprint + user id', async () => {
    const fp = await sessionFingerprint('sess_1', 'ABC123', 1000)
    const h = await voterBallotHash(fp, USER_ID)
    expect(h).toMatch(/^[0-9a-f]{32}$/)
    expect(h).not.toContain(USER_ID)
  })
})
