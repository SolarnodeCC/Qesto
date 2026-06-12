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
  computeCommitment,
  merkleRoot,
  timingSafeEqualHex,
} from '../lib/deliberate-crypto'
import {
  appendBallot,
  loadLedger,
  aggregateLedger,
  projectLedger,
} from '../lib/deliberate-ledger'
import { rateLimit } from '../lib/rate-limit'
import type { Env, Session } from '../types'
import type { ParentApp } from './parent-app'

// M-2 (S87): rate-limit the cast/verify/observe hot paths. `verify` and
// `observe` recompute the full Merkle root per call (DoS at ≥1000 concurrent),
// and `cast` mutates the append-only ledger — a per-caller fixed-window budget
// is the codebase's existing KV-backed limiter (`lib/rate-limit.ts`), not a new
// mechanism. Budgets are generous enough for honest voters but cap abuse.
const CAST_RATE = { max: 10, windowSeconds: 60, prefix: 'deliberate_cast' } as const
const VERIFY_RATE = { max: 30, windowSeconds: 60, prefix: 'deliberate_verify' } as const
const OBSERVE_RATE = { max: 30, windowSeconds: 60, prefix: 'deliberate_observe' } as const

/** Per-voter when authenticated, else per-IP — stable rate-limit identity. */
function rateLimitKey(c: { req: { header: (n: string) => string | undefined } }, userSub?: string): string {
  if (userSub) return `u:${userSub}`
  return `ip:${c.req.header('cf-connecting-ip') ?? 'anonymous'}`
}

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

    // M-2: per-voter rate limit on the ledger-mutating path.
    const rl = await rateLimit(c.env.ACTIONS_KV, rateLimitKey(c, user.sub), CAST_RATE)
    if (!rl.allowed) {
      return c.json({ ok: false, error: { code: 'rate_limited', message: 'Too many ballots — please slow down' }, trace_id }, 429)
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

    // Shared append-only ledger write (same path the LIVE WS board uses).
    // M-1: fold the optional server salt into the anonymous voter_hash.
    const result = await appendBallot(
      c.env.DB,
      { id: s.id, code: s.code, created_at: s.created_at },
      user.sub,
      parsed.data.choice,
      c.env.DELIBERATE_VOTER_SALT,
    )
    if (!result.ok) {
      return c.json({ ok: false, error: { code: result.code, message: result.message }, trace_id }, 409)
    }

    await recordAuditEvent(c, {
      action: 'deliberate.ballot.cast',
      subject_type: 'session',
      subject_id: id,
      after_snapshot: { leaf_index: result.receipt.leafIndex }, // no choice/voter — keep audit anonymous too
    })

    // Coercion-resistant receipt: reveals only this voter's own choice.
    return c.json({
      ok: true,
      data: {
        receipt: {
          ...result.receipt,
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

    // M-2: verify recomputes the full Merkle root per call — rate-limit per IP.
    const rl = await rateLimit(c.env.ACTIONS_KV, rateLimitKey(c), VERIFY_RATE)
    if (!rl.allowed) {
      return c.json({ ok: false, error: { code: 'rate_limited', message: 'Too many verification requests — please slow down' }, trace_id }, 429)
    }

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
    const agg = await aggregateLedger(ledger)

    return c.json({
      ok: true,
      data: {
        sessionId: id,
        voteCount: agg.voteCount,
        commitmentCount: agg.voteCount,
        tally: agg.tally,
        merkleRoot: agg.merkleRoot,
        // Anonymous, re-tallyable ledger: no voter_hash, no user id.
        ledger: projectLedger(ledger),
      },
      trace_id,
    })
  })

  parent.route('/api', app)
  mountDeliberateObserveRoute(parent)
}

/**
 * DELIBERATE-RETALLY-01 (resolves M-3, ADR-0049): PUBLIC observer re-tally
 * surface. ADR-0049 promises any third-party observer can independently
 * recompute the tally + Merkle root WITHOUT trusting the host or the Qesto
 * server. The owner-gated `/tally` cannot satisfy that, so this endpoint serves
 * the SAME anonymous projection with NO owner auth and NO identity:
 *
 *   GET /api/sessions/:id/deliberate/observe
 *     → { voteCount, tally, merkleRoot, ledger:[{leafIndex,ballotNonce,commitment,choice}] }
 *
 * Anonymity invariant: never exposes voter_hash, user id, or any per-voter link
 * — exactly the projection the owner `/tally` returns. It only serves sessions
 * actually in `session_mode='deliberate'` (404 otherwise) so it cannot be used
 * to probe non-deliberate sessions. Rate-limited (M-2) per IP because each call
 * recomputes the full Merkle root.
 */
function mountDeliberateObserveRoute(parent: ParentApp) {
  const pub = new Hono<{ Bindings: Env }>()

  pub.get('/sessions/:id/deliberate/observe', async (c) => {
    const id = c.req.param('id')

    const rl = await rateLimit(c.env.ACTIONS_KV, rateLimitKey(c), OBSERVE_RATE)
    if (!rl.allowed) {
      return c.json({ ok: false, error: { code: 'rate_limited', message: 'Too many requests — please slow down' } }, 429)
    }

    const s = await sessionForBallot(c.env.DB, id)
    if (!s || s.session_mode !== 'deliberate') {
      // Fail the same way for missing and non-deliberate so observers cannot
      // distinguish a non-existent session from a non-governance one.
      return c.json({ ok: false, error: { code: 'not_found', message: 'Deliberate session not found' } }, 404)
    }

    const ledger = await loadLedger(c.env.DB, id)
    const agg = await aggregateLedger(ledger)

    return c.json({
      ok: true,
      data: {
        sessionId: id,
        voteCount: agg.voteCount,
        commitmentCount: agg.voteCount,
        tally: agg.tally,
        merkleRoot: agg.merkleRoot,
        // Anonymous, re-tallyable ledger — identical projection to owner /tally.
        ledger: projectLedger(ledger),
      },
    })
  })

  parent.route('/api', pub)
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
