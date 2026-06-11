// DELIBERATE-RECEIPT-01 (ADR-0049) — verifiable governance voting primitives.
//
// Design goals (see ADR-0049):
//  1. Coercion-resistant receipt — a voter's receipt reveals only their OWN
//     choice; the published ledger reveals nothing about who cast which ballot.
//  2. Tamper-evident tally — commitments form a Merkle tree; any observer can
//     recompute the root from the public ledger and confirm vote count ==
//     commitment count. A single altered commitment changes the root.
//  3. Erasure-durable verification — the ledger holds no user id, so a voter can
//     still verify their receipt after deleting their account.
//
// No external dependencies, Workers-AI-only platform: WebCrypto SubtleCrypto
// (SHA-256) + crypto.getRandomValues only. "Verifiable" here means
// independently re-tallyable, NOT blockchain (out of scope per the roadmap).

const TE = new TextEncoder()

/** Lowercase hex SHA-256 of a UTF-8 string. */
export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', TE.encode(input))
  return hex(new Uint8Array(digest))
}

function hex(bytes: Uint8Array): string {
  let out = ''
  for (const b of bytes) out += b.toString(16).padStart(2, '0')
  return out
}

/** 128-bit cryptographically-random ballot nonce as 32 hex chars. */
export function generateBallotNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return hex(bytes)
}

/**
 * Stable, public fingerprint binding a commitment to one specific session.
 * Prevents a commitment minted in session A from verifying against session B
 * (cross-session replay). Derived only from immutable session facts.
 */
export async function sessionFingerprint(
  sessionId: string,
  code: string,
  createdAt: number,
): Promise<string> {
  return sha256Hex(`qesto.deliberate.v1:${sessionId}:${code}:${createdAt}`)
}

/**
 * Coercion-resistant vote commitment. Without the ballot nonce the commitment
 * leaks nothing about `choice` (the nonce is a 128-bit blinding factor), so the
 * published ledger can carry the commitment without exposing the voter.
 */
export async function computeCommitment(
  fingerprint: string,
  ballotNonce: string,
  choice: string,
): Promise<string> {
  return sha256Hex(`${fingerprint}:${ballotNonce}:${choice}`)
}

/**
 * Salted, anonymous one-ballot dedup key. NOT a user id — derived from the
 * voter identity hash plus the session fingerprint so the same person yields
 * different hashes across sessions (unlinkable) and account deletion never
 * orphans the ledger.
 */
export async function voterBallotHash(
  fingerprint: string,
  voterIdentity: string,
): Promise<string> {
  return (await sha256Hex(`ballot:${fingerprint}:${voterIdentity}`)).slice(0, 32)
}

// ── Merkle tree over sorted commitment leaves ────────────────────────────────
//
// Leaves are sorted so the root is a deterministic function of the SET of
// commitments (independent of insertion order / ledger pagination). An odd node
// is promoted (duplicated) — standard, and documented for re-tally tooling.

async function hashPair(left: string, right: string): Promise<string> {
  return sha256Hex(`${left}${right}`)
}

/** Merkle root of the commitment set. Empty set → 64 zeros (the "no votes" root). */
export async function merkleRoot(commitments: string[]): Promise<string> {
  if (commitments.length === 0) return '0'.repeat(64)
  let level = [...commitments].sort()
  while (level.length > 1) {
    const next: string[] = []
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i]
      const right = i + 1 < level.length ? level[i + 1] : level[i] // promote odd
      next.push(await hashPair(left, right))
    }
    level = next
  }
  return level[0]
}

export type ReceiptVerification = {
  /** Re-derived commitment matches the provided commitment. */
  commitmentValid: boolean
  /** The commitment exists in the published ledger for this session. */
  inLedger: boolean
  /** Constant-time match against the ledger-stored commitment. */
  ledgerCommitmentMatch: boolean
}

/**
 * Constant-time string comparison (length-leaking only — acceptable for
 * fixed-width hex digests). Used so verification can't be timing-probed to
 * forge a commitment.
 */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}
