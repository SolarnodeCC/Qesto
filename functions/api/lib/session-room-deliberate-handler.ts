/**
 * session-room-deliberate-handler.ts
 * DeliberateHandler — LIVE verifiable-governance board over the SessionRoom WS
 * (DELIBERATE-GA-01, ADR-0049). Graduates DELIBERATE from REST-only to a live
 * board: a participant casts over the WebSocket, gets a coercion-resistant
 * receipt back on ONLY their own socket, and the whole room sees the ANONYMOUS
 * aggregate tally + Merkle root update in realtime.
 *
 * Consistency invariant: this path writes the SAME append-only `deliberate_ballots`
 * ledger, the SAME way, as the REST `cast` — via the shared `appendBallot`
 * service (`lib/deliberate-ledger.ts`). One-ballot-per-voter
 * (UNIQUE(session, voter_hash) → `already_voted`, never overwrite); the LIVE WS
 * and REST surfaces stay byte-consistent.
 *
 * Anonymity invariant (the core ADR-0049 guarantee): the per-caster receipt
 * carries the voter's own nonce/choice; the BROADCAST carries ONLY the
 * aggregate tally + voteCount + merkleRoot. voter_hash, user id, and per-ballot
 * choice attribution NEVER leave this handler in a broadcast.
 */
import type { Env } from '../types'
import { serverMsg, errorMessage } from './session-room-messages'
import type { DurableContextLike } from './session-room-context'
import type { Attachment } from './session-room-types'
import { newSubmitBucket, consumeSubmitToken, type TokenBucket } from './board-submit-rate'
import {
  appendBallot,
  loadLedger,
  aggregateLedger,
  type BallotSession,
} from './deliberate-ledger'

const DELIBERATE_KEYS = {
  submitRate: (voterId: string) => `deliberate:submitrate:${voterId}`,
}

type Meta = { sessionId: string; sessionMode?: string }

export class DeliberateHandler {
  constructor(
    private readonly ctx: DurableContextLike,
    private readonly env: Env,
  ) {}

  private async getMeta(): Promise<Meta | null> {
    return (await this.ctx.storage.get<Meta>('meta')) ?? null
  }

  /**
   * Load the immutable session facts the commitment scheme binds to. Read from
   * D1 (NOT the DO meta's `startedAt`) so the fingerprint matches the REST path
   * exactly — both derive from `sessionFingerprint(id, code, created_at)`.
   */
  private async loadSession(sessionId: string): Promise<(BallotSession & { session_mode: string; status: string }) | null> {
    return this.env.DB.prepare(
      `SELECT id, code, created_at, session_mode, status FROM sessions WHERE id = ?1`,
    )
      .bind(sessionId)
      .first<BallotSession & { session_mode: string; status: string }>()
  }

  private async consumeSubmitRate(voterId: string): Promise<boolean> {
    const now = Date.now()
    const key = DELIBERATE_KEYS.submitRate(voterId)
    const bucket = (await this.ctx.storage.get<TokenBucket>(key)) ?? newSubmitBucket(now)
    const consumed = consumeSubmitToken(bucket, now)
    await this.ctx.storage.put(key, consumed.bucket)
    return consumed.ok
  }

  /** Compute + broadcast ONLY the anonymous aggregate (tally + root) to the room. */
  private async broadcastTally(sessionId: string): Promise<void> {
    const ledger = await loadLedger(this.env.DB, sessionId)
    const agg = await aggregateLedger(ledger)
    const frame = serverMsg({
      type: 'deliberate_tally',
      data: { tally: agg.tally, voteCount: agg.voteCount, merkleRoot: agg.merkleRoot },
      timestamp: Date.now(),
    })
    for (const s of this.ctx.getWebSockets()) {
      try {
        s.send(frame)
      } catch {
        /* ignore */
      }
    }
  }

  /** Send the current anonymous aggregate to a single (re)connecting socket. */
  async sendSnapshot(ws: WebSocket): Promise<void> {
    const meta = await this.getMeta()
    if (!meta?.sessionId) return
    const ledger = await loadLedger(this.env.DB, meta.sessionId)
    const agg = await aggregateLedger(ledger)
    ws.send(
      serverMsg({
        type: 'deliberate_tally',
        data: { tally: agg.tally, voteCount: agg.voteCount, merkleRoot: agg.merkleRoot },
        timestamp: Date.now(),
      }),
    )
  }

  async handleCast(ws: WebSocket, att: Attachment, data: { choice: string }): Promise<void> {
    const meta = await this.getMeta()
    if (!meta?.sessionId) {
      ws.send(errorMessage('not_found', 'Session not found'))
      return
    }
    if (meta.sessionMode !== 'deliberate') {
      ws.send(errorMessage('not_deliberate', 'Session is not a deliberate vote'))
      return
    }
    // M-2: per-voter submit-rate on the ledger-mutating WS path (same primitive
    // retro/ideate/townhall boards use).
    if (!(await this.consumeSubmitRate(att.voterId))) {
      ws.send(errorMessage('rate_limited', 'Too many ballots — please slow down'))
      return
    }
    const choice = data.choice.trim()
    if (choice.length < 1 || choice.length > 200) {
      ws.send(errorMessage('validation', 'Invalid ballot'))
      return
    }

    const session = await this.loadSession(meta.sessionId)
    if (!session || session.session_mode !== 'deliberate') {
      ws.send(errorMessage('not_deliberate', 'Session is not a deliberate vote'))
      return
    }
    if (session.status !== 'live') {
      ws.send(errorMessage('not_open', 'Voting is not open'))
      return
    }

    // Shared append-only ledger write (M-1 salt folded in). UNIQUE conflict →
    // already_voted; never an overwrite (coercion-resistance: no vote changing).
    const result = await appendBallot(
      this.env.DB,
      { id: session.id, code: session.code, created_at: session.created_at },
      att.voterId,
      choice,
      this.env.DELIBERATE_VOTER_SALT,
    )
    if (!result.ok) {
      ws.send(errorMessage(result.code, result.message))
      return
    }

    // Coercion-resistant receipt → ONLY the casting client. Never broadcast.
    ws.send(
      serverMsg({
        type: 'deliberate_receipt',
        data: { receipt: result.receipt },
        timestamp: Date.now(),
      }),
    )

    // Anonymous aggregate → the whole room. No identity, no per-ballot attribution.
    await this.broadcastTally(session.id)
  }
}
