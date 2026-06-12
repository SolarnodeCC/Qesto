/**
 * DELIBERATE shared ledger service (ADR-0049).
 *
 * Single source of the append-only commitment-write + anonymous projection so
 * the REST surface (`routes/deliberate-sessions.ts`) and the LIVE WebSocket
 * board (`lib/session-room-deliberate-handler.ts`, DELIBERATE-GA-01) write the
 * SAME `deliberate_ballots` table the SAME way. Both paths MUST stay consistent:
 * one-ballot-per-voter (UNIQUE conflict → `already_voted`, never overwrite),
 * leaf_index = current ledger length, no identity ever leaving the ledger.
 *
 * Pure-ish: takes a `D1Database` + the pure crypto primitives; no Hono `c`, no
 * DO `ctx`, so it is callable from a Pages Function and a Durable Object alike
 * and is unit-testable in isolation.
 */
import {
  sessionFingerprint,
  generateBallotNonce,
  computeCommitment,
  voterBallotHash,
  merkleRoot,
} from './deliberate-crypto'

/** One stored ledger row, anonymous projection (no voter_hash, no user id). */
export type LedgerRow = {
  ballot_nonce: string
  commitment: string
  choice: string
  leaf_index: number
}

/** Coercion-resistant receipt — reveals only the casting voter's own choice. */
export type DeliberateReceipt = {
  sessionId: string
  sessionFingerprint: string
  ballotNonce: string
  commitment: string
  choice: string
  leafIndex: number
  issuedAt: number
}

/** Anonymous aggregate projection broadcast to the whole room / served to observers. */
export type DeliberateAggregate = {
  voteCount: number
  tally: Record<string, number>
  merkleRoot: string
}

export type CastResult =
  | { ok: true; receipt: DeliberateReceipt }
  | { ok: false; code: 'already_voted'; message: string }

/** Immutable session facts needed to bind a ballot to one specific session. */
export type BallotSession = {
  id: string
  code: string
  created_at: number
}

/** Ordered ledger of (nonce, commitment, choice) — anonymous, observer-downloadable. */
export async function loadLedger(db: D1Database, sessionId: string): Promise<LedgerRow[]> {
  const res = await db
    .prepare(
      `SELECT ballot_nonce, commitment, choice, leaf_index
         FROM deliberate_ballots WHERE session_id = ?1 ORDER BY leaf_index ASC`,
    )
    .bind(sessionId)
    .all<LedgerRow>()
  return res.results ?? []
}

/** Per-choice counts + recomputed Merkle root over the anonymous commitment set. */
export async function aggregateLedger(ledger: LedgerRow[]): Promise<DeliberateAggregate> {
  const tally: Record<string, number> = {}
  for (const r of ledger) tally[r.choice] = (tally[r.choice] ?? 0) + 1
  const root = await merkleRoot(ledger.map((r) => r.commitment))
  return { voteCount: ledger.length, tally, merkleRoot: root }
}

/** Anonymous re-tallyable ledger projection — never carries voter_hash / user id. */
export function projectLedger(ledger: LedgerRow[]): Array<{
  leafIndex: number
  ballotNonce: string
  commitment: string
  choice: string
}> {
  return ledger.map((r) => ({
    leafIndex: r.leaf_index,
    ballotNonce: r.ballot_nonce,
    commitment: r.commitment,
    choice: r.choice,
  }))
}

/**
 * Append one ballot to the anonymous commitment ledger and return a receipt.
 *
 * Reuses the EXACT crypto path the REST cast established: sessionFingerprint →
 * generateBallotNonce → computeCommitment → voterBallotHash (with the optional
 * M-1 server salt) → append-only insert with `leaf_index = current ledger
 * length`. UNIQUE(session_id, voter_hash) enforces one ballot per voter — a
 * re-cast surfaces as a conflict (`already_voted`), NEVER a silent overwrite.
 *
 * The returned receipt is the voter's secret-bearing artifact (only place the
 * nonce is surfaced); the broadcastable aggregate is computed separately so the
 * room only ever sees the anonymous tally + root.
 */
export async function appendBallot(
  db: D1Database,
  session: BallotSession,
  voterIdentity: string,
  choice: string,
  voterSalt: string | undefined,
): Promise<CastResult> {
  const fingerprint = await sessionFingerprint(session.id, session.code, session.created_at)
  const ballotNonce = generateBallotNonce()
  const commitment = await computeCommitment(fingerprint, ballotNonce, choice)
  const voterHash = await voterBallotHash(fingerprint, voterIdentity, voterSalt)

  const count = await db
    .prepare(`SELECT COUNT(*) AS n FROM deliberate_ballots WHERE session_id = ?1`)
    .bind(session.id)
    .first<{ n: number }>()
  const leafIndex = count?.n ?? 0

  try {
    await db
      .prepare(
        `INSERT INTO deliberate_ballots (id, session_id, ballot_nonce, commitment, choice, voter_hash, leaf_index, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
      )
      .bind(crypto.randomUUID(), session.id, ballotNonce, commitment, choice, voterHash, leafIndex, Date.now())
      .run()
  } catch {
    // UNIQUE(session_id, voter_hash) violation → this voter already cast a ballot.
    return { ok: false, code: 'already_voted', message: 'A ballot was already cast for this session' }
  }

  return {
    ok: true,
    receipt: {
      sessionId: session.id,
      sessionFingerprint: fingerprint,
      ballotNonce,
      commitment,
      choice,
      leafIndex,
      issuedAt: Date.now(),
    },
  }
}
