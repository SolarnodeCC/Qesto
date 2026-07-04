// DELIBERATE-RECEIPT-01 (ADR-0049): REST surface — config, cast, verify, tally.
// Team-tier gated; coercion-resistant receipts; observer-recomputable Merkle root.

import { describe, expect, it } from 'vitest'
import { createApp } from '../../functions/api/app'
import { signJwt } from '../../functions/api/lib/jwt'
import type { Env } from '../../functions/api/types'
import { D1Mock } from '../helpers/d1-mock'
import { KVMock } from '../helpers/kv-mock'

const TEST_JWT_SECRET = 'integration-test-secret-at-least-32-bytes!'
const USER_ID = 'user_host_1'

const kv = () => new KVMock() as unknown as KVNamespace

function makeEnv(db: D1Mock): Env {
  return {
    ENV: 'dev',
    PAGES_URL: 'http://local',
    API_URL: 'http://local',
    JWT_SECRET: TEST_JWT_SECRET,
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
  return `qesto_session=${await signJwt({ sub: userId, email: `${userId}@example.com` }, TEST_JWT_SECRET, 3600)}`
}

function seed(db: D1Mock, plan: 'free' | 'starter' | 'team', status: 'draft' | 'live' = 'draft', mode = 'reflection') {
  db.users.set(USER_ID, {
    id: USER_ID,
    email: `${USER_ID}@example.com`,
    display_name: 'Host',
    plan,
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

describe('POST /api/sessions/:id/deliberate/config', () => {
  it('flips a DRAFT session into deliberate mode on the Team plan', async () => {
    const db = new D1Mock()
    seed(db, 'team')
    const res = await req(makeEnv(db), 'config', 'POST', await cookie(), {})
    expect(res.status).toBe(200)
    expect(db.sessions.get('sess_1')?.session_mode).toBe('deliberate')
  })

  it('blocks non-Team plans with feature_not_available', async () => {
    const db = new D1Mock()
    seed(db, 'starter')
    const res = await req(makeEnv(db), 'config', 'POST', await cookie(), {})
    expect(res.status).toBe(403)
    const body = (await res.json()) as { error: { details: { feature: string } } }
    expect(body.error.details.feature).toBe('verifiableVoting')
  })

  it('rejects configuring a non-draft session', async () => {
    const db = new D1Mock()
    seed(db, 'team', 'live')
    const res = await req(makeEnv(db), 'config', 'POST', await cookie(), {})
    expect(res.status).toBe(409)
  })
})

describe('DELIBERATE cast → receipt → verify → tally', () => {
  it('casts a ballot and returns a coercion-resistant receipt', async () => {
    const db = new D1Mock()
    seed(db, 'team', 'live', 'deliberate')
    const res = await req(makeEnv(db), 'cast', 'POST', await cookie(), { choice: 'approve' })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { data: { receipt: { ballotNonce: string; commitment: string; choice: string; leafIndex: number } } }
    expect(body.data.receipt.choice).toBe('approve')
    expect(body.data.receipt.commitment).toMatch(/^[0-9a-f]{64}$/)
    expect(body.data.receipt.ballotNonce).toMatch(/^[0-9a-f]{32}$/)
    expect(body.data.receipt.leafIndex).toBe(0)
  })

  it('enforces one ballot per voter (no vote-changing → coercion-resistant)', async () => {
    const db = new D1Mock()
    seed(db, 'team', 'live', 'deliberate')
    const first = await req(makeEnv(db), 'cast', 'POST', await cookie(), { choice: 'approve' })
    expect(first.status).toBe(200)
    const second = await req(makeEnv(db), 'cast', 'POST', await cookie(), { choice: 'reject' })
    expect(second.status).toBe(409)
    const body = (await second.json()) as { error: { code: string } }
    expect(body.error.code).toBe('already_voted')
  })

  it('rejects casting when voting is not open', async () => {
    const db = new D1Mock()
    seed(db, 'team', 'draft', 'deliberate')
    const res = await req(makeEnv(db), 'cast', 'POST', await cookie(), { choice: 'approve' })
    expect(res.status).toBe(409)
  })

  it('verifies a valid receipt against the ledger', async () => {
    const db = new D1Mock()
    seed(db, 'team', 'live', 'deliberate')
    const cast = await req(makeEnv(db), 'cast', 'POST', await cookie(), { choice: 'approve' })
    const { data } = (await cast.json()) as { data: { receipt: { ballotNonce: string; commitment: string; choice: string } } }
    const verify = await req(makeEnv(db), 'verify', 'POST', await cookie(), {
      ballotNonce: data.receipt.ballotNonce,
      commitment: data.receipt.commitment,
      choice: data.receipt.choice,
    })
    expect(verify.status).toBe(200)
    const vbody = (await verify.json()) as { data: { verified: boolean; inLedger: boolean; commitmentValid: boolean } }
    expect(vbody.data.verified).toBe(true)
    expect(vbody.data.inLedger).toBe(true)
    expect(vbody.data.commitmentValid).toBe(true)
  })

  it('fails verification for a tampered choice (commitment mismatch)', async () => {
    const db = new D1Mock()
    seed(db, 'team', 'live', 'deliberate')
    const cast = await req(makeEnv(db), 'cast', 'POST', await cookie(), { choice: 'approve' })
    const { data } = (await cast.json()) as { data: { receipt: { ballotNonce: string; commitment: string } } }
    const verify = await req(makeEnv(db), 'verify', 'POST', await cookie(), {
      ballotNonce: data.receipt.ballotNonce,
      commitment: data.receipt.commitment,
      choice: 'reject', // attacker claims a different choice
    })
    const vbody = (await verify.json()) as { data: { verified: boolean; reason: string } }
    expect(vbody.data.verified).toBe(false)
    expect(vbody.data.reason).toBe('commitment mismatch')
  })

  it('produces a tally whose commitment count equals the vote count with a Merkle root', async () => {
    const db = new D1Mock()
    seed(db, 'team', 'live', 'deliberate')
    // three distinct voters
    await req(makeEnv(db), 'cast', 'POST', await cookie('voter_a'), { choice: 'approve' })
    await req(makeEnv(db), 'cast', 'POST', await cookie('voter_b'), { choice: 'reject' })
    await req(makeEnv(db), 'cast', 'POST', await cookie('voter_c'), { choice: 'approve' })
    const res = await req(makeEnv(db), 'tally', 'GET', await cookie())
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      data: { voteCount: number; commitmentCount: number; tally: Record<string, number>; merkleRoot: string; ledger: unknown[] }
    }
    expect(body.data.voteCount).toBe(3)
    expect(body.data.commitmentCount).toBe(3)
    expect(body.data.tally).toMatchObject({ approve: 2, reject: 1 })
    expect(body.data.merkleRoot).toMatch(/^[0-9a-f]{64}$/)
    // Ledger is anonymous: no voter_hash exposed.
    expect(JSON.stringify(body.data.ledger)).not.toContain('voter_hash')
  })

  it('requires authentication to cast', async () => {
    const db = new D1Mock()
    seed(db, 'team', 'live', 'deliberate')
    const res = await req(makeEnv(db), 'cast', 'POST', null, { choice: 'approve' })
    expect(res.status).toBe(401)
  })
})
