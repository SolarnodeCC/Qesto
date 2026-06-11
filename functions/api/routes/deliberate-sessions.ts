/**
 * DELIBERATE-RECEIPT-01 (ADR-0049) — verifiable governance voting.
 *
 * REST foundation for the DELIBERATE governance tier (the LIVE board itself
 * graduates to the SessionRoom WebSocket in DELIBERATE-GA-01, S87). This surface
 * owns the cryptographic spine: an append-only, anonymous commitment ledger with
 * coercion-resistant receipts and a Merkle-root tally any observer can re-verify.
 *
 *   POST /api/sessions/:id/deliberate/config  — mark session DELIBERATE (DRAFT, Team)
 *   GET  /api/sessions/:id/deliberate/config  — owner view + live ballot count
 *   POST /api/sessions/:id/deliberate/cast    — cast a ballot, return a receipt (LIVE)
 *   POST /api/sessions/:id/deliberate/verify  — re-verify a receipt against the ledger
 *   GET  /api/sessions/:id/deliberate/tally   — tally + commitment ledger + Merkle root
 */
import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import { planMiddleware, type PlanVariables } from '../middleware/plan'
import { featureAllowed, denyFeature } from '../lib/entitlements'
import { fetchSession } from './sessions/shared'
import { requireFound, requireDraft } from '../lib/session-lifecycle'
import { recordAuditEvent } from '../lib/audit'
import {
  sessionFingerprint,
  generateBallotNonce,
  computeCommitment,
  voterBallotHash,
  merkleRoot,
  timingSafeEqualHex,
} from '../lib/deliberate-crypto'
import type { Env, Session } from '../types'
import type { ParentApp } from './parent-app'

type Vars = AuthVariables & PlanVariables

const CastSchema = z.object({
  // Public tally bucket. Bounded to keep the ledger/tally legible and to stop a
  // single voter inflating the commitment set with arbitrary-length payloads.
  choice: z.string().min(1).max(200),
})

const VerifySchema = z.object({
  ballotNonce: z.string().min(8).max(64),
  commitment: z.string().length(64),
  choice: z.string().min(1).max(200),
})

type BallotRow = {
  ballot_nonce: string
  commitment: string
  choice: string
  leaf_index: number
}

/** Ordered ledger of (nonce, commitment, choice) — anonymous, observer-downloadable. */
async function loadLedger(db: D1Database, sessionId: string): Promise<BallotRow[]> {
  const res = await db
    .prepare(
      `SELECT ballot_nonce, commitment, choice, leaf_index
         FROM deliberate_ballots WHERE session_id = ?1 ORDER BY leaf_index ASC`,
    )
    .bind(sessionId)
    .all<BallotRow>()
  return res.results ?? []
}

export function mountDeliberateSessionRoutes(parent: ParentApp) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()
  app.use('*', authMiddleware)
  app.use('*', planMiddleware)

  // ── Configure: flip a DRAFT session into DELIBERATE mode (Team tier) ────────
  app.post('/sessions/:id/deliberate/config', async (c) => {
    const trace_id = c.get('trace_id')
    const user = c.get('user')
    const id = c.req.param('id')

    if (!featureAllowed(c.get('planQuotas'), 'verifiableVoting')) {
      return c.json({ ok: false, error: denyFeature(c.get('plan'), 'verifiableVoting'), trace_id }, 403)
    }

    const loaded = requireFound(await fetchSession(c.env.DB, id, user.sub))
    if (!loaded.ok) {
      return c.json({ ok: false, error: { code: loaded.error.code, message: loaded.error.message }, trace_id }, loaded.error.status)
    }
    const draft = requireDraft(loaded.session, 'deliberate_config')
    if (!draft.ok) {
      return c.json({ ok: false, error: { code: draft.error.code, message: draft.error.message }, trace_id }, draft.error.status)
    }

    await c.env.DB.prepare(`UPDATE sessions SET session_mode = 'deliberate' WHERE id = ?1 AND owner_id = ?2`)
      .bind(id, user.sub)
      .run()

    await recordAuditEvent(c, {
      action: 'deliberate.config',
      subject_type: 'session',
      subject_id: id,
      after_snapshot: { session_mode: 'deliberate' },
    })

    return c.json({ ok: true, data: { sessionId: id, sessionMode: 'deliberate' }, trace_id })
  })

  // ── Owner config view + live ballot count ──────────────────────────────────
  app.get('/sessions/:id/deliberate/config', async (c) => {
    const trace_id = c.get('trace_id')
    const user = c.get('user')
    const id = c.req.param('id')
    const loaded = requireFound(await fetchSession(c.env.DB, id, user.sub))
    if (!loaded.ok) {
      return c.json({ ok: false, error: { code: loaded.error.code, message: loaded.error.message }, trace_id }, loaded.error.status)
    }
    const s = loaded.session
    const count = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM deliberate_ballots WHERE session_id = ?1`)
      .bind(id)
      .first<{ n: number }>()
    return c.json({
      ok: true,
      data: {
        sessionId: s.id,
        sessionMode: s.session_mode,
        status: s.status,
        deliberateReady: s.session_mode === 'deliberate',
        ballotCount: count?.n ?? 0,
      },
      trace_id,
    })
  })

  // ── Cast a ballot → receipt ────────────────────────────────────────────────
  app.post('/sessions/:id/deliberate/cast', async (c) => {
    const trace_id = c.get('trace_id')
    const user = c.get('user')
    const id = c.req.param('id')

    // No caller-plan gate here: a session can only be in 'deliberate' mode if a
    // Team-tier host enabled it via /config, so the mode itself is the
    // entitlement. Participants vote without needing their own subscription.
    const parsed = CastSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return c.json({ ok: false, error: { code: 'validation', message: 'Invalid ballot' }, trace_id }, 400)
    }

    const s = await sessionForBallot(c.env.DB, id)
    if (!s) {
      return c.json({ ok: false, error: { code: 'not_found', message: 'Deliberate session not found' }, trace_id }, 404)
    }
    if (s.session_mode !== 'deliberate') {
      return c.json({ ok: false, error: { code: 'not_deliberate', message: 'Session is not a deliberate vote' }, trace_id }, 409)
    }
    if (s.status !== 'live') {
      return c.json({ ok: false, error: { code: 'not_open', message: 'Voting is not open' }, trace_id }, 409)
    }

    const fingerprint = await sessionFingerprint(s.id, s.code, s.created_at)
    const ballotNonce = generateBallotNonce()
    const commitment = await computeCommitment(fingerprint, ballotNonce, parsed.data.choice)
    const voterHash = await voterBallotHash(fingerprint, user.sub)

    // Append-only insert; leaf_index = current ledger length. UNIQUE(session,
    // voter_hash) enforces one ballot per voter — a re-cast surfaces as a
    // conflict, never a silent overwrite (coercion-resistance: no vote changing).
    const count = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM deliberate_ballots WHERE session_id = ?1`)
      .bind(id)
      .first<{ n: number }>()
    const leafIndex = count?.n ?? 0

    try {
      await c.env.DB.prepare(
        `INSERT INTO deliberate_ballots (id, session_id, ballot_nonce, commitment, choice, voter_hash, leaf_index, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
      )
        .bind(crypto.randomUUID(), id, ballotNonce, commitment, parsed.data.choice, voterHash, leafIndex, Date.now())
        .run()
    } catch {
      // UNIQUE violation → this voter already cast a ballot.
      return c.json({ ok: false, error: { code: 'already_voted', message: 'A ballot was already cast for this session' }, trace_id }, 409)
    }

    await recordAuditEvent(c, {
      action: 'deliberate.ballot.cast',
      subject_type: 'session',
      subject_id: id,
      after_snapshot: { leaf_index: leafIndex }, // no choice/voter — keep audit anonymous too
    })

    // Coercion-resistant receipt: reveals only this voter's own choice.
    return c.json({
      ok: true,
      data: {
        receipt: {
          sessionId: id,
          sessionFingerprint: fingerprint,
          ballotNonce,
          commitment,
          choice: parsed.data.choice,
          leafIndex,
          issuedAt: Date.now(),
          verifyPath: `/api/sessions/${id}/deliberate/verify`,
        },
      },
      trace_id,
    })
  })

  // ── Verify a receipt against the ledger (works after account deletion) ──────
  app.post('/sessions/:id/deliberate/verify', async (c) => {
    const trace_id = c.get('trace_id')
    const id = c.req.param('id')

    const parsed = VerifySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return c.json({ ok: false, error: { code: 'validation', message: 'Invalid receipt' }, trace_id }, 400)
    }
    const { ballotNonce, commitment, choice } = parsed.data

    const s = await sessionForBallot(c.env.DB, id)
    if (!s) {
      return c.json({ ok: false, error: { code: 'not_found', message: 'Deliberate session not found' }, trace_id }, 404)
    }

    const fingerprint = await sessionFingerprint(s.id, s.code, s.created_at)
    // Re-derive the commitment from the public fingerprint + the voter's secret
    // nonce + claimed choice. A forged or altered receipt cannot reproduce it.
    const recomputed = await computeCommitment(fingerprint, ballotNonce, choice)
    const commitmentValid = timingSafeEqualHex(recomputed, commitment)

    const ledger = await loadLedger(c.env.DB, id)
    const row = ledger.find((r) => r.ballot_nonce === ballotNonce)
    const inLedger = !!row
    const ledgerCommitmentMatch = !!row && timingSafeEqualHex(row.commitment, commitment)
    const root = await merkleRoot(ledger.map((r) => r.commitment))

    const verified = commitmentValid && inLedger && ledgerCommitmentMatch

    // Tamper detection → forensics alert (SEC-VOTE-INTEGRITY-01). Two distinct
    // mutation shapes must both raise the alert:
    //  (a) the receipt's commitment no longer re-derives from (fingerprint,
    //      nonce, choice) — a forged/altered receipt OR a choice substitution.
    //  (b) the receipt re-derives correctly (commitmentValid) but the STORED
    //      ledger commitment for that nonce differs — i.e. the ledger row itself
    //      was mutated after the voter cast. (a) alone misses (b), yet (b) is the
    //      core "tampered ledger row" threat Pentest #5 exercises and the case
    //      that silently shifts the published Merkle root.
    const ledgerRowTampered = inLedger && commitmentValid && !ledgerCommitmentMatch
    if (inLedger && (!commitmentValid || ledgerRowTampered)) {
      await recordAuditEvent(c, {
        action: 'deliberate.verify.mismatch',
        subject_type: 'session',
        subject_id: id,
        after_snapshot: {
          ballotNonce,
          reason: ledgerRowTampered ? 'ledger_row_tampered' : 'commitment_mismatch',
        },
      })
    }

    return c.json({
      ok: true,
      data: {
        verified,
        commitmentValid,
        inLedger,
        ledgerCommitmentMatch,
        leafIndex: row?.leaf_index ?? null,
        merkleRoot: root,
        reason: verified ? null : !commitmentValid ? 'commitment mismatch' : !inLedger ? 'not in ledger' : 'ledger mismatch',
      },
      trace_id,
    })
  })

  // ── Tally + commitment ledger + Merkle root (owner-downloadable evidence) ───
  app.get('/sessions/:id/deliberate/tally', async (c) => {
    const trace_id = c.get('trace_id')
    const user = c.get('user')
    const id = c.req.param('id')

    const loaded = requireFound(await fetchSession(c.env.DB, id, user.sub))
    if (!loaded.ok) {
      return c.json({ ok: false, error: { code: loaded.error.code, message: loaded.error.message }, trace_id }, loaded.error.status)
    }

    const ledger = await loadLedger(c.env.DB, id)
    const tally: Record<string, number> = {}
    for (const r of ledger) tally[r.choice] = (tally[r.choice] ?? 0) + 1
    const root = await merkleRoot(ledger.map((r) => r.commitment))

    return c.json({
      ok: true,
      data: {
        sessionId: id,
        voteCount: ledger.length,
        commitmentCount: ledger.length,
        tally,
        merkleRoot: root,
        // Anonymous, re-tallyable ledger: no voter_hash, no user id.
        ledger: ledger.map((r) => ({ leafIndex: r.leaf_index, ballotNonce: r.ballot_nonce, commitment: r.commitment, choice: r.choice })),
      },
      trace_id,
    })
  })

  parent.route('/api', app)
}

/**
 * Load a session for a ballot/verify without an owner constraint — voters and
 * observers are not the session owner. Only immutable, public fields are read.
 */
async function sessionForBallot(db: D1Database, id: string): Promise<Pick<Session, 'id' | 'code' | 'created_at' | 'session_mode' | 'status'> | null> {
  return db
    .prepare(`SELECT id, code, created_at, session_mode, status FROM sessions WHERE id = ?1`)
    .bind(id)
    .first<Pick<Session, 'id' | 'code' | 'created_at' | 'session_mode' | 'status'>>()
}
